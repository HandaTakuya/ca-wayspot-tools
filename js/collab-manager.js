/**
 * Collaboration Manager Module (PeerJS real-time mapping)
 */
const CA_Collab = {
    peer: null,
    conn: null,
    isHost: false,
    roomId: null,

    init() {
        // Init happens via UI trigger
    },

    generateRoomId() {
        // Generate a short 5-character readable ID
        return Math.random().toString(36).substring(2, 7).toUpperCase();
    },

    hostSession(onStatusUpdate) {
        if (this.peer) this.disconnect();
        
        this.roomId = "CA-" + this.generateRoomId();
        this.isHost = true;
        
        this.peer = new Peer(this.roomId);
        
        this.peer.on('open', (id) => {
            onStatusUpdate('WAIT', id);
        });

        this.peer.on('connection', (connection) => {
            if (this.conn) {
                // Reject if already someone connected (only 1-1 supported currently)
                connection.close();
                return;
            }
            this.conn = connection;
            this.setupConnection(onStatusUpdate);
            
            // As host, send current state upon connection
            this.conn.on('open', () => {
                onStatusUpdate('CONNECTED_HOST', this.roomId);
                this.sendFullState();
            });
        });

        this.peer.on('error', (err) => {
            onStatusUpdate('ERROR', err.message);
        });
    },

    joinSession(hostId, onStatusUpdate) {
        if (this.peer) this.disconnect();
        
        if (!hostId.startsWith('CA-')) hostId = 'CA-' + hostId;
        hostId = hostId.toUpperCase();
        
        this.isHost = false;
        this.roomId = hostId;
        
        this.peer = new Peer(); // Client gets random ID
        
        this.peer.on('open', () => {
            this.conn = this.peer.connect(hostId);
            if (!this.conn) {
                onStatusUpdate('ERROR', 'Cannot connect to peer');
                return;
            }
            this.setupConnection(onStatusUpdate);
            
            this.conn.on('open', () => {
                onStatusUpdate('CONNECTED_CLIENT', hostId);
            });
        });

        this.peer.on('error', (err) => {
            onStatusUpdate('ERROR', err.message);
        });
    },

    setupConnection(onStatusUpdate) {
        this.conn.on('data', (data) => {
            this.handleIncomingData(data);
        });
        this.conn.on('close', () => {
            onStatusUpdate('DISCONNECTED', null);
            this.conn = null;
        });
        this.conn.on('error', (err) => {
            onStatusUpdate('ERROR', err.message);
        });
    },

    sendFullState() {
        if (!this.conn || !this.conn.open) return;
        const currentData = [];
        for(let id in window.CA_Map.spotsData) {
            let s = window.CA_Map.spotsData[id];
            currentData.push({
                id: s.id, type: s.type, name: s.name, imgUrl: s.imgUrl,
                lat: s.lat, lng: s.lng, radius: s.radius
            });
        }
        this.conn.send({ type: 'FULL_STATE', data: currentData });
    },

    broadcast(actionType, spotId, extraData = {}) {
        // actionType: ADD, MOVE, DELETE, EDIT, DATA_CLEAR
        if (!this.conn || !this.conn.open) return;
        
        let payload = { type: actionType, id: spotId };
        
        if (actionType !== 'DELETE' && actionType !== 'DATA_CLEAR' && spotId && window.CA_Map.spotsData[spotId]) {
            let s = window.CA_Map.spotsData[spotId];
            payload.data = {
                id: s.id, type: s.type, name: s.name, imgUrl: s.imgUrl,
                lat: s.lat, lng: s.lng, radius: s.radius
            };
        }
        Object.assign(payload, extraData);
        
        this.conn.send(payload);
    },

    handleIncomingData(payload) {
        // Process data received from peer
        // We set a flag to prevent echoing back the broadcast
        window.isCollabSyncing = true;
        
        try {
            switch(payload.type) {
                case 'FULL_STATE':
                    window.CAWayspotApp.clearAllSpotsLocally();
                    payload.data.forEach(d => {
                        window.CAWayspotApp.createSpotLocally(L.latLng(d.lat, d.lng), d);
                    });
                    break;
                case 'ADD':
                case 'EDIT':
                    if (payload.data) {
                        window.CAWayspotApp.createSpotLocally(L.latLng(payload.data.lat, payload.data.lng), payload.data);
                    }
                    break;
                case 'MOVE':
                    window.CAWayspotApp.moveSpotLocally(payload.id, payload.lat, payload.lng);
                    break;
                case 'DELETE':
                    window.CAWayspotApp.removeSpotLocally(payload.id);
                    break;
                case 'DATA_CLEAR':
                    window.CAWayspotApp.clearAllSpotsLocally();
                    break;
            }
        } catch (e) {
            console.error("Collab Sync Error:", e);
        } finally {
            window.isCollabSyncing = false;
        }
    },

    disconnect() {
        if(this.conn) {
            this.conn.close();
            this.conn = null;
        }
        if(this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.isHost = false;
        this.roomId = null;
    }
};

window.CA_Collab = CA_Collab;
