/**
 * 3D Simulation Module — Pokemon GO-style view using Three.js
 * Ground: real map tiles · Sky: morning gradient
 */
const CA_Simulation3D = (() => {
    let scene, camera, renderer, controls, animId;
    let spinParts = [];
    let playerGroup = null;
    let playerPos   = { x: 0, z: 0 };
    let lastFrameTime = 0;
    let joystickState       = { active: false, jx: 0, jy: 0 };
    let spinPartsClockwise  = []; // rotates Y = -rot (clockwise from above)

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

    function getTileUrl(tx, ty, zoom) {
        const layer = localStorage.getItem('caWayspotMapLayer') || 'osm';
        const s = ['a', 'b', 'c'][(tx + ty) % 3];
        switch (layer) {
            case 'cartodb_dark':
                return `https://${s}.basemaps.cartocdn.com/dark_all/${zoom}/${tx}/${ty}.png`;
            case 'mapbox':
                // Works on HTTPS (localhost / GitHub Pages). Blocked on file:// (null origin).
                return `https://api.mapbox.com/styles/v1/yuljang01/cjwiphjwn10lj1cp0nye6wtec/tiles/256/${zoom}/${tx}/${ty}?access_token=pk.eyJ1IjoieXVsamFuZzAxIiwiYSI6ImNtbzJhaDRvMDBzaWQycHF3amtmMmg1bHUifQ.z6KdZVVik50x4nNb7BEIBg`;
            // gmap_street / gmap_sat / bing → no CORS, fall back to CartoDB voyager
            default:
                return `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png`;
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
        const ZOOM = 16;
        const n   = Math.pow(2, ZOOM);
        const center = latLngToTile(cLat, cLng, ZOOM);
        const R      = 6371000;
        const cosLat = Math.cos(cLat * Math.PI / 180);

        const layer   = localStorage.getItem('caWayspotMapLayer') || 'osm';
        // Fallback color: matches the map's dominant palette while tiles load
        const fallback = layer === 'cartodb_dark' ? 0x252535
                       : layer === 'mapbox'       ? 0xd4eac0   // Pokemon GO greenish
                       : 0xddd8c8;

        // Wide background so sky/horizon never shows below the tile grid
        const bg = new THREE.Mesh(
            new THREE.PlaneGeometry(5000, 5000),
            new THREE.MeshBasicMaterial({ color: fallback })
        );
        bg.rotation.x = -Math.PI / 2;
        bg.position.y = -0.5;
        scene.add(bg);

        const loader = new THREE.TextureLoader();
        loader.crossOrigin = 'anonymous';

        const RADIUS = 2; // 5 × 5 grid
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

                // Tiny Y stagger per tile (distance from center) to prevent
                // z-fighting where BLEED areas of adjacent tiles overlap
                const yOffset = -0.05 - Math.sqrt(dx * dx + dy * dy) * 0.002;

                const mat = new THREE.MeshBasicMaterial({ color: fallback });
                const plane = new THREE.Mesh(new THREE.PlaneGeometry(tileW, tileH), mat);
                plane.rotation.x = -Math.PI / 2;
                plane.position.set(centerX, yOffset, centerZ);
                scene.add(plane);

                loader.load(getTileUrl(tx, ty, ZOOM),
                    (tex) => {
                        tex.generateMipmaps  = true;
                        tex.minFilter        = THREE.LinearMipmapLinearFilter;
                        tex.magFilter        = THREE.LinearFilter;
                        tex.anisotropy       = renderer.capabilities.getMaxAnisotropy();
                        mat.map = tex;
                        mat.color.setHex(0xffffff);
                        mat.needsUpdate = true;
                    },
                    undefined,
                    () => { /* CORS or network error — show fallback color */ }
                );
            }
        }
    }

    // ── GLB model loader ──────────────────────────────────────────────────────


    // ── POI 3D builders ───────────────────────────────────────────────────────

    function makePokeStop(hex, imgUrl = null) {

        const g      = new THREE.Group();
        const silver = 0xaabbcc;

        // ── Base & pole ──────────────────────────────────────
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(2, 2.5, 0.4, 12),
            new THREE.MeshLambertMaterial({ color: silver })
        );
        base.position.y = 0.2;
        g.add(base);

        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.5, 14, 8),
            new THREE.MeshLambertMaterial({ color: silver })
        );
        pole.position.y = 7;
        g.add(pole);

        // ── Tray platform (item drop area below disc) ────────
        const trayArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 4, 6),
            new THREE.MeshLambertMaterial({ color: silver })
        );
        trayArm.position.y = 16;
        g.add(trayArm);

        const trayBoard = new THREE.Mesh(
            new THREE.BoxGeometry(4.5, 0.55, 2.5),
            new THREE.MeshLambertMaterial({ color: hex })
        );
        trayBoard.position.y = 18.3;
        g.add(trayBoard);

        // ── Disc assembly — all elements vertical (face Z) ───
        const discGroup = new THREE.Group();
        discGroup.position.y = 24;
        g.add(discGroup);

        // Main body disc (Pokeball face background)
        const mainDisc = new THREE.Mesh(
            new THREE.CylinderGeometry(6.5, 6.5, 0.7, 24),
            new THREE.MeshLambertMaterial({ color: hex })
        );
        mainDisc.rotation.x = Math.PI / 2;
        discGroup.add(mainDisc);

        // Outer border ring
        const midRing = new THREE.Mesh(
            new THREE.TorusGeometry(6.5, 0.45, 6, 32),
            new THREE.MeshBasicMaterial({ color: hex })
        );
        discGroup.add(midRing);

        // POI image — front face
        const imgMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide });
        const imgDisc = new THREE.Mesh(new THREE.CircleGeometry(6.2, 32), imgMat);
        imgDisc.position.z = 0.4;
        discGroup.add(imgDisc);

        // POI image — back face (rotation.y=π keeps image un-mirrored from behind)
        const imgDiscBack = new THREE.Mesh(new THREE.CircleGeometry(6.2, 32), imgMat);
        imgDiscBack.position.z = -0.4;
        imgDiscBack.rotation.y = Math.PI;
        discGroup.add(imgDiscBack);

        // Load POI image as texture if available
        if (imgUrl) {
            const loader = new THREE.TextureLoader();
            loader.crossOrigin = 'anonymous';
            loader.load(imgUrl,
                (tex) => {
                    tex.minFilter = THREE.LinearFilter;
                    tex.generateMipmaps = false;
                    imgMat.map = tex;
                    imgMat.needsUpdate = true;
                },
                undefined,
                () => {}
            );
        }


        // ── Outer ring group (spinning CW around Y) ──────────
        const outerRingGrp = new THREE.Group();

        const outerRing = new THREE.Mesh(
            new THREE.TorusGeometry(8.5, 0.55, 8, 48),
            new THREE.MeshBasicMaterial({ color: hex })
        );
        outerRingGrp.add(outerRing);

        // Arc segment decorations — tangentially placed
        [0.8, Math.PI + 0.4, Math.PI * 1.65].forEach(angle => {
            const arc = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 2.2, 0.6),
                new THREE.MeshBasicMaterial({ color: hex })
            );
            arc.position.set(Math.cos(angle) * 9.2, Math.sin(angle) * 9.2, 0);
            arc.rotation.z = angle; // tangential to ring
            outerRingGrp.add(arc);
        });

        discGroup.add(outerRingGrp);

        // 60% smaller than Gym (gym scale=1.5, pokestop = 0.6)
        g.scale.setScalar(0.6);

        return { group: g, spin: [], spinCW: [outerRingGrp] };
    }

    function makeGym(hex) {

        const g      = new THREE.Group();
        const silver = 0xb8bcd0;
        const dark   = 0x38384a;

        // ── Base & pole ──────────────────────────────────────
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(2, 2.5, 0.4, 12),
            new THREE.MeshLambertMaterial({ color: silver })
        );
        base.scale.setScalar(1 / 1.5);   // cancel parent scale → original size
        base.position.y = 0.2 / 1.5;
        g.add(base);

        // Pole height extended so its world top (= h/2 + 1.5*pos_y) reaches
        // the first scaled disc at world y=12.75.  Solving: h=12.75, pos_y=h/3
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.55, 12.75, 8),
            new THREE.MeshLambertMaterial({ color: silver })
        );
        pole.scale.setScalar(1 / 1.5);   // cancel parent scale → original thickness
        pole.position.y = 4.25;           // = 12.75 / 3
        g.add(pole);

        // ── Lower stacked disc rings ─────────────────────────
        [[8.5, 4.2], [10.2, 3.8], [11.6, 3.2]].forEach(([y, r]) => {
            const disc = new THREE.Mesh(
                new THREE.CylinderGeometry(r, r * 1.06, 0.45, 8),
                new THREE.MeshLambertMaterial({ color: hex })
            );
            disc.position.y = y;
            g.add(disc);
        });

        // ── Main hexagonal column ────────────────────────────
        const col = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 2.6, 11, 6),
            new THREE.MeshLambertMaterial({ color: dark })
        );
        col.position.y = 15;
        g.add(col);

        // ── Crystal rings (spinning) ─────────────────────────
        function buildCrystalRing(y, r, rotY) {
            const gr = new THREE.Group();
            const torus = new THREE.Mesh(
                new THREE.TorusGeometry(r, 0.28, 4, 18),
                new THREE.MeshLambertMaterial({ color: silver })
            );
            torus.rotation.x = Math.PI / 2;
            gr.add(torus);
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2;
                const oct = new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.65, 0),
                    new THREE.MeshBasicMaterial({ color: hex })
                );
                oct.position.set(Math.cos(a) * r, 0.35, Math.sin(a) * r);
                oct.rotation.set(0.3, a, 0.2);
                gr.add(oct);
            }
            gr.position.y = y;
            gr.rotation.y = rotY;
            return gr;
        }

        const cring1 = buildCrystalRing(13, 5.0, 0);
        const cring2 = buildCrystalRing(17, 5.2, Math.PI / 5);
        g.add(cring1);
        g.add(cring2);

        // ── Upper platform ───────────────────────────────────
        const plat = new THREE.Mesh(
            new THREE.CylinderGeometry(5.5, 5.0, 0.9, 8),
            new THREE.MeshLambertMaterial({ color: hex })
        );
        plat.position.y = 22;
        g.add(plat);

        // ── Dome ─────────────────────────────────────────────
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(2.8, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
            new THREE.MeshLambertMaterial({ color: hex })
        );
        dome.position.y = 22.9;
        g.add(dome);

        const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.9, 1.8, 1.5, 6),
            new THREE.MeshLambertMaterial({ color: dark })
        );
        hub.position.y = 24.3;
        g.add(hub);

        // ── Large spinning halo ──────────────────────────────
        const haloGrp = new THREE.Group();
        haloGrp.position.y = 25;
        const halo = new THREE.Mesh(
            new THREE.TorusGeometry(7.8, 0.5, 6, 32),
            new THREE.MeshBasicMaterial({ color: hex })
        );
        halo.rotation.x = Math.PI / 2;
        haloGrp.add(halo);
        g.add(haloGrp);

        // ── Top cap ──────────────────────────────────────────
        const topCap = new THREE.Mesh(
            new THREE.CylinderGeometry(1.3, 1.3, 0.4, 12),
            new THREE.MeshBasicMaterial({ color: hex })
        );
        topCap.position.y = 26.5;
        g.add(topCap);

        g.scale.setScalar(1.5);
        return { group: g, spin: [haloGrp, cring1, cring2] };
    }

    function makePowerSpot() {
        const g = new THREE.Group();
        const purple    = 0x9b59b6;
        const darkPurple= 0x6c3483;
        const green     = 0x27ae60;
        const pink      = 0xff44cc;

        // Ground base glow disc
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(1.8, 1.8, 0.4, 20),
            new THREE.MeshBasicMaterial({ color: pink })
        );
        base.position.y = 0.2;
        g.add(base);

        // Energy beam (ground → funnel tip)
        const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.45, 10, 8),
            new THREE.MeshBasicMaterial({ color: pink, transparent: true, opacity: 0.9 })
        );
        beam.position.y = 5;
        g.add(beam);

        const beamGlow = new THREE.Mesh(
            new THREE.CylinderGeometry(1.6, 1.6, 10, 8),
            new THREE.MeshBasicMaterial({ color: pink, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
        );
        beamGlow.position.y = 5;
        g.add(beamGlow);

        // Funnel — inverted hexagonal cone (wide top @ y=28, tip @ y=10)
        const funnel = new THREE.Mesh(
            new THREE.CylinderGeometry(8, 0.8, 18, 6),
            new THREE.MeshLambertMaterial({ color: darkPurple })
        );
        funnel.position.y = 19;
        g.add(funnel);

        // Inner energy — translucent spinning cone
        const energy = new THREE.Mesh(
            new THREE.CylinderGeometry(7.4, 0.4, 18, 14),
            new THREE.MeshBasicMaterial({ color: pink, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
        );
        energy.position.y = 19;
        g.add(energy);

        // Panel decorations × 3 on upper funnel sides
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
            const panel = new THREE.Mesh(
                new THREE.BoxGeometry(2.5, 4.5, 0.7),
                new THREE.MeshLambertMaterial({ color: purple })
            );
            panel.position.set(Math.cos(angle) * 5.8, 23, Math.sin(angle) * 5.8);
            panel.rotation.y = -angle;
            g.add(panel);
        }

        // Arena green inner disc
        const arena = new THREE.Mesh(
            new THREE.CylinderGeometry(7, 7, 0.5, 32),
            new THREE.MeshLambertMaterial({ color: green })
        );
        arena.position.y = 28.6;
        g.add(arena);

        // Platform outer rim — static flat ring
        const rim = new THREE.Mesh(
            new THREE.RingGeometry(7.2, 8.8, 32),
            new THREE.MeshLambertMaterial({ color: purple, side: THREE.DoubleSide })
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.y = 29.1;
        g.add(rim);

        return { group: g, spin: [energy] };
    }

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

    // ── Scene construction ────────────────────────────────────────────────────

    function buildScene(spotsData) {
        const spotList = Object.values(spotsData);

        // Use spot centroid or fall back to current map center
        let cLat, cLng;
        if (spotList.length > 0) {
            cLat = spotList.reduce((s, sp) => s + sp.lat, 0) / spotList.length;
            cLng = spotList.reduce((s, sp) => s + sp.lng, 0) / spotList.length;
        } else {
            const c = CA_Map.map.getCenter();
            cLat = c.lat; cLng = c.lng;
        }

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
        personGroup.scale.setScalar(1.8);
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

        spinParts = [];

        if (spotList.length === 0) return;

        spotList.forEach(spot => {
            const [x, z] = toXZ(spot.lat, spot.lng, cLat, cLng);
            const hex = TYPE_COLORS[spot.type] || 0x007aff;

            const result = GYM_TYPES.has(spot.type) ? makeGym(hex)
                         : spot.type === 'powerspot' ? makePowerSpot()
                         : makePokeStop(hex, spot.imgUrl || null);
            result.group.position.set(x, 0, z);
            scene.add(result.group);
            result.spin.forEach(s => spinParts.push(s));
            if (result.spinCW) result.spinCW.forEach(s => spinPartsClockwise.push(s));

            makeExclusionZone(x, z, 45, hex).forEach(m => scene.add(m));
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

        const rot = time * 0.0007;
        for (let i = 0; i < spinParts.length; i++)          spinParts[i].rotation.y          =  rot;
        for (let i = 0; i < spinPartsClockwise.length; i++) spinPartsClockwise[i].rotation.y = -rot;

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
        spinParts = [];
        spinPartsClockwise = [];
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

        const fabContainer = document.getElementById('fab-menu-container');
        if (fabContainer && fabContainer.classList.contains('active')) {
            fabContainer.classList.remove('active');
            const fabMain = document.getElementById('fab-main-menu');
            if (fabMain) fabMain.innerText = '☰';
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                initThree();
                buildScene(CA_Map.spotsData);
                initJoystick();
                initDoubleClickMove();
                animate();
            });
        });
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

    return { open, close, resetView };
})();
