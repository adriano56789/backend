"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStreamUrls = buildStreamUrls;
function getConfig() {
    return {
        srsHost: process.env.SRS_HOST || '72.60.249.175',
        srsRtmpPort: process.env.SRS_RTMP_PORT || '1935',
        srsVhost: process.env.SRS_VHOST || '__defaultVhost__',
        backendUrl: (process.env.BACKEND_URL || 'https://api.livego.store').replace(/\/+$/, ''),
        app: 'live',
    };
}
function buildStreamUrls(streamId) {
    const cfg = getConfig();
    const baseRtmp = `rtmp://${cfg.srsHost}:${cfg.srsRtmpPort}/${cfg.app}`;
    const baseHttp = `${cfg.backendUrl}/api/video/http`;
    return {
        rtmpIngestUrl: `${baseRtmp}/${streamId}`,
        playbackUrl: `${baseHttp}/live/${streamId}.flv`,
        hlsUrl: `${baseHttp}/live/${streamId}.m3u8`,
        flvUrl: `${baseHttp}/live/${streamId}.flv`,
        rtmpUrl: `${baseRtmp}/${streamId}`,
    };
}
