import axios from 'axios';
import { ENV } from '../config/env';

class SRSService {
  private readonly getApiUrl = (): string => {
    return ENV.SRS_API_URL;
  };

  constructor() {}

  getWebRTCPublishUrl(streamId: string): string {
    return `webrtc://${this.getWebRTCHost()}/live/${streamId}`;
  }

  getWebRTCPlayUrl(streamId: string): string {
    return `webrtc://${this.getWebRTCHost()}/live/${streamId}`;
  }

  /**
   * Retorna URL HLS via Nginx (HTTPS).
   * Ex: https://api.livego.store/api/video/http/live/stream_xxx.m3u8
   */
  getHlsUrl(streamId: string): string {
    return this._buildPublicUrl(streamId, 'm3u8');
  }

  /**
   * Retorna URL FLV via Nginx (HTTPS).
   * Ex: https://api.livego.store/api/video/http/live/stream_xxx.flv
   */
  getFlvUrl(streamId: string): string {
    return this._buildPublicUrl(streamId, 'flv');
  }

  private _buildPublicUrl(streamId: string, ext: string): string {
    const normalizedId = streamId.startsWith('stream_') ? streamId : `stream_${streamId}`;
    return `${ENV.SRS_PUBLIC_URL}/live/${normalizedId}.${ext}`;
  }

  private getWebRTCHost(): string {
    return ENV.SRS_HOST;
  }

  public sanitizeSDP(sdp: string): string {
    const lines = sdp.replace(/\r\n/g, '\n').split('\n');
    const newLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      if (trimmed.includes('extmap-allow-mixed')) continue;
      if (trimmed.includes('goog-remb')) continue;
      newLines.push(trimmed);
    }
    return newLines.join('\r\n') + '\r\n';
  }

  public async publish(streamId: string, offerSdp: string): Promise<{ code: number; sdp: string; sessionid: string }> {
    try {
      const url = `${this.getApiUrl()}/rtc/v1/whip/?app=live&stream=${encodeURIComponent(streamId)}`;
      const response = await axios.post(url, this.sanitizeSDP(offerSdp), {
        headers: { 'Content-Type': 'application/sdp' },
        timeout: 10000,
        responseType: 'text',
        validateStatus: () => true,
      });
      if (response.status >= 200 && response.status < 300) {
        const sdp = response.data as string;
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
    } catch (error: any) {
      console.error('[SRS-WHIP] Erro:', error?.message || error);
      return { code: -1, sdp: '', sessionid: '' };
    }
  }

  public async play(streamId: string, offerSdp: string): Promise<{ code: number; sdp: string; sessionid: string }> {
    try {
      const url = `${this.getApiUrl()}/rtc/v1/whep/?app=live&stream=${encodeURIComponent(streamId)}`;
      const response = await axios.post(url, this.sanitizeSDP(offerSdp), {
        headers: { 'Content-Type': 'application/sdp' },
        timeout: 10000,
        responseType: 'text',
        validateStatus: () => true,
      });
      if (response.status >= 200 && response.status < 300) {
        const sdp = response.data as string;
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
    } catch (error: any) {
      console.error('[SRS-WHEP] Erro:', error?.message || error);
      return { code: -1, sdp: '', sessionid: '' };
    }
  }

  public async stop(sessionId: string): Promise<{ code: number; desc: string }> {
    try {
      const url = `${this.getApiUrl()}/rtc/v1/whip/${encodeURIComponent(sessionId)}`;
      const response = await axios.delete(url, { timeout: 10000, validateStatus: () => true });
      return {
        code: response.status >= 200 && response.status < 300 ? 0 : -1,
        desc: response.status >= 200 && response.status < 300 ? 'Session stopped' : `Stop failed: ${response.status}`,
      };
    } catch (error: any) {
      console.error('[SRS-STOP] Erro:', error?.message || error);
      return { code: -1, desc: 'Failed to stop session' };
    }
  }
}

export const srsService = new SRSService();
