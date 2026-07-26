"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.srsService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
class SRSService {
    constructor() {
        this.getApiUrl = () => {
            return env_1.ENV.SRS_API_URL;
        };
    }
    getWebRTCPublishUrl(streamId) {
        return `webrtc://${this.getWebRTCHost()}/live/${streamId}`;
    }
    getWebRTCPlayUrl(streamId) {
        return `webrtc://${this.getWebRTCHost()}/live/${streamId}`;
    }
    /**
     * Retorna URL HLS via Nginx (HTTPS).
     * Ex: https://api.livego.store/api/video/http/live/stream_xxx.m3u8
     */
    getHlsUrl(streamId) {
        return this._buildPublicUrl(streamId, 'm3u8');
    }
    /**
     * Retorna URL FLV via Nginx (HTTPS).
     * Ex: https://api.livego.store/api/video/http/live/stream_xxx.flv
     */
    getFlvUrl(streamId) {
        return this._buildPublicUrl(streamId, 'flv');
    }
    _buildPublicUrl(streamId, ext) {
        const normalizedId = streamId.startsWith('stream_') ? streamId : `stream_${streamId}`;
        return `${env_1.ENV.SRS_PUBLIC_URL}/live/${normalizedId}.${ext}`;
    }
    getWebRTCHost() {
        return env_1.ENV.SRS_HOST;
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
            if (trimmed.includes('goog-remb'))
                continue;
            newLines.push(trimmed);
        }
        return newLines.join('\r\n') + '\r\n';
    }
    async publish(streamId, offerSdp) {
        try {
            const url = `${this.getApiUrl()}/rtc/v1/whip/?app=live&stream=${encodeURIComponent(streamId)}`;
            const response = await axios_1.default.post(url, this.sanitizeSDP(offerSdp), {
                headers: { 'Content-Type': 'application/sdp' },
                timeout: 10000,
                responseType: 'text',
                validateStatus: () => true,
            });
            if (response.status >= 200 && response.status < 300) {
                const sdp = response.data;
                let sessionid = '';
                const location = response.headers['location'];
                if (location) {
                    const parts = location.split('/');
                    sessionid = parts[parts.length - 1] || '';
                }
                console.log(`[SRS-WHIP] Resposta do SRS: status=${response.status}, sessionId=${sessionid}`);
                return { code: 0, sdp, sessionid };
            }
            throw new Error(`SRS WHIP Error: ${response.status} ${response.statusText}`);
        }
        catch (error) {
            console.error('[SRS-WHIP] Erro:', error?.message || error);
            return { code: -1, sdp: '', sessionid: '' };
        }
    }
    async play(streamId, offerSdp) {
        try {
            const url = `${this.getApiUrl()}/rtc/v1/whep/?app=live&stream=${encodeURIComponent(streamId)}`;
            const response = await axios_1.default.post(url, this.sanitizeSDP(offerSdp), {
                headers: { 'Content-Type': 'application/sdp' },
                timeout: 10000,
                responseType: 'text',
                validateStatus: () => true,
            });
            if (response.status >= 200 && response.status < 300) {
                const sdp = response.data;
                let sessionid = '';
                const location = response.headers['location'];
                if (location) {
                    const parts = location.split('/');
                    sessionid = parts[parts.length - 1] || '';
                }
                console.log(`[SRS-WHEP] Resposta do SRS: status=${response.status}, sessionId=${sessionid}`);
                return { code: 0, sdp, sessionid };
            }
            throw new Error(`SRS WHEP Error: ${response.status} ${response.statusText}`);
        }
        catch (error) {
            console.error('[SRS-WHEP] Erro:', error?.message || error);
            return { code: -1, sdp: '', sessionid: '' };
        }
    }
    async stop(sessionId) {
        try {
            const url = `${this.getApiUrl()}/rtc/v1/whip/${encodeURIComponent(sessionId)}`;
            const response = await axios_1.default.delete(url, { timeout: 10000, validateStatus: () => true });
            return {
                code: response.status >= 200 && response.status < 300 ? 0 : -1,
                desc: response.status >= 200 && response.status < 300 ? 'Session stopped' : `Stop failed: ${response.status}`,
            };
        }
        catch (error) {
            console.error('[SRS-STOP] Erro:', error?.message || error);
            return { code: -1, desc: 'Failed to stop session' };
        }
    }
}
exports.srsService = new SRSService();
