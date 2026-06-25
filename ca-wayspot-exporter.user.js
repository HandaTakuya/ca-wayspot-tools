// ==UserScript==
// @name         CA Wayspot Exporter
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  ส่งออกข้อมูล Wayspot จาก Niantic Wayfarer พร้อมเลือกโหมด รัศมี และเลือก POI รายจุด
// @author       HandaTakuya
// @match        *://wayfarer.nianticlabs.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // === DATA CACHE ===
    window.__CA_WAYSPOT_CACHE = new Map();

    // === HAVERSINE DISTANCE ===
    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3;
        const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
        const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // === JSON EXTRACTOR ===
    const extractFromJSON = (obj) => {
        if (!obj) return;
        if (Array.isArray(obj)) { obj.forEach(extractFromJSON); return; }
        if (typeof obj !== 'object') return;

        const lat = obj.lat || (obj.latE6 ? obj.latE6 / 1e6 : null);
        const lng = obj.lng || (obj.lngE6 ? obj.lngE6 / 1e6 : null);

        if (lat && lng && (obj.title || obj.name || obj.imageUrl || obj.guid || obj.id)) {
            const key = `${parseFloat(lat).toFixed(5)}_${parseFloat(lng).toFixed(5)}`;
            let name = obj.title || obj.name || 'Unknown Wayspot';
            let imgUrl = obj.imageUrl || obj.image || obj.coverImageUrl || obj.photoUrl || obj.url || '';
            if (!imgUrl && Array.isArray(obj.imageUrls) && obj.imageUrls[0]) imgUrl = obj.imageUrls[0];
            if (!imgUrl && obj.photos?.[0]?.url) imgUrl = obj.photos[0].url;
            if (!imgUrl && obj.images?.[0]?.url) imgUrl = obj.images[0].url;
            if (!imgUrl) {
                const m = JSON.stringify(obj).match(/https:\/\/(lh3\.googleusercontent\.com|ggpht\.com)[^"'\\]+/i);
                if (m) imgUrl = m[0];
            }

            // ตรวจประเภทเฉพาะจาก field โดยตรงก่อน (แม่นยำกว่า raw string search)
            let type = 'none';
            const gameStr = (JSON.stringify(obj.gameTypes || obj.gameData || obj.pokemonGoGameData || obj.status || '')).toLowerCase();
            const selfStr = (JSON.stringify({ t: obj.title || obj.name, g: obj.guid || obj.id })).toLowerCase();
            const fieldStr = gameStr || selfStr;

            if (obj.pokestopType || obj.type === 'POKESTOP' || fieldStr.includes('pgo_pokestop') || fieldStr.includes('pokestop')) type = 'pokestop';
            else if (obj.gymType || obj.type === 'GYM' || fieldStr.includes('pgo_gym') || fieldStr.includes('"gym"')) type = 'gym';
            else if (fieldStr.includes('power_spot') || fieldStr.includes('powerspot')) type = 'powerspot';

            // fallback: raw scan ทั้ง object แต่ pokestop ชนะ gym เสมอ
            if (type === 'none') {
                const raw = JSON.stringify(obj).toLowerCase();
                if (raw.includes('pgo_pokestop') || raw.includes('"pokestop"')) type = 'pokestop';
                else if (raw.includes('pgo_gym') || raw.includes('"gym"')) type = 'gym';
                else if (raw.includes('power_spot') || raw.includes('powerspot')) type = 'powerspot';
            }

            const existing = window.__CA_WAYSPOT_CACHE.get(key);
            if (existing) {
                if (!imgUrl) imgUrl = existing.imgUrl;
                if (name === 'Unknown Wayspot') name = existing.name;
                // type ที่ตั้งครั้งแรกจะไม่ถูกเขียนทับโดย type อื่น (ป้องกัน cross-contamination)
                if (existing.type !== 'none') type = existing.type;
                else if (type === 'none') type = existing.type;
            }

            window.__CA_WAYSPOT_CACHE.set(key, { id: key, type, name, lat, lng, radius: 45, imgUrl, fetchedAt: Date.now() });
            _updateCount();
        }
        Object.values(obj).forEach(extractFromJSON);
    };

    // === INTERCEPTORS ===
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
        const res = await origFetch.apply(this, args);
        try { res.clone().json().then(extractFromJSON).catch(() => {}); } catch (e) {}
        return res;
    };

    const origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('load', function () {
            if (this.responseType === '' || this.responseType === 'text' || this.responseType === 'json') {
                try {
                    const text = this.responseType === 'json' ? JSON.stringify(this.response) : this.responseText;
                    if (text?.includes('{')) extractFromJSON(JSON.parse(text));
                } catch (e) {}
            }
        });
        origXHRSend.apply(this, args);
    };

    // === HELPERS ===
    const TYPE_INFO = {
        pokestop:  { label: 'PokeStop',    color: '#4285f4', bg: '#e8f0fe' },
        gym:       { label: 'Gym',         color: '#ea4335', bg: '#fce8e6' },
        powerspot: { label: 'Power Spot',  color: '#e37400', bg: '#fef3e0' },
    };
    const FALLBACK_IMG = 'data:image/jpeg;base64,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1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pPY1ov8GRH03HPGiXfYg7212pYG1h8A4NwrgqLkMPYfsom9r4os7KrcWyVUqPtakVN130XekqvToOrW7He73tQ07/Y2VnYxVRTET2v8lmu9dddpMVTnpzI1JbeAAAAAA//V2aDl1gAAAAAC+tVfZ9Mb5SHkmHixk3An3zyhPveLG7qyDpe0g3ejbDlhOWUdbSdW7nLaJdRuq1WjTp069hJXi1kfSRzlc11ijcvdk5TNerabvZxXTETMzm/qejHZWcWlXZnUnXrXz3hGI4he8s0fEbXVDa0WjXJ1r57wjEcQveWPEbXVBotGuTrXz3hGI4he8seI2uqDRaNcnWvnvCMRxC95Y8RtdUGi0a5OtfPeEYjiF7yx4ja6oNFo1yda+e8IxHEL3ljxG11QaLRrk61894RiOIXvLHiNrqg0WjXJ1r57wjEcQveWPEbXVBotGuTrXz3hGI4he8seI2uqDRaNcnWvnvCMRxC95Y8RtdUGi0a5OtfPeEYjiF7yx4ja6oNFo1yda+e8IxHEL3ljxG11QaLRrk61894RiOIXvLHiNrqg0WjXJ1r57wjEcQveWPEbXVBotGuTrXz3hGI4he8seI2uqDRaNcnWvnvCMRxC95Y8RtdUGi0a5OtfPeEYjiF7yx4ja6oNFo1yda+e8IxHEL3ljxG11QaLRrk61894RiOIXvLHiNrqg0WjXJ1r57wjEcQveWPEbXVBotGu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';
    const TYPE_SUFFIX  = { pokestop: '[PokeStop]', gym: '[Gym]', powerspot: '[Power Spot]' };

    const _updateCount = () => {
        const all   = window.__CA_WAYSPOT_CACHE.size;
        const typed = Array.from(window.__CA_WAYSPOT_CACHE.values()).filter(s => s.type !== 'none').length;
        const elAll   = document.getElementById('ca-count-all');
        const elTyped = document.getElementById('ca-count-typed');
        if (elAll)   elAll.textContent   = all;
        if (elTyped) elTyped.textContent = typed;
    };

    const _getBatchCenter = () => {
        try {
            const p = new URLSearchParams(window.location.search);
            if (p.get('lat') && p.get('lng'))
                return { lat: parseFloat(p.get('lat')), lng: parseFloat(p.get('lng')) };
        } catch (e) {}

        const spots = Array.from(window.__CA_WAYSPOT_CACHE.values());
        if (!spots.length) return null;
        let maxT = 0;
        spots.forEach(s => { if (s.fetchedAt > maxT) maxT = s.fetchedAt; });
        const recent = spots.filter(s => maxT - s.fetchedAt <= 5000);
        const src = recent.length ? recent : [spots[spots.length - 1]];
        return {
            lat: src.reduce((a, s) => a + s.lat, 0) / src.length,
            lng: src.reduce((a, s) => a + s.lng, 0) / src.length
        };
    };

    const _triggerDownload = (data, filename) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    };

    const _tagName = (s) => {
        const tag = TYPE_SUFFIX[s.type] || '';
        return (tag && !s.name.includes(tag)) ? `${s.name} ${tag}` : s.name;
    };

    const _doDownload = (spots, label) => {
        const timestamp = new Date().toLocaleString('th-TH');
        const exportSpots = spots.map(s => ({ ...s, name: _tagName(s) }));
        _triggerDownload([{
            id: 'proj_' + Date.now(),
            name: `Wayfarer Export [${label}] ${timestamp}`,
            data: exportSpots
        }], `CA_Wayfarer_${label}_${Date.now()}.json`);
        return exportSpots.length;
    };

    // === MAIN EXPORT (panel button) ===
    window.__CA_doExport = () => {
        const exportBtn = document.getElementById('ca-export-btn');
        const mode      = document.querySelector('.ca-mode-btn.active')?.dataset.mode || 'screen';
        const allSpots  = Array.from(window.__CA_WAYSPOT_CACHE.values());
        let spots = [];

        if (mode === 'screen') {
            let maxT = 0;
            allSpots.forEach(s => { if (s.fetchedAt > maxT) maxT = s.fetchedAt; });
            const recent = allSpots.filter(s => maxT - s.fetchedAt <= 15000 && s.type !== 'none');
            spots = recent.length ? recent : allSpots.filter(s => s.type !== 'none');
        } else {
            const radius = parseInt(document.querySelector('.ca-radius-btn.active')?.dataset.r || 500);
            let lat = parseFloat(document.getElementById('ca-lat')?.value);
            let lng = parseFloat(document.getElementById('ca-lng')?.value);
            if (!lat || !lng) {
                const auto = _getBatchCenter();
                if (!auto) { alert('ไม่สามารถหาจุดศูนย์กลางได้\nกรุณาระบุพิกัด หรือเลื่อนแผนที่เพื่อให้ POI โหลดก่อน'); return; }
                lat = auto.lat; lng = auto.lng;
                if (document.getElementById('ca-lat')) document.getElementById('ca-lat').value = lat.toFixed(6);
                if (document.getElementById('ca-lng')) document.getElementById('ca-lng').value = lng.toFixed(6);
            }
            spots = allSpots.filter(s => s.type !== 'none' && getDistance(lat, lng, s.lat, s.lng) <= radius);
        }

        if (!spots.length) {
            alert('ไม่พบ POI ที่ตรงเงื่อนไข\n\n💡 เลื่อนหรือซูมแผนที่ให้ POI โหลดขึ้นมาก่อน แล้วลอง Export ใหม่');
            return;
        }

        const label = mode === 'screen' ? 'Screen' : `${document.querySelector('.ca-radius-btn.active')?.dataset.r || 500}m`;
        const count = _doDownload(spots, label);
        exportBtn.textContent = `✅ Export สำเร็จ! (${count} จุด)`;
        setTimeout(() => { exportBtn.textContent = '📥 Export'; }, 3000);
    };

    window.__CA_setMode = (btn) => {
        document.querySelectorAll('.ca-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('ca-radius-section').style.display = btn.dataset.mode === 'radius' ? 'block' : 'none';
    };

    window.__CA_setRadius = (btn) => {
        document.querySelectorAll('.ca-radius-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };

    window.__CA_clearCache = () => {
        if (!confirm(`ล้างข้อมูล POI ทั้งหมด ${window.__CA_WAYSPOT_CACHE.size} จุดออกจากหน่วยความจำ?\n\nหลังล้างแล้ว ให้เลื่อนแผนที่ใหม่เพื่อโหลดข้อมูลปัจจุบัน`)) return;
        window.__CA_WAYSPOT_CACHE.clear();
        _updateCount();
        document.getElementById('ca-poi-modal')?.remove();
        const btn = document.getElementById('ca-clear-btn');
        if (btn) { btn.textContent = '✅ ล้างแล้ว'; setTimeout(() => { btn.textContent = '🗑️ ล้างแคช'; }, 2000); }
    };

    window.__CA_autofill = () => {
        const center = _getBatchCenter();
        if (!center) { alert('ยังไม่มีข้อมูล POI โหลดเข้ามา กรุณาเลื่อนแผนที่ก่อน'); return; }
        document.getElementById('ca-lat').value = center.lat.toFixed(6);
        document.getElementById('ca-lng').value = center.lng.toFixed(6);
    };

    // === POI LIST MODAL ===
    const _fmtDist = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

    const _poiRow = (s, center) => {
        const info = TYPE_INFO[s.type] || { label: s.type, color: '#999', bg: '#f0f0f0' };
        const img  = s.imgUrl || FALLBACK_IMG;
        const mapsUrl = `https://www.google.com/maps?q=${s.lat},${s.lng}`;
        const distHtml = center
            ? `<span class="ca-poi-dist">${_fmtDist(getDistance(center.lat, center.lng, s.lat, s.lng))}</span>`
            : '';
        return `
            <label class="ca-poi-row" data-type="${s.type}" data-name="${s.name.toLowerCase().replace(/"/g, '')}">
                <input type="checkbox" class="ca-poi-cb" data-id="${s.id}" checked onchange="window.__CA_updateSelCount()">
                <img src="${img}" class="ca-poi-thumb" onerror="this.src='${FALLBACK_IMG}'">
                <div class="ca-poi-info">
                    <div class="ca-poi-name">${s.name}</div>
                    <div class="ca-poi-meta">
                        <span class="ca-poi-badge" style="color:${info.color};background:${info.bg}">${info.label}</span>
                        ${distHtml}
                    </div>
                </div>
                <a class="ca-map-btn" href="${mapsUrl}" target="_blank" onclick="event.stopPropagation()" title="ดูตำแหน่งบน Google Maps">📍</a>
            </label>`;
    };

    window.__CA_showPOIList = () => {
        document.getElementById('ca-poi-modal')?.remove();

        const mode = document.querySelector('.ca-mode-btn.active')?.dataset.mode || 'screen';

        // หาจุดอ้างอิง
        const manualLat = parseFloat(document.getElementById('ca-lat')?.value);
        const manualLng = parseFloat(document.getElementById('ca-lng')?.value);
        const center = (manualLat && manualLng)
            ? { lat: manualLat, lng: manualLng }
            : _getBatchCenter();

        // กรองตามโหมด
        let allSpots = Array.from(window.__CA_WAYSPOT_CACHE.values()).filter(s => s.type !== 'none');

        if (mode === 'screen') {
            // เฉพาะ batch ล่าสุด
            let maxT = 0;
            allSpots.forEach(s => { if (s.fetchedAt > maxT) maxT = s.fetchedAt; });
            const recent = allSpots.filter(s => maxT - s.fetchedAt <= 15000);
            allSpots = recent.length ? recent : allSpots;
        } else if (center) {
            // กรองตามรัศมีที่เลือก
            const radius = parseInt(document.querySelector('.ca-radius-btn.active')?.dataset.r || 500);
            allSpots = allSpots.filter(s => getDistance(center.lat, center.lng, s.lat, s.lng) <= radius);
        }

        const spots = allSpots.sort((a, b) => center
            ? getDistance(center.lat, center.lng, a.lat, a.lng) - getDistance(center.lat, center.lng, b.lat, b.lng)
            : a.name.localeCompare(b.name, 'th'));

        const totalTyped = Array.from(window.__CA_WAYSPOT_CACHE.values()).filter(s => s.type !== 'none').length;
        if (!spots.length) {
            if (totalTyped === 0) {
                alert('ยังไม่มี POI ในหน่วยความจำ\nกรุณาเลื่อนแผนที่ใน Wayfarer ให้ POI โหลดก่อน');
            } else {
                const radius = document.querySelector('.ca-radius-btn.active')?.dataset.r || 500;
                alert(`ไม่พบ POI ในรัศมี ${radius} m จากพิกัดที่ระบุ\n\nมี POI ในหน่วยความจำ ${totalTyped} จุด แต่อยู่นอกรัศมี\n\n💡 ลองกด "ดึงพิกัดจากหน้าจออัตโนมัติ" เพื่ออัปเดตจุดศูนย์กลาง หรือเพิ่มรัศมี`);
            }
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'ca-poi-modal';
        modal.innerHTML = `
            <div id="ca-poi-card">
                <div class="ca-poi-header">
                    <span>📋 รายการ POI ที่ตรวจจับได้</span>
                    <button onclick="document.getElementById('ca-poi-modal').remove()">✕</button>
                </div>
                ${center ? `<div class="ca-center-bar">📌 วัดระยะจาก: ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}${mode === 'radius' ? ` · รัศมี ${document.querySelector('.ca-radius-btn.active')?.dataset.r || 500} m` : ''}</div>` : ''}
                <div class="ca-poi-toolbar">
                    <input id="ca-poi-search" type="text" placeholder="🔍 ค้นหาชื่อ POI..." oninput="window.__CA_filterPOI()">
                    <div class="ca-type-tabs">
                        <button class="ca-tab active" data-t="all"       onclick="window.__CA_filterPOI(this)">ทั้งหมด</button>
                        <button class="ca-tab"        data-t="pokestop"  onclick="window.__CA_filterPOI(this)">PokeStop</button>
                        <button class="ca-tab"        data-t="gym"       onclick="window.__CA_filterPOI(this)">Gym</button>
                        <button class="ca-tab"        data-t="powerspot" onclick="window.__CA_filterPOI(this)">Power Spot</button>
                    </div>
                </div>
                <div id="ca-poi-list">${spots.map(s => _poiRow(s, center)).join('')}</div>
                <div class="ca-poi-footer">
                    <span class="ca-sel-info">เลือกแล้ว: <b id="ca-sel-count">${spots.length}</b> จุด</span>
                    <div class="ca-poi-actions">
                        <button onclick="window.__CA_toggleAll(true)">เลือกทั้งหมด</button>
                        <button onclick="window.__CA_toggleAll(false)">ยกเลิกทั้งหมด</button>
                        <button class="ca-export-sel-btn" onclick="window.__CA_exportSelected()">📥 Export ที่เลือก</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    };

    window.__CA_filterPOI = (tabBtn) => {
        if (tabBtn?.dataset) {
            document.querySelectorAll('.ca-tab').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');
        }
        const typeFilter = document.querySelector('.ca-tab.active')?.dataset.t || 'all';
        const search     = (document.getElementById('ca-poi-search')?.value || '').toLowerCase();
        document.querySelectorAll('.ca-poi-row').forEach(row => {
            const show = (typeFilter === 'all' || row.dataset.type === typeFilter) && row.dataset.name.includes(search);
            row.style.display = show ? 'flex' : 'none';
        });
    };

    window.__CA_toggleAll = (checked) => {
        document.querySelectorAll('.ca-poi-row')
            .forEach(row => {
                if (row.style.display !== 'none') {
                    const cb = row.querySelector('.ca-poi-cb');
                    if (cb) cb.checked = checked;
                }
            });
        window.__CA_updateSelCount();
    };

    window.__CA_updateSelCount = () => {
        const count = document.querySelectorAll('.ca-poi-cb:checked').length;
        const el = document.getElementById('ca-sel-count');
        if (el) el.textContent = count;
    };

    window.__CA_exportSelected = () => {
        const selectedIds = new Set([...document.querySelectorAll('.ca-poi-cb:checked')].map(cb => cb.dataset.id));
        if (!selectedIds.size) { alert('กรุณาเลือก POI อย่างน้อย 1 จุด'); return; }

        const spots = Array.from(window.__CA_WAYSPOT_CACHE.values()).filter(s => selectedIds.has(s.id));
        const count = _doDownload(spots, 'Selected');

        const btn = document.querySelector('.ca-export-sel-btn');
        if (btn) { btn.textContent = `✅ Export สำเร็จ! (${count} จุด)`; setTimeout(() => { btn.textContent = '📥 Export ที่เลือก'; document.getElementById('ca-poi-modal')?.remove(); }, 1500); }
    };

    // === UI ===
    const STYLES = `
        #ca-fab {
            position: fixed; bottom: 30px; right: 30px; z-index: 999999;
            background: linear-gradient(135deg, #0bd3cd, #007aff);
            color: white; border: none; border-radius: 50px;
            padding: 12px 22px; font-size: 14px; font-weight: bold;
            cursor: pointer; box-shadow: 0 4px 20px rgba(0,122,255,0.4);
            transition: transform 0.2s, box-shadow 0.2s; user-select: none;
        }
        #ca-fab:hover { transform: scale(1.05); box-shadow: 0 6px 24px rgba(0,122,255,0.5); }

        #ca-panel {
            position: fixed; bottom: 85px; right: 30px; z-index: 999998;
            background: #fff; border-radius: 18px; overflow: hidden;
            box-shadow: 0 8px 40px rgba(0,0,0,0.18); width: 310px;
            font-family: -apple-system, sans-serif; font-size: 13px; color: #222;
            display: none;
        }
        #ca-panel.open { display: block; }

        .ca-ph { background: linear-gradient(135deg, #0bd3cd, #007aff); color: white; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; }
        .ca-ph-title { font-weight: 700; font-size: 14px; }
        .ca-ph-close { background: rgba(255,255,255,0.25); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 13px; }

        .ca-steps { background: #f0f7ff; padding: 10px 16px 10px 12px; font-size: 12px; color: #444; line-height: 1.75; border-bottom: 1px solid #e5eaf0; }
        .ca-steps ol { margin: 4px 0 0; padding-left: 22px; list-style-type: decimal; }
        .ca-steps li { padding-left: 2px; }
        .ca-steps li b { color: #007aff; }

        .ca-sec { padding: 12px 16px; border-bottom: 1px solid #f0f0f0; }
        .ca-sec-label { font-weight: 700; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }

        .ca-btn-row { display: flex; gap: 6px; }
        .ca-mode-btn, .ca-radius-btn { flex: 1; padding: 8px 0; border: 2px solid #e0e0e0; border-radius: 10px; background: white; cursor: pointer; font-size: 12px; font-weight: 600; color: #666; transition: all 0.15s; }
        .ca-mode-btn.active, .ca-radius-btn.active { border-color: #007aff; background: #e8f0ff; color: #007aff; }

        .ca-coord-group { margin-top: 10px; }
        .ca-coord-row { display: flex; gap: 6px; margin-bottom: 4px; }
        .ca-coord-row input { flex: 1; padding: 8px 10px; border: 1.5px solid #e0e0e0; border-radius: 8px; font-size: 12px; outline: none; transition: border-color 0.15s; }
        .ca-coord-row input:focus { border-color: #007aff; }
        .ca-autofill-btn { width: 100%; padding: 6px; border: 1.5px dashed #007aff; border-radius: 8px; background: transparent; color: #007aff; font-size: 11px; cursor: pointer; font-weight: 600; }
        .ca-coord-hint { font-size: 11px; color: #aaa; margin-top: 5px; }

        .ca-count-bar { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 8px; }
        .ca-count-bar span b { color: #007aff; }
        #ca-clear-btn {
            width: 100%; padding: 6px; border: 1.5px solid #ff3b30; border-radius: 8px;
            background: transparent; color: #ff3b30; font-size: 11px; cursor: pointer; font-weight: 600;
            transition: background 0.15s;
        }
        #ca-clear-btn:hover { background: #fff0ef; }

        #ca-list-btn {
            display: block; width: calc(100% - 32px); margin: 10px 16px 0;
            padding: 10px; background: white; color: #007aff;
            border: 2px solid #007aff; border-radius: 12px;
            font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s;
        }
        #ca-list-btn:hover { background: #e8f0ff; }

        #ca-export-btn {
            display: block; width: calc(100% - 32px); margin: 8px 16px 14px;
            padding: 13px; background: linear-gradient(135deg, #0bd3cd, #007aff);
            color: white; border: none; border-radius: 12px;
            font-size: 14px; font-weight: 700; cursor: pointer; letter-spacing: 0.3px; transition: opacity 0.2s;
        }
        #ca-export-btn:hover { opacity: 0.88; }

        /* === POI MODAL === */
        #ca-poi-modal {
            position: fixed; inset: 0; z-index: 9999999;
            background: rgba(0,0,0,0.5);
            display: flex; align-items: center; justify-content: center;
        }
        #ca-poi-card {
            background: white; border-radius: 18px;
            width: 420px; max-width: 95vw; max-height: 85vh;
            display: flex; flex-direction: column;
            box-shadow: 0 16px 60px rgba(0,0,0,0.3); overflow: hidden;
            font-family: -apple-system, sans-serif;
        }
        .ca-poi-header {
            background: linear-gradient(135deg, #0bd3cd, #007aff);
            color: white; padding: 14px 16px;
            display: flex; justify-content: space-between; align-items: center;
            font-weight: 700; font-size: 14px; flex-shrink: 0;
        }
        .ca-poi-header button {
            background: rgba(255,255,255,0.25); border: none; color: white;
            width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 13px;
        }
        .ca-poi-toolbar { padding: 10px 12px; border-bottom: 1px solid #eee; flex-shrink: 0; }
        #ca-poi-search {
            width: 100%; box-sizing: border-box; padding: 8px 12px;
            border: 1.5px solid #e0e0e0; border-radius: 8px; font-size: 13px;
            margin-bottom: 8px; outline: none;
        }
        #ca-poi-search:focus { border-color: #007aff; }
        .ca-type-tabs { display: flex; gap: 5px; }
        .ca-tab {
            flex: 1; padding: 6px 0; border: 1.5px solid #e0e0e0; border-radius: 8px;
            background: white; font-size: 11px; font-weight: 600; color: #666; cursor: pointer; transition: all 0.15s;
        }
        .ca-tab.active { border-color: #007aff; background: #e8f0ff; color: #007aff; }
        #ca-poi-list { flex: 1; overflow-y: auto; }
        .ca-poi-row {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 14px; cursor: pointer; transition: background 0.1s;
        }
        .ca-poi-row:hover { background: #f7f7f7; }
        .ca-poi-row input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; accent-color: #007aff; }
        .ca-poi-thumb { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid #e8e8e8; }
        .ca-poi-info { flex: 1; min-width: 0; }
        .ca-poi-name { font-size: 13px; font-weight: 600; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; }
        .ca-center-bar { background: #f0f7ff; padding: 6px 14px; font-size: 11px; color: #555; border-bottom: 1px solid #e5eaf0; }
        .ca-poi-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
        .ca-poi-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 20px; }
        .ca-poi-dist { font-size: 11px; color: #888; font-weight: 600; white-space: nowrap; }
        .ca-map-btn {
            flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
            background: #f0f7ff; display: flex; align-items: center; justify-content: center;
            font-size: 16px; text-decoration: none; transition: background 0.15s;
        }
        .ca-map-btn:hover { background: #d0e8ff; }
        .ca-poi-footer {
            padding: 10px 14px; border-top: 1px solid #eee; flex-shrink: 0;
            display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;
        }
        .ca-sel-info { font-size: 12px; color: #666; white-space: nowrap; }
        .ca-sel-info b { color: #007aff; }
        .ca-poi-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .ca-poi-actions button {
            padding: 7px 10px; border: 1.5px solid #ddd; border-radius: 8px;
            background: white; font-size: 11px; font-weight: 600; color: #555; cursor: pointer; transition: background 0.1s;
        }
        .ca-poi-actions button:hover { background: #f0f0f0; }
        .ca-export-sel-btn {
            background: linear-gradient(135deg, #0bd3cd, #007aff) !important;
            color: white !important; border-color: transparent !important;
        }
        .ca-export-sel-btn:hover { opacity: 0.88; background: linear-gradient(135deg, #0bd3cd, #007aff) !important; }
    `;

    const PANEL_HTML = `
        <div class="ca-ph">
            <span class="ca-ph-title">📥 CA Wayspot Exporter</span>
            <button class="ca-ph-close" onclick="document.getElementById('ca-panel').classList.remove('open')">✕</button>
        </div>

        <div class="ca-steps">
            <strong>วิธีใช้งาน:</strong>
            <ol>
                <li>เปิดหน้า <b>Map</b> ใน Wayfarer</li>
                <li><b>เลื่อน/ซูม</b> แผนที่ไปยังพื้นที่ที่ต้องการ รอให้ POI โหลด</li>
                <li>เลือก <b>โหมด</b> และ <b>รัศมี</b> (ถ้าต้องการ)</li>
                <li>กด <b>Export</b> เพื่อดาวน์โหลด JSON</li>
                <li>เมื่อ Export แล้ว ให้ไป Import ข้อมูลที่ <b>CA Wayspot Tools</b> หัวข้อ <b>การจัดการข้อมูล Wayspot</b> เลือก <b>นำเข้า JSON</b></li>
            </ol>
        </div>

        <div class="ca-sec">
            <div class="ca-sec-label">📍 โหมดพื้นที่</div>
            <div class="ca-btn-row">
                <button class="ca-mode-btn active" data-mode="screen" onclick="window.__CA_setMode(this)">🖥️ ตามหน้าจอ</button>
                <button class="ca-mode-btn" data-mode="radius" onclick="window.__CA_setMode(this)">📏 ระบุรัศมี</button>
            </div>
        </div>

        <div class="ca-sec" id="ca-radius-section" style="display:none;">
            <div class="ca-sec-label">📏 รัศมี</div>
            <div class="ca-btn-row">
                <button class="ca-radius-btn" data-r="100" onclick="window.__CA_setRadius(this)">100 m</button>
                <button class="ca-radius-btn active" data-r="250" onclick="window.__CA_setRadius(this)">250 m</button>
                <button class="ca-radius-btn" data-r="500" onclick="window.__CA_setRadius(this)">500 m</button>
            </div>
            <div class="ca-coord-group">
                <div class="ca-coord-row">
                    <input id="ca-lat" type="number" step="any" placeholder="ละติจูด (Lat)">
                    <input id="ca-lng" type="number" step="any" placeholder="ลองจิจูด (Lng)">
                </div>
                <button class="ca-autofill-btn" onclick="window.__CA_autofill()">⚡ ดึงพิกัดจากหน้าจออัตโนมัติ</button>
                <div class="ca-coord-hint">เว้นว่างไว้ = ใช้จุดกึ่งกลาง POI ที่โหลดล่าสุด</div>
            </div>
        </div>

        <div class="ca-sec">
            <div class="ca-count-bar">
                <span>🗂️ POI ทั้งหมด: <b id="ca-count-all">0</b></span>
                <span>✅ มีประเภท: <b id="ca-count-typed">0</b></span>
            </div>
            <button id="ca-clear-btn" onclick="window.__CA_clearCache()">🗑️ ล้างแคช</button>
        </div>

        <button id="ca-list-btn" onclick="window.__CA_showPOIList()">📋 ดูและเลือก POI รายจุด</button>
        <button id="ca-export-btn" onclick="window.__CA_doExport()">📥 Export</button>
    `;

    const injectUI = () => {
        if (document.getElementById('ca-fab')) return;

        if (!document.getElementById('ca-styles')) {
            const style = document.createElement('style');
            style.id = 'ca-styles';
            style.textContent = STYLES;
            document.head.appendChild(style);
        }

        const fab = document.createElement('button');
        fab.id = 'ca-fab';
        fab.textContent = '📥 CA Exporter';
        fab.onclick = () => document.getElementById('ca-panel')?.classList.toggle('open');
        document.body.appendChild(fab);

        const panel = document.createElement('div');
        panel.id = 'ca-panel';
        panel.innerHTML = PANEL_HTML;
        document.body.appendChild(panel);

        _updateCount();
    };

    setInterval(injectUI, 2000);
})();
