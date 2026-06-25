const POGO_GMAP_STYLE = [
    { featureType: 'landscape',          elementType: 'geometry.fill',   stylers: [{ color: '#dcedc8' }] },
    { featureType: 'landscape.natural',  elementType: 'geometry.fill',   stylers: [{ color: '#c8e6c9' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry.fill',   stylers: [{ color: '#dcedc8' }] },
    { featureType: 'poi.park',           elementType: 'geometry.fill',   stylers: [{ color: '#a5d6a7' }] },
    { featureType: 'poi',                elementType: 'labels',          stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business',                                        stylers: [{ visibility: 'off' }] },
    { featureType: 'water',              elementType: 'geometry.fill',   stylers: [{ color: '#80deea' }] },
    { featureType: 'road',               elementType: 'geometry.fill',   stylers: [{ color: '#ffffff' }] },
    { featureType: 'road',               elementType: 'geometry.stroke', stylers: [{ color: '#c8e6c9' }] },
    { featureType: 'road.highway',       elementType: 'geometry.fill',   stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.highway',       elementType: 'geometry.stroke', stylers: [{ color: '#a5d6a7' }] },
    { featureType: 'transit',                                             stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative',     elementType: 'geometry.stroke', stylers: [{ color: '#a5d6a7' }] },
    { featureType: 'all',                elementType: 'labels.text.fill', stylers: [{ color: '#5f6368' }] },
];

/**
 * Map Management Module (Leaflet, S2 Grid, Spots)
 */
const CA_Map = {
    map: null,
    layers: {},
    s2LayerGroup: null,
    spotsData: {},
    userLocationMarker: null,
    exclusionLayerGroup: null,
    _gmapCallId: 0,
    _gmapLoadedKey: null,

    init(elementId, initialView) {
        this.map = L.map(elementId, { zoomControl: false, doubleClickZoom: false }).setView(initialView.center, initialView.zoom);
        L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

        this.layers.osm = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20 });
this.layers.gmap_street = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] });
        this.layers.gmap_sat = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], className: 'no-invert' });
        this.layers.cartodb_dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, className: 'no-invert' });

        const BingLayer = L.TileLayer.extend({
            getTileUrl: function (coords) {
                let quadkey = '';
                for (let i = coords.z; i > 0; i--) {
                    let digit = 0, mask = 1 << (i - 1);
                    if ((coords.x & mask) !== 0) digit += 1;
                    if ((coords.y & mask) !== 0) digit += 2;
                    quadkey += digit;
                }
                return this._url.replace('{q}', quadkey);
            }
        });
        this.layers.bing = new BingLayer('https://t0.tiles.virtualearth.net/tiles/a{q}.jpeg?g=129', { maxZoom: 19, attribution: 'Bing Maps', className: 'no-invert' });

        this.s2LayerGroup = L.layerGroup().addTo(this.map);
        this.exclusionLayerGroup = L.layerGroup();
        
        // Default layer
        this.currentLayer = this.layers.gmap_street;
        this.currentLayer.addTo(this.map);

        return this.map;
    },

    setLayer(layerKey, mapboxOptions = null) {
        if (this.currentLayer) this.map.removeLayer(this.currentLayer);

        if (layerKey === 'mapbox' && mapboxOptions) {
            const { user, styleId, token } = mapboxOptions;
            const url = `https://api.mapbox.com/styles/v1/${user}/${styleId}/tiles/256/{z}/{x}/{y}?access_token=${token}`;
            this.currentLayer = L.tileLayer(url, { maxZoom: 20, attribution: '© Mapbox', className: 'no-invert' });
        } else {
            this.currentLayer = this.layers[layerKey] || this.layers.gmap_street;
        }

        this.currentLayer.addTo(this.map);
    },

    updateS2Grid(showS2) {
        this.s2LayerGroup.clearLayers();
        if (!showS2) return;
        const zoom = this.map.getZoom();
        if (zoom < 13) return;
        this.drawS2Level(14, { color: '#ff9500', weight: 4, fillOpacity: 0, opacity: 0.9, interactive: false });
        if (zoom >= 15) {
            this.drawS2Level(17, { color: '#34c759', weight: 2, fillOpacity: 0, opacity: 0.7, interactive: false });
        }
    },

    drawS2Level(level, styleOptions) {
        try {
            const bounds = this.map.getBounds().pad(0.1);
            const center = this.map.getCenter();
            const startCell = S2.S2Cell.FromLatLng(center, level);
            const queue = [startCell.toHilbertQuadkey()];
            const seen = new Set();

            while (queue.length > 0) {
                const key = queue.shift();
                if (seen.has(key)) continue;
                seen.add(key);
                const cell = S2.S2Cell.FromHilbertQuadKey(key);
                const corners = cell.getCornerLatLngs();
                const inBounds = corners.some(p => bounds.contains([p.lat, p.lng]));
                const centerInBounds = bounds.contains([cell.getLatLng().lat, cell.getLatLng().lng]);

                if (inBounds || centerInBounds) {
                    const latlngs = corners.map(p => [p.lat, p.lng]);
                    this.s2LayerGroup.addLayer(L.polygon(latlngs, styleOptions));
                    cell.getNeighbors().forEach(n => queue.push(n.toHilbertQuadkey()));
                }
            }
        } catch (e) {
            console.error("S2 Grid error: ", e);
        }
    },

    clearAllSpots() {
        for (let id in this.spotsData) {
            if (this.map.hasLayer(this.spotsData[id].layerGroup)) {
                this.map.removeLayer(this.spotsData[id].layerGroup);
            }
        }
        this.spotsData = {};
        this.updateExclusionZone(document.getElementById('setting-show-exclusion') && document.getElementById('setting-show-exclusion').checked);
    },

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                if (existing.dataset.status === 'ok') { resolve(); return; }
                if (existing.dataset.status === 'err') { existing.remove(); }
                else {
                    existing.addEventListener('load', resolve, { once: true });
                    existing.addEventListener('error', () => reject(new Error(`CDN โหลดไม่ได้: ${src}`)), { once: true });
                    return;
                }
            }
            const s = document.createElement('script');
            s.src = src;
            s.onload  = () => { s.dataset.status = 'ok'; resolve(); };
            s.onerror = () => { s.dataset.status = 'err'; reject(new Error(`CDN โหลดไม่ได้: ${src}`)); };
            document.head.appendChild(s);
        });
    },

    loadGoogleMapsAPI(apiKey) {
        return new Promise((resolve, reject) => {
            if (window.google?.maps) {
                if (this._gmapLoadedKey !== apiKey) {
                    reject(new Error('key_changed'));
                    return;
                }
                resolve(); return;
            }
            const src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing && existing.dataset.status === 'err') existing.remove();
            else if (existing) {
                const timer = setTimeout(() => reject(new Error('timeout')), 10000);
                existing.addEventListener('load', () => {
                    clearTimeout(timer);
                    window.google?.maps ? (this._gmapLoadedKey = apiKey, resolve()) : reject(new Error('invalid_key'));
                }, { once: true });
                existing.addEventListener('error', () => { clearTimeout(timer); reject(new Error('network')); }, { once: true });
                return;
            }
            const timer = setTimeout(() => reject(new Error('timeout')), 10000);
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => {
                clearTimeout(timer);
                if (window.google?.maps) { this._gmapLoadedKey = apiKey; resolve(); }
                else reject(new Error('invalid_key'));
            };
            s.onerror = () => { clearTimeout(timer); s.dataset.status = 'err'; reject(new Error('network')); };
            document.head.appendChild(s);
        });
    },

    async setGmapStyled(apiKey) {
        const callId = ++this._gmapCallId;
        const prevLayer = this.currentLayer;
        try {
            await this.loadScript('https://unpkg.com/leaflet.gridlayer.googlemutant@0.13.4/dist/Leaflet.GoogleMutant.js');
            await this.loadGoogleMapsAPI(apiKey);
            if (callId !== this._gmapCallId) return;
            const newLayer = L.gridLayer.googleMutant({ type: 'roadmap', styles: POGO_GMAP_STYLE, maxZoom: 20 });
            if (prevLayer) this.map.removeLayer(prevLayer);
            this.currentLayer = newLayer;
            this.currentLayer.addTo(this.map);
        } catch (e) {
            if (callId !== this._gmapCallId) return;
            console.error('Google Maps load failed:', e);
            const msg = e.message === 'key_changed'   ? 'API Key เปลี่ยนแล้ว กรุณา Reload หน้า'
                      : e.message === 'timeout'        ? 'โหลดหมดเวลา — ตรวจสอบ network'
                      : e.message === 'network'        ? 'โหลด plugin ไม่สำเร็จ — ตรวจสอบ network'
                      : e.message === 'invalid_key'    ? 'API Key ไม่ถูกต้อง หรือยังไม่ได้เปิดใช้ Maps JavaScript API'
                      : e.message.includes('CDN')      ? 'CDN โหลดไม่ได้ — ตรวจสอบ network'
                      : '1. เปิดใช้ Maps JavaScript API\n2. เพิ่ม localhost ใน allowed domains';
            alert('โหลด Google Maps ไม่สำเร็จ\n' + msg);
        }
    },

    updateExclusionZone(show) {
        this.exclusionLayerGroup.clearLayers();
        if (!show) {
            if (this.map.hasLayer(this.exclusionLayerGroup)) this.map.removeLayer(this.exclusionLayerGroup);
            return;
        }
        if (!this.map.hasLayer(this.exclusionLayerGroup)) this.exclusionLayerGroup.addTo(this.map);

        for (let id in this.spotsData) {
            const spot = this.spotsData[id];
            L.circle([spot.lat, spot.lng], {
                radius: 45, // User requested 45m for this project
                color: '#ff3b30',
                weight: 1,
                fillColor: '#ff3b30',
                fillOpacity: 0.15,
                dashArray: '5, 5',
                interactive: false
            }).addTo(this.exclusionLayerGroup);
        }
    }
};
