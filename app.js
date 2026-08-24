/**
 * CA Wayspot Tools - Main Entry Point
 * Refactored Version with Modules
 */
window.CAWayspotApp = (function () {
    const undoStack = [];
    const MAX_UNDO = 50;
    let tutorialIndex = 0;

    // Draw mode — วาด polygon อิสระบนแผนที่เพื่อเลือก Wayspot (ทั้งของผู้ใช้เอง
    // และ Live POI จาก Wayfarer) ที่อยู่ในเขต ไม่พึ่ง library ภายนอก
    let drawModeActive = false;
    let drawPoints = [];
    let drawPreviewLine = null;
    let drawPolygonLayer = null;
    const selectedSpotIds = new Set();
    const selectedLivePoiIds = new Set();

    const tutorialContent = [
        { title: 'tutorialSlide1Title', text: 'tutorialSlide1Content', image: 'img/img_tutorial%20page%201.webp' },
        { title: 'tutorialSlide2Title', text: 'tutorialSlide2Content', image: 'img/img_tutorial%20page%202.webp' },
        { title: 'tutorialSlide3Title', text: 'tutorialSlide3Content', image: 'img/img_tutorial%20page%203.webp' },
        { title: 'tutorialSlide4Title', text: 'tutorialSlide4Content', image: 'img/img_tutorial%20page%204.webp' },
        { title: 'tutorialSlide5Title', text: 'tutorialSlide5Content', image: 'img/img_tutorial%20page%205.webp' },
        { title: 'tutorialSlide6Title', text: 'tutorialSlide6Content', image: 'img/img_tutorial%20page%206.webp' },
        { title: 'tutorialSlide7Title', text: 'tutorialSlide7Content', image: 'img/img_tutorial%20page%207.webp' }
    ];

    const defaultColors = {
        'pokestop': '#007aff',
        'gym': '#ff3b30',
        'caspot': '#0bd3cd',
        'cagym': '#af52de',
        'clwayspot': '#f7931e',
        'clgymwayspot': '#90ee90',
        'powerspot': '#911042'
    };
    let storedColors = JSON.parse(localStorage.getItem('caWayspotColors'));
    let currentColors = { ...defaultColors, ...(storedColors || {}) };

    // --- Core Logic ---

    function pushToUndo(action) {
        undoStack.push(action);
        if (undoStack.length > MAX_UNDO) undoStack.shift();
    }

    function saveToStorage() {
        const dataToSave = [];
        for (let id in CA_Map.spotsData) {
            let spot = CA_Map.spotsData[id];
            dataToSave.push({
                id: spot.id, type: spot.type, name: spot.name, imgUrl: spot.imgUrl,
                lat: spot.lat, lng: spot.lng, radius: spot.radius, locked: spot.locked || false,
                hidden: spot.hidden || false
            });
        }
        CA_Storage.updateActiveProjectData(dataToSave);
    }

    // ซ่อน/แสดง layerGroup (marker+circle) ของ spot ตามทั้ง filter checkbox ของ
    // type และสถานะ hidden ทีละจุด — เรียกทุกครั้งที่ตัวใดตัวหนึ่งเปลี่ยน กัน
    // 2 ระบบ (filter ต่อ type / hidden ทีละจุด) ทับกันเอง
    function updateSpotVisibility(spot) {
        const filterEl = document.getElementById('filter-' + spot.type);
        const typeVisible = filterEl ? filterEl.checked : true;
        const shouldShow = typeVisible && !spot.hidden;
        if (shouldShow) { if (!CA_Map.map.hasLayer(spot.layerGroup)) CA_Map.map.addLayer(spot.layerGroup); }
        else { if (CA_Map.map.hasLayer(spot.layerGroup)) CA_Map.map.removeLayer(spot.layerGroup); }
    }

    function toggleHidden(id) {
        const spot = CA_Map.spotsData[id];
        if (!spot) return;
        spot.hidden = !spot.hidden;
        updateSpotVisibility(spot);
        updatePopupContent(id);
        // ซ่อนแล้ว marker หลุดจากแผนที่ไปแล้ว เปิด popup ไม่ได้ — เปิดใหม่ต่อเมื่อกดแสดงกลับ
        if (!spot.hidden) spot.marker.openPopup();
        refreshInfoPanel(document.getElementById('info-search-input') ? document.getElementById('info-search-input').value : '');
        saveToStorage();
    }

    // ซ่อน/แสดงทุกจุดของ type เดียวกันพร้อมกัน — ใช้จาก checkbox "ซ่อนทั้งหมด"
    // ที่หัวข้อแต่ละ category ใน list modal
    function setAllHiddenForType(type, hidden) {
        for (let id in CA_Map.spotsData) {
            const spot = CA_Map.spotsData[id];
            if (spot.type !== type) continue;
            spot.hidden = hidden;
            updateSpotVisibility(spot);
        }
        refreshInfoPanel(document.getElementById('info-search-input') ? document.getElementById('info-search-input').value : '');
        saveToStorage();
    }



    function loadFromStorage() {
        CA_Storage.init();
        
        // Clear existing map layers
        CA_Map.clearAllSpots();

        const activeProject = CA_Storage.getActiveProject();
        if (activeProject && activeProject.data) {
            activeProject.data = activeProject.data.filter(s => s.type !== 'none'); // Remove legacy 'none' data
            activeProject.data.forEach(spotData => {
                createSpot(L.latLng(spotData.lat, spotData.lng), spotData, false);
            });
        }
        refreshProjectListUI();
    }

    function getStyleByType(type) {
        const color = currentColors[type] || defaultColors[type] || '#007aff';
        const typeMap = {
            'pokestop': 'PokeStop',
            'gym': 'Gym',
            'caspot': 'CA PokeStop',
            'cagym': 'CA Gym',
            'clwayspot': 'CL Wayspot',
            'clgymwayspot': 'CL Gym Wayspot',
            'powerspot': 'Power Spot'
        };
        return { color: color, fillColor: color, typeName: typeMap[type] || 'Unknown' };
    }

    function getImageUrl(imgUrl, type) {
        const defaultImages = {
            'pokestop': 'https://lh3.googleusercontent.com/fs2mYM4r9Qq93ejdOP_2lwefRNLVa9tqmJW7XXwqNhMCMXNKwoJoFuMboBpXwnKUf7fJGImbajM9mHAOMlndt5A-Ts9Qh9f_t6YoaQ6u=s0',
            'gym': 'https://lh3.googleusercontent.com/fs2mYM4r9Qq93ejdOP_2lwefRNLVa9tqmJW7XXwqNhMCMXNKwoJoFuMboBpXwnKUf7fJGImbajM9mHAOMlndt5A-Ts9Qh9f_t6YoaQ6u=s0',
            'caspot': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQcm3QbkubsZfLk4kiEHCdzIe3nezdt3yU4dA&s',
            'cagym': 'https://lh3.googleusercontent.com/p-LbBPtPAKKNNZFMYy84f35FFaEpZBSEfPKx0xK9t48a_SJwaeBEBGOzrPOu0vtcKnnWSe9FpVyt25Rh8PoKldVKlOm9B5iTweq8Ox8=s0',
            'clwayspot': 'https://lh3.googleusercontent.com/1X_n9YMH-P-LMVfeaMffmx49EiRxFGX4CZceamtAbsjHUqZsXoKcLQzV5SH_XOafm4Egex7se7yhr64e_ADEDTw5jQx25K3pmKjW',
            'clgymwayspot': 'https://lh3.googleusercontent.com/1X_n9YMH-P-LMVfeaMffmx49EiRxFGX4CZceamtAbsjHUqZsXoKcLQzV5SH_XOafm4Egex7se7yhr64e_ADEDTw5jQx25K3pmKjW',
            'powerspot': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0NSIgZmlsbD0iIzkxMTA0MiIgLz4KICA8cGF0aCBkPSJNNDggMjAgTDMwIDU1IEw1MCA1NSBMNDUgODAgTDcwIDQ1IEw1MCA0NSBaIiBmaWxsPSIjZmZmZmZmIiAvPgo8L3N2Zz4='
        };
        return imgUrl || defaultImages[type] || 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Pokebola-pokeball-png-0.png/600px-Pokebola-pokeball-png-0.png';
    }

    function createCustomIcon(imgUrl, borderColor, type, locked = false) {
        let iconSize = parseInt(document.getElementById('setting-icon-size').value) || 36;
        const lockBadge = locked ? `<span class="lock-badge">🔒</span>` : '';
        return L.divIcon({
            className: 'custom-icon-wrapper',
            html: `<div class="custom-icon-inner"><img crossorigin="anonymous" src="${getImageUrl(imgUrl, type)}" class="custom-marker${locked ? ' marker-locked' : ''}" style="border-color: ${borderColor}; width: ${iconSize}px; height: ${iconSize}px;" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Pokebola-pokeball-png-0.png/600px-Pokebola-pokeball-png-0.png'">${lockBadge}</div>`,
            iconSize: [iconSize, iconSize], iconAnchor: [iconSize / 2, iconSize / 2]
        });
    }

    function createSpot(latlng, savedData = null, isFromClick = false) {
        const type = savedData ? savedData.type : document.getElementById('spotType').value;
        const name = savedData ? savedData.name : (document.getElementById('spotName').value || CA_UI.t('unnamedAlert'));
        const imgUrl = savedData ? savedData.imgUrl : document.getElementById('spotImage').value;
        let radius = savedData ? savedData.radius : parseInt(document.getElementById('spotRadius').value);

        radius = Math.max(45, Math.min(80, isNaN(radius) ? 45 : radius));
        if (!savedData) document.getElementById('spotRadius').value = radius;

        const styleInfo = getStyleByType(type);
        const showRadius = document.getElementById('setting-show-radius') ? document.getElementById('setting-show-radius').checked : true;
        
        const circle = L.circle(latlng, { 
            color: styleInfo.color, 
            weight: 2, 
            fillColor: styleInfo.fillColor, 
            fillOpacity: showRadius ? 0.10 : 0, 
            opacity: showRadius ? 1 : 0, 
            radius: radius 
        });

        const locked = (savedData && savedData.locked) || false;
        const isDraggable = (window.isDraggableMode || false) && !locked;

        const marker = L.marker(latlng, {
            icon: createCustomIcon(imgUrl, styleInfo.color, type, locked),
            draggable: isDraggable
        });

        const layerGroup = L.layerGroup([circle, marker]);
        const currentId = savedData && savedData.id ? savedData.id : CA_UI.generateId();

        CA_Map.spotsData[currentId] = {
            id: currentId, type: type, name: name, imgUrl: imgUrl,
            radius: radius, lat: latlng.lat, lng: latlng.lng,
            locked: locked, hidden: (savedData && savedData.hidden) || false,
            layerGroup: layerGroup, marker: marker, circle: circle
        };

        if (!savedData && !window.isUndoing) {
            pushToUndo({ type: 'ADD', id: currentId });
        }

        // Collab Hook
        if (!window.isCollabSyncing && window.CA_Collab && !savedData) {
            CA_Collab.broadcast('ADD', currentId);
        }

        // Marker Events
        marker.on('dragstart', (e) => { marker._oldPos = e.target.getLatLng(); });
        marker.on('drag', (e) => {
            const pos = e.target.getLatLng();
            circle.setLatLng(pos);
            CA_Map.spotsData[currentId].lat = pos.lat;
            CA_Map.spotsData[currentId].lng = pos.lng;
            updatePopupContent(currentId);
        });
        marker.on('dragend', (e) => {
            const newPos = e.target.getLatLng();
            const oldPos = marker._oldPos;
            if (!window.isUndoing) {
                pushToUndo({ type: 'MOVE', id: currentId, oldLat: oldPos.lat, oldLng: oldPos.lng, newLat: newPos.lat, newLng: newPos.lng });
            }
            CA_Map.spotsData[currentId].lat = newPos.lat;
            CA_Map.spotsData[currentId].lng = newPos.lng;
            circle.setLatLng(newPos);
            updatePopupContent(currentId);
            refreshInfoPanel();
            saveToStorage();
            if (document.getElementById('setting-show-exclusion')?.checked) CA_Map.updateExclusionZone(true);

            // Collab Hook
            if (!window.isCollabSyncing && window.CA_Collab) {
                CA_Collab.broadcast('MOVE', currentId, {lat: newPos.lat, lng: newPos.lng});
            }
        });

        updatePopupContent(currentId);
        updateSpotVisibility(CA_Map.spotsData[currentId]);
        refreshInfoPanel();
        if (!savedData) {
            saveToStorage();
            // Update exclusion zone if active
            if (document.getElementById('setting-show-exclusion')?.checked) CA_Map.updateExclusionZone(true);
        }
    }

    function updatePopupContent(id) {
        const spot = CA_Map.spotsData[id];
        if (!spot) return;
        const styleInfo = getStyleByType(spot.type);
        const content = `
            <div style="text-align: center; min-width: 170px; position: relative;">
                <button class="popup-lock-corner${spot.locked ? ' locked' : ''}" onclick="window.CAWayspotApp.toggleLock('${id}')" title="${spot.locked ? CA_UI.t('btnUnlock') : CA_UI.t('btnLock')}">${spot.locked ? '🔓' : '🔒'}</button>
                <button class="popup-hide-corner${spot.hidden ? ' spot-hidden' : ''}" onclick="window.CAWayspotApp.toggleHidden('${id}')" title="${spot.hidden ? CA_UI.t('btnShowSpot') : CA_UI.t('btnHideSpot')}">${spot.hidden ? '🙈' : '👁'}</button>
                <h4 style="margin: 0;">${CA_UI.escapeHTML(spot.name) || CA_UI.t('unnamedAlert')}</h4>
                <img crossorigin="anonymous" src="${getImageUrl(spot.imgUrl, spot.type)}" class="popup-spot-image" style="border-color: ${styleInfo.color};" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Pokebola-pokeball-png-0.png/600px-Pokebola-pokeball-png-0.png'">
                <div style="font-size: 11px; color: #b3b3b3; font-family: monospace; margin: 0 0 5px 0;">
                    (${spot.lat.toFixed(6)}, ${spot.lng.toFixed(6)})
                </div>
                <span style="font-size: 13px; color: var(--text-secondary);">${CA_UI.t('wayspotTypeLabel')}: <b>${CA_UI.t({
                    'pokestop': 'optPokestop',
                    'gym': 'optGym',
                    'caspot': 'optCaPokestop',
                    'cagym': 'optCaGym',
                    'clwayspot': 'optClWayspot',
                    'clgymwayspot': 'optClGymWayspot',
                    'powerspot': 'optPowerSpot'
                }[spot.type] || 'Unknown').replace(/ [🔵🔴🌸🟣🍊🟡🟢]/, '')}</b></span><br>
                <span style="font-size: 12px; color: var(--text-secondary);">${CA_UI.t('radiusLabel').replace(' (เมตร)', '').replace(' (meters)', '')}: <b>${spot.radius} m</b></span><br>
                <div class="popup-buttons">
                    <button class="popup-btn btn-edit-popup" onclick="window.CAWayspotApp.openEditModal('${id}')">${CA_UI.t('btnEdit')}</button>
                    <button class="popup-btn btn-del-popup" onclick="window.CAWayspotApp.removeSpot('${id}')">${CA_UI.t('btnDelete')}</button>
                </div>
            </div>
        `;
        spot.marker.bindPopup(content);
    }

    function refreshInfoPanel(filterText = '') {
        const htmlData = { 'pokestop': '', 'gym': '', 'caspot': '', 'cagym': '', 'clwayspot': '', 'clgymwayspot': '', 'powerspot': '' };
        const counts = { 'pokestop': 0, 'gym': 0, 'caspot': 0, 'cagym': 0, 'clwayspot': 0, 'clgymwayspot': 0, 'powerspot': 0 };
        const hiddenCounts = { 'pokestop': 0, 'gym': 0, 'caspot': 0, 'cagym': 0, 'clwayspot': 0, 'clgymwayspot': 0, 'powerspot': 0 };
        filterText = filterText.toLowerCase();

        for (let id in CA_Map.spotsData) {
            const spot = CA_Map.spotsData[id];
            if (filterText && !spot.name.toLowerCase().includes(filterText)) continue;
            const latlngText = `${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}`;
            htmlData[spot.type] += `
                <div class="info-item${spot.hidden ? ' info-item-hidden' : ''}">
                    <input type="checkbox" class="info-item-checkbox" ${spot.hidden ? '' : 'checked'}
                        title="${CA_UI.t('hideItemTooltip')}"
                        onchange="window.CAWayspotApp.toggleHidden('${id}')">
                    <div class="info-item-body" onclick="window.CAWayspotApp.jumpToSpot('${id}')">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <b>${CA_UI.escapeHTML(spot.name)}</b>
                            <span style="font-size: 10px; color: var(--text-secondary);">${spot.radius}m</span>
                        </div>
                        <span class="info-item-coords">📍 ${CA_UI.t('infoCoords')} ${latlngText}</span>
                    </div>
                </div>`;
            counts[spot.type]++;
            if (spot.hidden) hiddenCounts[spot.type]++;
        }

        let finalHTML = "";
        const cats = [
            { id: 'pokestop', name: CA_UI.t('optPokestop'), color: '#007aff' },
            { id: 'gym', name: CA_UI.t('optGym'), color: '#ff3b30' },
            { id: 'caspot', name: CA_UI.t('optCaPokestop'), color: '#0bd3cd' },
            { id: 'cagym', name: CA_UI.t('optCaGym'), color: '#af52de' },
            { id: 'clwayspot', name: CA_UI.t('optClWayspot'), color: '#f7931e' },
            { id: 'clgymwayspot', name: CA_UI.t('optClGymWayspot'), color: '#90ee90' },
            { id: 'powerspot', name: CA_UI.t('optPowerSpot') || 'Power Spot', color: '#911042' }
        ];

        cats.forEach(c => {
            const content = htmlData[c.id] || `<div style="font-size:12px; color:var(--text-secondary);">-</div>`;
            // checkbox "ซ่อนทั้งหมด" ของ category — checked เมื่อยังมีจุดที่แสดงอยู่
            // อย่างน้อย 1 จุด, unchecked เมื่อซ่อนหมดทุกจุดแล้ว (ไม่โชว์เลยถ้าไม่มีจุด)
            const allHidden = counts[c.id] > 0 && hiddenCounts[c.id] === counts[c.id];
            const headerCheckbox = counts[c.id] > 0
                ? `<label class="info-category-hideall" title="${CA_UI.t('hideAllTooltip')}" onclick="event.stopPropagation()">
                     <input type="checkbox" ${allHidden ? '' : 'checked'} onchange="window.CAWayspotApp.setAllHiddenForType('${c.id}', !this.checked)">
                   </label>`
                : '';
            finalHTML += `<div class="info-category"><h4 style="color:${c.color}; margin-top: 10px;">
                <span>${c.name.split(' ')[0]} ${c.name.split(' ')[1] || ''} (${CA_UI.t('countLabel')} ${counts[c.id]})</span>
                ${headerCheckbox}
            </h4>${content}</div>`;
        });

        // Live POI จาก Wayfarer (PokéStop/Gym/Power Spot จริง) — ต่อท้าย 7
        // category ของ Wayspot ที่ผู้ใช้สร้างเอง, checkbox ทีละจุด persist ใน
        // live-poi-manager.js เอง, checkbox หัวข้อ sync 2 ทางกับ toggle ใน sidebar
        if (window.CA_LivePOI && CA_LivePOI.getPoiList) {
            const liveCats = [
                { id: 'pokestop', labelKey: 'optPokestop', color: '#007aff' },
                { id: 'gym', labelKey: 'optGym', color: '#ff3b30' },
                { id: 'powerspot', labelKey: 'optPowerSpot', color: '#911042' },
            ];
            liveCats.forEach(c => {
                const list = CA_LivePOI.getPoiList(c.id).filter(p => !filterText || p.name.toLowerCase().includes(filterText));
                const filterEl = document.getElementById('filter-live-' + c.id);
                const typeOn = filterEl ? filterEl.checked : true;
                let content = '';
                list.forEach(p => {
                    content += `
                        <div class="info-item${p.hidden ? ' info-item-hidden' : ''}">
                            <input type="checkbox" class="info-item-checkbox" ${p.hidden ? '' : 'checked'}
                                title="${CA_UI.t('hideItemTooltip')}"
                                onchange="window.CA_LivePOI.toggleHidden('${p.id}'); window.CAWayspotApp.refreshInfoPanel();">
                            <div class="info-item-body" onclick="window.CA_LivePOI.jumpTo('${p.id}')">
                                <b>${CA_UI.escapeHTML(p.name)}</b>
                                <span class="info-item-coords">📍 ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span>
                            </div>
                        </div>`;
                });
                if (!content) content = `<div style="font-size:12px; color:var(--text-secondary);">-</div>`;
                const label = CA_UI.t(c.labelKey);
                const headerCheckbox = `<label class="info-category-hideall" title="${CA_UI.t('hideAllTooltip')}" onclick="event.stopPropagation()">
                    <input type="checkbox" ${typeOn ? 'checked' : ''} onchange="window.CAWayspotApp.setLivePoiTypeVisible('${c.id}', this.checked)">
                </label>`;
                finalHTML += `<div class="info-category"><h4 style="color:${c.color}; margin-top: 10px;">
                    <span>${label.split(' ')[0]} ${label.split(' ')[1] || ''} ${CA_UI.t('livePoiFromWayfarerSuffix')} (${CA_UI.t('countLabel')} ${list.length})</span>
                    ${headerCheckbox}
                </h4>${content}</div>`;
            });
        }

        document.getElementById('info-content').innerHTML = finalHTML;
    }

    function refreshProjectListUI() {
        const container = document.getElementById('project-list-container');
        if (!container) return;
        container.innerHTML = '';
        CA_Storage.projects.forEach(p => {
            const isActive = p.id === CA_Storage.activeProjectId;
            const item = document.createElement('div');
            item.className = `project-item ${isActive ? 'active' : ''}`;
            item.innerHTML = `
                <span class="project-item-name">
                    ${isActive ? '📍 ' : ''}${CA_UI.escapeHTML(p.name)} (${p.data.length})
                </span>
                <button class="btn-icon btn-project-action btn-duplicate-project" data-id="${p.id}" title="Duplicate">📋</button>
                <button class="btn-icon btn-project-action btn-rename-project" data-id="${p.id}">✏️</button>
                <button class="btn-icon btn-project-action btn-delete-project" data-id="${p.id}">🗑️</button>
            `;
            item.addEventListener('click', (e) => { if (!e.target.closest('.btn-icon')) switchProject(p.id); });
            item.querySelector('.btn-duplicate-project').addEventListener('click', (e) => { e.stopPropagation(); duplicateProject(p.id); });
            item.querySelector('.btn-rename-project').addEventListener('click', (e) => { e.stopPropagation(); renameProject(p.id); });
            item.querySelector('.btn-delete-project').addEventListener('click', (e) => { e.stopPropagation(); deleteProject(p.id); });
            container.appendChild(item);
        });
    }

    function switchProject(id) {
        if (id === CA_Storage.activeProjectId) return;
        saveToStorage();
        CA_Storage.activeProjectId = id;
        CA_Storage.saveAll();
        loadFromStorage();
    }

    function renameProject(id) {
        const project = CA_Storage.projects.find(p => p.id === id);
        if (!project) return;
        const newName = prompt(CA_UI.t('renameProjectPrompt'), project.name);
        if (newName && newName !== project.name) {
            CA_Storage.renameProject(id, newName);
            refreshProjectListUI();
        }
    }

    function duplicateProject(id) {
        const suffix = CA_UI.t('duplicateSuffix');
        const newId = CA_Storage.duplicateProject(id, suffix);
        if (newId) {
            refreshProjectListUI();
        }
    }

    function deleteProject(id) {
        const project = CA_Storage.projects.find(p => p.id === id);
        if (!project) return;
        if (confirm(CA_UI.t('deleteProjectConfirm', { name: project.name }))) {
            if (CA_Storage.deleteProject(id)) {
                loadFromStorage();
            } else {
                alert("ไม่สามารถลบโครงการสุดท้ายได้");
            }
        }
    }

    function undoAction() {
        if (undoStack.length === 0) return;
        window.isUndoing = true;
        const lastAction = undoStack.pop();
        try {
            switch (lastAction.type) {
                case 'ADD': removeSpot(lastAction.id, true); break;
                case 'MOVE':
                    const spotMove = CA_Map.spotsData[lastAction.id];
                    if (spotMove) {
                        const oldPos = L.latLng(lastAction.oldLat, lastAction.oldLng);
                        spotMove.marker.setLatLng(oldPos); spotMove.circle.setLatLng(oldPos);
                        spotMove.lat = oldPos.lat; spotMove.lng = oldPos.lng;
                        updatePopupContent(lastAction.id); refreshInfoPanel(); saveToStorage();
                        if (!window.isCollabSyncing && window.CA_Collab) {
                            CA_Collab.broadcast('MOVE', lastAction.id, {lat: oldPos.lat, lng: oldPos.lng});
                        }
                    }
                    break;
                case 'DELETE': 
                    createSpot(L.latLng(lastAction.data.lat, lastAction.data.lng), { ...lastAction.data, id: lastAction.id }, false); 
                    if (!window.isCollabSyncing && window.CA_Collab) {
                        CA_Collab.broadcast('ADD', lastAction.id);
                    }
                    break;
                case 'EDIT':
                    const spotEdit = CA_Map.spotsData[lastAction.id];
                    if (spotEdit) {
                        const old = lastAction.oldData;
                        const oldLatLng = L.latLng(old.lat, old.lng);
                        Object.assign(spotEdit, old);
                        const styleInfo = getStyleByType(spotEdit.type);
                        spotEdit.circle.setLatLng(oldLatLng).setRadius(old.radius).setStyle({ color: styleInfo.color, fillColor: styleInfo.fillColor });
                        spotEdit.marker.setLatLng(oldLatLng).setIcon(createCustomIcon(spotEdit.imgUrl, styleInfo.color, spotEdit.type));
                        updatePopupContent(lastAction.id); refreshInfoPanel(); saveToStorage();
                        if (!window.isCollabSyncing && window.CA_Collab) {
                            CA_Collab.broadcast('EDIT', lastAction.id);
                        }
                    }
                    break;
            }
            if (document.getElementById('setting-show-exclusion')?.checked) CA_Map.updateExclusionZone(true);
        } catch (e) { console.error("Undo Error:", e); } finally { window.isUndoing = false; }
    }

    function removeSpot(id, skipConfirm = false) {
        if (CA_Map.spotsData[id] && (skipConfirm || confirm(CA_UI.t('deleteConfirmMark')))) {
            if (!window.isUndoing) {
                const s = CA_Map.spotsData[id];
                pushToUndo({ type: 'DELETE', id: id, data: { type: s.type, name: s.name, imgUrl: s.imgUrl, lat: s.lat, lng: s.lng, radius: s.radius } });
            }
            if (CA_Map.map.hasLayer(CA_Map.spotsData[id].layerGroup)) CA_Map.map.removeLayer(CA_Map.spotsData[id].layerGroup);
            delete CA_Map.spotsData[id]; refreshInfoPanel(); saveToStorage();
            if (document.getElementById('setting-show-exclusion')?.checked) CA_Map.updateExclusionZone(true);

            if (!window.isCollabSyncing && window.CA_Collab) {
                CA_Collab.broadcast('DELETE', id);
            }
        }
    }

    function showTutorialStep(index) {
        tutorialIndex = index;
        const container = document.getElementById('tutorial-slide-content');
        const slide = tutorialContent[index];
        container.innerHTML = `
            ${slide.image ? `<img src="${slide.image}" class="tutorial-slide-image" alt="Tutorial Image">` : ''}
            <div class="tutorial-slide-title">${CA_UI.t(slide.title)}</div>
            <div class="tutorial-slide-text">${CA_UI.t(slide.text)}</div>
        `;
        const dots = document.querySelectorAll('#tutorial-indicators .dot');
        dots.forEach((dot, i) => dot.classList[i === index ? 'add' : 'remove']('active'));
        document.getElementById('btn-tutorial-back').style.display = (index === 0 ? 'none' : 'block');
        document.getElementById('btn-tutorial-next').innerText = (index === tutorialContent.length - 1 ? CA_UI.t('btnUnderstand') : CA_UI.t('btnNext'));
    }

    // --- Initialization & Event Listeners ---

    function setupEventListeners() {
        const safeListen = (id, event, cb) => { const el = document.getElementById(id); if (el) el.addEventListener(event, cb); };

        safeListen('fab-3d-sim', 'click', () => CA_Simulation3D.open());
        safeListen('btn-sim3d-close', 'click', () => CA_Simulation3D.close());
        safeListen('btn-sim3d-reset', 'click', () => CA_Simulation3D.resetView());

        safeListen('fab-add-mode', 'click', () => setMode('add'));
        safeListen('fab-edit-mode', 'click', () => setMode('edit'));
        safeListen('fab-undo', 'click', () => undoAction());
        safeListen('fab-info-mode', 'click', () => {
            const p = document.getElementById('info-panel');
            p.style.display = (p.style.display === 'block' ? 'none' : 'block');
            if (p.style.display === 'block') refreshInfoPanel();
        });

        safeListen('fab-draw-mode', 'click', () => {
            if (drawModeActive) cancelDrawMode(); else startDrawMode();
        });
        safeListen('btn-draw-mode-cancel', 'click', () => cancelDrawMode());
        // ปุ่ม X ต้องล้างเขตที่วาดไปด้วย ไม่ใช่แค่ปิด modal — ไม่งั้นเส้นจะค้างบน
        // แผนที่ตลอดไปเพราะไม่มีทางอื่นเปิด modal นี้กลับมาลบทีหลังได้เลย
        safeListen('btn-close-draw-selection', 'click', () => clearSelection());
        safeListen('btn-draw-selection-clear', 'click', () => clearSelection());
        safeListen('btn-draw-selection-delete', 'click', () => deleteSelectedItems());
        safeListen('btn-draw-selection-export-json', 'click', () => exportSelectedJSON());
        safeListen('btn-draw-selection-export-kml', 'click', () => exportSelectedKML());

        function syncGmapKeyGroup() {
            const sel = document.getElementById('mapLayer');
            const g = document.getElementById('gmap-api-key-group');
            if (sel && g) g.style.display = sel.value === 'gmap_styled' ? 'block' : 'none';
        }

        safeListen('fab-settings-mode', 'click', () => {
            CA_UI.openModal('settings-modal-overlay');
            syncGmapKeyGroup();
        });
        safeListen('btn-locate', 'click', () => CA_Map.map.locate({ setView: true, maxZoom: 17 }));
        safeListen('btn-toggle-control', 'click', () => CA_UI.toggleControlPanel());
        safeListen('btn-close-info', 'click', () => {
            document.getElementById('info-panel').style.display = 'none';
        });

        safeListen('fab-main-menu', 'click', () => {
            const container = document.getElementById('fab-menu-container');
            const btn = document.getElementById('fab-main-menu');
            container.classList.toggle('active');
            btn.innerText = container.classList.contains('active') ? '✕' : '☰';
        });


        safeListen('btnAddByLatLng', 'click', () => {
            const lat = parseFloat(document.getElementById('spotLat').value);
            const lng = parseFloat(document.getElementById('spotLng').value);
            if (isNaN(lat) || isNaN(lng)) return alert(CA_UI.t('invalidLatLong'));
            if (!CA_UI.validateInput(document.getElementById('spotName').value, document.getElementById('spotImage').value)) return;
            const newLatLng = L.latLng(lat, lng);
            createSpot(newLatLng, null, false);
            CA_Map.map.flyTo(newLatLng, 17);
            document.getElementById('spotName').value = ''; document.getElementById('spotImage').value = '';
            document.getElementById('spotLat').value = ''; document.getElementById('spotLng').value = '';
        });
        
        safeListen('btn-close-settings-top', 'click', () => CA_UI.closeModal('settings-modal-overlay'));
        safeListen('btn-close-settings-done', 'click', () => CA_UI.closeModal('settings-modal-overlay'));
        safeListen('mapLayer', 'change', () => {
            const val = document.getElementById('mapLayer').value;
            syncGmapKeyGroup();

            if (val === 'mapbox') {
                const token = "pk.eyJ1IjoieXVsamFuZzAxIiwiYSI6ImNtbzJhaDRvMDBzaWQycHF3amtmMmg1bHUifQ.z6KdZVVik50x4nNb7BEIBg";
                const user = "yuljang01";
                const styleId = "cjwiphjwn10lj1cp0nye6wtec";
                CA_Map.setLayer('mapbox', { user, styleId, token });
            } else if (val === 'gmap_styled') {
                const key = localStorage.getItem('caGmapApiKey') || '';
                if (key) {
                    CA_Map.setGmapStyled(key);
                } else {
                    // ยังไม่มี key — map ยังคงอยู่ที่ layer เดิม รอ user กด Apply
                    setTimeout(() => document.getElementById('gmapApiKey')?.focus(), 100);
                }
            } else {
                CA_Map.setLayer(val);
            }
            localStorage.setItem('caWayspotMapLayer', val);
        });

        safeListen('btn-apply-gmap-key', 'click', () => {
            const key = (document.getElementById('gmapApiKey')?.value || '').trim();
            if (!key) return;
            localStorage.setItem('caGmapApiKey', key);
            CA_Map.setGmapStyled(key);
        });
        
        safeListen('setting-darkmode', 'change', (e) => {
            const isDark = e.target.checked;
            document.body.classList[isDark ? 'add' : 'remove']('dark-mode');
            localStorage.setItem('caWayspotDarkMode', isDark);

            // Auto-switch to CartoDB DarkMatter if currently using OSM and turning ON Dark Mode
            if (isDark) {
                const mapSelect = document.getElementById('mapLayer');
                if (mapSelect && mapSelect.value === 'osm') {
                    mapSelect.value = 'cartodb_dark';
                    CA_Map.setLayer('cartodb_dark');
                    localStorage.setItem('caWayspotMapLayer', 'cartodb_dark');
                }
            }
        });
        safeListen('setting-s2grid', 'change', () => CA_Map.updateS2Grid(document.getElementById('setting-s2grid').checked));
        
        ['filter-pokestop', 'filter-gym', 'filter-caspot', 'filter-cagym', 'filter-clwayspot', 'filter-clgymwayspot', 'filter-powerspot'].forEach(id => {
            safeListen(id, 'change', () => {
                for (let sid in CA_Map.spotsData) {
                    updateSpotVisibility(CA_Map.spotsData[sid]);
                }
            });
        });

        // Live POI Layer Listeners (PokéStop/Gym/Power Spot จริงจาก Niantic)
        if (window.CA_LivePOI) {
            safeListen('filter-live-pokestop', 'change', (e) => { CA_LivePOI.setVisible('pokestop', e.target.checked); refreshInfoPanel(); });
            safeListen('filter-live-gym', 'change', (e) => { CA_LivePOI.setVisible('gym', e.target.checked); refreshInfoPanel(); });
            safeListen('filter-live-powerspot', 'change', (e) => { CA_LivePOI.setVisible('powerspot', e.target.checked); refreshInfoPanel(); });

            const tokenForm = document.getElementById('live-poi-token-form');
            const tokenFormError = document.getElementById('live-poi-token-form-error');
            const bearerInput = document.getElementById('live-poi-token-input');
            const csrfInput = document.getElementById('live-poi-csrf-input');
            const saveBtn = document.getElementById('btn-live-poi-token-save');

            const showTokenFormError = (msg) => {
                if (!tokenFormError) return;
                tokenFormError.textContent = msg;
                tokenFormError.style.display = msg ? 'block' : 'none';
            };

            const openTokenForm = () => {
                if (!tokenForm) return;
                const opening = tokenForm.style.display === 'none';
                tokenForm.style.display = opening ? 'flex' : 'none';
                showTokenFormError('');
                if (opening) CA_LivePOI.renderQRCode();
            };

            safeListen('btn-live-poi-token-toggle', 'click', openTokenForm);
            safeListen('btn-live-poi-token-cancel', 'click', () => {
                if (tokenForm) tokenForm.style.display = 'none';
                showTokenFormError('');
            });

            safeListen('btn-live-poi-paste', 'click', async () => {
                try {
                    const { bearerToken, csrfToken } = await CA_LivePOI.pasteFromClipboard();
                    if (bearerInput) bearerInput.value = bearerToken;
                    if (csrfInput) csrfInput.value = csrfToken;
                    showTokenFormError('');
                } catch (e) {
                    showTokenFormError(CA_UI.t('livePoiPasteError'));
                }
            });

            safeListen('btn-live-poi-token-save', 'click', async () => {
                const bearer = (bearerInput && bearerInput.value || '').trim();
                const csrf = (csrfInput && csrfInput.value || '').trim();
                if (!bearer) { showTokenFormError(CA_UI.t('livePoiBearerRequired')); return; }
                showTokenFormError('');
                if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = CA_UI.t('livePoiSaving'); }
                try {
                    await CA_LivePOI.validateAndSaveToken(bearer, csrf);
                    if (bearerInput) bearerInput.value = '';
                    if (csrfInput) csrfInput.value = '';
                    if (tokenForm) tokenForm.style.display = 'none';
                    CA_LivePOI.renderTokenStatusUI();
                    const powerspotToggle = document.getElementById('filter-live-powerspot');
                    if (powerspotToggle) {
                        powerspotToggle.disabled = false;
                        powerspotToggle.checked = true;
                        CA_LivePOI.setVisible('powerspot', true);
                    }
                } catch (e) {
                    showTokenFormError(CA_UI.t('livePoiTokenInvalid'));
                } finally {
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = CA_UI.t('btnSave'); }
                }
            });

            safeListen('btn-live-poi-token-clear', 'click', () => {
                CA_LivePOI.clearToken();
                CA_LivePOI.renderTokenStatusUI();
                const powerspotToggle = document.getElementById('filter-live-powerspot');
                if (powerspotToggle) {
                    powerspotToggle.checked = false;
                    powerspotToggle.disabled = true;
                    CA_LivePOI.setVisible('powerspot', false);
                }
            });

            // ถ้ามี token บันทึกไว้จากครั้งก่อนแล้ว เปิดปุ่ม Power Spot ให้ทันที —
            // ต้อง set checked + เรียก setVisible จริง ไม่ใช่แค่ปลด disabled
            // (เดิมพลาดตรงนี้ทำให้ toggle เด้งปิดเอง + ไม่ fetch ใหม่ทุกครั้งที่ refresh)
            if (CA_LivePOI.getToken()) {
                const powerspotToggle = document.getElementById('filter-live-powerspot');
                if (powerspotToggle) {
                    powerspotToggle.disabled = false;
                    powerspotToggle.checked = true;
                    CA_LivePOI.setVisible('powerspot', true);
                }
            }
        }

        // Custom Wayspot Colors Listeners
        ['pokestop', 'gym', 'caspot', 'cagym', 'clwayspot', 'clgymwayspot', 'powerspot'].forEach(type => {
            safeListen('color-' + type, 'change', (e) => {
                currentColors[type] = e.target.value;
                localStorage.setItem('caWayspotColors', JSON.stringify(currentColors));
                for (let id in CA_Map.spotsData) {
                    const s = CA_Map.spotsData[id];
                    if (s.type === type) {
                        const style = getStyleByType(type);
                        s.marker.setIcon(createCustomIcon(s.imgUrl, style.color, type));
                        s.circle.setStyle({ color: style.color, fillColor: style.color });
                        updatePopupContent(id);
                    }
                }
                refreshInfoPanel();
            });
        });

        safeListen('btn-reset-colors', 'click', () => {
            currentColors = { ...defaultColors };
            localStorage.removeItem('caWayspotColors');
            ['pokestop', 'gym', 'caspot', 'cagym', 'clwayspot', 'clgymwayspot', 'powerspot'].forEach(type => {
                document.getElementById('color-' + type).value = currentColors[type];
                const style = getStyleByType(type);
                for (let id in CA_Map.spotsData) {
                    const s = CA_Map.spotsData[id];
                    if (s.type === type) {
                        s.marker.setIcon(createCustomIcon(s.imgUrl, style.color, type));
                        s.circle.setStyle({ color: style.color, fillColor: style.color });
                        updatePopupContent(id);
                    }
                }
            });
            refreshInfoPanel();
        });

        safeListen('setting-icon-size', 'change', (e) => {
            let val = parseInt(e.target.value) || 36;
            val = Math.max(20, Math.min(40, val));
            e.target.value = val;
            localStorage.setItem('caWayspotIconSize', val);
            for (let id in CA_Map.spotsData) {
                const s = CA_Map.spotsData[id];
                s.marker.setIcon(createCustomIcon(s.imgUrl, getStyleByType(s.type).color, s.type));
            }
        });

        safeListen('setting-show-radius', 'change', (e) => {
            const show = e.target.checked;
            localStorage.setItem('caWayspotShowRadius', show);
            for (let id in CA_Map.spotsData) {
                if (CA_Map.spotsData[id].circle) CA_Map.spotsData[id].circle.setStyle({ fillOpacity: show ? 0.10 : 0, opacity: show ? 1 : 0 });
            }
            if (window.CA_LivePOI) CA_LivePOI.setShowRadius(show);
        });

        safeListen('setting-show-exclusion', 'change', (e) => {
            CA_Map.updateExclusionZone(e.target.checked);
        });

        safeListen('btn-force-radius', 'click', () => {
            const r = parseInt(document.getElementById('globalRadiusInput').value);
            if (isNaN(r) || r <= 0) return alert(CA_UI.t('invalidRadius'));
            if (confirm(CA_UI.t('confirmRadiusChange', { radius: r }))) {
                for (let id in CA_Map.spotsData) {
                    CA_Map.spotsData[id].radius = r;
                    if (CA_Map.spotsData[id].circle) CA_Map.spotsData[id].circle.setRadius(r);
                }
                if (window.CA_LivePOI) CA_LivePOI.setAllRadius(r);
                saveToStorage(); refreshInfoPanel();
            }
        });

        safeListen('btn-sync-export', 'click', () => CA_Sync.requestDriveAccess('export', () => CA_UI.openModal('backup-modal-overlay')));
        safeListen('btn-sync-import', 'click', () => CA_Sync.requestDriveAccess('import', async () => {
            const data = await CA_Sync.downloadFromDrive('CA_Wayspot_All_Backup.json');
            if (data && Array.isArray(data)) {
                data.forEach(proj => {
                    const idx = CA_Storage.projects.findIndex(p => p.id === proj.id);
                    if (idx >= 0) CA_Storage.projects[idx] = proj;
                    else CA_Storage.projects.push(proj);
                });
                CA_Storage.activeProjectId = data[0].id;
                CA_Storage.saveAll();
                loadFromStorage();
                alert(CA_UI.t('loadSuccess'));
            }
        }));
        
        safeListen('btn-json-export', 'click', () => {
            CA_Sync.pendingDriveAction = null;
            CA_UI.openModal('backup-modal-overlay');
        });
        safeListen('btn-json-import', 'click', () => document.getElementById('importJSONInput').click());
        safeListen('importJSONInput', 'change', (e) => parseImportedFile(e.target.files[0]));

        safeListen('btn-capture', 'click', async () => {
            const btn = document.getElementById('btn-capture');
            btn.innerText = '⌛';
            try {
                // Simplified capture for refactoring demo
                const dataUrl = await htmlToImage.toPng(document.getElementById('map'), { pixelRatio: 1 });
                const link = document.createElement('a'); link.download = `wayspot_${new Date().getTime()}.png`; link.href = dataUrl; link.click();
            } finally { btn.innerText = '📸'; }
        });

        safeListen('btn-new-project', 'click', () => {
            const name = prompt(CA_UI.t('newProjectPrompt'));
            if (name) {
                const id = CA_Storage.createNewProject(name);
                switchProject(id);
            }
        });

        document.querySelectorAll('.theme-btn').forEach(btn => btn.addEventListener('click', () => CA_UI.setTheme(btn.getAttribute('data-theme'))));
        safeListen('setting-language', 'change', () => {
            CA_UI.currentLang = document.getElementById('setting-language').value;
            localStorage.setItem('appLang', CA_UI.currentLang);
            CA_UI.applyTranslations();
            refreshProjectListUI();
            refreshInfoPanel();
            
            // Re-render all map popups to apply new language
            for (let id in CA_Map.spotsData) {
                updatePopupContent(id);
            }
        });

        safeListen('btn-tutorial-next', 'click', () => (tutorialIndex < tutorialContent.length - 1 ? showTutorialStep(tutorialIndex + 1) : CA_UI.closeModal('tutorial-modal-overlay')));
        safeListen('btn-tutorial-back', 'click', () => (tutorialIndex > 0 ? showTutorialStep(tutorialIndex - 1) : null));
        safeListen('btn-local-clear', 'click', () => { 
            if (confirm(CA_UI.t('clearAllConfirm'))) { 
                CA_Map.clearAllSpots(); saveToStorage(); refreshInfoPanel(); 
                if (!window.isCollabSyncing && window.CA_Collab) CA_Collab.broadcast('DATA_CLEAR');
            } 
        });
        
        safeListen('btn-save-edit', 'click', () => {
            const id = window.currentEditId;
            const spot = CA_Map.spotsData[id];
            const name = document.getElementById('editName').value;
            const imageUrl = document.getElementById('editImage').value;
            if (!CA_UI.validateInput(name, imageUrl)) return;
            
            // Push to undo before update
            const oldData = { ...spot };
            delete oldData.layerGroup; delete oldData.marker; delete oldData.circle;
            pushToUndo({ type: 'EDIT', id: id, oldData: oldData });

            // Update spot logic...
            spot.name = name; spot.imgUrl = imageUrl;
            spot.type = document.getElementById('editType').value;
            spot.radius = parseInt(document.getElementById('editRadius').value);
            spot.lat = parseFloat(document.getElementById('editLat').value);
            spot.lng = parseFloat(document.getElementById('editLng').value);
            const pos = L.latLng(spot.lat, spot.lng);
            const style = getStyleByType(spot.type);
            spot.marker.setLatLng(pos).setIcon(createCustomIcon(spot.imgUrl, style.color, spot.type));
            spot.circle.setLatLng(pos).setRadius(spot.radius).setStyle({ color: style.color, fillColor: style.color });
            updatePopupContent(id); CA_UI.closeModal('edit-modal-overlay'); saveToStorage(); refreshInfoPanel();
            if (document.getElementById('setting-show-exclusion')?.checked) CA_Map.updateExclusionZone(true);

            if (!window.isCollabSyncing && window.CA_Collab) {
                CA_Collab.broadcast('EDIT', id);
            }
        });

        // Accordion functionality in Settings
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', function () {
                const item = this.parentElement;
                const wasActive = item.classList.contains('active');
                document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
                if (!wasActive) item.classList.add('active');
            });
        });

        // Search functionality in Info Panel
        safeListen('info-search-input', 'input', (e) => {
            const val = e.target.value;
            const clearBtn = document.getElementById('btn-clear-search');
            if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
            refreshInfoPanel(val);
        });

        safeListen('btn-clear-search', 'click', () => {
            const input = document.getElementById('info-search-input');
            if (input) {
                input.value = '';
                input.focus();
                document.getElementById('btn-clear-search').style.display = 'none';
                refreshInfoPanel();
            }
        });

        // Click outside to close modals
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) CA_UI.closeModal(overlay.id);
            });
        });

        // Welcome Modal Start
        safeListen('btn-start-welcome', 'click', () => CA_UI.closeModal('welcome-modal-overlay'));

        // Local Data Management
        safeListen('btn-local-export', 'click', () => {
            const kml = CA_Sync.exportKML(CA_Map.spotsData, getStyleByType, CA_UI.escapeHTML);
            if (kml) CA_Sync.downloadFile(kml, 'wayspot_export.kml', 'application/vnd.google-earth.kml+xml');
        });

        // KML / JSON Parser
        const parseImportedFile = (file) => {
            if (!file) return;
            const fn = file.name.toLowerCase();
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (fn.endsWith('.json')) {
                    try {
                        const data = JSON.parse(ev.target.result);
                        if (Array.isArray(data) && data[0] && data[0].hasOwnProperty('data')) {
                            // full backup format: array ของ project ทั้งชุด (เช่นจาก Google Drive backup) — แทนที่/เพิ่ม project
                            data.forEach(proj => {
                                if (proj.data) proj.data = proj.data.filter(s => s.type !== 'none');
                                const idx = CA_Storage.projects.findIndex(p => p.id === proj.id);
                                if (idx >= 0) CA_Storage.projects[idx] = proj;
                                else CA_Storage.projects.push(proj);
                            });
                            CA_Storage.activeProjectId = data[0].id;
                            CA_Storage.saveAll();
                            loadFromStorage();
                            alert(CA_UI.t('loadSuccess'));
                        } else if (Array.isArray(data) && data[0] && data[0].hasOwnProperty('lat') && data[0].hasOwnProperty('lng')) {
                            // flat array ของ spot เดี่ยวๆ (เช่นจาก "Export JSON" ของโหมดวาดเขตเลือก)
                            // — เพิ่มเข้า project ที่เปิดอยู่ตอนนี้ ไม่ทับทั้ง project เหมือน format ด้านบน
                            let count = 0;
                            data.forEach(s => {
                                if (!s.type || s.type === 'none' || typeof s.lat !== 'number' || typeof s.lng !== 'number') return;
                                createSpot(L.latLng(s.lat, s.lng), {
                                    id: CA_UI.generateId(), type: s.type, name: s.name || '',
                                    imgUrl: s.imgUrl || '', radius: s.radius || 45, locked: false, hidden: false
                                }, false);
                                count++;
                            });
                            if (count > 0) { saveToStorage(); refreshInfoPanel(); }
                            alert(CA_UI.t('importSuccessCount', { count: count, dup: 0 }));
                        }
                    } catch(e) {}
                } else if (fn.endsWith('.kml')) {
                    const parser = new DOMParser();
                    const kml = parser.parseFromString(ev.target.result, "text/xml");
                    const placemarks = kml.querySelectorAll("Placemark");
                    let count = 0;
                    placemarks.forEach(pm => {
                        const name = pm.querySelector("name") ? pm.querySelector("name").textContent : "Imported Spot";
                        const coords = pm.querySelector("coordinates") ? pm.querySelector("coordinates").textContent.trim().split(",") : null;
                        if (coords && coords.length >= 2) {
                            createSpot(L.latLng(parseFloat(coords[1]), parseFloat(coords[0])), { name, type: 'pokestop', radius: 45 }, false);
                            count++;
                        }
                    });
                    if (count > 0) { saveToStorage(); refreshInfoPanel(); }
                    alert(CA_UI.t('importSuccessCount', { count: count, dup: 0 }));
                }
            };
            reader.readAsText(file);
        };

        safeListen('btn-local-import', 'click', () => document.getElementById('importKMLInput').click());
        safeListen('importKMLInput', 'change', (e) => parseImportedFile(e.target.files[0]));
        
        // Drag Object Handler
        const dropOverlay = document.getElementById('drag-drop-overlay');
        if (dropOverlay) {
            document.body.addEventListener('dragover', (e) => { e.preventDefault(); dropOverlay.style.display = 'flex'; });
            document.body.addEventListener('dragleave', (e) => { e.preventDefault(); if (!e.relatedTarget || e.relatedTarget.nodeName === "HTML") dropOverlay.style.display = 'none'; });
            document.body.addEventListener('drop', (e) => {
                e.preventDefault(); dropOverlay.style.display = 'none';
                if (e.dataTransfer.files.length > 0) parseImportedFile(e.dataTransfer.files[0]);
            });
        }

        // Backup Modal Logic
        safeListen('btn-backup-active', 'click', () => {
            const p = CA_Storage.getActiveProject();
            if (p) {
                const content = JSON.stringify([p], null, 2);
                if (CA_Sync.pendingDriveAction === 'export') {
                    CA_Sync.uploadToDrive(content, `CA_Wayspot_${p.name}_Backup.json`).then(() => alert(CA_UI.t('saveSuccess')));
                } else {
                    CA_Sync.downloadFile(content, `CA_Wayspot_${p.name}.json`, 'application/json');
                }
                CA_Sync.pendingDriveAction = null; // Reset state
            }
            CA_UI.closeModal('backup-modal-overlay');
        });

        safeListen('btn-backup-all', 'click', () => {
            const content = JSON.stringify(CA_Storage.projects, null, 2);
            if (CA_Sync.pendingDriveAction === 'export') {
                CA_Sync.uploadToDrive(content, 'CA_Wayspot_All_Backup.json').then(() => alert(CA_UI.t('saveSuccess')));
            } else {
                CA_Sync.downloadFile(content, 'CA_Wayspot_All.json', 'application/json');
            }
            CA_Sync.pendingDriveAction = null; // Reset state
            CA_UI.closeModal('backup-modal-overlay');
        });

        safeListen('btn-close-backup', 'click', () => CA_UI.closeModal('backup-modal-overlay'));

        // Tutorial logic
        safeListen('btn-open-tutorial', 'click', () => {
            CA_UI.closeModal('settings-modal-overlay');
            setTimeout(() => {
                showTutorialStep(0);
                CA_UI.openModal('tutorial-modal-overlay');
            }, 400);
        });

        document.querySelectorAll('#tutorial-indicators .dot').forEach((dot, i) => {
            dot.addEventListener('click', () => showTutorialStep(i));
        });

        // Other modal close buttons
        safeListen('btn-close-edit', 'click', () => CA_UI.closeModal('edit-modal-overlay'));

        window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { if (document.activeElement.tagName !== 'INPUT') undoAction(); } });

        // Collab UI handlers
        safeListen('btn-collab-host', 'click', () => {
            if(window.CA_Collab) window.CA_Collab.hostSession(updateCollabUI);
        });
        
        safeListen('btn-collab-join', 'click', () => {
            const id = document.getElementById('collab-join-id').value.trim();
            if(!id) return;
            if(window.CA_Collab) window.CA_Collab.joinSession(id, updateCollabUI);
        });
        
        safeListen('btn-collab-disconnect', 'click', () => {
            if(window.CA_Collab) window.CA_Collab.disconnect();
            updateCollabUI('DISCONNECTED');
        });
        
        safeListen('btn-collab-copy', 'click', (e) => {
            const btn = document.getElementById('btn-collab-copy');
            const id = btn.getAttribute('data-id');
            if (id) {
                navigator.clipboard.writeText(id).then(() => {
                    const orig = btn.innerText;
                    btn.innerText = '✅';
                    setTimeout(() => btn.innerText = orig, 1500);
                });
            }
        });

        safeListen('btn-collab-sync', 'click', (e) => {
            if(window.CA_Collab && !window.CA_Collab.isHost) {
                const btn = document.getElementById('btn-collab-sync');
                const orig = btn.innerText;
                btn.innerText = '⌛...';
                window.CA_Collab.requestFullState();
                setTimeout(() => btn.innerText = orig, 1000);
            }
        });
        
        function updateCollabUI(status, id) {
            const stateEl = document.getElementById('collab-status-state');
            const disBtn = document.getElementById('btn-collab-disconnect');
            const copyBtn = document.getElementById('btn-collab-copy');
            const syncBtn = document.getElementById('btn-collab-sync');
            if(!stateEl) return;
            
            if (copyBtn) copyBtn.style.display = 'none';
            if (syncBtn) syncBtn.style.display = 'none';
            
            if (status === 'WAIT') {
                stateEl.innerText = CA_UI.t('collabWait', {id: id});
                stateEl.style.color = '#f5a623';
                if(disBtn) disBtn.style.display = 'inline-block';
                if(copyBtn && window.CA_Collab && window.CA_Collab.isHost) {
                    copyBtn.style.display = 'inline-block';
                    copyBtn.setAttribute('data-id', id);
                }
            } else if (status === 'CONNECTED_HOST') {
                stateEl.innerText = CA_UI.t('collabConnectedHost', {id: id});
                stateEl.style.color = '#34c759';
                if(disBtn) disBtn.style.display = 'inline-block';
                if(copyBtn) {
                    copyBtn.style.display = 'inline-block';
                    copyBtn.setAttribute('data-id', id);
                }
            } else if (status === 'CONNECTED_CLIENT') {
                stateEl.innerText = CA_UI.t('collabConnectedClient', {id: id});
                stateEl.style.color = '#34c759';
                if(disBtn) disBtn.style.display = 'inline-block';
                if(syncBtn) syncBtn.style.display = 'inline-block';
            } else if (status === 'DISCONNECTED') {
                stateEl.innerText = CA_UI.t('collabDisconnected');
                stateEl.style.color = 'var(--text-secondary)';
                if(disBtn) disBtn.style.display = 'none';
            } else if (status === 'ERROR') {
                stateEl.innerText = CA_UI.t('collabError') + id;
                stateEl.style.color = '#ff3b30';
                if(disBtn) disBtn.style.display = 'inline-block';
            }
        }
    }

    function setMode(mode) {
        window.isDraggableMode = (mode === 'edit');
        const btnAdd = document.getElementById('fab-add-mode');
        const btnEdit = document.getElementById('fab-edit-mode');
        btnAdd.classList[mode === 'add' ? 'add' : 'remove']('active');
        btnEdit.classList[mode === 'edit' ? 'add' : 'remove']('active');
        for (let id in CA_Map.spotsData) {
            const spot = CA_Map.spotsData[id];
            spot.marker.dragging[window.isDraggableMode && !spot.locked ? 'enable' : 'disable']();
        }
    }

    function toggleLock(id) {
        const spot = CA_Map.spotsData[id];
        if (!spot) return;
        spot.locked = !spot.locked;
        spot.marker.setIcon(createCustomIcon(spot.imgUrl, getStyleByType(spot.type).color, spot.type, spot.locked));
        if (spot.locked) {
            spot.marker.dragging.disable();
        } else if (window.isDraggableMode) {
            spot.marker.dragging.enable();
        }
        updatePopupContent(id);
        spot.marker.openPopup();
        saveToStorage();
    }

    // === Draw Mode: วาด polygon อิสระเพื่อเลือก Wayspot ในเขต ===

    // ray-casting algorithm มาตรฐาน — ไม่พึ่ง library ภายนอก
    function pointInPolygon(lat, lng, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const yi = points[i].lat, xi = points[i].lng;
            const yj = points[j].lat, xj = points[j].lng;
            const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    function handleDrawClick(e) {
        drawPoints.push(e.latlng);
        updateDrawPreview();
    }

    function handleDrawDblClick(e) {
        // Leaflet ยิง click ตามด้วย dblclick เสมอ — จุดสุดท้ายจาก click handler
        // ก่อนหน้าซ้ำกับตำแหน่ง dblclick นี้ ตัดออก 1 จุดกันจุดซ้อน
        if (drawPoints.length > 1) drawPoints.pop();
        finishDrawPolygon();
    }

    function updateDrawPreview() {
        const map = CA_Map.map;
        if (drawPreviewLine) map.removeLayer(drawPreviewLine);
        if (drawPoints.length < 2) return;
        drawPreviewLine = L.polyline(drawPoints, { color: '#007aff', weight: 2, dashArray: '6,6', interactive: false }).addTo(map);
    }

    function startDrawMode() {
        if (drawModeActive) return;
        drawModeActive = true;
        drawPoints = [];
        const map = CA_Map.map;
        map.getContainer().style.cursor = 'crosshair';
        map.doubleClickZoom.disable();
        map.on('click', handleDrawClick);
        map.on('dblclick', handleDrawDblClick);
        const hint = document.getElementById('draw-mode-hint');
        if (hint) hint.style.display = 'flex';
        const btn = document.getElementById('fab-draw-mode');
        if (btn) btn.classList.add('active');
    }

    function exitDrawInteraction() {
        const map = CA_Map.map;
        map.off('click', handleDrawClick);
        map.off('dblclick', handleDrawDblClick);
        map.doubleClickZoom.enable();
        map.getContainer().style.cursor = '';
        drawModeActive = false;
        const hint = document.getElementById('draw-mode-hint');
        if (hint) hint.style.display = 'none';
        const btn = document.getElementById('fab-draw-mode');
        if (btn) btn.classList.remove('active');
    }

    function cancelDrawMode() {
        exitDrawInteraction();
        drawPoints = [];
        if (drawPreviewLine) { CA_Map.map.removeLayer(drawPreviewLine); drawPreviewLine = null; }
    }

    function computeSelectionFromPolygon(points) {
        selectedSpotIds.clear();
        selectedLivePoiIds.clear();
        for (const id in CA_Map.spotsData) {
            const spot = CA_Map.spotsData[id];
            if (pointInPolygon(spot.lat, spot.lng, points)) selectedSpotIds.add(id);
        }
        if (window.CA_LivePOI) {
            CA_LivePOI.getAllPoiList().forEach(p => {
                if (pointInPolygon(p.lat, p.lng, points)) selectedLivePoiIds.add(p.id);
            });
        }
    }

    function finishDrawPolygon() {
        exitDrawInteraction();
        if (drawPreviewLine) { CA_Map.map.removeLayer(drawPreviewLine); drawPreviewLine = null; }

        if (drawPoints.length < 3) { drawPoints = []; return; } // เขตต้องมีอย่างน้อย 3 จุด

        if (drawPolygonLayer) CA_Map.map.removeLayer(drawPolygonLayer);
        drawPolygonLayer = L.polygon(drawPoints, { color: '#007aff', fillColor: '#007aff', fillOpacity: 0.1, weight: 2, interactive: false }).addTo(CA_Map.map);

        computeSelectionFromPolygon(drawPoints);
        renderSelectionPanel();
        CA_UI.openModal('draw-selection-modal-overlay');
    }

    function renderSelectionPanel() {
        const countEl = document.getElementById('draw-selection-count-text');
        const contentEl = document.getElementById('draw-selection-content');
        if (!countEl || !contentEl) return;
        const total = selectedSpotIds.size + selectedLivePoiIds.size;
        countEl.textContent = CA_UI.t('countLabel') + ' ' + total;

        let html = '';

        // Wayspot ของผู้ใช้เอง — group ตาม type
        const spotByType = {};
        selectedSpotIds.forEach(id => {
            const spot = CA_Map.spotsData[id];
            if (!spot) return;
            (spotByType[spot.type] = spotByType[spot.type] || []).push({ id, spot });
        });
        Object.keys(spotByType).forEach(type => {
            const items = spotByType[type];
            const styleInfo = getStyleByType(type);
            html += `<div class="info-category"><h4 style="color:${styleInfo.color};"><span>${styleInfo.typeName} (${CA_UI.t('countLabel')} ${items.length})</span></h4>`;
            items.forEach(({ id, spot }) => {
                html += `
                    <div class="info-item">
                        <input type="checkbox" class="info-item-checkbox" checked
                            onchange="window.CAWayspotApp.removeFromSelection('spot','${id}')">
                        <div class="info-item-body" onclick="window.CAWayspotApp.jumpToSpot('${id}')">
                            <b>${CA_UI.escapeHTML(spot.name) || CA_UI.t('unnamedAlert')}</b>
                            <span class="info-item-coords">📍 ${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}</span>
                        </div>
                    </div>`;
            });
            html += `</div>`;
        });

        // Live POI จาก Wayfarer — group ตาม type
        if (window.CA_LivePOI && selectedLivePoiIds.size > 0) {
            const allLive = CA_LivePOI.getAllPoiList();
            const liveByType = {};
            selectedLivePoiIds.forEach(id => {
                const found = allLive.find(p => p.id === id);
                if (!found) return;
                (liveByType[found.type] = liveByType[found.type] || []).push(found);
            });
            const liveLabels = { pokestop: CA_UI.t('optPokestop'), gym: CA_UI.t('optGym'), powerspot: CA_UI.t('optPowerSpot') };
            const liveColors = { pokestop: '#007aff', gym: '#ff3b30', powerspot: '#911042' };
            Object.keys(liveByType).forEach(type => {
                const items = liveByType[type];
                html += `<div class="info-category"><h4 style="color:${liveColors[type]};"><span>${liveLabels[type]} ${CA_UI.t('livePoiFromWayfarerSuffix')} (${CA_UI.t('countLabel')} ${items.length})</span></h4>`;
                items.forEach(p => {
                    html += `
                        <div class="info-item">
                            <input type="checkbox" class="info-item-checkbox" checked
                                onchange="window.CAWayspotApp.removeFromSelection('live','${p.id}')">
                            <div class="info-item-body" onclick="window.CA_LivePOI.jumpTo('${p.id}')">
                                <b>${CA_UI.escapeHTML(p.name)}</b>
                                <span class="info-item-coords">📍 ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span>
                            </div>
                        </div>`;
                });
                html += `</div>`;
            });
        }

        if (!html) html = `<div style="font-size:13px; color:var(--text-secondary); text-align:center; padding:20px 0;">${CA_UI.t('drawNoSelection')}</div>`;
        contentEl.innerHTML = html;
    }

    function removeFromSelection(kind, id) {
        if (kind === 'spot') selectedSpotIds.delete(id);
        else selectedLivePoiIds.delete(id);
        renderSelectionPanel();
    }

    function clearSelection() {
        selectedSpotIds.clear();
        selectedLivePoiIds.clear();
        if (drawPolygonLayer) { CA_Map.map.removeLayer(drawPolygonLayer); drawPolygonLayer = null; }
        CA_UI.closeModal('draw-selection-modal-overlay');
    }

    function deleteSelectedItems() {
        const total = selectedSpotIds.size + selectedLivePoiIds.size;
        if (total === 0) return;
        if (!confirm(CA_UI.t('confirmDeleteSelected').replace('{count}', total))) return;
        Array.from(selectedSpotIds).forEach(id => removeSpot(id, true));
        if (window.CA_LivePOI) {
            const allLive = CA_LivePOI.getAllPoiList();
            Array.from(selectedLivePoiIds).forEach(id => {
                const found = allLive.find(p => p.id === id);
                if (found && !found.hidden) CA_LivePOI.toggleHidden(id);
            });
        }
        clearSelection();
        refreshInfoPanel();
    }

    function buildSelectedExportData() {
        const data = {};
        selectedSpotIds.forEach(id => {
            const spot = CA_Map.spotsData[id];
            if (spot) data[id] = spot;
        });
        if (window.CA_LivePOI) {
            const allLive = CA_LivePOI.getAllPoiList();
            selectedLivePoiIds.forEach(id => {
                const found = allLive.find(p => p.id === id);
                if (found) data[id] = { name: found.name, type: found.type, lat: found.lat, lng: found.lng, radius: 45 };
            });
        }
        return data;
    }

    function exportSelectedJSON() {
        const data = buildSelectedExportData();
        const arr = Object.keys(data).map(id => {
            const s = data[id];
            return { id, type: s.type, name: s.name, lat: s.lat, lng: s.lng, radius: s.radius };
        });
        if (arr.length === 0) return;
        CA_Sync.downloadFile(JSON.stringify(arr, null, 2), 'wayspot_selection.json', 'application/json');
    }

    function exportSelectedKML() {
        const data = buildSelectedExportData();
        if (Object.keys(data).length === 0) return;
        const kml = CA_Sync.exportKML(data, getStyleByType, CA_UI.escapeHTML);
        if (kml) CA_Sync.downloadFile(kml, 'wayspot_selection.kml', 'application/vnd.google-earth.kml+xml');
    }

    // --- Start App ---

    function init() {
        CA_UI.applyTranslations();
        
        const savedPos = JSON.parse(localStorage.getItem('caWayspotLastPos'));
        const initialView = savedPos || { center: [13.7649, 100.5383], zoom: 16 };
        CA_Map.init('map', initialView);
        if (window.CA_LivePOI) CA_LivePOI.init(CA_Map.map);

        // Load Settings
        if (localStorage.getItem('caWayspotDarkMode') === 'true') {
            document.body.classList.add('dark-mode');
            const dm = document.getElementById('setting-darkmode'); if (dm) dm.checked = true;
        }
        CA_UI.setTheme(CA_UI.currentTheme);

        // Initialize Color Pickers
        ['pokestop', 'gym', 'caspot', 'cagym', 'clwayspot', 'clgymwayspot', 'powerspot'].forEach(type => {
            const el = document.getElementById('color-' + type);
            if (el) el.value = currentColors[type];
        });
        
        setupEventListeners();

        // Load Initial Map Layer
        const savedLayer = localStorage.getItem('caWayspotMapLayer') || 'gmap_street';
        document.getElementById('mapLayer').value = savedLayer;
        if (savedLayer === 'mapbox') {
            const token = "pk.eyJ1IjoieXVsamFuZzAxIiwiYSI6ImNqd2lwaDEzZTA3a3A0YnA2bTB3amw3bGQifQ.xP7t0DvEJTi97webcHYftg";
            const user = "yuljang01";
            const styleId = "cjwiphjwn10lj1cp0nye6wtec";
            CA_Map.setLayer('mapbox', { user, styleId, token });
        } else if (savedLayer === 'gmap_styled') {
            const savedKey = localStorage.getItem('caGmapApiKey') || '';
            const keyInput = document.getElementById('gmapApiKey');
            if (keyInput) keyInput.value = savedKey;
            syncGmapKeyGroup();
            if (savedKey) {
                CA_Map.setGmapStyled(savedKey);
            } else {
                // ยังไม่มี key — sync select + localStorage ให้ตรงกับ map ที่แสดงอยู่
                document.getElementById('mapLayer').value = 'gmap_street';
                localStorage.setItem('caWayspotMapLayer', 'gmap_street');
                syncGmapKeyGroup();
                CA_Map.setLayer('gmap_street');
            }
        } else {
            CA_Map.setLayer(savedLayer);
        }

        loadFromStorage();
        
        if (!localStorage.getItem('caWayspotWelcomeShown')) {
            setTimeout(() => CA_UI.openModal('welcome-modal-overlay'), 300);
            localStorage.setItem('caWayspotWelcomeShown', 'true');
        }
        
        CA_Sync.initGSI();
        
        // Double click handler
        let lastClickTime = 0;
        CA_Map.map.on('click', (e) => {
            if (window.isDraggableMode) return;
            if (drawModeActive) return; // อยู่ในโหมดวาดเขต — ห้ามคลิกสร้าง Wayspot ปน
            const now = Date.now();
            if (now - lastClickTime < 350) { createSpot(e.latlng); lastClickTime = 0; }
            else lastClickTime = now;
        });

        CA_Map.map.on('moveend', () => {
            const center = CA_Map.map.getCenter();
            localStorage.setItem('caWayspotLastPos', JSON.stringify({
                center: [center.lat, center.lng],
                zoom: CA_Map.map.getZoom()
            }));
            CA_Map.updateS2Grid(document.getElementById('setting-s2grid').checked);
            if (window.CA_LivePOI) CA_LivePOI.scheduleFetch();
        });

        // Location Handlers
        CA_Map.map.on('locationfound', (e) => {
            if (CA_Map.userLocationMarker) {
                CA_Map.userLocationMarker.setLatLng(e.latlng);
            } else {
                CA_Map.userLocationMarker = L.circleMarker(e.latlng, {
                    radius: 8,
                    fillColor: "#007aff",
                    color: "#fff",
                    weight: 3,
                    fillOpacity: 0.8
                }).addTo(CA_Map.map);
            }
            CA_Map.map.setView(e.latlng, 17);
        });

        CA_Map.map.on('locationerror', (e) => {
            alert(CA_UI.t('errorLocation'));
        });
    }

    function createSpotLocally(latlng, data) {
        window.isCollabSyncing = true;
        createSpot(latlng, data, false);
        window.isCollabSyncing = false;
    }
    
    function moveSpotLocally(id, lat, lng) {
        window.isCollabSyncing = true;
        let spot = CA_Map.spotsData[id];
        if (spot) {
            let pos = L.latLng(lat, lng);
            spot.marker.setLatLng(pos);
            spot.circle.setLatLng(pos);
            spot.lat = lat; spot.lng = lng;
            updatePopupContent(id); refreshInfoPanel(); saveToStorage();
        }
        window.isCollabSyncing = false;
    }
    
    function removeSpotLocally(id) {
        window.isCollabSyncing = true;
        removeSpot(id, true);
        window.isCollabSyncing = false;
    }
    
    function clearAllSpotsLocally() {
        window.isCollabSyncing = true;
        CA_Map.clearAllSpots(); refreshInfoPanel(); saveToStorage();
        window.isCollabSyncing = false;
    }

    // Export API
    return {
        init,
        createSpotLocally,
        moveSpotLocally,
        removeSpotLocally,
        clearAllSpotsLocally,
        updatePopupContentLocally: (id) => updatePopupContent(id),
        toggleLock,
        toggleHidden,
        setAllHiddenForType,
        refreshInfoPanel: () => refreshInfoPanel(document.getElementById('info-search-input') ? document.getElementById('info-search-input').value : ''),
        setLivePoiTypeVisible: (type, checked) => {
            const el = document.getElementById('filter-live-' + type);
            if (!el) return;
            el.checked = checked;
            el.dispatchEvent(new Event('change'));
        },
        startDrawMode,
        cancelDrawMode,
        removeFromSelection,
        clearSelection,
        deleteSelectedItems,
        exportSelectedJSON,
        exportSelectedKML,
        openEditModal: (id) => { 
            window.currentEditId = id;
            const s = CA_Map.spotsData[id];
            document.getElementById('editType').value = s.type;
            document.getElementById('editName').value = s.name;
            document.getElementById('editImage').value = s.imgUrl;
            document.getElementById('editLat').value = s.lat;
            document.getElementById('editLng').value = s.lng;
            document.getElementById('editRadius').value = s.radius;
            CA_UI.openModal('edit-modal-overlay'); 
        },
        removeSpot,
        jumpToSpot: (id) => {
            const s = CA_Map.spotsData[id];
            if (s) {
                CA_Map.map.flyTo([s.lat, s.lng], 17);
                setTimeout(() => s.marker.openPopup(), 600);
            }
        }
    };
})();

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => window.CAWayspotApp.init());
