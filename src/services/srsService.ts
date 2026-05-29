class SRSService {
  private readonly srsHost = process.env.SRS_HOST || 'localhost';
  private readonly srsApiPort = process.env.SRS_API_PORT || '1985';
  private readonly srsHttpPort = process.env.SRS_HTTP_PORT || '8080';
  private readonly srsRtcPort = process.env.SRS_RTC_PORT || '8000';

  private readonly getApiUrl = (): string => {
    const port = this.srsApiPort;
    const protocol = port === '1985' ? 'http' : 'https';
    return `${protocol}://${this.srsHost}:${port}`;
  };

  constructor() {}

  // Métodos utilitários para construir URLs
  getWebRTCPublishUrl(streamId: string): string {
    return `webrtc://${this.getWebRTCHost()}/live/${streamId}`;
  }

  getWebRTCPlayUrl(streamId: string): string {
    return `webrtc://${this.getWebRTCHost()}/live/${streamId}`;
  }

  getHlsUrl(streamId: string): string {
    const srsHost = process.env.SRS_HOST || 'localhost';
    const srsPort = process.env.SRS_HTTP_PORT || '8080';
    const normalizedId = streamId.startsWith('stream_') ? streamId : `stream_${streamId}`;
    return `http://${srsHost}:${srsPort}/live/${normalizedId}.m3u8`;
  }

  getFlvUrl(streamId: string): string {
    const srsHost = process.env.SRS_HOST || 'localhost';
    const srsPort = process.env.SRS_HTTP_PORT || '8080';
    const normalizedId = streamId.startsWith('stream_') ? streamId : `stream_${streamId}`;
    return `http://${srsHost}:${srsPort}/live/${normalizedId}.flv`;
  }

  private getWebRTCHost(): string {
    return this.srsHost;
  }

  public sanitizeSDP(sdp: string): string {
    const lines = sdp.replace(/\r\n/g, '\n').split('\n');
    const newLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      if (trimmed.includes('extmap-allow-mixed')) continue;
      if (trimmed.includes('transport-cc')) continue;
      if (trimmed.includes('goog-remb')) continue;
      newLines.push(trimmed);
    }

    return newLines.join('\r\n') + '\r\n';
  }

  public async publish(streamId: string, offerSdp: string): Promise<{ code: number, sdp: string, sessionid: string }> {
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
    } catch (error) {
      return { code: -1, sdp: '', sessionid: '' };
    }
  }

  public async play(streamId: string, offerSdp: string): Promise<{ code: number, sdp: string, sessionid: string }> {
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
    } catch (error) {
      return { code: -1, sdp: '', sessionid: '' };
    }
  }

  public async stop(sessionId: string): Promise<{ code: number, desc: string }> {
    try {
      const response = await fetch(`${this.getApiUrl()}/rtc/v1/whip/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      return {
        code: response.ok ? 0 : -1,
        desc: response.ok ? 'Session stopped' : `Stop failed: ${response.status}`,
      };
    } catch (error) {
      return { code: -1, desc: 'Failed to stop session' };
    }
  }
}

export const srsService = new SRSService();
