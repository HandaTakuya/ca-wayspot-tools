/**
 * Sync and File Management Module (Google Drive, KML, JSON)
 */
const CA_Sync = {
    CLIENT_ID: '185984263865-g9029qge3j0o3tsft9hqasp6dkujf34i.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    tokenClient: null,
    accessToken: null,
    pendingDriveAction: null,
    pendingAuthCallback: null,

    initGSI() {
        if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
            setTimeout(() => this.initGSI(), 500);
            return;
        }
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    this.accessToken = tokenResponse.access_token;
                    if (this.pendingAuthCallback) {
                        this.pendingAuthCallback();
                        this.pendingAuthCallback = null;
                    }
                }
            },
        });
    },

    requestDriveAccess(action, onAuthSuccess) {
        this.pendingDriveAction = action;
        if (this.accessToken) {
            if (onAuthSuccess) onAuthSuccess();
        } else {
            this.pendingAuthCallback = onAuthSuccess;
            if (this.tokenClient) {
                this.tokenClient.requestAccessToken({ prompt: '' });
            } else {
                this.initGSI();
                alert("ระบบ Google กำลังโหลด... กรุณารอสักครู่แล้วลองกดอีกครั้งครับ");
            }
        }
    },

    async searchBackupFile(filename) {
        let url = `https://www.googleapis.com/drive/v3/files?q=name="${filename}" and trashed=false&spaces=drive`;
        let res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + this.accessToken } });
        if (res.ok) {
            let data = await res.json();
            if (data.files && data.files.length > 0) return data.files[0].id;
        } else if (res.status === 401) this.accessToken = null;
        return null;
    },

    async uploadToDrive(customData, filename) {
        let fileId = await this.searchBackupFile(filename);
        let url = fileId ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media` : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
        let method = fileId ? 'PATCH' : 'POST';
        let headers = new Headers();
        headers.append('Authorization', 'Bearer ' + this.accessToken);

        let body;
        if (fileId) {
            headers.append('Content-Type', 'application/json');
            body = customData;
        } else {
            let boundary = '-------314159CAWAYSPOT';
            let delimiter = "\r\n--" + boundary + "\r\n";
            let close_delim = "\r\n--" + boundary + "--";
            let meta = { name: filename, mimeType: 'application/json' };
            headers.append('Content-Type', `multipart/related; boundary="${boundary}"`);
            body = delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(meta) + delimiter + 'Content-Type: application/json\r\n\r\n' + customData + close_delim;
        }

        const res = await fetch(url, { method: method, headers: headers, body: body });
        return res;
    },

    async downloadFromDrive(filename) {
        let fileId = await this.searchBackupFile(filename);
        if (!fileId) return null;

        let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        let res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + this.accessToken } });
        if (res.ok) return await res.json();
        return null;
    },

    exportKML(spotsData, getStyleByType, escapeHTML) {
        if (Object.keys(spotsData).length === 0) return null;
        let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Map Export</name>\n`;
        for (let id in spotsData) {
            let spot = spotsData[id];
            let typeName = getStyleByType(spot.type).typeName;
            kmlContent += `    <Placemark>\n      <name>${escapeHTML(spot.name)}</name>\n      <description>ประเภท: ${typeName} | รัศมี: ${spot.radius} เมตร</description>\n      <Point><coordinates>${spot.lng},${spot.lat},0</coordinates></Point>\n    </Placemark>\n`;
        }
        kmlContent += `  </Document>\n</kml>`;
        return kmlContent;
    },

    downloadFile(content, filename, mimeType) {
        let blob = new Blob([content], { type: mimeType });
        let url = URL.createObjectURL(blob);
        let a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
