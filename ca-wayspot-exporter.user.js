// ==UserScript==
// @name         CA Wayspot Exporter
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  ส่งออกข้อมูลเสาจาก Niantic Wayfarer แบบอัตโนมัติ (ผ่าน XHR/Fetch) ภายในรัศมี 500m
// @author       CA Community
// @match        *://wayfarer.nianticlabs.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // === DATA CACHE ===
    // เก็บ Wayspot ทุกอันที่โหลดผ่านหลอด Network
    window.__CA_WAYSPOT_CACHE = new Map();

    // === HA VERSINE DISTANCE (คำนวณระยะทางเมตร) ===
    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // เมตร
        const p1 = lat1 * Math.PI / 180;
        const p2 = lat2 * Math.PI / 180;
        const dp = (lat2 - lat1) * Math.PI / 180;
        const dl = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    // === XHR / FETCH INTERCEPTOR ===
    // แย่งจับข้อมูล JSON ที่วิ่งเข้าเว็บหน้าจอ
    const extractFromJSON = (obj) => {
        if (!obj) return;
        if (Array.isArray(obj)) {
            obj.forEach(extractFromJSON);
        } else if (typeof obj === 'object') {
            let lat = obj.lat || (obj.latE6 ? obj.latE6 / 1e6 : null);
            let lng = obj.lng || (obj.lngE6 ? obj.lngE6 / 1e6 : null);

            // โฟกัสเฉพาะ Object ที่มีพิกัด หรือพบ ID เพื่อจับรวมร่างกัน
            if (lat && lng && (obj.title || obj.name || obj.imageUrl || obj.guid || obj.id)) {
                let id = obj.guid || obj.id || (lat + "_" + lng);
                let name = obj.title || obj.name || "Unknown Wayspot";
                
                // พยายามกวาดหา URL รูปภาพทุกรูปแบบที่ Niantic นิยมใช้
                let imgUrl = obj.imageUrl || obj.image || obj.coverImageUrl || obj.photoUrl || obj.url || "";
                if (!imgUrl && Array.isArray(obj.imageUrls) && obj.imageUrls.length > 0 && typeof obj.imageUrls[0] === 'string') imgUrl = obj.imageUrls[0];
                if (!imgUrl && Array.isArray(obj.photos) && obj.photos.length > 0 && obj.photos[0].url) imgUrl = obj.photos[0].url;
                if (!imgUrl && Array.isArray(obj.images) && obj.images.length > 0 && obj.images[0].url) imgUrl = obj.images[0].url;
                
                let rawStr = JSON.stringify(obj);
                
                // ท่าไม้ตาย: ถ้าหาไม่เจอจริงๆ ให้ควานหาลิงก์ googleusercontent (ที่เก็บรูป Niantic) ในก้อนข้อความ
                if (!imgUrl) {
                    let photoMatch = rawStr.match(/https:\/\/(lh3\.googleusercontent\.com|ggpht\.com)[^"'\\]+/i);
                    if (photoMatch) {
                        imgUrl = photoMatch[0];
                    }
                }

                rawStr = rawStr.toLowerCase();
                let statusInfo = "none"; 
                let caType = "none"; // default for None

                // วิเคราะห์สถานะจาก JSON (Pokestop, Gym, Power Spot, None)
                if (rawStr.includes('pokestop') || rawStr.includes('pgo_pokestop')) {
                    statusInfo = "PokeStop"; caType = "pokestop";
                } else if (rawStr.includes('gym') || rawStr.includes('pgo_gym')) {
                    statusInfo = "Gym"; caType = "gym";
                } else if (rawStr.includes('power_spot') || rawStr.includes('powerspot')) {
                    statusInfo = "Power Spot"; caType = "powerspot";
                }

                // การ Merge ข้อมูล: ถ้าเราเคยมีรูปเสานี้แล้ว จะไม่เขียนทับด้วย String ว่าง
                let existing = window.__CA_WAYSPOT_CACHE.get(id);
                if (existing && !imgUrl) imgUrl = existing.imgUrl;
                if (existing && name === "Unknown Wayspot") name = existing.name;

                window.__CA_WAYSPOT_CACHE.set(id, {
                    id: id,
                    type: caType,
                    statusText: statusInfo,
                    name: name,
                    lat: lat,
                    lng: lng,
                    radius: 40,
                    imgUrl: imgUrl
                });
            }
            // ค้นหาลึกลงไปใน Child objects
            Object.values(obj).forEach(extractFromJSON);
        }
    };

    // Intercept Fetch
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
        const res = await origFetch.apply(this, args);
        try {
            const clone = res.clone();
            clone.json().then(data => extractFromJSON(data)).catch(() => { });
        } catch (e) { }
        return res;
    };

    // Intercept XHR
    const origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('load', function () {
            if (this.responseType === '' || this.responseType === 'text' || this.responseType === 'json') {
                try {
                    let text = this.responseType === 'json' ? JSON.stringify(this.response) : this.responseText;
                    if (text && text.includes('{')) extractFromJSON(JSON.parse(text));
                } catch (e) { }
            }
        });
        origXHRSend.apply(this, args);
    };

    // === UI INJECTION ===
    const injectStyles = () => {
        if (document.getElementById('ca-wayspot-styles')) return;
        const style = document.createElement('style');
        style.id = 'ca-wayspot-styles';
        style.innerHTML = `
            #ca-wayspot-export-btn {
                position: fixed !important; bottom: 30px !important; right: 30px !important;
                z-index: 999999 !important; background: linear-gradient(135deg, #0bd3cd, #007aff) !important;
                color: white !important; border: none !important; border-radius: 50px !important;
                padding: 12px 24px !important; font-family: sans-serif !important; font-size: 14px !important;
                font-weight: bold !important; cursor: pointer !important; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3) !important;
                transition: transform 0.2s !important;
            }
            #ca-wayspot-export-btn:hover { transform: scale(1.05) !important; }
            #ca-wayspot-export-btn.loading { opacity: 0.8 !important; pointer-events: none !important; }
        `;
        document.head.appendChild(style);
    };

    const injectButton = () => {
        if (document.getElementById('ca-wayspot-export-btn')) return;
        injectStyles();
        const btn = document.createElement('button');
        btn.id = 'ca-wayspot-export-btn';
        btn.innerHTML = '📥 Export CA (รัศมี 500m)';
        btn.addEventListener('click', handleExportClick);
        document.body.appendChild(btn);
    };

    const triggerDownload = (jsonData, filename) => {
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
    };

    const processAndExport = (gpsLat, gpsLng, btn) => {
        const allSpots = Array.from(window.__CA_WAYSPOT_CACHE.values());
        let filteredSpots = [];

        if (gpsLat && gpsLng) {
            filteredSpots = allSpots.filter(spot => {
                const dist = getDistance(gpsLat, gpsLng, spot.lat, spot.lng);
                return dist <= 500;
            });
        } else {
            filteredSpots = allSpots; // ถ้าหา GPS ไม่ได้ ให้โชว์ทั้งหมดที่ดักจับได้
        }

        if (filteredSpots.length > 0) {
            const timestamp = new Date().toLocaleString('th-TH');
            // เรียบเรียงชื่อโดยเพิ่มวงเล็บสถานะตามที่ขอ
            filteredSpots.forEach(s => {
               if(s.statusText !== 'none' && !s.name.includes(s.statusText)) {
                   s.name = `${s.name} [${s.statusText}]`;
               } 
            });

            const projectData = {
                id: 'proj_' + new Date().getTime(),
                name: 'Wayfarer Export [500m] ' + timestamp,
                data: filteredSpots
            };
            triggerDownload([projectData], `CA_Wayfarer_500m_${new Date().getTime()}.json`);
            btn.innerHTML = `✅ สำเร็จ! (${filteredSpots.length} จุด)`;
        } else {
            btn.innerHTML = '❌ ไม่พบข้อมูล (ลองเลื่อนแผนที่)';
            alert('ไม่พบเสาในรัศมี 500m หรือยังไม่มีการโหลดหน้าจอแผนที่ (กรุณาซูม/เลื่อนแผนที่เพื่อให้ข้อมูลโหลดเข้ามาก่อน)');
        }

        setTimeout(() => { btn.innerHTML = '📥 Export CA (รัศมี 500m)'; btn.classList.remove('loading'); }, 3000);
    };

    const handleExportClick = (e) => {
        const btn = e.target;
        btn.innerHTML = '📍 กำลังหา GPS...';
        btn.classList.add('loading');

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => processAndExport(pos.coords.latitude, pos.coords.longitude, btn),
                (err) => {
                    alert('ไม่อนุญาต/ไม่สามารถดึง GPS ได้ ระบบจะส่งออกทุกเสาที่โหลดไว้บนพื้นที่ปัจจุบันแทน');
                    processAndExport(null, null, btn);
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else {
            processAndExport(null, null, btn);
        }
    };

    setInterval(injectButton, 2000);
})();
