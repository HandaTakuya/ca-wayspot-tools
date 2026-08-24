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

    const CAMPFIRE_GRAPHQL = 'https://niantic-social-api.nianticlabs.com/graphql';
    // Bookmarklet: อ่าน Campfire session token/csrf token จาก localStorage ของ
    // campfire.nianticlabs.com เอง (คีย์เดียวกับที่ Capacitor เก็บไว้ตอน login)
    // แล้วก็อปเป็น JSON ไปที่ clipboard ให้ผู้ใช้กลับมาวางที่นี่ — ไม่ผ่าน backend ใดๆ
    const CAMPFIRE_BOOKMARKLET_HREF = "javascript:(function(){var t=localStorage.getItem('CapacitorStorage.sessionToken');var c=localStorage.getItem('CapacitorStorage.csrfToken');if(!t){alert('ไม่พบ Token — login Campfire ก่อน');return;}var payload=JSON.stringify({bearer_token:t,csrf_token:c});navigator.clipboard.writeText(payload).then(function(){document.title='✅ Copied — กลับไปวางที่ CA Wayspot Tools';},function(){prompt('Copy ข้อความนี้ไปวางในแอป:',payload);});})();";
    // iOS Shortcut สำเร็จรูป (Run JavaScript on Web Page → Copy to Clipboard) ทำ
    // logic เดียวกับ bookmarklet ด้านบน แค่แพ็กเป็น Shortcut ให้ติดตั้งครั้งเดียว
    const CAMPFIRE_SHORTCUT_URL = 'https://www.icloud.com/shortcuts/5d79efc812324d25aba2870bdb836085';

    const TYPES = ['pokestop', 'gym', 'powerspot'];

    let map = null;
    const layerGroups = { pokestop: null, gym: null, powerspot: null };
    const markerIndex = { pokestop: new Map(), gym: new Map(), powerspot: new Map() };
    const visible = { pokestop: true, gym: true, powerspot: false };

    let debounceTimer = null;
    let inFlightController = null;

    // ซ่อนทีละจุด (ต่างจาก visible ที่ปิดทั้ง type) — persist เป็น set ของ
    // poi.id ใน localStorage เพื่อให้จำไว้ข้าม session เหมือน hidden ของ
    // Wayspot ที่ผู้ใช้สร้างเอง แม้ตัว POI จะถูก fetch ใหม่ทุกครั้งที่ pan/zoom
    const HIDDEN_KEY = 'caWayspotLivePoiHidden';

    function loadHiddenIds() {
        try {
            const raw = localStorage.getItem(HIDDEN_KEY);
            return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch (e) { return new Set(); }
    }

    function persistHiddenIds() {
        try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(hiddenIds))); } catch (e) { /* ignore */ }
    }

    const hiddenIds = loadHiddenIds();

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

    function saveToken(bearerToken, csrfToken, username) {
        bearerToken = (bearerToken || '').trim();
        if (!bearerToken) return;
        // ผู้ใช้อาจก็อปมาทั้ง "Bearer eyJ..." — ตัด prefix ออกให้เอง
        bearerToken = bearerToken.replace(/^Bearer\s+/i, '');
        localStorage.setItem(TOKEN_KEY, JSON.stringify({
            bearerToken,
            csrfToken: csrfToken || null,
            username: username || null,
            updatedAt: new Date().toISOString(),
        }));
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
    }

    // ยิง query GetMe ไปที่ Campfire GraphQL ตรงๆ จาก browser (endpoint นี้เปิด
    // CORS * ไว้ให้ official app เรียกอยู่แล้ว) เพื่อยืนยันว่า token ใช้งานได้จริง
    // และดึง username กลับมาแสดงในการ์ดสถานะ — ไม่ผ่าน/ไม่เก็บที่ backend ของเราเอง
    async function verifyTokenAndGetUsername(bearerToken, csrfToken) {
        const headers = {
            'Authorization': 'Bearer ' + bearerToken,
            'Content-Type': 'application/json',
        };
        if (csrfToken) headers['X-Csrf-Token'] = csrfToken;
        const res = await fetch(CAMPFIRE_GRAPHQL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: 'query GetMe { me { username } }', variables: {} }),
        });
        if (!res.ok) throw new Error('http-' + res.status);
        const json = await res.json();
        const username = json && json.data && json.data.me && json.data.me.username;
        if (!username) throw new Error('invalid-token');
        return username;
    }

    // ตรวจ + บันทึก token ใหม่ทั้งชุด ใช้จากฟอร์ม "บันทึก Token" — คืน username
    // เมื่อสำเร็จ, throw เมื่อ token ใช้งานไม่ได้ (ให้ฝั่งเรียกจับไปแสดง error เอง)
    async function validateAndSaveToken(bearerToken, csrfToken) {
        bearerToken = (bearerToken || '').trim().replace(/^Bearer\s+/i, '');
        if (!bearerToken) throw new Error('empty-token');
        const username = await verifyTokenAndGetUsername(bearerToken, csrfToken);
        saveToken(bearerToken, csrfToken, username);
        return username;
    }

    // อ่านจาก Clipboard — รองรับทั้ง payload JSON ที่ bookmarklet/Shortcut สร้าง
    // ({bearer_token, csrf_token}) และกรณี user ก็อป token เปล่าๆ มาวางเอง
    async function pasteFromClipboard() {
        const text = await navigator.clipboard.readText();
        const trimmed = (text || '').trim();
        if (!trimmed) throw new Error('clipboard-empty');
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && parsed.bearer_token) {
                return { bearerToken: parsed.bearer_token, csrfToken: parsed.csrf_token || '' };
            }
        } catch (e) { /* ไม่ใช่ JSON — ถือเป็น token เปล่าๆ */ }
        return { bearerToken: trimmed, csrfToken: '' };
    }

    function getTokenStatus() {
        const tok = getToken();
        if (!tok || !tok.bearerToken) return { configured: false };
        let expired = false;
        try {
            const payload = JSON.parse(atob(tok.bearerToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            expired = !!payload.exp && payload.exp < Math.floor(Date.now() / 1000);
        } catch (e) { /* decode ไม่ได้ก็ถือว่ายังไม่หมดอายุ ปล่อยให้ fetch จริงเป็นคนบอก */ }
        return { configured: true, expired, username: tok.username || null, updatedAt: tok.updatedAt || null };
    }

    function renderBookmarklet() {
        const slot = document.getElementById('live-poi-bookmarklet-slot');
        if (!slot) return;
        // React-style XSS guard บนหลาย browser บล็อก href="javascript:" ที่ตั้งผ่าน
        // .href ตรงๆ ไม่ได้ปัญหาแบบนั้นที่นี่ (เราตั้งผ่าน innerHTML ของ static
        // string ที่เราเขียนเองล้วน ไม่มี user input ปน) แต่ escape quote กันพลาด
        slot.innerHTML = `<a href="${CAMPFIRE_BOOKMARKLET_HREF.replace(/"/g, '&quot;')}" onclick="return false;">📥 ดึง Campfire Token</a>`;
    }

    function renderQRCode() {
        const canvas = document.getElementById('live-poi-qr-canvas');
        if (!canvas || typeof QRCode === 'undefined') return;
        QRCode.toCanvas(canvas, CAMPFIRE_SHORTCUT_URL, { width: 72, margin: 1 }, function (err) {
            if (err) console.error('[CA_LivePOI] QR render failed', err);
        });
    }

    function fmtDate(iso) {
        if (!iso) return '';
        try {
            const locale = (typeof CA_UI !== 'undefined' && CA_UI.currentLang === 'en') ? 'en-US' : 'th-TH';
            return new Date(iso).toLocaleString(locale, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
        } catch (e) { return ''; }
    }

    function renderTokenStatusUI() {
        const statusEl = document.getElementById('live-poi-token-status-text');
        const toggleBtn = document.getElementById('btn-live-poi-token-toggle');
        const clearBtn = document.getElementById('btn-live-poi-token-clear');
        if (!statusEl || !toggleBtn) return;

        const status = getTokenStatus();
        statusEl.classList.remove('is-ok', 'is-warning', 'is-none');

        if (!status.configured) {
            statusEl.textContent = t('livePoiTokenNotConfigured');
            statusEl.classList.add('is-none');
            toggleBtn.textContent = t('livePoiTokenBtnSet');
            if (clearBtn) clearBtn.style.display = 'none';
        } else if (status.expired) {
            statusEl.textContent = t('livePoiTokenExpiredShort');
            statusEl.classList.add('is-warning');
            toggleBtn.textContent = t('livePoiTokenBtnUpdate');
            if (clearBtn) clearBtn.style.display = '';
        } else {
            const updated = status.updatedAt ? fmtDate(status.updatedAt) : '';
            statusEl.textContent = (status.username ? '✓ ' + status.username : '✓ ' + t('livePoiTokenReady'))
                + (updated ? '  ·  ' + t('livePoiTokenUpdatedAt') + ' ' + updated : '');
            statusEl.classList.add('is-ok');
            toggleBtn.textContent = t('livePoiTokenBtnUpdate');
            if (clearBtn) clearBtn.style.display = '';
        }
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

    const RING_COLOR = { pokestop: '#007aff', gym: '#ff3b30', powerspot: '#911042' };

    function buildPopupHTML(poi) {
        const typeLabel = { pokestop: t('optPokestop'), gym: t('optGym'), powerspot: t('optPowerSpot') }[poi.type] || poi.type;
        const megaBadge = poi.isMegaEnhancedEligible ? ` <span class="live-poi-mega-badge">⭐ Mega</span>` : '';
        // รูปใหญ่วงกลม — pattern เดียวกับ .popup-spot-image ของ custom marker
        // เดิม แค่ใส่ขอบสีตาม type (ฟ้า=PokéStop, แดง=Gym, ม่วง=Power Spot) ให้
        // ตรงกับสี ring ของ marker บนแผนที่ — ถ้าไม่มี imageUrl หรือโหลดพัง ใช้
        // ไอคอน emoji fallback แทนที่รูป
        const ringColor = RING_COLOR[poi.type] || '#888';
        const img = poi.imageUrl
            ? `<img crossorigin="anonymous" src="${poi.imageUrl}" class="popup-spot-image" style="border: 3px solid ${ringColor};" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'live-poi-popup-fallback',textContent:'${defaultIconFor(poi.type)}'}))">`
            : `<div class="live-poi-popup-fallback">${defaultIconFor(poi.type)}</div>`;
        return `
            <div style="text-align:center; min-width:170px;">
                <h4 style="margin:0;">${CA_UI.escapeHTML(poi.name)}</h4>
                <span style="font-size:12px; color:var(--text-secondary);">${typeLabel}</span>${megaBadge}
                ${img}
                <div style="font-size:11px; color:var(--text-secondary); font-family:monospace;">
                    ${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}
                </div>
                <div class="live-poi-readonly-note">${t('livePoiReadOnlyNote')}</div>
            </div>`;
    }

    // วง Exclusion Zone 45m รอบ POI จริง — รัศมีคงที่ (ไม่ปรับได้เหมือน spot ของ
    // ผู้ใช้เอง เพราะ POI จาก Wayfarer ไม่ใช่ของเรา) สีตาม type เดียวกับขอบ
    // marker ของตัวเอง (RING_COLOR) และเคารพ toggle "แสดงรัศมี" เดียวกับ POI อื่นๆ
    const LIVE_POI_RADIUS = 45;

    function isShowRadius() {
        const el = document.getElementById('setting-show-radius');
        return el ? el.checked : true;
    }

    function buildCircle(poi) {
        const color = RING_COLOR[poi.type] || '#888';
        const show = isShowRadius();
        return L.circle([poi.lat, poi.lng], {
            radius: LIVE_POI_RADIUS,
            color: color,
            weight: 2,
            fillColor: color,
            fillOpacity: show ? 0.10 : 0,
            opacity: show ? 1 : 0,
            interactive: false,
        });
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
        const circle = buildCircle(poi);
        const marker = L.marker([poi.lat, poi.lng], { icon: buildIcon(poi), interactive: true, keyboard: false });
        marker.bindPopup(buildPopupHTML(poi));
        index.set(poi.id, { marker, circle, poi });
        if (!hiddenIds.has(poi.id)) {
            circle.addTo(group);
            marker.addTo(group);
        }
    }

    // เรียกจาก toggleHidden — ใส่/เอา marker+circle ออกจาก layerGroup ของ type
    // นั้น (ไม่กระทบว่า group ทั้งก้อนถูก addTo แผนที่หรือยัง — คนละชั้นกัน)
    function applyEntryVisibility(type, entry) {
        const group = layerGroups[type];
        if (!group) return;
        if (hiddenIds.has(entry.poi.id)) {
            group.removeLayer(entry.marker);
            group.removeLayer(entry.circle);
        } else {
            if (!group.hasLayer(entry.circle)) entry.circle.addTo(group);
            if (!group.hasLayer(entry.marker)) entry.marker.addTo(group);
        }
    }

    function findEntry(poiId) {
        for (const type of TYPES) {
            const entry = markerIndex[type].get(poiId);
            if (entry) return { type, entry };
        }
        return null;
    }

    function toggleHidden(poiId) {
        if (hiddenIds.has(poiId)) hiddenIds.delete(poiId); else hiddenIds.add(poiId);
        persistHiddenIds();
        const found = findEntry(poiId);
        if (found) applyEntryVisibility(found.type, found.entry);
    }

    // รายชื่อ POI ปัจจุบัน (เท่าที่ fetch มาแล้วในมุมมองตอนนี้) ต่อ type — ใช้
    // แสดงใน list modal "รายการทั้งหมด" ของ app.js
    function getPoiList(type) {
        const index = markerIndex[type];
        if (!index) return [];
        const list = [];
        for (const [id, entry] of index) {
            list.push({ id, type, name: entry.poi.name, lat: entry.poi.lat, lng: entry.poi.lng, hidden: hiddenIds.has(id) });
        }
        return list;
    }

    function getAllPoiList() {
        return TYPES.reduce((acc, type) => acc.concat(getPoiList(type)), []);
    }

    // pan ไปหา POI + เปิด popup — ใช้จาก list modal (คลิกรายการ) เหมือน
    // jumpToSpot ของ Wayspot ที่ผู้ใช้สร้างเอง
    function jumpTo(poiId) {
        const found = findEntry(poiId);
        if (!found) return;
        map.flyTo([found.entry.poi.lat, found.entry.poi.lng], 17);
        // marker ที่ถูกซ่อนไม่ได้อยู่บนแผนที่ — เปิด popup ไม่ได้ ข้ามไปเฉยๆ
        if (!hiddenIds.has(poiId)) setTimeout(() => found.entry.marker.openPopup(), 600);
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
                    if (entry.circle) group.removeLayer(entry.circle);
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

    // เรียกจาก toggle "แสดงรัศมี" ส่วนกลาง (setting-show-radius) ให้วง 45m ของ
    // POI จริงจาก Wayfarer เปิด/ปิดพร้อมกับวงของ spot ที่ผู้ใช้สร้างเอง
    function setShowRadius(show) {
        TYPES.forEach((type) => {
            for (const [, entry] of markerIndex[type]) {
                if (entry.circle) entry.circle.setStyle({ fillOpacity: show ? 0.10 : 0, opacity: show ? 1 : 0 });
            }
        });
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
        renderBookmarklet();
        renderTokenStatusUI();
    }

    return {
        init,
        scheduleFetch,
        fetchNow,
        setVisible,
        saveToken,
        clearToken,
        getToken,
        validateAndSaveToken,
        pasteFromClipboard,
        getTokenStatus,
        renderTokenStatusUI,
        renderQRCode,
        setShowRadius,
        toggleHidden,
        getPoiList,
        getAllPoiList,
        jumpTo,
    };
})();
