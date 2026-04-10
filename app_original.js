<script>
        // i18n Localization Dictionary
        const i18n = {
            th: {
                tooltipAddWayspot: "เพิ่ม Wayspot",
                tooltipEditPosition: "แก้ไขตำแหน่ง",
                tooltipWayspotList: "รายการ Wayspot",
                tooltipSettings: "การตั้งค่า",
                tooltipMyLocation: "ตำแหน่งของฉัน",
                addWayspotTitle: "📍 เพิ่ม Wayspot",
                wayspotTypeLabel: "ประเภท Wayspot",
                optPokestop: "PokéStop",
                optGym: "Gym",
                optCaPokestop: "CA PokéStop",
                optCaGym: "CA Gym",
                nameLabel: "ชื่อ",
                namePlaceholder: "ศาลพระภูมิ...",
                imgUrlLabel: "URL รูปภาพ (ไม่บังคับ)",
                latLabel: "ละติจูด (Lat)",
                lngLabel: "ลองจิจูด (Lng)",
                radiusLabel: "รัศมี (เมตร)",
                btnAddByCoords: "เพิ่มด้วยพิกัด",
                addByMapHint: "หรือคลิกบนแผนที่เพื่อเพิ่มหมุด",
                allWayspotsTitle: "รายการทั้งหมด",
                settingsTitle: "การตั้งค่า",
                mapLayerLabel: "การแสดงผลแผนที่",
                optGmapStreet: "Google Maps (ถนน)",
                optGmapSat: "Google Maps (ดาวเทียม)",
                optOsm: "OpenStreetMap",
                optCartoDark: "CartoDB DarkMatter",
                optBing: "Bing Maps (ดาวเทียม)",
                mapFeatureTitle: "ฟีเจอร์แผนที่",
                darkMode: "🌙 โหมดกลางคืน",
                s2Grid: "🌐 แสดง S2 Cells (L14, L17)",
                draggable: "✋ อนุญาตให้ลากหมุด",
                iconSizeLabel: "ปรับขนาดรูป Wayspot",
                showRadiusLabel: "แสดงวงรัศมีของ Wayspot",
                visibilityTitle: "การแสดงผล Wayspot",
                forceRadiusTitle: "บังคับเปลี่ยนรัศมี Wayspot",
                radiusPlaceholder: "ระบุระยะ (เช่น 20 หรือ 40)",
                forceRadiusBtn: "เปลี่ยนระยะรัศมีทั้งหมด",
                cloudSyncTitle: "Cloud Sync (Google Drive)",
                saveToDrive: "☁️ บันทึกขึ้น Google Drive",
                loadFromDrive: "☁️ โหลดจาก Google Drive",
                localDataTitle: "การจัดการแฟ้มข้อมูล (Local)",
                importKML: "📥 นำเข้า KML",
                exportKML: "📤 ส่งออก KML",
                clearAll: "🗑️ ล้างข้อมูลทั้งหมด",
                langTitle: "ภาษา (Language)",
                credits: "จัดทำโดย CA: Community Ambassador Thailand",
                btnDone: "เสร็จสิ้น",
                editTitle: "แก้ไขข้อมูล",
                editTypeLabel: "ประเภท",
                btnCancel: "ยกเลิก",
                btnSave: "บันทึก",
                welcomeTitle: "สวัสดีครับ 👋",
                welcomeText: "<b>CA Wayspot Tools</b> โฉมใหม่!<br><br>จำลอง กะระยะ และวางแผนการตั้ง CA Wayspot ได้ง่ายขึ้น รองรับการวาด S2 Cells และไฟล์ KML จาก Google My Maps<br><br>ลองคลิกบนแผนที่เพื่อปักหมุดแรกได้เลยครับ",
                btnStart: "เริ่มต้นใช้งาน",
                noDataToSave: "ไม่มีข้อมูลที่จะบันทึก",
                saveSuccess: "บันทึกลง Google Drive สำเร็จ! ☁️",
                saveFailed: "บันทึกไม่สำเร็จ Error: ",
                backupNotFound: "ไม่พบไฟล์แบ็กอัพใน Google Drive ของคุณ",
                loadSuccess: "โหลดข้อมูลสำเร็จ! ☁️",
                loadFailed: "กู้คืนไม่สำเร็จ: ",
                importSuccessCount: "นำเข้าสำเร็จ {count} จุด\n(ข้ามข้อมูลซ้ำ {dup} จุด)",
                noLocationFound: "ไม่พบข้อมูลตำแหน่ง",
                invalidLatLong: "กรุณากรอกพิกัด Latitude และ Longitude ให้ครบและถูกต้อง",
                deleteConfirmMark: "ลบ Wayspot นี้ออก?",
                invalidRadius: "กรุณากรอกตัวเลขระยะรัศมีให้ถูกต้อง",
                confirmRadiusChange: "ต้องการเปลี่ยนรัศมีของตำแหน่งทั้งหมดเป็น {radius} เมตร ใช่หรือไม่?",
                radiusChangeSuccess: "เปลี่ยนระยะรัศมีทั้งหมด {count} จุดสำเร็จ!",
                clearAllConfirm: "คุณต้องการลบข้อมูลทั้งหมดจริงๆ หรือไม่?",
                unnamedAlert: "ไม่มีชื่อ",
                countLabel: "จำนวน:",
                infoCoords: "พิกัด:",
                btnEdit: "แก้ไข",
                btnDelete: "ลบ",
                editWayspot: "แก้ไข Wayspot"
            },
            en: {
                tooltipAddWayspot: "Add Wayspot",
                tooltipEditPosition: "Edit Position",
                tooltipWayspotList: "Wayspot List",
                tooltipSettings: "Settings",
                tooltipMyLocation: "My Location",
                addWayspotTitle: "📍 Add Wayspot",
                wayspotTypeLabel: "Wayspot Type",
                optPokestop: "PokéStop",
                optGym: "Gym",
                optCaPokestop: "CA PokéStop",
                optCaGym: "CA Gym",
                nameLabel: "Name",
                namePlaceholder: "Shrine...",
                imgUrlLabel: "Image URL (Optional)",
                latLabel: "Latitude",
                lngLabel: "Longitude",
                radiusLabel: "Radius (meters)",
                btnAddByCoords: "Add by Coordinates",
                addByMapHint: "Or click on the map to add a pin",
                allWayspotsTitle: "All Wayspots",
                settingsTitle: "Settings",
                mapLayerLabel: "Map Layer",
                optGmapStreet: "Google Maps (Street)",
                optGmapSat: "Google Maps (Satellite)",
                optOsm: "OpenStreetMap",
                optCartoDark: "CartoDB DarkMatter",
                optBing: "Bing Maps (Satellite)",
                mapFeatureTitle: "Map Features",
                darkMode: "🌙 Dark Mode",
                s2Grid: "🌐 Show S2 Cells (L14, L17)",
                draggable: "✋ Allow Draggable Wayspot",
                iconSizeLabel: "Adjust Wayspot Icon Size",
                showRadiusLabel: "Show Wayspot Radius",
                visibilityTitle: "Wayspot Visibility",
                forceRadiusTitle: "Force Change Radius",
                radiusPlaceholder: "Enter distance (e.g., 20 or 40)",
                forceRadiusBtn: "Change All Radiuses",
                cloudSyncTitle: "Cloud Sync (Google Drive)",
                saveToDrive: "☁️ Save to Google Drive",
                loadFromDrive: "☁️ Load from Google Drive",
                localDataTitle: "Data Management (Local)",
                importKML: "📥 Import KML",
                exportKML: "📤 Export KML",
                clearAll: "🗑️ Clear All Data",
                langTitle: "Language",
                credits: "Made by CA: Community Ambassador Thailand",
                btnDone: "Done",
                editTitle: "Edit Wayspot",
                editTypeLabel: "Type",
                btnCancel: "Cancel",
                btnSave: "Save",
                welcomeTitle: "Sawasdee! 👋",
                welcomeText: "Welcome to <b>CA Wayspot Tools</b>!<br><br>Easily simulate, measure, and plan CA Wayspots. Built in support for S2 Cells and KML files from Google My Maps.<br><br>Click anywhere on the map to place your first pin.",
                btnStart: "Get Started",
                noDataToSave: "No data to save",
                saveSuccess: "Successfully saved to Google Drive! ☁️",
                saveFailed: "Failed to save. Error: ",
                backupNotFound: "No backup file found in your Google Drive.",
                loadSuccess: "Data loaded successfully! ☁️",
                loadFailed: "Failed to restore: ",
                importSuccessCount: "Successfully imported {count} pins\n(Skipped {dup} duplicates)",
                noLocationFound: "Location data not found",
                invalidLatLong: "Please enter valid Latitude and Longitude.",
                deleteConfirmMark: "Delete this Wayspot?",
                invalidRadius: "Please enter a valid radius number.",
                confirmRadiusChange: "Are you sure you want to change the radius of all Wayspots to {radius} meters?",
                radiusChangeSuccess: "Successfully changed radius for {count} Wayspots!",
                clearAllConfirm: "Are you sure you want to clear all data?",
                unnamedAlert: "Unnamed",
                countLabel: "Total:",
                infoCoords: "Coords:",
                btnEdit: "Edit",
                btnDelete: "Delete",
                editWayspot: "Edit Wayspot"
            }
        };

        let currentLang = localStorage.getItem('appLang') || 'th';

        function t(key, params = {}) {
            let str = i18n[currentLang][key] || key;
            for (let p in params) {
                str = str.replace(`{${p}}`, params[p]);
            }
            return str;
        }

        function applyTranslations() {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                el.innerHTML = t(el.getAttribute('data-i18n'));
            });
            document.querySelectorAll('[data-tooltip-i18n]').forEach(el => {
                el.setAttribute('data-tooltip', t(el.getAttribute('data-tooltip-i18n')));
            });
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
            });

            let langSelect = document.getElementById('setting-language');
            if (langSelect) langSelect.value = currentLang;
        }

        function changeLanguage() {
            currentLang = document.getElementById('setting-language').value;
            localStorage.setItem('appLang', currentLang);
            applyTranslations();
            refreshInfoPanel();
            if (window.updateAllPopupContents) window.updateAllPopupContents();
        }

        window.addEventListener('DOMContentLoaded', applyTranslations);
        // Service Worker Registration for PWA
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Reg Failed', err));
            });
        }

        // Google Drive Sync Logic
        const CLIENT_ID = '185984263865-g9029qge3j0o3tsft9hqasp6dkujf34i.apps.googleusercontent.com';
        const SCOPES = 'https://www.googleapis.com/auth/drive.file';
        let tokenClient;
        let accessToken = null;
        let pendingDriveAction = null;

        function initGSI() {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID, scope: SCOPES,
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        accessToken = tokenResponse.access_token;
                        executeDriveAction();
                    }
                },
            });
        }

        function requestDriveAccess(action) {
            pendingDriveAction = action;
            if (accessToken) executeDriveAction();
            else tokenClient.requestAccessToken({ prompt: 'consent' });
        }

        async function executeDriveAction() {
            if (pendingDriveAction === 'export') {
                document.body.style.cursor = 'wait';
                await uploadToDrive();
                document.body.style.cursor = 'default';
            } else if (pendingDriveAction === 'import') {
                document.body.style.cursor = 'wait';
                await downloadFromDrive();
                document.body.style.cursor = 'default';
            }
        }

        async function searchBackupFile() {
            let url = 'https://www.googleapis.com/drive/v3/files?q=name="CA_Wayspot_Backup.json" and trashed=false&spaces=drive';
            let res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
            if (res.ok) {
                let data = await res.json();
                if (data.files && data.files.length > 0) return data.files[0].id;
            } else if (res.status === 401) accessToken = null;
            return null;
        }

        async function uploadToDrive() {
            let currentData = localStorage.getItem('pokemonMapSavedData');
            if (!currentData || Object.keys(spotsData).length === 0) return alert(t('noDataToSave'));

            let fileId = await searchBackupFile();
            let url = fileId ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media` : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
            let method = fileId ? 'PATCH' : 'POST';
            let headers = new Headers();
            headers.append('Authorization', 'Bearer ' + accessToken);

            let body;
            if (fileId) {
                headers.append('Content-Type', 'application/json'); body = currentData;
            } else {
                let boundary = '-------314159CAWAYSPOT';
                let delimiter = "\r\n--" + boundary + "\r\n";
                let close_delim = "\r\n--" + boundary + "--";
                let meta = { name: 'CA_Wayspot_Backup.json', mimeType: 'application/json' };
                headers.append('Content-Type', `multipart/related; boundary="${boundary}"`);
                body = delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(meta) + delimiter + 'Content-Type: application/json\r\n\r\n' + currentData + close_delim;
            }

            try {
                let res = await fetch(url, { method: method, headers: headers, body: body });
                if (res.ok) alert(t('saveSuccess'));
                else { alert(t('saveFailed') + res.status); if (res.status === 401) accessToken = null; }
            } catch (e) { alert("Error: " + e.message); }
        }

        async function downloadFromDrive() {
            let fileId = await searchBackupFile();
            if (!fileId) return alert(t('backupNotFound'));

            let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            try {
                let res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
                if (res.ok) {
                    let data = await res.json();
                    if (Array.isArray(data)) {
                        for (let id in spotsData) if (map.hasLayer(spotsData[id].layerGroup)) map.removeLayer(spotsData[id].layerGroup);
                        spotsData = {}; spotIdCounter = 0;
                        localStorage.setItem('pokemonMapSavedData', JSON.stringify(data));
                        loadFromStorage(); updateVisibility(); refreshInfoPanel();
                        alert(t('loadSuccess'));
                        closeModal('settings-modal-overlay');
                    }
                } else alert(t('loadFailed') + res.status);
            } catch (e) { alert("Error: " + e.message); }
        }

        // Dark Mode Logic
        window.toggleDarkMode = function () {
            var isDark = document.getElementById('setting-darkmode').checked;
            if (isDark) document.body.classList.add('dark-mode');
            else document.body.classList.remove('dark-mode');
            localStorage.setItem('caWayspotDarkMode', isDark);
        };
        // Init dark mode
        if (localStorage.getItem('caWayspotDarkMode') === 'true') {
            document.body.classList.add('dark-mode');
            window.addEventListener('load', () => { document.getElementById('setting-darkmode').checked = true; });
        }

        // Modal Logic
        function openModal(id) {
            const overlay = document.getElementById(id);
            const modal = overlay.querySelector('.modal');
            overlay.style.display = 'flex';
            // Trigger reflow
            void overlay.offsetWidth;
            overlay.classList.add('active');
            modal.classList.add('active');
        }

        function closeModal(id) {
            const overlay = document.getElementById(id);
            const modal = overlay.querySelector('.modal');
            overlay.classList.remove('active');
            modal.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
                modal.scrollTop = 0;
            }, 300);
        }

        // Show welcome by default (only on first visit)
        window.addEventListener('load', () => {
            if (!localStorage.getItem('caWayspotWelcomeShown')) {
                setTimeout(() => openModal('welcome-modal-overlay'), 300);
                localStorage.setItem('caWayspotWelcomeShown', 'true');
            }
        });

        // Panels
        var isControlPanelOpen = true;
        function toggleControlContent() {
            var content = document.getElementById('control-content');
            var btn = document.getElementById('btn-toggle-control');
            if (isControlPanelOpen) { content.style.display = 'none'; btn.innerText = '🔼'; }
            else { content.style.display = 'flex'; btn.innerText = '🔽'; }
            isControlPanelOpen = !isControlPanelOpen;
        }

        function toggleInfoPanel() {
            var panel = document.getElementById('info-panel');
            if (panel.style.display === 'block') { panel.style.display = 'none'; }
            else { panel.style.display = 'block'; refreshInfoPanel(); }
        }

        function escapeHTML(str) {
            if (!str) return '';
            return str.replace(/[&<>'"]/g, function (tag) {
                var charsToReplace = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
                return charsToReplace[tag] || tag;
            });
        }

        // Map Setup
        var map = L.map('map', { zoomControl: false }).setView([13.7649, 100.5383], 16);
        L.control.zoom({ position: 'bottomleft' }).addTo(map);

        var osmLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20 });
        osmLayer.on('tileerror', function (error) { console.warn('OSM tile error', error); });

        var gmapStreet = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] });
        gmapStreet.on('tileerror', function (error) { console.warn('GMap tile error', error); });

        var gmapSat = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] });
        gmapSat.on('tileerror', function (error) { console.warn('GSat tile error', error); });

        var cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 });
        cartoDark.on('tileerror', function (error) { console.warn('Carto dark tile error', error); });

        L.TileLayer.Bing = L.TileLayer.extend({
            getTileUrl: function (coords) {
                var quadkey = '';
                for (var i = coords.z; i > 0; i--) {
                    var digit = 0, mask = 1 << (i - 1);
                    if ((coords.x & mask) !== 0) digit += 1;
                    if ((coords.y & mask) !== 0) digit += 2;
                    quadkey += digit;
                }
                return this._url.replace('{q}', quadkey);
            }
        });
        var bingSat = new L.TileLayer.Bing('https://t0.tiles.virtualearth.net/tiles/a{q}.jpeg?g=129', { maxZoom: 19, attribution: 'Bing Maps' });

        var currentLayer = gmapStreet;
        currentLayer.addTo(map);

        window.changeMapLayer = function () {
            var selected = document.getElementById('mapLayer').value;
            map.removeLayer(currentLayer);
            if (selected === 'osm') currentLayer = osmLayer;
            else if (selected === 'cartodb_dark') currentLayer = cartoDark;
            else if (selected === 'bing') currentLayer = bingSat;
            else if (selected === 'gmap_street') currentLayer = gmapStreet;
            else if (selected === 'gmap_sat') currentLayer = gmapSat;
            currentLayer.addTo(map);
        };

        var s2LayerGroup = L.layerGroup().addTo(map);

        window.updateS2Grid = function () {
            var showS2 = document.getElementById('setting-s2grid').checked;
            s2LayerGroup.clearLayers();
            if (!showS2) return;
            var zoom = map.getZoom();
            if (zoom < 13) return; // Prevent heavy rendering
            drawS2Level(14, { color: '#ff9500', weight: 4, fillOpacity: 0, opacity: 0.9, interactive: false });
            if (zoom >= 15) {
                drawS2Level(17, { color: '#34c759', weight: 2, fillOpacity: 0, opacity: 0.7, interactive: false });
            }
        };

        function drawS2Level(level, styleOptions) {
            try {
                var bounds = map.getBounds().pad(0.1);
                var center = map.getCenter();
                var startCell = S2.S2Cell.FromLatLng(center, level);
                var queue = [startCell.toHilbertQuadkey()];
                var seen = new Set();

                while (queue.length > 0) {
                    var key = queue.shift();
                    if (seen.has(key)) continue;
                    seen.add(key);
                    var cell = S2.S2Cell.FromHilbertQuadKey(key);
                    var corners = cell.getCornerLatLngs();
                    var inBounds = corners.some(p => bounds.contains([p.lat, p.lng]));
                    var centerInBounds = bounds.contains([cell.getLatLng().lat, cell.getLatLng().lng]);

                    if (inBounds || centerInBounds) {
                        var latlngs = corners.map(p => [p.lat, p.lng]);
                        s2LayerGroup.addLayer(L.polygon(latlngs, styleOptions));
                        cell.getNeighbors().forEach(n => queue.push(n.toHilbertQuadkey()));
                    }
                }
            } catch (e) {
                console.error("S2 Grid error: ", e);
            }
        }
        map.on('moveend', updateS2Grid);
        map.on('zoomend', updateS2Grid);

        var spotsData = {};
        var spotIdCounter = 0;
        var currentEditId = null;
        var userLocationMarker = null;

        window.updateVisibility = function () {
            var checks = {
                'pokestop': document.getElementById('filter-pokestop').checked,
                'gym': document.getElementById('filter-gym').checked,
                'caspot': document.getElementById('filter-caspot').checked,
                'cagym': document.getElementById('filter-cagym').checked
            };
            for (var id in spotsData) {
                var spot = spotsData[id];
                if (checks[spot.type]) {
                    if (!map.hasLayer(spot.layerGroup)) map.addLayer(spot.layerGroup);
                } else {
                    if (map.hasLayer(spot.layerGroup)) map.removeLayer(spot.layerGroup);
                }
            }
        };

        window.toggleDraggable = function () {
            var isDraggable = document.getElementById('setting-draggable').checked;
            for (var id in spotsData) {
                if (isDraggable) spotsData[id].marker.dragging.enable();
                else spotsData[id].marker.dragging.disable();
            }
            var btnAdd = document.getElementById('fab-add-mode');
            var btnEdit = document.getElementById('fab-edit-mode');
            if (btnAdd && btnEdit) {
                if (isDraggable) {
                    btnEdit.classList.add('active');
                    btnAdd.classList.remove('active');
                } else {
                    btnAdd.classList.add('active');
                    btnEdit.classList.remove('active');
                }
            }
        };

        window.setMode = function (mode) {
            var chk = document.getElementById('setting-draggable');
            chk.checked = (mode === 'edit');
            window.toggleDraggable();
        };

        function saveToStorage() {
            const dataToSave = [];
            for (let id in spotsData) {
                let spot = spotsData[id];
                dataToSave.push({
                    type: spot.type, name: spot.name, imgUrl: spot.imgUrl,
                    lat: spot.lat, lng: spot.lng, radius: spot.radius
                });
            }
            localStorage.setItem('pokemonMapSavedData', JSON.stringify(dataToSave));
        }

        function loadFromStorage() {
            const savedData = localStorage.getItem('pokemonMapSavedData');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                parsedData.forEach(spotData => createSpot(L.latLng(spotData.lat, spotData.lng), spotData, false));
                if (parsedData.length > 0) map.setView([parsedData[0].lat, parsedData[0].lng], 16);
            }
        }

        // Import KML
        // Uses previously added duplicate check.
        window.importKML = function (event) {
            var file = event.target.files[0];
            if (!file) return;

            var reader = new FileReader();
            reader.onload = function (e) {
                var text = e.target.result;
                var parser = new DOMParser();
                var xmlDoc = parser.parseFromString(text, "text/xml");
                var placemarks = xmlDoc.getElementsByTagName("Placemark");
                var importedCount = 0;
                var duplicateCount = 0;

                for (var i = 0; i < placemarks.length; i++) {
                    var pm = placemarks[i];
                    var name = pm.getElementsByTagName("name")[0]?.textContent || "ไม่มีชื่อ";
                    var desc = pm.getElementsByTagName("description")[0]?.textContent || "";
                    var point = pm.getElementsByTagName("Point")[0];

                    if (point) {
                        var coords = point.getElementsByTagName("coordinates")[0]?.textContent.trim().split(',');
                        if (coords && coords.length >= 2) {
                            var lng = parseFloat(coords[0]), lat = parseFloat(coords[1]);
                            var type = 'pokestop';
                            if (desc.includes('CA Gym')) type = 'cagym';
                            else if (desc.includes('Gym')) type = 'gym';
                            else if (desc.includes('CA PokeStop') || desc.includes('CA Spot')) type = 'caspot';

                            var radiusMatch = desc.match(/รัศมี:\s*(\d+)/);
                            var radius = radiusMatch ? parseInt(radiusMatch[1]) : 40;

                            var isDuplicate = false;
                            for (var existingId in spotsData) {
                                var existing = spotsData[existingId];
                                if (Math.abs(existing.lat - lat) < 0.00001 && Math.abs(existing.lng - lng) < 0.00001) {
                                    isDuplicate = true; break;
                                }
                            }
                            if (!isDuplicate) {
                                createSpot(L.latLng(lat, lng), { type: type, name: name, imgUrl: '', radius: radius, lat: lat, lng: lng }, false);
                                importedCount++;
                            } else duplicateCount++;
                        }
                    }
                }

                if (importedCount > 0 || duplicateCount > 0) {
                    alert(t('importSuccessCount', { count: importedCount, dup: duplicateCount }));
                    saveToStorage(); updateVisibility();
                    var lastId = Object.keys(spotsData).pop();
                    if (lastId && importedCount > 0) map.setView([spotsData[lastId].lat, spotsData[lastId].lng], 16);
                } else alert(t('noLocationFound'));
                event.target.value = '';
            };
            reader.readAsText(file);
        };

        window.exportKML = function () {
            if (Object.keys(spotsData).length === 0) return alert(t('noDataToSave'));
            let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Map Export</name>\n`;
            for (let id in spotsData) {
                let spot = spotsData[id];
                let typeName = getStyleByType(spot.type).typeName;
                kmlContent += `    <Placemark>\n      <name>${escapeHTML(spot.name)}</name>\n      <description>ประเภท: ${typeName} | รัศมี: ${spot.radius} เมตร</description>\n      <Point><coordinates>${spot.lng},${spot.lat},0</coordinates></Point>\n    </Placemark>\n`;
            }
            kmlContent += `  </Document>\n</kml>`;
            let blob = new Blob([kmlContent], { type: "application/vnd.google-earth.kml+xml" });
            let url = URL.createObjectURL(blob);
            let a = document.createElement("a"); a.href = url; a.download = "export_points.kml";
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        };

        window.clearAllSpots = function () {
            if (confirm(t('clearAllConfirm'))) {
                for (let id in spotsData) {
                    if (map.hasLayer(spotsData[id].layerGroup)) map.removeLayer(spotsData[id].layerGroup);
                }
                spotsData = {}; spotIdCounter = 0; saveToStorage(); refreshInfoPanel(); closeModal('settings-modal-overlay');
            }
        };

        function getStyleByType(type) {
            if (type === 'pokestop') return { color: '#007aff', fillColor: '#007aff', typeName: 'PokeStop' };
            if (type === 'gym') return { color: '#ff3b30', fillColor: '#007aff', typeName: 'Gym' };
            if (type === 'caspot') return { color: '#ff2d55', fillColor: '#007aff', typeName: 'CA PokeStop' };
            if (type === 'cagym') return { color: '#af52de', fillColor: '#af52de', typeName: 'CA Gym' };
            return { color: '#007aff', fillColor: '#007aff', typeName: 'Unknown' };
        }

        function getImageUrl(imgUrl, type) {
            let defaultImg = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Pokebola-pokeball-png-0.png/600px-Pokebola-pokeball-png-0.png';
            if (type === 'pokestop' || type === 'gym') defaultImg = 'https://lh3.googleusercontent.com/fs2mYM4r9Qq93ejdOP_2lwefRNLVa9tqmJW7XXwqNhMCMXNKwoJoFuMboBpXwnKUf7fJGImbajM9mHAOMlndt5A-Ts9Qh9f_t6YoaQ6u=s0';
            else if (type === 'caspot') defaultImg = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQcm3QbkubsZfLk4kiEHCdzIe3nezdt3yU4dA&s';
            else if (type === 'cagym') defaultImg = 'https://lh3.googleusercontent.com/p-LbBPtPAKKNNZFMYy84f35FFaEpZBSEfPKx0xK9t48a_SJwaeBEBGOzrPOu0vtcKnnWSe9FpVyt25Rh8PoKldVKlOm9B5iTweq8Ox8=s0';
            return imgUrl || defaultImg;
        }

        function refreshInfoPanel() {
            var htmlData = { 'pokestop': '', 'gym': '', 'caspot': '', 'cagym': '' };
            var counts = { 'pokestop': 0, 'gym': 0, 'caspot': 0, 'cagym': 0 };

            for (var id in spotsData) {
                var spot = spotsData[id];
                var latlngText = `${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}`;
                htmlData[spot.type] += `<div class="info-item"><b>${escapeHTML(spot.name)}</b><br><span class="info-item-coords">📍 ${t('infoCoords')} ${latlngText}</span></div>`;
                counts[spot.type]++;
            }

            var finalHTML = "";
            var cats = [
                { id: 'pokestop', name: t('optPokestop'), color: '#007aff' },
                { id: 'gym', name: t('optGym'), color: '#ff3b30' },
                { id: 'caspot', name: t('optCaPokestop'), color: '#ff2d55' },
                { id: 'cagym', name: t('optCaGym'), color: '#af52de' }
            ];

            cats.forEach(c => {
                var content = htmlData[c.id] || `<div style="font-size:12px; color:var(--text-secondary);">-</div>`;
                finalHTML += `<div class="info-category"><h4 style="color:${c.color}; margin-top: 10px;">${c.name.split(' ')[0]} ${c.name.split(' ')[1] ? c.name.split(' ')[1] : ''} (${t('countLabel')} ${counts[c.id]})</h4>${content}</div>`;
            });

            document.getElementById('info-content').innerHTML = finalHTML;
        }

        function createCustomIcon(imgUrl, borderColor, type) {
            let iconSize = parseInt(document.getElementById('setting-icon-size').value) || 36;
            return L.divIcon({
                className: 'custom-icon-wrapper',
                html: `<img src="${getImageUrl(imgUrl, type)}" class="custom-marker" style="border-color: ${borderColor}; width: ${iconSize}px; height: ${iconSize}px;" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Pokebola-pokeball-png-0.png/600px-Pokebola-pokeball-png-0.png'">`,
                iconSize: [iconSize, iconSize], iconAnchor: [iconSize / 2, iconSize / 2]
            });
        }

        function updatePopupContent(id) {
            var spot = spotsData[id];
            var styleInfo = getStyleByType(spot.type);

            var content = `
                <div style="text-align: center; min-width: 170px;">
                    <h4 style="margin: 0 0 5px 0;">${escapeHTML(spot.name)}</h4>
                    <img src="${getImageUrl(spot.imgUrl, spot.type)}" class="popup-spot-image" style="border-color: ${styleInfo.color};" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Pokebola-pokeball-png-0.png/600px-Pokebola-pokeball-png-0.png'">
                    <span style="font-size: 13px; color: var(--text-secondary);">${t('wayspotTypeLabel')}: <b>${t('opt' + spot.type.charAt(0).toUpperCase() + spot.type.slice(1).replace('pokestop', 'Pokestop').replace('caspot', 'CaPokestop').replace('gym', 'Gym').replace('cagym', 'CaGym')).replace(/ [🔵🔴🌸🟣]/, '')}</b></span><br>
                    <span style="font-size: 12px; color: var(--text-secondary);">${t('radiusLabel').replace(' (เมตร)', '').replace(' (meters)', '')}: <b>${spot.radius} m</b></span><br>
                    <div class="popup-buttons">
                        <button class="popup-btn btn-edit-popup" onclick="window.openEditModal(${id})">${t('btnEdit')}</button>
                        <button class="popup-btn btn-del-popup" onclick="window.removeSpot(${id})">${t('btnDelete')}</button>
                    </div>
                </div>
            `;
            spot.marker.bindPopup(content);
        }

        window.updateAllPopupContents = function () {
            for (let id in spotsData) updatePopupContent(id);
        }

        function createSpot(latlng, savedData = null, isFromClick = false) {
            var type = savedData ? savedData.type : (isFromClick ? 'pokestop' : document.getElementById('spotType').value);
            var name = savedData ? savedData.name : (document.getElementById('spotName').value || t('unnamedAlert'));
            var imgUrl = savedData ? savedData.imgUrl : document.getElementById('spotImage').value;
            var radius = savedData ? savedData.radius : parseInt(document.getElementById('spotRadius').value);

            radius = Math.max(40, Math.min(80, isNaN(radius) ? 40 : radius));
            if (!savedData) document.getElementById('spotRadius').value = radius;

            var styleInfo = getStyleByType(type);
            var showRadius = document.getElementById('setting-show-radius') ? document.getElementById('setting-show-radius').checked : true;
            var circle = L.circle(latlng, { color: styleInfo.color, weight: 2, fillColor: styleInfo.fillColor, fillOpacity: showRadius ? 0.10 : 0, opacity: showRadius ? 1 : 0, radius: radius });
            var marker = L.marker(latlng, {
                icon: createCustomIcon(imgUrl, styleInfo.color, type),
                draggable: document.getElementById('setting-draggable').checked
            });

            var layerGroup = L.layerGroup([circle, marker]);
            var currentId = spotIdCounter++;

            spotsData[currentId] = {
                id: currentId, type: type, name: name, imgUrl: imgUrl,
                radius: radius, lat: latlng.lat, lng: latlng.lng,
                layerGroup: layerGroup, marker: marker, circle: circle
            };

            marker.on('drag', function (e) { circle.setLatLng(e.latlng); });
            marker.on('dragend', function (e) {
                var newPos = e.target.getLatLng();
                spotsData[currentId].lat = newPos.lat; spotsData[currentId].lng = newPos.lng;
                circle.setLatLng(newPos);
                updatePopupContent(currentId); refreshInfoPanel(); saveToStorage();
            });

            updatePopupContent(currentId);
            if (document.getElementById('filter-' + type).checked) layerGroup.addTo(map);
            refreshInfoPanel();
            if (!savedData) saveToStorage();
        }

        map.on('click', function (e) {
            if (document.getElementById('setting-draggable').checked) return;
            document.getElementById('spotLat').value = ''; document.getElementById('spotLng').value = '';
            createSpot(e.latlng, null, true);
        });

        document.getElementById('btnAddByLatLng').addEventListener('click', function () {
            var lat = parseFloat(document.getElementById('spotLat').value);
            var lng = parseFloat(document.getElementById('spotLng').value);
            if (isNaN(lat) || isNaN(lng)) return alert(t('invalidLatLong'));
            var newLatLng = L.latLng(lat, lng);
            createSpot(newLatLng, null, false);
            map.flyTo(newLatLng, 17);

            // Clear form
            document.getElementById('spotName').value = '';
            document.getElementById('spotImage').value = '';
            document.getElementById('spotLat').value = '';
            document.getElementById('spotLng').value = '';
            document.getElementById('spotType').value = 'pokestop';
        });

        window.openEditModal = function (id) {
            var spot = spotsData[id]; currentEditId = id;
            document.getElementById('editType').value = spot.type;
            document.getElementById('editName').value = spot.name;
            document.getElementById('editImage').value = spot.imgUrl || '';
            document.getElementById('editLat').value = spot.lat;
            document.getElementById('editLng').value = spot.lng;
            document.getElementById('editRadius').value = spot.radius;
            map.closePopup(); openModal('edit-modal-overlay');
        };

        window.saveEdit = function () {
            if (currentEditId === null) return;
            var spot = spotsData[currentEditId];
            var newLat = parseFloat(document.getElementById('editLat').value);
            var newLng = parseFloat(document.getElementById('editLng').value);
            var newRadius = parseInt(document.getElementById('editRadius').value);

            if (isNaN(newLat) || isNaN(newLng)) return alert(t('invalidLatLong'));
            newRadius = Math.max(40, Math.min(80, isNaN(newRadius) ? 40 : newRadius));

            spot.type = document.getElementById('editType').value;
            spot.name = document.getElementById('editName').value || t('unnamedAlert');
            spot.imgUrl = document.getElementById('editImage').value;
            spot.lat = newLat; spot.lng = newLng; spot.radius = newRadius;

            var newLatLng = L.latLng(newLat, newLng);
            var styleInfo = getStyleByType(spot.type);

            spot.circle.setLatLng(newLatLng); spot.circle.setRadius(newRadius);
            spot.circle.setStyle({ color: styleInfo.color, fillColor: styleInfo.fillColor });
            spot.marker.setLatLng(newLatLng);
            spot.marker.setIcon(createCustomIcon(spot.imgUrl, styleInfo.color, spot.type));

            updatePopupContent(currentEditId); closeModal('edit-modal-overlay');
            map.flyTo(newLatLng, map.getZoom());
            updateVisibility(); saveToStorage(); refreshInfoPanel();
        };
        window.forceChangeRadius = function () {
            var newRadius = parseInt(document.getElementById('globalRadiusInput').value);
            if (isNaN(newRadius) || newRadius <= 0) return alert(t('invalidRadius'));
            if (confirm(t('confirmRadiusChange', { radius: newRadius }))) {
                let count = 0;
                for (let id in spotsData) {
                    spotsData[id].radius = newRadius;
                    if (spotsData[id].circle) spotsData[id].circle.setRadius(newRadius);
                    count++;
                }
                saveToStorage();
                alert(t('radiusChangeSuccess', { count: count }));
                document.getElementById('globalRadiusInput').value = '';
            }
        };

        window.removeSpot = function (id) {
            if (spotsData[id] && confirm(t('deleteConfirmMark'))) {
                if (map.hasLayer(spotsData[id].layerGroup)) map.removeLayer(spotsData[id].layerGroup);
                delete spotsData[id]; refreshInfoPanel(); saveToStorage();
            }
        };

        document.getElementById('btn-locate').addEventListener('click', function () { map.locate({ setView: true, maxZoom: 17 }); });
        map.on('locationfound', function (e) {
            if (userLocationMarker) map.removeLayer(userLocationMarker);
            userLocationMarker = L.circleMarker(e.latlng, { radius: 8, fillColor: "#007aff", color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.8 }).addTo(map);
            userLocationMarker.bindPopup(currentLang === 'th' ? "คุณอยู่ที่นี่" : "You are here").openPopup();
        });
        map.on('locationerror', function (e) { alert(currentLang === 'th' ? "ไม่สามารถเข้าถึงตำแหน่งของคุณได้" : "Cannot access your location."); });

        window.updateIconSize = function () {
            let iconSize = parseInt(document.getElementById('setting-icon-size').value) || 36;
            if (iconSize < 20) iconSize = 20;
            if (iconSize > 40) iconSize = 40;
            document.getElementById('setting-icon-size').value = iconSize;
            localStorage.setItem('caWayspotIconSize', iconSize);
            for (let id in spotsData) {
                let spot = spotsData[id];
                let styleInfo = getStyleByType(spot.type);
                spot.marker.setIcon(createCustomIcon(spot.imgUrl, styleInfo.color, spot.type));
            }
        };

        window.toggleRadiusVisibility = function () {
            let showRadius = document.getElementById('setting-show-radius').checked;
            localStorage.setItem('caWayspotShowRadius', showRadius);
            for (let id in spotsData) {
                if (spotsData[id].circle) {
                    spotsData[id].circle.setStyle({ fillOpacity: showRadius ? 0.10 : 0, opacity: showRadius ? 1 : 0 });
                }
            }
        };

        if (localStorage.getItem('caWayspotIconSize')) {
            document.getElementById('setting-icon-size').value = localStorage.getItem('caWayspotIconSize');
        }
        if (localStorage.getItem('caWayspotShowRadius') !== null) {
            document.getElementById('setting-show-radius').checked = (localStorage.getItem('caWayspotShowRadius') === 'true');
        }

        loadFromStorage();
        updateVisibility();
    </script>