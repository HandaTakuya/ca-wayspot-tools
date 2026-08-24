/**
 * Live POI Layer — ดึง PokéStop / Gym / Power Spot จริงจาก Niantic (ผ่าน
 * pogodpu-web's public proxy) มาแสดงบนแผนที่ตามขอบเขตที่มองเห็นอยู่ปัจจุบัน
 * แยกจากระบบ CA_Map.spotsData เดิมโดยสิ้นเชิง: ชั้นข้อมูลนี้เป็น read-only
 * (ดูอย่างเดียว ห้ามลาก/แก้ไข/ลบ) ใช้เป็นข้อมูลอ้างอิงประกอบการวางแผนเท่านั้น
 */
window.CA_LivePOI = (function () {
    const API_BASE = 'https://pokemongodpu.com/api/public/live-poi';
    const DEBOUNCE_MS = 600;
    const TOKEN_KEY = 'caWayspotCampfireToken';
    const PAD_RATIO = 0.15; // ขยาย bounds เล็กน้อยกันหมุดโผล่/หายที่ขอบจอ

    const TYPES = ['pokestop', 'gym', 'powerspot'];

    let map = null;
    const layerGroups = { pokestop: null, gym: null, powerspot: null };
    const markerIndex = { pokestop: new Map(), gym: new Map(), powerspot: new Map() };
    const visible = { pokestop: true, gym: true, powerspot: false };

    let debounceTimer = null;
    let inFlightController = null;

    function t(key) {
        return (typeof CA_UI !== 'undefined' && CA_UI.t) ? CA_UI.t(key) : key;
    }

    function getToken() {
        try {
            const raw = localStorage.getItem(TOKEN_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function saveToken(bearerToken, csrfToken) {
        bearerToken = (bearerToken || '').trim();
        if (!bearerToken) return;
        // ผู้ใช้อาจก็อปมาทั้ง "Bearer eyJ..." — ตัด prefix ออกให้เอง
        bearerToken = bearerToken.replace(/^Bearer\s+/i, '');
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ bearerToken, csrfToken: csrfToken || null }));
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
    }

    function defaultIconFor(type) {
        // ไอคอน fallback ต่อประเภท กรณี API ไม่ส่ง imageUrl มาให้
        const svg = {
            pokestop: '🔵',
            gym: '🔴',
            powerspot: '🟣',
        }[type] || '📍';
        return svg;
    }

    function buildIcon(poi) {
        const size = 26;
        const inner = poi.imageUrl
            ? `<img crossorigin="anonymous" src="${poi.imageUrl}" class="live-poi-thumb" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'live-poi-fallback',textContent:'${defaultIconFor(poi.type)}'}))">`
            : `<span class="live-poi-fallback">${defaultIconFor(poi.type)}</span>`;
        return L.divIcon({
            className: 'live-poi-icon-wrapper',
            html: `<div class="live-poi-icon-inner live-poi-type-${poi.type}">${inner}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }

    function buildPopupHTML(poi) {
        const typeLabel = { pokestop: t('optPokestop'), gym: t('optGym'), powerspot: t('optPowerSpot') }[poi.type] || poi.type;
        const megaBadge = poi.isMegaEnhancedEligible ? `<br><span class="live-poi-mega-badge">⭐ Mega</span>` : '';
        return `
            <div style="text-align:center; min-width:150px;">
                <h4 style="margin:0 0 4px 0;">${CA_UI.escapeHTML(poi.name)}</h4>
                <span style="font-size:12px; color:var(--text-secondary);">${typeLabel}</span>${megaBadge}
                <div style="font-size:11px; color:var(--text-secondary); font-family:monospace; margin-top:6px;">
                    ${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}
                </div>
                <div class="live-poi-readonly-note">${t('livePoiReadOnlyNote')}</div>
            </div>`;
    }

    function upsertMarker(poi) {
        const index = markerIndex[poi.type];
        const group = layerGroups[poi.type];
        if (!index || !group) return;
        const existing = index.get(poi.id);
        if (existing) {
            existing.marker.setPopupContent(buildPopupHTML(poi));
            return;
        }
        const marker = L.marker([poi.lat, poi.lng], { icon: buildIcon(poi), interactive: true, keyboard: false });
        marker.bindPopup(buildPopupHTML(poi));
        marker.addTo(group);
        index.set(poi.id, { marker, poi });
    }

    function reconcile(pois) {
        const seenByType = { pokestop: new Set(), gym: new Set(), powerspot: new Set() };
        for (const poi of pois) {
            if (!markerIndex[poi.type]) continue;
            seenByType[poi.type].add(poi.id);
            upsertMarker(poi);
        }
        // ลบ marker ที่ไม่อยู่ในผลลัพธ์รอบนี้ (หลุดจากมุมมอง หรือถูกลบไปจริง)
        TYPES.forEach((type) => {
            const index = markerIndex[type];
            const group = layerGroups[type];
            for (const [id, entry] of index) {
                if (!seenByType[type].has(id)) {
                    group.removeLayer(entry.marker);
                    index.delete(id);
                }
            }
        });
        updateCounts();
    }

    function updateCounts() {
        TYPES.forEach((type) => {
            const el = document.getElementById('live-poi-count-' + type);
            if (el) el.textContent = markerIndex[type].size;
        });
    }

    function setStatus(state, extra) {
        const line = document.getElementById('live-poi-status');
        const errBox = document.getElementById('live-poi-error');
        if (!line || !errBox) return;
        const messages = {
            idle: '',
            loading: t('livePoiLoading'),
            ok: '',
            'token-error': t('livePoiTokenExpired'),
            'fetch-error': t('livePoiFetchError'),
            'network-error': t('livePoiNetworkError'),
        };
        line.textContent = state === 'loading' ? messages.loading : '';
        if (state === 'token-error' || state === 'fetch-error' || state === 'network-error') {
            errBox.textContent = messages[state] + (extra ? ` (${extra})` : '');
            errBox.style.display = 'block';
        } else {
            errBox.style.display = 'none';
        }
    }

    function scheduleFetch() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchNow, DEBOUNCE_MS);
    }

    async function fetchNow() {
        if (!map) return;
        if (inFlightController) inFlightController.abort();
        const controller = new AbortController();
        inFlightController = controller;

        const b = map.getBounds().pad(PAD_RATIO);
        const params = new URLSearchParams({
            minLat: b.getSouth(),
            minLng: b.getWest(),
            maxLat: b.getNorth(),
            maxLng: b.getEast(),
        });

        const tok = getToken();
        const headers = {};
        if (tok && tok.bearerToken && visible.powerspot) {
            headers['Authorization'] = 'Bearer ' + tok.bearerToken;
            if (tok.csrfToken) headers['X-Csrf-Token'] = tok.csrfToken;
        }

        setStatus('loading');
        try {
            const res = await fetch(`${API_BASE}?${params.toString()}`, { headers, signal: controller.signal });
            if (!res.ok) {
                let body = null;
                try { body = await res.json(); } catch (e) {}
                if (res.status === 401) {
                    setStatus('token-error');
                } else {
                    setStatus('fetch-error', body && body.error);
                }
                return;
            }
            const json = await res.json();
            reconcile(json.pois || []);
            setStatus('ok');
        } catch (e) {
            if (e.name !== 'AbortError') {
                setStatus('network-error');
            }
        }
    }

    function setVisible(type, on) {
        if (!layerGroups[type]) return;
        visible[type] = !!on;
        if (on) {
            if (!map.hasLayer(layerGroups[type])) layerGroups[type].addTo(map);
            fetchNow();
        } else {
            if (map.hasLayer(layerGroups[type])) map.removeLayer(layerGroups[type]);
        }
    }

    function init(leafletMap) {
        map = leafletMap;
        TYPES.forEach((type) => { layerGroups[type] = L.layerGroup(); });
        layerGroups.pokestop.addTo(map);
        layerGroups.gym.addTo(map);
        // powerspot layer เพิ่มเข้าแผนที่ก็ต่อเมื่อผู้ใช้เปิดใช้งาน (ต้องมี token)
        fetchNow();
    }

    return {
        init,
        scheduleFetch,
        fetchNow,
        setVisible,
        saveToken,
        clearToken,
        getToken,
    };
})();
