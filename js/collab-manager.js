/**
 * Collaboration Manager Module (Firebase Realtime Database)
 */

const firebaseConfig = {
  apiKey: "AIzaSyCSOTdKfSWNWF57c6QB-EdSxZeu26i5INs",
  authDomain: "ca-wayspot-tools.firebaseapp.com",
  databaseURL: "https://ca-wayspot-tools-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ca-wayspot-tools",
  storageBucket: "ca-wayspot-tools.firebasestorage.app",
  messagingSenderId: "127609539704",
  appId: "1:127609539704:web:b091efac413e1a642bf18d"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

const CA_Collab = {
    isHost: false,
    roomId: null,
    clientId: 'client-' + Math.random().toString(36).substring(2, 10),
    eventsRef: null,
    statusUpdateCallback: null,

    init() {},

    generateRoomId() {
        return Math.random().toString(36).substring(2, 7).toUpperCase();
    },

    async hostSession(onStatusUpdate) {
        this.disconnect();
        this.statusUpdateCallback = onStatusUpdate;
        
        onStatusUpdate('WAIT', '...');
        this.roomId = "CA-" + this.generateRoomId();
        this.isHost = true;
        
        try {
            // Clean up the room completely first
            const roomRef = db.ref('rooms/' + this.roomId);
            await roomRef.remove();
            
            // Set host heartbeat/presence so room expires if host drops
            await roomRef.child('hostStatus').set({ online: true, timestamp: firebase.database.ServerValue.TIMESTAMP });
            roomRef.onDisconnect().remove();

            this.eventsRef = roomRef.child('events');
            
            // Start listening for incoming events
            this.setupEventBus();
            
            onStatusUpdate('CONNECTED_HOST', this.roomId);
            this.sendFullState();
        } catch (e) {
            onStatusUpdate('ERROR', e.message);
        }
    },

    async joinSession(hostId, onStatusUpdate) {
        this.disconnect();
        this.statusUpdateCallback = onStatusUpdate;
        
        if (!hostId.startsWith('CA-')) hostId = 'CA-' + hostId;
        this.roomId = hostId.toUpperCase();
        this.isHost = false;
        
        try {
            const roomRef = db.ref('rooms/' + this.roomId);
            
            // Check if room exists
            const snapshot = await roomRef.child('hostStatus').get();
            if (!snapshot.exists() || !snapshot.val().online) {
                onStatusUpdate('ERROR', 'Room not found or host has left.');
                return;
            }
            
            this.eventsRef = roomRef.child('events');
            this.setupEventBus();
            
            onStatusUpdate('CONNECTED_CLIENT', this.roomId);
            this.requestFullState();
            
        } catch (e) {
            onStatusUpdate('ERROR', e.message);
        }
    },

    setupEventBus() {
        if (!this.eventsRef) return;
        
        // Listen to new child nodes added to 'events'
        this.eventsRef.on('child_added', (snapshot) => {
            const payload = snapshot.val();
            if (!payload) return;
            
            // Prevent echoing back our own broadcasts
            if (payload.senderId === this.clientId) return;
            
            this.handleIncomingData(payload);
        });
    },

    disconnect() {
        if (this.eventsRef) {
            this.eventsRef.off('child_added');
            this.eventsRef = null;
        }
        
        if (this.roomId && this.isHost) {
            // Unregister room
            db.ref('rooms/' + this.roomId).remove();
        }
        
        this.roomId = null;
        this.isHost = false;
        if (this.statusUpdateCallback) {
            this.statusUpdateCallback('DISCONNECTED', null);
            this.statusUpdateCallback = null;
        }
    },

    sendFullState() {
        if (!this.eventsRef) return;
        const currentData = [];
        for(let id in window.CA_Map.spotsData) {
            let s = window.CA_Map.spotsData[id];
            currentData.push({
                id: s.id, type: s.type, name: s.name, imgUrl: s.imgUrl,
                lat: s.lat, lng: s.lng, radius: s.radius
            });
        }
        
        try { 
            const payload = { type: 'FULL_STATE', data: currentData, senderId: this.clientId };
            this.eventsRef.push(payload); 
        } catch(err) { console.error("Collab send error:", err); }
    },

    requestFullState() {
        if (!this.eventsRef || this.isHost) return;
        try { 
            const payload = { type: 'REQUEST_FULL_STATE', senderId: this.clientId };
            this.eventsRef.push(payload); 
        } catch(err) { console.error("Collab send error:", err); }
    },

    broadcast(actionType, spotId, extraData = {}) {
        // actionType: ADD, MOVE, DELETE, EDIT, DATA_CLEAR
        if (!this.eventsRef) return;
        
        let payload = { type: actionType, id: spotId, senderId: this.clientId };
        
        if (actionType !== 'DELETE' && actionType !== 'DATA_CLEAR' && spotId && window.CA_Map.spotsData[spotId]) {
            let s = window.CA_Map.spotsData[spotId];
            payload.data = {
                id: s.id, type: s.type, name: s.name, imgUrl: s.imgUrl,
                lat: s.lat, lng: s.lng, radius: s.radius
            };
        }
        Object.assign(payload, extraData);
        
        try { this.eventsRef.push(payload); } catch(err) { console.error("Collab broadcast error:", err); }
    },

    handleIncomingData(payload) {
        window.isCollabSyncing = true;
        
        try {
            console.log("Collab Received:", payload.type, payload);
            switch(payload.type) {
                case 'FULL_STATE':
                    const stateEl = document.getElementById('collab-status-state');
                    if (stateEl) {
                        const originalText = stateEl.innerText;
                        stateEl.innerText = CA_UI.t('collabSyncing', {count: payload.data ? payload.data.length : 0});
                        setTimeout(() => { stateEl.innerText = originalText; }, 1500);
                    }

                    window.CAWayspotApp.clearAllSpotsLocally();
                    if (payload.data && Array.isArray(payload.data)) {
                        payload.data.forEach(d => {
                            window.CAWayspotApp.createSpotLocally(L.latLng(d.lat, d.lng), d);
                        });
                    }
                    break;
                case 'REQUEST_FULL_STATE':
                    console.log("Host received REQUEST_FULL_STATE, sending data...");
                    if (window.CA_Collab && window.CA_Collab.isHost) {
                        window.CA_Collab.sendFullState();
                    }
                    break;
                case 'ADD':
                case 'EDIT':
                    if (payload.data) {
                        window.CAWayspotApp.createSpotLocally(L.latLng(payload.data.lat, payload.data.lng), payload.data);
                    }
                    break;
                case 'MOVE':
                    if (payload.id && window.CA_Map.spotsData[payload.id]) {
                        const spot = window.CA_Map.spotsData[payload.id];
                        const pos = L.latLng(payload.lat, payload.lng);
                        spot.marker.setLatLng(pos);
                        if (spot.circle) spot.circle.setLatLng(pos);
                        spot.lat = payload.lat;
                        spot.lng = payload.lng;
                        if(window.CAWayspotApp && window.CAWayspotApp.updatePopupContentLocally) {
                            window.CAWayspotApp.updatePopupContentLocally(payload.id);
                        }
                    }
                    break;
                case 'DELETE':
                    if (payload.id && window.CA_Map.spotsData[payload.id]) {
                        const spot = window.CA_Map.spotsData[payload.id];
                        window.CA_Map.map.removeLayer(spot.layerGroup);
                        delete window.CA_Map.spotsData[payload.id];
                    }
                    break;
                case 'DATA_CLEAR':
                    window.CAWayspotApp.clearAllSpotsLocally();
                    break;
            }
        } catch (e) {
            console.error("Collab process error:", e);
        }
        
        setTimeout(() => { window.isCollabSyncing = false; }, 50);
    }
};

window.CA_Collab = CA_Collab;
