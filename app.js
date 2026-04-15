/**
 * CA Wayspot Tools - Main Entry Point
 * Refactored Version with Modules
 */
window.CAWayspotApp = (function () {
    const undoStack = [];
    const MAX_UNDO = 50;
    let tutorialIndex = 0;

    const tutorialContent = [
        { title: 'tutorialSlide1Title', text: 'tutorialSlide1Content', image: 'img/img_tutorial%20page%201.webp' },
        { title: 'tutorialSlide2Title', text: 'tutorialSlide2Content', image: 'img/img_tutorial%20page%202.webp' },
        { title: 'tutorialSlide3Title', text: 'tutorialSlide3Content', image: 'img/img_tutorial%20page%203.webp' },
        { title: 'tutorialSlide4Title', text: 'tutorialSlide4Content', image: 'img/img_tutorial%20page%204.webp' },
        { title: 'tutorialSlide5Title', text: 'tutorialSlide5Content', image: 'img/img_tutorial%20page%205.webp' }
    ];

    const defaultColors = {
        'pokestop': '#007aff',
        'gym': '#ff3b30',
        'caspot': '#0bd3cd',
        'cagym': '#af52de',
        'clwayspot': '#f7931e',
        'clgymwayspot': '#90ee90'
    };
    let currentColors = JSON.parse(localStorage.getItem('caWayspotColors')) || { ...defaultColors };

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
                lat: spot.lat, lng: spot.lng, radius: spot.radius
            });
        }
        CA_Storage.updateActiveProjectData(dataToSave);
    }



    function loadFromStorage() {
        CA_Storage.init();
        
        // Clear existing map layers
        CA_Map.clearAllSpots();

        const activeProject = CA_Storage.getActiveProject();
        if (activeProject && activeProject.data) {
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
            'clgymwayspot': 'CL Gym Wayspot'
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
            'clgymwayspot': 'https://lh3.googleusercontent.com/1X_n9YMH-P-LMVfeaMffmx49EiRxFGX4CZceamtAbsjHUqZsXoKcLQzV5SH_XOafm4Egex7se7yhr64e_ADEDTw5jQx25K3pmKjW'
        };
        return imgUrl || defaultImages[type] || 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Pokebola-pokeball-png-0.png/600px-Pokebola-pokeball-png-0.png';
    }

    function createCustomIcon(imgUrl, borderColor, type) {
        let iconSize = parseInt(document.getElementById('setting-icon-size').value) || 36;
        return L.divIcon({
            className: 'custom-icon-wrapper',
            html: `<img crossorigin="anonymous" src="${getImageUrl(imgUrl, type)}" class="custom-marker" style="border-color: ${borderColor}; width: ${iconSize}px; height: ${iconSize}px;" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Pokebola-pokeball-png-0.png/600px-Pokebola-pokeball-png-0.png'">`,
            iconSize: [iconSize, iconSize], iconAnchor: [iconSize / 2, iconSize / 2]
        });
    }

    function createSpot(latlng, savedData = null, isFromClick = false) {
        const type = savedData ? savedData.type : document.getElementById('spotType').value;
        const name = savedData ? savedData.name : (document.getElementById('spotName').value || CA_UI.t('unnamedAlert'));
        const imgUrl = savedData ? savedData.imgUrl : document.getElementById('spotImage').value;
        let radius = savedData ? savedData.radius : parseInt(document.getElementById('spotRadius').value);

        radius = Math.max(40, Math.min(80, isNaN(radius) ? 40 : radius));
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

        const isDraggable = document.getElementById('setting-draggable') ? document.getElementById('setting-draggable').checked : (window.isDraggableMode || false);
        
        const marker = L.marker(latlng, {
            icon: createCustomIcon(imgUrl, styleInfo.color, type),
            draggable: isDraggable
        });

        const layerGroup = L.layerGroup([circle, marker]);
        const currentId = savedData && savedData.id ? savedData.id : CA_UI.generateId();

        CA_Map.spotsData[currentId] = {
            id: currentId, type: type, name: name, imgUrl: imgUrl,
            radius: radius, lat: latlng.lat, lng: latlng.lng,
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
        if (document.getElementById('filter-' + type).checked) layerGroup.addTo(CA_Map.map);
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
            <div style="text-align: center; min-width: 170px;">
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
                    'clgymwayspot': 'optClGymWayspot'
                }[spot.type]).replace(/ [🔵🔴🌸🟣🍊🟡🟢]/, '')}</b></span><br>
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
        const htmlData = { 'pokestop': '', 'gym': '', 'caspot': '', 'cagym': '', 'clwayspot': '', 'clgymwayspot': '' };
        const counts = { 'pokestop': 0, 'gym': 0, 'caspot': 0, 'cagym': 0, 'clwayspot': 0, 'clgymwayspot': 0 };
        filterText = filterText.toLowerCase();

        for (let id in CA_Map.spotsData) {
            const spot = CA_Map.spotsData[id];
            if (filterText && !spot.name.toLowerCase().includes(filterText)) continue;
            const latlngText = `${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}`;
            htmlData[spot.type] += `
                <div class="info-item" onclick="window.CAWayspotApp.jumpToSpot('${id}')" style="cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <b>${CA_UI.escapeHTML(spot.name)}</b>
                        <span style="font-size: 10px; color: var(--text-secondary);">${spot.radius}m</span>
                    </div>
                    <span class="info-item-coords">📍 ${CA_UI.t('infoCoords')} ${latlngText}</span>
                </div>`;
            counts[spot.type]++;
        }

        let finalHTML = "";
        const cats = [
            { id: 'pokestop', name: CA_UI.t('optPokestop'), color: '#007aff' },
            { id: 'gym', name: CA_UI.t('optGym'), color: '#ff3b30' },
            { id: 'caspot', name: CA_UI.t('optCaPokestop'), color: '#0bd3cd' },
            { id: 'cagym', name: CA_UI.t('optCaGym'), color: '#af52de' },
            { id: 'clwayspot', name: CA_UI.t('optClWayspot'), color: '#f7931e' },
            { id: 'clgymwayspot', name: CA_UI.t('optClGymWayspot'), color: '#90ee90' }
        ];

        cats.forEach(c => {
            const content = htmlData[c.id] || `<div style="font-size:12px; color:var(--text-secondary);">-</div>`;
            finalHTML += `<div class="info-category"><h4 style="color:${c.color}; margin-top: 10px;">${c.name.split(' ')[0]} ${c.name.split(' ')[1] || ''} (${CA_UI.t('countLabel')} ${counts[c.id]})</h4>${content}</div>`;
        });

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

        safeListen('fab-add-mode', 'click', () => setMode('add'));
        safeListen('fab-edit-mode', 'click', () => setMode('edit'));
        safeListen('fab-undo', 'click', () => undoAction());
        safeListen('fab-info-mode', 'click', () => {
            const p = document.getElementById('info-panel');
            p.style.display = (p.style.display === 'block' ? 'none' : 'block');
            if (p.style.display === 'block') refreshInfoPanel();
        });
        safeListen('fab-settings-mode', 'click', () => CA_UI.openModal('settings-modal-overlay'));
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
            if (val === 'mapbox') {
                const token = "pk.eyJ1IjoieXVsamFuZzAxIiwiYSI6ImNqd2lwaDEzZTA3a3A0YnA2bTB3amw3bGQifQ.xP7t0DvEJTi97webcHYftg";
                const user = "yuljang01";
                const styleId = "cjwiphjwn10lj1cp0nye6wtec";
                CA_Map.setLayer('mapbox', { user, styleId, token });
            } else {
                CA_Map.setLayer(val);
            }
            localStorage.setItem('caWayspotMapLayer', val);
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
        
        ['filter-pokestop', 'filter-gym', 'filter-caspot', 'filter-cagym', 'filter-clwayspot', 'filter-clgymwayspot'].forEach(id => {
            safeListen(id, 'change', () => {
                const results = { 
                    'pokestop': document.getElementById('filter-pokestop').checked, 
                    'gym': document.getElementById('filter-gym').checked, 
                    'caspot': document.getElementById('filter-caspot').checked, 
                    'cagym': document.getElementById('filter-cagym').checked,
                    'clwayspot': document.getElementById('filter-clwayspot').checked,
                    'clgymwayspot': document.getElementById('filter-clgymwayspot').checked
                };
                for (let sid in CA_Map.spotsData) {
                    const spot = CA_Map.spotsData[sid];
                    if (results[spot.type]) { if (!CA_Map.map.hasLayer(spot.layerGroup)) CA_Map.map.addLayer(spot.layerGroup); }
                    else { if (CA_Map.map.hasLayer(spot.layerGroup)) CA_Map.map.removeLayer(spot.layerGroup); }
                }
            });
        });

        // Custom Wayspot Colors Listeners
        ['pokestop', 'gym', 'caspot', 'cagym', 'clwayspot', 'clgymwayspot'].forEach(type => {
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
            ['pokestop', 'gym', 'caspot', 'cagym', 'clwayspot', 'clgymwayspot'].forEach(type => {
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
                saveToStorage(); refreshInfoPanel();
            }
        });

        safeListen('btn-sync-export', 'click', () => CA_Sync.requestDriveAccess('export', () => CA_UI.openModal('backup-modal-overlay')));
        safeListen('btn-sync-import', 'click', () => CA_Sync.requestDriveAccess('import', async () => {
            const data = await CA_Sync.downloadFromDrive('CA_Wayspot_All_Backup.json');
            if (data) { CA_Storage.projects = data; CA_Storage.activeProjectId = data[0].id; CA_Storage.saveAll(); loadFromStorage(); alert(CA_UI.t('loadSuccess')); }
        }));
        
        safeListen('btn-json-export', 'click', () => {
            CA_Sync.pendingDriveAction = null;
            CA_UI.openModal('backup-modal-overlay');
        });
        safeListen('btn-json-import', 'click', () => document.getElementById('importJSONInput').click());
        safeListen('importJSONInput', 'change', (e) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const data = JSON.parse(ev.target.result);
                if (Array.isArray(data)) {
                    if (data[0] && data[0].hasOwnProperty('data')) {
                        CA_Storage.projects = data; CA_Storage.activeProjectId = data[0].id; CA_Storage.saveAll(); loadFromStorage();
                    }
                }
            };
            reader.readAsText(e.target.files[0]);
        });

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

        safeListen('btn-local-import', 'click', () => document.getElementById('importKMLInput').click());
        safeListen('importKMLInput', 'change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const parser = new DOMParser();
                const kml = parser.parseFromString(ev.target.result, "text/xml");

                const placemarks = kml.querySelectorAll("Placemark");
                let count = 0;
                placemarks.forEach(pm => {
                    const name = pm.querySelector("name") ? pm.querySelector("name").textContent : "Imported Spot";
                    const coords = pm.querySelector("coordinates") ? pm.querySelector("coordinates").textContent.trim().split(",") : null;
                    if (coords && coords.length >= 2) {
                        createSpot(L.latLng(parseFloat(coords[1]), parseFloat(coords[0])), { name, type: 'pokestop', radius: 40 }, false);
                        count++;
                    }
                });
                alert(CA_UI.t('importSuccessCount', { count: count, dup: 0 }));
            };
            reader.readAsText(file);
        });

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
        for (let id in CA_Map.spotsData) CA_Map.spotsData[id].marker.dragging[window.isDraggableMode ? 'enable' : 'disable']();
    }

    // --- Start App ---

    function init() {
        CA_UI.applyTranslations();
        
        const savedPos = JSON.parse(localStorage.getItem('caWayspotLastPos'));
        const initialView = savedPos || { center: [13.7649, 100.5383], zoom: 16 };
        CA_Map.init('map', initialView);
        
        // Load Settings
        if (localStorage.getItem('caWayspotDarkMode') === 'true') {
            document.body.classList.add('dark-mode');
            const dm = document.getElementById('setting-darkmode'); if (dm) dm.checked = true;
        }
        CA_UI.setTheme(CA_UI.currentTheme);

        // Initialize Color Pickers
        ['pokestop', 'gym', 'caspot', 'cagym', 'clwayspot', 'clgymwayspot'].forEach(type => {
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
