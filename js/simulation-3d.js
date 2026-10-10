/**
 * 3D Simulation Module — Pokemon GO-style view using Three.js
 * Ground: real map tiles · Sky: morning gradient
 */
const CA_Simulation3D = (() => {
    let scene, camera, renderer, controls, animId;
    let poiMixers = [];          // AnimationMixer per POI model
    let poiTemplates = null;     // loaded GLB props (CA_PoiModels.load)
    let startTime = 0;
    let playerGroup = null;
    let playerPos   = { x: 0, z: 0 };
    let lastFrameTime = 0;
    let joystickState       = { active: false, jx: 0, jy: 0 };
    let zoneRings = [];          // exclusion zone ring meshes (togglable)
    let groundGroup = null;      // map tile meshes (rebuilt when the 3D map layer changes)
    let groundCenter = null;     // { lat, lng } the ground was built around

    // Load a texture — tries crossOrigin img first (works on file:// + HTTPS when server sends CORS *),
    // falls back to fetch→blob (bypasses WebGL cross-origin for non-null origins).
    function fetchTexture(url, onLoad, onError) {
        const loader = new THREE.TextureLoader();
        loader.crossOrigin = 'anonymous';
        loader.load(url, onLoad, undefined, () => {
            fetch(url)
                .then(r => { if (!r.ok) throw r.status; return r.blob(); })
                .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    new THREE.TextureLoader().load(blobUrl, tex => {
                        URL.revokeObjectURL(blobUrl);
                        onLoad(tex);
                    }, undefined, err => {
                        URL.revokeObjectURL(blobUrl);
                        onError && onError(err);
                    });
                })
                .catch(() => onError && onError());
        });
    }

    const TYPE_COLORS = {
        pokestop:    0x007aff,
        gym:         0xff3b30,
        caspot:      0x0bd3cd,
        cagym:       0xaf52de,
        clwayspot:   0xf7931e,
        clgymwayspot:0x34c759,
        powerspot:   0x911042
    };
    const GYM_TYPES = new Set(['gym', 'cagym', 'clgymwayspot']);

    // ── Coordinate helpers ────────────────────────────────────────────────────

    function toXZ(lat, lng, cLat, cLng) {
        const R = 6371000;
        const x = (lng - cLng) * (Math.PI / 180) * R * Math.cos(cLat * Math.PI / 180);
        const z = -(lat - cLat) * (Math.PI / 180) * R;
        return [x, z];
    }

    function haversine(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dL = (lat2 - lat1) * Math.PI / 180;
        const dN = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dN/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ── Map tile helpers ──────────────────────────────────────────────────────

    // Returns { x, y } tile coords for given lat/lng/zoom
    function latLngToTile(lat, lng, zoom) {
        const n = Math.pow(2, zoom);
        const lr = lat * Math.PI / 180;
        return {
            x: Math.floor((lng + 180) / 360 * n),
            y: Math.floor((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n)
        };
    }

    // Latitude of the north edge of tile row tileY at zoom (standard Web Mercator formula)
    function tileEdgeLat(tileY, n) {
        return Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n))) * 180 / Math.PI;
    }

    // OSM standard tiles (CARTO basemaps now require an API key)
    function osmTileUrl(tx, ty, zoom) {
        return `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
    }

    // Esri dark gray canvas only has real tiles up to z16 — callers crop the parent tile
    const ESRI_DARK_MAX_ZOOM = 16;

    // 3D map layer: 'auto' follows the main map's layer, otherwise its own choice
    const SIM3D_LAYER_KEY = 'caWayspotSim3dLayer';

    function getLayer() {
        const own = localStorage.getItem(SIM3D_LAYER_KEY) || 'auto';
        return own === 'auto' ? (localStorage.getItem('caWayspotMapLayer') || 'osm') : own;
    }

    function getTileUrl(tx, ty, zoom, layer) {
        switch (layer) {
            case 'cartodb_dark': {
                const shift = Math.max(0, zoom - ESRI_DARK_MAX_ZOOM);
                return `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${zoom - shift}/${ty >> shift}/${tx >> shift}`;
            }
            case 'mapbox':
                return mapboxTileUrl(zoom, tx, ty);
            case 'esri_sat':
                return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
            // Google tiles send Access-Control-Allow-Origin: *, so they work as WebGL textures
            case 'gmap_street':
                return `https://mt${(tx + ty) % 4}.google.com/vt/lyrs=m&x=${tx}&y=${ty}&z=${zoom}`;
            case 'gmap_sat':
                return `https://mt${(tx + ty) % 4}.google.com/vt/lyrs=y&x=${tx}&y=${ty}&z=${zoom}`;
            // bing → no CORS, fall back to OSM
            default:
                return osmTileUrl(tx, ty, zoom);
        }
    }

    // ── Sky & Sun ─────────────────────────────────────────────────────────────

    function buildSky() {
        // Pokemon GO-style sky: bright cyan-blue, cool, no visible sun disc
        const skyGeo = new THREE.SphereGeometry(580, 16, 10);
        const pos = skyGeo.attributes.position;
        const colors = new Float32Array(pos.count * 3);

        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            const t = (y + 580) / 1160; // 0 = bottom, 1 = zenith
            let r, g, b;
            if (t > 0.5) {
                // Horizon white-blue → zenith medium cyan-blue
                const u = (t - 0.5) * 2;
                r = 0.84 + (0.46 - 0.84) * u;
                g = 0.93 + (0.72 - 0.93) * u;
                b = 0.97 + (0.86 - 0.97) * u;
            } else {
                // Below horizon — pale blue-white (safety net)
                const u = t * 2;
                r = 0.88 + (0.84 - 0.88) * u;
                g = 0.95 + (0.93 - 0.95) * u;
                b = 0.98 + (0.97 - 0.98) * u;
            }
            colors[i * 3 + 0] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }
        skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        scene.add(new THREE.Mesh(
            skyGeo,
            new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
        ));

        // Cool white directional light from high above — no sun disc
        const dirLight = new THREE.DirectionalLight(0xd8eeff, 1.1);
        dirLight.position.set(120, 280, -180);
        scene.add(dirLight);

        // Pokemon GO cool hemisphere: bright sky blue above, soft teal below
        scene.add(new THREE.HemisphereLight(0xb0d8f0, 0x98c8b8, 0.65));
    }

    // ── Map tile ground ───────────────────────────────────────────────────────

    function buildMapGround(cLat, cLng) {
        const ZOOM = 19;
        const n   = Math.pow(2, ZOOM);
        const center = latLngToTile(cLat, cLng, ZOOM);
        const R      = 6371000;
        const cosLat = Math.cos(cLat * Math.PI / 180);

        const layer   = getLayer();
        // Fallback color: matches the map's dominant palette while tiles load
        const fallback = layer === 'cartodb_dark' ? 0x252535
                       : layer === 'mapbox'       ? 0xd4eac0   // Pokemon GO greenish
                       : layer === 'esri_sat' || layer === 'gmap_sat' ? 0x4a5240
                       : layer === 'gmap_street'  ? 0xe8e8e8
                       : 0xddd8c8;

        groundCenter = { lat: cLat, lng: cLng };
        const group = new THREE.Group();
        groundGroup = group;
        scene.add(group);

        // Wide background so sky/horizon never shows below the tile grid
        const bg = new THREE.Mesh(
            new THREE.PlaneGeometry(5000, 5000),
            new THREE.MeshBasicMaterial({ color: fallback })
        );
        bg.rotation.x = -Math.PI / 2;
        bg.position.y = -0.5;
        group.add(bg);

        const RADIUS = 7; // 15 × 15 grid at zoom 19 — ~550m radius, max detail
        const BLEED  = 1; // 1 m overlap on each side to close seams

        for (let dy = -RADIUS; dy <= RADIUS; dy++) {
            for (let dx = -RADIUS; dx <= RADIUS; dx++) {
                const tx = center.x + dx;
                const ty = center.y + dy;

                // Accurate lat/lng bounds using the standard Web Mercator formula
                const northLat = tileEdgeLat(ty,     n);
                const southLat = tileEdgeLat(ty + 1, n);
                const westLng  = tx       / n * 360 - 180;
                const eastLng  = (tx + 1) / n * 360 - 180;

                // Convert to world XZ (consistent with toXZ used for POIs)
                const westX  = (westLng  - cLng) * (Math.PI / 180) * R * cosLat;
                const eastX  = (eastLng  - cLng) * (Math.PI / 180) * R * cosLat;
                const northZ = -(northLat - cLat) * (Math.PI / 180) * R;
                const southZ = -(southLat - cLat) * (Math.PI / 180) * R;

                const tileW  = (eastX - westX)   + BLEED * 2;
                const tileH  = (southZ - northZ)  + BLEED * 2;
                const centerX = (westX + eastX)   / 2;
                const centerZ = (northZ + southZ)  / 2;

                // Y stagger: center tile highest, outer tiles progressively lower.
                // Must exceed WebGL depth-buffer precision — 0.05 per step (was 0.002) prevents z-fighting.
                const yOffset = -0.05 - Math.sqrt(dx * dx + dy * dy) * 0.05;

                const mat = new THREE.MeshBasicMaterial({ color: fallback });
                const plane = new THREE.Mesh(new THREE.PlaneGeometry(tileW, tileH), mat);
                plane.rotation.x = -Math.PI / 2;
                plane.position.set(centerX, yOffset, centerZ);
                group.add(plane);

                const applyTex = (tex, crop) => {
                    // Ground was rebuilt (layer switched) or scene closed while loading
                    if (groundGroup !== group) { tex.dispose(); return; }
                    if (crop) {
                        // Show only this tile's sub-square of a lower-zoom parent tile
                        const k = 1 << crop;
                        tex.repeat.set(1 / k, 1 / k);
                        tex.offset.set((tx % k) / k, 1 - ((ty % k) + 1) / k);
                    }
                    tex.generateMipmaps = true;
                    tex.minFilter       = THREE.LinearMipmapLinearFilter;
                    tex.magFilter       = THREE.LinearFilter;
                    tex.anisotropy      = renderer.capabilities.getMaxAnisotropy();
                    tex.wrapS           = THREE.ClampToEdgeWrapping;
                    tex.wrapT           = THREE.ClampToEdgeWrapping;
                    mat.map = tex;
                    mat.color.setHex(0xffffff);
                    mat.needsUpdate = true;
                };
                const crop = layer === 'cartodb_dark' ? Math.max(0, ZOOM - ESRI_DARK_MAX_ZOOM) : 0;
                fetchTexture(getTileUrl(tx, ty, ZOOM, layer), tex => applyTex(tex, crop),
                    () => fetchTexture(osmTileUrl(tx, ty, ZOOM), tex => applyTex(tex, 0))
                );
            }
        }
    }

    // ── POI 3D models ─────────────────────────────────────────────────────────
    // PokéStop / Gym / Power Spot are the game's own GLB props with their idle
    // animations and FX (js/poi-models.js). Heights keep the size each model
    // was tuned to here: PokéStop ~35 m, Gym ~157 m, Power Spot ~50 m.
    const MODEL_HEIGHT = {
        pokestop: 35,
        gym: 136 * 1.1 * 1.05,
        powerspot: 38.4 * 1.3,
    };

    function makeExclusionZone(x, z, radius, hex) {
        const border = new THREE.Mesh(
            new THREE.RingGeometry(radius - 0.8, radius, 32),
            new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
        );
        border.rotation.x = -Math.PI / 2;
        border.position.set(x, 0.2, z);
        return [border];
    }

    function makeRing(radius, hex, opacity) {
        const m = new THREE.Mesh(
            new THREE.RingGeometry(radius - 1.2, radius, 48),
            new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity, side: THREE.DoubleSide })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.25;
        return m;
    }

    // CA gyms stay neutral white and CA PokéStops green; other gyms take a team
    // colour picked from the spot's id, so a gym keeps its colour every time the
    // view opens. Other PokéStops stay blue.
    const GYM_TEAMS = ['mystic', 'valor', 'instinct'];
    function poiTheme(spot, id) {
        if (spot.type === 'caspot') return 'ca';
        if (spot.type === 'cagym' || !GYM_TYPES.has(spot.type)) return undefined;
        let h = 0;
        for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
        return GYM_TEAMS[Math.abs(h) % GYM_TEAMS.length];
    }

    // ── Scene construction ────────────────────────────────────────────────────

    // Spots farther than this from the center fall outside the tile ground
    const SCENE_RADIUS_M = 600;

    function buildScene(allSpotsData) {
        // Center on what the Map View is showing. A centroid of every spot drifts
        // to another area when the project or loaded Live POIs span several places.
        const c = CA_Map.map.getCenter();
        const cLat = c.lat, cLng = c.lng;

        const spotsData = {};
        Object.entries(allSpotsData).forEach(([id, sp]) => {
            if (haversine(cLat, cLng, sp.lat, sp.lng) <= SCENE_RADIUS_M) spotsData[id] = sp;
        });
        const spotList = Object.values(spotsData);

        buildSky();
        buildMapGround(cLat, cLng);

        // Player group — moves with joystick
        playerPos = { x: 0, z: 0 };
        playerGroup = new THREE.Group();

        const pGreen  = 0x00bb55;
        const pGreenL = 0x00dd77;
        const pMat  = () => new THREE.MeshLambertMaterial({ color: pGreen });
        const pMatL = () => new THREE.MeshLambertMaterial({ color: pGreenL });

        // Person sub-group — scaled independently so ring stays at true 80m
        const personGroup = new THREE.Group();
        personGroup.scale.setScalar(1.8 * 1.4); // ใหญ่ขึ้นอีก 40% จากเดิม = 2.52
        playerGroup.add(personGroup);

        // Shadow / feet base
        const playerBase = new THREE.Mesh(
            new THREE.CylinderGeometry(1.8, 1.8, 0.3, 10),
            new THREE.MeshBasicMaterial({ color: 0x009944 })
        );
        playerBase.position.y = 0.15;
        personGroup.add(playerBase);

        // Left leg
        const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 3.2, 6), pMat());
        legL.position.set(-0.52, 2.0, 0);
        personGroup.add(legL);

        // Right leg
        const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 3.2, 6), pMat());
        legR.position.set(0.52, 2.0, 0);
        personGroup.add(legR);

        // Torso
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.65, 3.0, 8), pMat());
        torso.position.set(0, 5.1, 0);
        personGroup.add(torso);

        // Left arm
        const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 2.6, 6), pMat());
        armL.position.set(-1.15, 4.9, 0);
        armL.rotation.z = 0.38;
        personGroup.add(armL);

        // Right arm
        const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 2.6, 6), pMat());
        armR.position.set(1.15, 4.9, 0);
        armR.rotation.z = -0.38;
        personGroup.add(armR);

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), pMatL());
        head.position.set(0, 7.5, 0);
        personGroup.add(head);

        // 80m ring — darker green, wider for visibility
        playerGroup.add(makeRing(80, 0x009933, 0.75));
        scene.add(playerGroup);

        poiMixers = [];
        zoneRings = [];

        if (spotList.length === 0) return;

        Object.entries(spotsData).forEach(([id, spot]) => {
            const [x, z] = toXZ(spot.lat, spot.lng, cLat, cLng);
            const hex = TYPE_COLORS[spot.type] || 0x007aff;

            if (poiTemplates) {
                const kind = GYM_TYPES.has(spot.type) ? 'gym'
                           : spot.type === 'powerspot' ? 'powerspot'
                           : 'pokestop';
                const poi = CA_PoiModels.createInstance(poiTemplates, kind, MODEL_HEIGHT[kind], poiTheme(spot, id));
                poi.group.position.set(x, 0, z);
                scene.add(poi.group);
                if (poi.mixer) poiMixers.push(poi.mixer);
            }

            makeExclusionZone(x, z, 45, hex).forEach(m => { scene.add(m); zoneRings.push(m); });
        });
    }

    function buildDistanceTable(spotList, cLat, cLng) {
        const el = document.getElementById('sim3d-dist-table');
        if (!el) return;

        if (spotList.length === 0) {
            el.innerHTML = '<div style="padding:8px 16px; color:#666; font-size:12px;">ยังไม่มี Wayspot ในโปรเจคนี้</div>';
            return;
        }

        let html = '<div style="display:flex;flex-wrap:wrap;gap:5px;padding:6px 12px;">';
        spotList.forEach(sp => {
            const d = haversine(cLat, cLng, sp.lat, sp.lng);
            const typeHex = '#' + (TYPE_COLORS[sp.type] || 0x007aff).toString(16).padStart(6, '0');
            const distCol = d < 20 ? '#ff5555' : d < 45 ? '#ffaa22' : '#44dd88';
            const distLabel = d < 1 ? 'ตรงจุดศูนย์กลาง' : `${d.toFixed(0)}m`;
            html += `<div style="background:rgba(0,0,0,0.45);border-radius:6px;padding:4px 10px;font-size:11px;border-left:3px solid ${typeHex};">
                <span style="color:#ddd;">${sp.name || '(ไม่มีชื่อ)'}</span>
                <span style="color:${distCol};margin-left:8px;font-weight:600;">${distLabel}</span>
            </div>`;
        });
        html += '</div>';
        el.innerHTML = html;
    }

    // ── Three.js lifecycle ────────────────────────────────────────────────────

    function initThree() {
        const canvas = document.getElementById('sim3d-canvas');
        const w = Math.max(canvas.offsetWidth, window.innerWidth);
        const h = Math.max(canvas.offsetHeight, window.innerHeight - 120);

        scene = new THREE.Scene();
        // Fallback colour if sky dome has a gap — matches Pokemon GO horizon blue
        scene.background = new THREE.Color(0xc8e8f5);

        camera = new THREE.PerspectiveCamera(55, w / h, 0.5, 1000);
        camera.position.set(0, 70, 105);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 5, 0);
        controls.maxPolarAngle = Math.PI / 2.05;
        controls.minDistance = 15;
        controls.maxDistance = 450;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;

        // Cool ambient base — directional + hemi light added by buildSky()
        scene.add(new THREE.AmbientLight(0xddeeff, 0.75));
    }

    function animate(time = 0) {
        animId = requestAnimationFrame(animate);
        const delta = Math.min((time - lastFrameTime) / 1000, 0.1);
        lastFrameTime = time;

        if (!startTime) startTime = time;
        for (let i = 0; i < poiMixers.length; i++) poiMixers[i].update(delta);
        CA_PoiModels.update((time - startTime) / 1000);

        // Camera-relative joystick movement
        if (playerGroup && (joystickState.jx !== 0 || joystickState.jy !== 0)) {
            const speed = 25 * delta;
            const fwd = new THREE.Vector3(
                controls.target.x - camera.position.x, 0,
                controls.target.z - camera.position.z
            ).normalize();
            const right = new THREE.Vector3()
                .crossVectors(fwd, new THREE.Vector3(0, 1, 0))
                .normalize();
            playerPos.x += (-joystickState.jy * fwd.x + joystickState.jx * right.x) * speed;
            playerPos.z += (-joystickState.jy * fwd.z + joystickState.jx * right.z) * speed;
            playerGroup.position.set(playerPos.x, 0, playerPos.z);
            controls.target.set(playerPos.x, 5, playerPos.z);
        }

        controls.update();
        renderer.render(scene, camera);
    }

    function onResize() {
        if (!renderer || !camera) return;
        const canvas = document.getElementById('sim3d-canvas');
        if (!canvas) return;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (w < 10 || h < 10) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    function initJoystick() {
        const pad   = document.getElementById('sim3d-joystick');
        const thumb = document.getElementById('sim3d-joystick-thumb');
        if (!pad || !thumb) return;

        const maxR = pad.offsetWidth / 2 - 24; // max thumb travel radius

        function move(e) {
            const rect = pad.getBoundingClientRect();
            const px = e.clientX - (rect.left + rect.width  / 2);
            const py = e.clientY - (rect.top  + rect.height / 2);
            const dist = Math.sqrt(px * px + py * py);
            const c = dist > maxR ? maxR / dist : 1;
            const tx = px * c, ty = py * c;
            thumb.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
            joystickState.jx = tx / maxR;
            joystickState.jy = ty / maxR;
        }

        function release() {
            joystickState.active = false;
            joystickState.jx = 0;
            joystickState.jy = 0;
            thumb.style.transform = 'translate(-50%, -50%)';
        }

        pad.addEventListener('pointerdown', e => {
            e.stopPropagation();
            joystickState.active = true;
            pad.setPointerCapture(e.pointerId);
            move(e);
        });
        pad.addEventListener('pointermove', e => {
            if (!joystickState.active) return;
            e.stopPropagation();
            move(e);
        });
        pad.addEventListener('pointerup',     e => { e.stopPropagation(); release(); });
        pad.addEventListener('pointercancel', release);
    }

    function initDoubleClickMove() {
        if (!renderer) return;
        const raycaster = new THREE.Raycaster();
        const ground    = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit       = new THREE.Vector3();

        renderer.domElement.addEventListener('dblclick', e => {
            if (!playerGroup) return;
            const rect  = renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width)  *  2 - 1,
               -((e.clientY - rect.top)  / rect.height) *  2 + 1
            );
            raycaster.setFromCamera(mouse, camera);
            if (!raycaster.ray.intersectPlane(ground, hit)) return;
            playerPos.x = hit.x;
            playerPos.z = hit.z;
            playerGroup.position.set(hit.x, 0, hit.z);
            controls.target.set(hit.x, 5, hit.z);
        });
    }

    function dispose() {
        if (animId) { cancelAnimationFrame(animId); animId = null; }
        if (renderer) { renderer.dispose(); renderer = null; }
        if (scene) {
            scene.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
                    else o.material.dispose();
                }
            });
        }
        scene = camera = controls = null;
        poiMixers = [];
        poiTemplates = null;
        startTime = 0;
        CA_PoiModels.dispose();
        zoneRings = [];
        groundGroup = null;
        groundCenter = null;
        playerGroup = null;
        playerPos = { x: 0, z: 0 };
        lastFrameTime = 0;
        joystickState = { active: false, jx: 0, jy: 0 };
        const thumb = document.getElementById('sim3d-joystick-thumb');
        if (thumb) thumb.style.transform = 'translate(-50%, -50%)';
    }

    // ── Public API ────────────────────────────────────────────────────────────

    function open() {
        const overlay = document.getElementById('sim3d-overlay');
        overlay.style.display = 'flex';
        syncLayerSelect();

        const fabContainer = document.getElementById('fab-menu-container');
        if (fabContainer && fabContainer.classList.contains('active')) {
            fabContainer.classList.remove('active');
            const fabMain = document.getElementById('fab-main-menu');
            if (fabMain) fabMain.innerText = '☰';
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(async () => {
                // Load the GLB props before building; the scene still opens
                // (without POI models) if they fail.
                try {
                    poiTemplates = await CA_PoiModels.load();
                } catch (err) {
                    console.warn('[Sim3D] POI models failed to load', err);
                    poiTemplates = null;
                }
                if (overlay.style.display === 'none') { poiTemplates = null; CA_PoiModels.dispose(); return; } // closed while loading
                initThree();
                buildScene(buildCombinedSpotsData());
                initJoystick();
                initDoubleClickMove();
                animate();
            });
        });
    }

    // รวม Wayspot ที่ผู้ใช้สร้างเองกับ POI จริงจาก Wayfarer (ที่ยังไม่ถูกซ่อน)
    // เป็น object เดียวกันก่อนส่งเข้า buildScene — ให้จำลอง 3D เห็นทั้งสองแหล่ง
    function buildCombinedSpotsData() {
        const combined = Object.assign({}, CA_Map.spotsData);
        if (window.CA_LivePOI && CA_LivePOI.getAllPoiList) {
            CA_LivePOI.getAllPoiList().forEach(p => {
                if (p.hidden) return;
                combined[p.id] = { type: p.type, name: p.name, lat: p.lat, lng: p.lng, imgUrl: p.imgUrl };
            });
        }
        return combined;
    }

    function close() {
        document.getElementById('sim3d-overlay').style.display = 'none';
        dispose();
    }

    function resetView() {
        if (!camera || !controls) return;
        playerPos = { x: 0, z: 0 };
        if (playerGroup) playerGroup.position.set(0, 0, 0);
        camera.position.set(0, 70, 105);
        controls.target.set(0, 5, 0);
        controls.update();
    }

    window.addEventListener('resize', onResize);

    function toggleZoneRings() {
        const btn = document.getElementById('btn-sim3d-rings');
        const visible = zoneRings.length > 0 && zoneRings[0].visible;
        zoneRings.forEach(m => { m.visible = !visible; });
        if (btn) btn.textContent = visible ? '⭕ รัศมี' : '🚫 รัศมี';
    }

    function disposeGround() {
        if (!groundGroup) return;
        scene.remove(groundGroup);
        groundGroup.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                if (o.material.map) o.material.map.dispose();
                o.material.dispose();
            }
        });
        groundGroup = null;
    }

    function setMapLayer(val) {
        localStorage.setItem(SIM3D_LAYER_KEY, val);
        if (!scene || !groundCenter) return;
        const { lat, lng } = groundCenter;
        disposeGround();
        buildMapGround(lat, lng);
    }

    function syncLayerSelect() {
        const sel = document.getElementById('sim3d-layer-select');
        if (sel) sel.value = localStorage.getItem(SIM3D_LAYER_KEY) || 'auto';
    }

    return { open, close, resetView, toggleZoneRings, setMapLayer };
})();
