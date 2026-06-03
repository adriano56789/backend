"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.srsService = void 0;
class SRSService {
    constructor() {
        this.srsHost = process.env.SRS_HOST || 'localhost';
        this.srsApiPort = process.env.SRS_API_PORT || '1985';
        this.srsHttpPort = process.env.SRS_HTTP_PORT || '8080';
        this.srsRtcPort = process.env.SRS_RTC_PORT || '8000';
        this.getApiUrl = () => {
            const port = this.srsApiPort;
            const protocol = port === '1985' ? 'http' : 'https';
            return `${protocol}://${this.srsHost}:${port}`;
        };
    }
    // Métodos utilitários para construir URLs
    getWebRTCPublishUrl(streamId) {
        return `webrtc://${this.getWebRTCHost()}/live/${streamId}`;
    }
    getWebRTCPlayUrl(streamId) {
        return `webrtc://${this.getWebRTCHost()}/live/${streamId}`;
    }
    getHlsUrl(streamId) {
        const srsHost = process.env.SRS_HOST || 'localhost';
        const srsPort = process.env.SRS_HTTP_PORT || '8080';
        const normalizedId = streamId.startsWith('stream_') ? streamId : `stream_${streamId}`;
        return `http://${srsHost}:${srsPort}/live/${normalizedId}.m3u8`;
    }
    getFlvUrl(streamId) {
        const srsHost = process.env.SRS_HOST || 'localhost';
        const srsPort = process.env.SRS_HTTP_PORT || '8080';
        const normalizedId = streamId.startsWith('stream_') ? streamId : `stream_${streamId}`;
        return `http://${srsHost}:${srsPort}/live/${normalizedId}.flv`;
    }
    getWebRTCHost() {
        return this.srsHost;
    }
    sanitizeSDP(sdp) {
        const lines = sdp.replace(/\r\n/g, '\n').split('\n');
        const newLines = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '')
                continue;
            if (trimmed.includes('extmap-allow-mixed'))
                continue;
            if (trimmed.includes('transport-cc'))
                continue;
            if (trimmed.includes('goog-remb'))
                continue;
            newLines.push(trimmed);
        }
        return newLines.join('\r\n') + '\r\n';
    }
    async publish(streamId, offerSdp) {
        try {
            const url = `${this.getApiUrl()}/rtc/v1/whip/?app=live&stream=${encodeURIComponent(streamId)}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/sdp' },
                body: this.sanitizeSDP(offerSdp),
            });
            if (response.ok) {
                const sdp = await response.text();
                let sessionid = '';
                const location = response.headers.get('location');
                if (location) {
                    const parts = location.split('/');
                    sessionid = parts[parts.length - 1] || '';
                }
                return { code: 0, sdp: this.sanitizeSDP(sdp), sessionid };
            }
            throw new Error(`SRS WHIP Error: ${response.status} ${response.statusText}`);
        }
        catch (error) {
            return { code: -1, sdp: '', sessionid: '' };
        }
    }
    async play(streamId, offerSdp) {
        try {
            const url = `${this.getApiUrl()}/rtc/v1/whep/?app=live&stream=${encodeURIComponent(streamId)}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/sdp' },
                body: this.sanitizeSDP(offerSdp),
            });
            if (response.ok) {
                const sdp = await response.text();
                let sessionid = '';
                const location = response.headers.get('location');
                if (location) {
                    const parts = location.split('/');
                    sessionid = parts[parts.length - 1] || '';
                }
                return { code: 0, sdp: this.sanitizeSDP(sdp), sessionid };
            }
            throw new Error(`SRS WHEP Error: ${response.status} ${response.statusText}`);
        }
        catch (error) {
            return { code: -1, sdp: '', sessionid: '' };
        }
    }
    async stop(sessionId) {
        try {
            const response = await fetch(`${this.getApiUrl()}/rtc/v1/whip/${encodeURIComponent(sessionId)}`, {
                method: 'DELETE',
            });
            return {
                code: response.ok ? 0 : -1,
                desc: response.ok ? 'Session stopped' : `Stop failed: ${response.status}`,
            };
        }
        catch (error) {
            return { code: -1, desc: 'Failed to stop session' };
        }
    }
}
exports.srsService = new SRSService();
