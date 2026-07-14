"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = require("../models/User");
const Streamer_1 = require("../models/Streamer");
const srsService_1 = require("../services/srsService");
const env_1 = require("../config/env");
const httpClient_1 = require("../utils/httpClient");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// @route POST /api/video/stream/start
// Inicia uma transmissão de vídeo e retorna URLs para o player
router.post('/stream/start', async (req, res) => {
    try {
        const { userId, streamKey, title, description } = req.body;
        console.log('[VIDEO-STREAM] Iniciando stream:', { userId, streamKey, title });
        // Validar dados obrigatórios
        if (!userId || !streamKey) {
            return res.status(400).json({
                success: false,
                error: 'userId e streamKey são obrigatórios'
            });
        }
        // Verificar se o usuário existe
        const user = await User_1.User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        // Verificar se a streamKey é válida para este usuário
        const streamer = await Streamer_1.Streamer.findOne({
            hostId: userId,
            streamKey: streamKey
        });
        if (!streamer) {
            return res.status(401).json({
                success: false,
                error: 'StreamKey inválida ou não pertence a este usuário'
            });
        }
        // Gerar URLs para o stream
        const streamId = streamer.id;
        const hlsUrl = srsService_1.srsService.getHlsUrl(streamId);
        const flvUrl = srsService_1.srsService.getFlvUrl(streamId);
        const webrtcUrl = srsService_1.srsService.getWebRTCPlayUrl(streamId);
        // Atualizar status do stream
        await Streamer_1.Streamer.findOneAndUpdate({ id: streamId }, { $set: {
                isLive: true,
                streamStatus: 'active',
                title: title || streamer.title,
                description: description || streamer.description,
                startTime: new Date(),
                hlsUrl: hlsUrl,
                flvUrl: flvUrl,
                webrtcUrl: webrtcUrl
            } });
        // Atualizar status do usuário
        await User_1.User.findOneAndUpdate({ id: userId }, { $set: { isLive: true, currentStreamId: streamId, lastStreamStart: new Date() } });
        console.log('[VIDEO-STREAM] Stream iniciado com sucesso:', {
            streamId,
            userId,
            hlsUrl,
            flvUrl,
            webrtcUrl
        });
        const io = req.app.get('io');
        if (io) {
            io.emit('new_live', {
                id: streamId,
                hostId: userId,
                name: streamer.name || title || `Live`,
                avatar: streamer.avatar || user?.avatarUrl || '',
                isLive: true,
                streamStatus: 'active',
                country: streamer.country || user?.country || 'BR',
                viewers: 0,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_started', {
                streamId: streamId,
                hostId: userId,
                name: streamer.name || title || `Live`,
                avatar: streamer.avatar || user?.avatarUrl || '',
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            success: true,
            data: {
                streamId,
                userId,
                title: title || streamer.title,
                description: description || streamer.description,
                urls: {
                    hls: hlsUrl,
                    flv: flvUrl,
                    webrtc: webrtcUrl,
                    // URL direta conforme documentação SRS 6 (porta 8080)
                    direct_hls: `http://${env_1.ENV.SRS_HOST}:${env_1.ENV.SRS_HTTP_PORT || '8080'}/live/${streamId}.m3u8`
                },
                rtmpUrl: `rtmp://${env_1.ENV.SRS_HOST || 'localhost'}:${env_1.ENV.SRS_RTMP_PORT || '1935'}/live/${streamKey}`,
                status: 'live'
            }
        });
    }
    catch (error) {
        console.error('[VIDEO-STREAM] Erro ao iniciar stream:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao iniciar stream',
            details: error.message
        });
    }
});
// @route POST /api/video/stream/stop
// Para uma transmissão de vídeo
router.post('/stream/stop', async (req, res) => {
    try {
        const { userId, streamId } = req.body;
        console.log('[VIDEO-STREAM] Parando stream:', { userId, streamId });
        // Validar dados obrigatórios
        if (!userId || !streamId) {
            return res.status(400).json({
                success: false,
                error: 'userId e streamId são obrigatórios'
            });
        }
        // Verificar se o usuário existe
        const user = await User_1.User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        // Verificar se a stream pertence a este usuário
        const streamer = await Streamer_1.Streamer.findOne({
            id: streamId,
            hostId: userId
        });
        if (!streamer) {
            return res.status(401).json({
                success: false,
                error: 'Stream não encontrada ou não pertence a este usuário'
            });
        }
        // Atualizar status do stream
        await Streamer_1.Streamer.findOneAndUpdate({ id: streamId }, { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } });
        // Atualizar status do usuário
        await User_1.User.findOneAndUpdate({ id: userId }, { $set: { isLive: false, isOnline: false, currentStreamId: null, lastStreamEnd: new Date() } });
        console.log('[VIDEO-STREAM] Stream parado com sucesso:', {
            streamId,
            userId
        });
        const io = req.app.get('io');
        if (io) {
            io.emit('card_removed', {
                streamId: streamId,
                hostId: userId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_ended', {
                streamId: streamId,
                hostId: userId,
                timestamp: new Date().toISOString()
            });
            io.emit('stream_stopped', {
                streamId: streamId,
                hostId: userId,
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            success: true,
            data: {
                streamId,
                userId,
                status: 'ended',
                endTime: new Date()
            }
        });
    }
    catch (error) {
        console.error('[VIDEO-STREAM] Erro ao parar stream:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao parar stream',
            details: error.message
        });
    }
});
// @route GET /api/video/stream/:streamId/urls
// Obtém URLs de reprodução para uma stream
router.get('/stream/:streamId/urls', async (req, res) => {
    try {
        const { streamId } = req.params;
        console.log('[VIDEO-STREAM] Obtendo URLs do stream:', streamId);
        // Verificar se a stream existe
        const streamer = await Streamer_1.Streamer.findOne({ id: streamId });
        if (!streamer) {
            return res.status(404).json({
                success: false,
                error: 'Stream não encontrada'
            });
        }
        // Gerar URLs atualizadas
        const hlsUrl = srsService_1.srsService.getHlsUrl(streamId);
        const flvUrl = srsService_1.srsService.getFlvUrl(streamId);
        const webrtcUrl = srsService_1.srsService.getWebRTCPlayUrl(streamId);
        // Atualizar URLs no streamer se necessário
        await Streamer_1.Streamer.findOneAndUpdate({ id: streamId }, { $set: { hlsUrl: hlsUrl, flvUrl: flvUrl, webrtcUrl: webrtcUrl } });
        res.json({
            success: true,
            data: {
                streamId,
                isLive: streamer.isLive,
                title: streamer.title,
                description: streamer.description,
                hostId: streamer.hostId,
                urls: {
                    hls: hlsUrl,
                    flv: flvUrl,
                    webrtc: webrtcUrl
                },
                status: streamer.streamStatus,
                startTime: streamer.startTime,
                viewerCount: streamer.viewers || 0
            }
        });
    }
    catch (error) {
        console.error('[VIDEO-STREAM] Erro ao obter URLs:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao obter URLs',
            details: error.message
        });
    }
});
// @route GET /api/video/stream/:streamId/status
// Obtém status atual de uma stream
router.get('/stream/:streamId/status', async (req, res) => {
    try {
        const { streamId } = req.params;
        console.log('[VIDEO-STREAM] Verificando status do stream:', streamId);
        // Verificar se a stream existe
        const streamer = await Streamer_1.Streamer.findOne({ id: streamId });
        if (!streamer) {
            return res.status(404).json({
                success: false,
                error: 'Stream não encontrada'
            });
        }
        res.json({
            success: true,
            data: {
                streamId,
                isLive: streamer.isLive,
                status: streamer.streamStatus,
                title: streamer.title,
                hostId: streamer.hostId,
                startTime: streamer.startTime,
                endTime: streamer.endTime,
                viewerCount: streamer.viewers || 0,
                duration: streamer.startTime ?
                    Math.floor((new Date().getTime() - new Date(streamer.startTime).getTime()) / 1000) : 0
            }
        });
    }
    catch (error) {
        console.error('[VIDEO-STREAM] Erro ao verificar status:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao verificar status',
            details: error.message
        });
    }
});
// @route POST /api/video/stream/webrtc/publish
// Endpoint para WebRTC publish (recebe SDP offer do app)
router.post('/stream/webrtc/publish', async (req, res) => {
    try {
        const { streamId, offerSdp } = req.body;
        console.log('[VIDEO-STREAM] WebRTC publish request:', { streamId });
        if (!streamId || !offerSdp) {
            return res.status(400).json({
                success: false,
                error: 'streamId e offerSdp são obrigatórios'
            });
        }
        // Verificar se a stream existe e pertence ao usuário
        const streamer = await Streamer_1.Streamer.findOne({ id: streamId });
        if (!streamer) {
            return res.status(404).json({
                success: false,
                error: 'Stream não encontrada'
            });
        }
        // Enviar para o SRS via WHIP
        const result = await srsService_1.srsService.publish(streamId, offerSdp);
        if (result.code === 0) {
            console.log('[VIDEO-STREAM] WebRTC publish successful:', { streamId, sessionId: result.sessionid });
            // Atualizar status do stream
            await Streamer_1.Streamer.findOneAndUpdate({ id: streamId }, { $set: { isLive: true, streamStatus: 'active', startTime: new Date(), webrtcSessionId: result.sessionid } });
            // Criar/atualizar LiveCard
            try {
                const { LiveCard } = await Promise.resolve().then(() => __importStar(require('../models')));
                await LiveCard.findOneAndUpdate({ hostId: streamId }, { $set: {
                        hostId: streamer.hostId || streamId,
                        name: streamer.name || 'Live',
                        avatar: streamer.avatar || '',
                        title: streamer.title || streamer.message || 'Ao Vivo',
                        streamKey: streamId,
                        country: (streamer.country || 'BR').toLowerCase(),
                        isLive: true,
                        streamStatus: 'active',
                        category: (streamer.category || 'popular').toLowerCase(),
                        playbackUrl: streamer.playbackUrl || '',
                        hlsUrl: streamer.hlsUrl || '',
                        viewers: streamer.viewers || 0,
                        startTime: new Date(),
                        updatedAt: new Date()
                    } }, { upsert: true });
            }
            catch (cardErr) {
                console.warn('[VIDEO-STREAM] Erro ao criar LiveCard:', cardErr);
            }
            res.json({
                success: true,
                data: {
                    code: result.code,
                    sdp: result.sdp,
                    sessionId: result.sessionid
                }
            });
        }
        else {
            console.error('[VIDEO-STREAM] WebRTC publish failed:', { streamId, code: result.code });
            res.status(500).json({
                success: false,
                error: 'Falha ao publicar stream via WebRTC',
                code: result.code
            });
        }
    }
    catch (error) {
        console.error('[VIDEO-STREAM] Erro no WebRTC publish:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno no WebRTC publish',
            details: error.message
        });
    }
});
// @route POST /api/video/stream/webrtc/play
// Endpoint para WebRTC play (recebe SDP offer do player)
router.post('/stream/webrtc/play', async (req, res) => {
    try {
        const { streamId, offerSdp } = req.body;
        console.log('[VIDEO-STREAM] WebRTC play request:', { streamId });
        if (!streamId || !offerSdp) {
            return res.status(400).json({
                success: false,
                error: 'streamId e offerSdp são obrigatórios'
            });
        }
        // Verificar se a stream existe e está ativa
        const streamer = await Streamer_1.Streamer.findOne({ id: streamId, isLive: true });
        if (!streamer) {
            return res.status(404).json({
                success: false,
                error: 'Stream não encontrada ou não está ativa'
            });
        }
        // Enviar para o SRS via WHEP
        const result = await srsService_1.srsService.play(streamId, offerSdp);
        if (result.code === 0) {
            console.log('[VIDEO-STREAM] WebRTC play successful:', { streamId, sessionId: result.sessionid });
            res.json({
                success: true,
                data: {
                    code: result.code,
                    sdp: result.sdp,
                    sessionId: result.sessionid
                }
            });
        }
        else {
            console.error('[VIDEO-STREAM] WebRTC play failed:', { streamId, code: result.code });
            res.status(500).json({
                success: false,
                error: 'Falha ao reproduzir stream via WebRTC',
                code: result.code
            });
        }
    }
    catch (error) {
        console.error('[VIDEO-STREAM] Erro no WebRTC play:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno no WebRTC play',
            details: error.message
        });
    }
});
// GET /api/video/http/live/:filename - Proxy HLS/FLV do SRS (para HTTPS)
// Evita mixed content ao servir HLS/FLV via backend HTTPS
router.get('/http/live/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        // Usar configurações centralizadas do ENV
        const srsHost = env_1.ENV.SRS_HOST || 'localhost';
        const srsHttpPort = env_1.ENV.SRS_HTTP_PORT || '8080';
        // Forçar HTTP para comunicação interna backend -> SRS para maior performance e evitar erros de SSL
        let srsUrl = `http://${srsHost}:${srsHttpPort}/live/${filename}`;
        console.log(`[VIDEO-STREAM] Proxying HLS request: ${filename} -> ${srsUrl}`);
        if (filename.endsWith('.m3u8')) {
            // Para m3u8: usa requestRaw (texto) para fazer URL rewriting
            let rawResp = await httpClient_1.httpClient.requestRaw('GET', srsUrl);
            // Fallback: Se falhar com o prefixo 'stream_', tentar sem
            if (!rawResp.ok && filename.startsWith('stream_')) {
                const altFilename = filename.replace('stream_', '');
                const altUrl = `http://${srsHost}:${srsHttpPort}/live/${altFilename}`;
                console.log(`[VIDEO-STREAM] ${rawResp.status} detected. Trying alternative URL: ${altUrl}`);
                const altResp = await httpClient_1.httpClient.requestRaw('GET', altUrl);
                if (altResp.ok) {
                    rawResp = altResp;
                    srsUrl = altUrl;
                }
            }
            if (!rawResp.ok) {
                console.error(`[VIDEO-STREAM] SRS returned error ${rawResp.status} for ${srsUrl}`);
                return res.status(rawResp.status).send(`SRS error: ${rawResp.status}`);
            }
            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            res.set('Cache-Control', 'no-cache');
            // Rewrite URLs inside the manifest to go through proxy
            const proxied = rawResp.bodyText.replace(/^(.*\.(ts|m3u8))/gm, (match) => {
                if (match.startsWith('http'))
                    return match;
                return `${req.protocol}://${req.get('host')}/api/video/http/live/${match}`;
            });
            res.send(proxied);
        }
        else {
            // Para .ts/.flv: usa requestBuffer (binário) — única chamada HTTP
            let bufResp = await httpClient_1.httpClient.requestBuffer('GET', srsUrl);
            // Fallback: Se falhar com o prefixo 'stream_', tentar sem
            if (!bufResp.ok && filename.startsWith('stream_')) {
                const altFilename = filename.replace('stream_', '');
                const altUrl = `http://${srsHost}:${srsHttpPort}/live/${altFilename}`;
                console.log(`[VIDEO-STREAM] ${bufResp.status} detected. Trying alternative URL: ${altUrl}`);
                const altResp = await httpClient_1.httpClient.requestBuffer('GET', altUrl);
                if (altResp.ok) {
                    bufResp = altResp;
                    srsUrl = altUrl;
                }
            }
            if (!bufResp.ok) {
                console.error(`[VIDEO-STREAM] SRS returned error ${bufResp.status} for ${srsUrl}`);
                return res.status(bufResp.status).send(`SRS error: ${bufResp.status}`);
            }
            const contentType = filename.endsWith('.flv')
                ? 'video/x-flv'
                : 'video/MP2T';
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'no-cache');
            res.send(Buffer.from(bufResp.buffer));
        }
    }
    catch (error) {
        console.error('[VIDEO-STREAM] Erro no proxy HLS:', error);
        res.status(502).send('Proxy error');
    }
});
// @route POST /api/rtc/v1/publish
// Proxy SDP offer → SRS via WHIP (backende-proxy flow)
router.post('/rtc/v1/publish', async (req, res) => {
    try {
        const { streamUrl, sdp, streamKey } = req.body;
        if (!streamUrl || !sdp) {
            return res.status(400).json({
                success: false,
                error: 'streamUrl e sdp são obrigatórios'
            });
        }
        const streamId = streamKey || streamUrl.split('/').pop() || '';
        console.log('[RTC] Publish request:', { streamId, streamKey });
        const result = await srsService_1.srsService.publish(streamId, sdp);
        if (result.code === 0) {
            console.log('[RTC] Publish successful:', { sessionId: result.sessionid });
            if (streamKey) {
                await Streamer_1.Streamer.findOneAndUpdate({ id: streamKey }, { $set: { isLive: true, streamStatus: 'active', startTime: new Date(), webrtcSessionId: result.sessionid } });
                // Criar/atualizar LiveCard
                try {
                    const streamer = await Streamer_1.Streamer.findOne({ id: streamKey }).lean();
                    const { LiveCard } = await Promise.resolve().then(() => __importStar(require('../models')));
                    await LiveCard.findOneAndUpdate({ hostId: streamKey }, { $set: {
                            hostId: streamer?.hostId || streamKey,
                            name: streamer?.name || 'Live',
                            avatar: streamer?.avatar || '',
                            title: streamer?.title || streamer?.message || 'Ao Vivo',
                            streamKey,
                            country: (streamer?.country || 'BR').toLowerCase(),
                            isLive: true,
                            streamStatus: 'active',
                            category: (streamer?.category || 'popular').toLowerCase(),
                            playbackUrl: streamer?.playbackUrl || '',
                            hlsUrl: streamer?.hlsUrl || '',
                            viewers: streamer?.viewers || 0,
                            startTime: new Date(),
                            updatedAt: new Date()
                        } }, { upsert: true });
                }
                catch (cardErr) {
                    console.warn('[RTC] Erro ao criar LiveCard:', cardErr);
                }
            }
            res.json({
                success: true,
                data: {
                    code: result.code,
                    sdp: result.sdp,
                    sessionId: result.sessionid
                }
            });
        }
        else {
            console.error('[RTC] Publish failed:', { code: result.code });
            res.status(500).json({
                success: false,
                error: 'Falha ao publicar stream via SRS',
                code: result.code
            });
        }
    }
    catch (error) {
        console.error('[RTC] Erro no publish:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno no publish',
            details: error.message
        });
    }
});
// @route DELETE /api/rtc/v1/stop/:sessionId
// Encerra sessão WebRTC no SRS
router.delete('/rtc/v1/stop/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        console.log('[RTC] Stop request:', { sessionId });
        const result = await srsService_1.srsService.stop(sessionId);
        if (result.code === 0) {
            console.log('[RTC] Session stopped:', { sessionId });
            res.json({
                success: true,
                data: result
            });
        }
        else {
            console.warn('[RTC] Stop returned non-zero:', { sessionId, code: result.code });
            res.json({
                success: true,
                data: result
            });
        }
    }
    catch (error) {
        console.error('[RTC] Erro no stop:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno no stop',
            details: error.message
        });
    }
});
// @route POST /api/rtc/v1/play
// Proxy SDP offer → SRS via WHEP (backende-proxy flow)
router.post('/rtc/v1/play', async (req, res) => {
    try {
        const { streamUrl, sdp } = req.body;
        if (!streamUrl || !sdp) {
            return res.status(400).json({
                success: false,
                error: 'streamUrl e sdp são obrigatórios'
            });
        }
        const streamId = streamUrl.split('/').pop() || '';
        console.log('[RTC] Play request:', { streamId });
        const result = await srsService_1.srsService.play(streamId, sdp);
        if (result.code === 0) {
            console.log('[RTC] Play successful:', { sessionId: result.sessionid });
            res.json({
                success: true,
                data: {
                    code: result.code,
                    sdp: result.sdp,
                    sessionId: result.sessionid
                }
            });
        }
        else {
            console.error('[RTC] Play failed:', { code: result.code });
            res.status(500).json({
                success: false,
                error: 'Falha ao reproduzir stream via SRS',
                code: result.code
            });
        }
    }
    catch (error) {
        console.error('[RTC] Erro no play:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno no play',
            details: error.message
        });
    }
});
// @route GET /api/rtc/ice-servers
// Retorna servidores ICE com STUN público (Google) + endpoint para obter credenciais TURN dinâmicas
// NOTA: Credenciais TURN estáticas não funcionam com coturn (usa HMAC time-based auth).
// O frontend DEVE chamar POST /api/turn/credentials para obter credenciais TURN válidas.
router.get('/rtc/ice-servers', (req, res) => {
    const { TURN_HOST, TURN_PORT } = env_1.ENV;
    const BACKEND_URL = process.env.BACKEND_URL || '';
    res.json({
        success: true,
        iceServers: [
            // STUN público do Google (sempre funciona fora da rede)
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // STUN customizado (se disponível)
            { urls: `stun:${TURN_HOST}:${TURN_PORT}` },
            // TURN - o frontend deve obter credenciais via POST /api/turn/credentials
        ],
        turnCredentialsEndpoint: `${BACKEND_URL}/api/turn/credentials`,
    });
});
// Helper para construir URL base do SRS — usa ENV.SRS_API_URL centralizado
const getSrsApiBaseUrl = () => {
    return env_1.ENV.SRS_API_URL;
};
/**
 * Remove candidatos ICE com IPs privados (Docker/internalos) do SDP,
 * mantendo apenas candidatos com IP público ou relay (TURN).
 * Isso evita que o cliente tente conectar em IPs 172.x.x.x ou 10.x.x.x
 * que só funcionam dentro da rede Docker.
 */
function rewritePrivateIpsInSdp(sdp, publicIp) {
    const privateRanges = [
        /^172\.(1[6-9]|2[0-9]|3[0-1])\..*/,
        /^10\..*/,
        /^192\.168\..*/,
        /^127\..*/,
        /^0\..*/,
    ];
    // Se não tem IP público configurado, manter apenas candidatos relay (TURN)
    if (!publicIp) {
        // Remove candidatos host com IP privado, mantém relay e srflx
        return sdp.split('\r\n').filter(line => {
            if (!line.startsWith('a=candidate:'))
                return true;
            const parts = line.split(' ');
            // Formato: a=candidate:fundation 1 udp 2130706431 192.168.1.1 3478 typ host
            // O IP é o 4º campo (index 4) em candidatos típicos
            // Procurar IP na linha
            const ipMatch = line.match(/a=candidate:[^ ]+ [^ ]+ [^ ]+ [^ ]+ ([^ ]+)/);
            if (!ipMatch)
                return true;
            const ip = ipMatch[1];
            // Verificar se é IP privado
            for (const range of privateRanges) {
                if (range.test(ip))
                    return false; // Remove candidato com IP privado
            }
            return true;
        }).join('\r\n');
    }
    // Se tem IP público, substituir IPs privados nos candidatos
    return sdp.split('\r\n').map(line => {
        if (!line.startsWith('a=candidate:'))
            return line;
        const ipMatch = line.match(/a=candidate:[^ ]+ [^ ]+ [^ ]+ [^ ]+ ([^ ]+)/);
        if (!ipMatch)
            return line;
        const ip = ipMatch[1];
        for (const range of privateRanges) {
            if (range.test(ip)) {
                // Substituir IP privado pelo IP público
                return line.replace(ip, publicIp);
            }
        }
        return line;
    }).join('\r\n');
}
const whipSdpParser = express_1.default.text({ type: 'application/sdp', limit: '1mb' });
// @route POST /api/rtc/v1/whip/
// Proxy raw SDP → SRS WHIP endpoint (via backend proxy)
router.post('/rtc/v1/whip/', auth_1.protect, whipSdpParser, async (req, res) => {
    try {
        const { app, stream } = req.query;
        const sdp = req.body;
        if (!sdp || !stream) {
            return res.status(400).send('Missing SDP body or stream query param');
        }
        const sanitizedSdp = srsService_1.srsService.sanitizeSDP(sdp);
        const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whip/?app=${encodeURIComponent(String(app || 'live'))}&stream=${encodeURIComponent(String(stream))}`;
        console.log('[RTC] WHIP proxy:', { stream });
        const srsRes = await httpClient_1.httpClient.requestRaw('POST', srsUrl, sanitizedSdp, {
            headers: { 'Content-Type': 'application/sdp' },
        });
        // Rewrite location header for ICE trickle to go through backend proxy
        if (srsRes.headers.get('location')) {
            const loc = srsRes.headers.get('location');
            res.set('location', loc.replace('/rtc/v1/whip/', '/api/rtc/v1/whip/'));
        }
        if (srsRes.headers.get('ETag')) {
            res.set('ETag', srsRes.headers.get('ETag'));
        }
        console.log('[RTC] WHIP response:', { status: srsRes.status });
        res.status(srsRes.status).send(srsRes.bodyText);
    }
    catch (err) {
        console.error('[RTC] WHIP proxy error:', err);
        res.status(502).send(`WHIP proxy error: ${err.message}`);
    }
});
// @route PATCH /api/rtc/v1/whip/:sessionId
// Proxy ICE trickle PATCH → SRS
router.patch('/rtc/v1/whip/:sessionId', auth_1.protect, whipSdpParser, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const eTag = req.headers['etag'];
        const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whip/${sessionId}`;
        const srsRes = await httpClient_1.httpClient.requestRaw('PATCH', srsUrl, req.body, {
            headers: {
                'Content-Type': 'application/trickle-ice-sdpfrag',
                'ETag': eTag || '',
            },
        });
        if (srsRes.headers.get('ETag')) {
            res.set('ETag', srsRes.headers.get('ETag'));
        }
        res.status(srsRes.status).send(srsRes.bodyText);
    }
    catch (err) {
        console.error('[RTC] WHIP PATCH error:', err);
        res.status(502).send(`WHIP PATCH error: ${err.message}`);
    }
});
// @route DELETE /api/rtc/v1/whip/:sessionId
// Proxy DELETE → SRS WHIP session cleanup
router.delete('/rtc/v1/whip/:sessionId', auth_1.protect, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whip/${sessionId}`;
        const srsRes = await httpClient_1.httpClient.requestRaw('DELETE', srsUrl);
        console.log('[RTC] WHIP DELETE:', { sessionId, status: srsRes.status });
        res.status(srsRes.status).send(srsRes.bodyText);
    }
    catch (err) {
        console.error('[RTC] WHIP DELETE error:', err);
        res.status(502).send(`WHIP DELETE error: ${err.message}`);
    }
});
// @route POST /api/rtc/v1/whep/
// Proxy raw SDP → SRS WHEP endpoint (via backend proxy)
router.post('/rtc/v1/whep/', auth_1.protect, whipSdpParser, async (req, res) => {
    try {
        const { app, stream } = req.query;
        const sdp = req.body;
        if (!sdp || !stream) {
            return res.status(400).send('Missing SDP body or stream query param');
        }
        console.log('[RTC-WHEP] Request recebido:', { app, stream, sdpLength: sdp?.length });
        const sanitizedSdp = srsService_1.srsService.sanitizeSDP(sdp);
        const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whep/?app=${encodeURIComponent(String(app || 'live'))}&stream=${encodeURIComponent(String(stream))}`;
        console.log('[RTC-WHEP] Proxy para SRS:', { stream });
        if (sanitizedSdp.length !== sdp.length) {
            console.log('[RTC-WHEP] SDP sanitizado:', { originalLen: sdp.length, sanitizedLen: sanitizedSdp.length });
        }
        const srsRes = await httpClient_1.httpClient.requestRaw('POST', srsUrl, sanitizedSdp, {
            headers: { 'Content-Type': 'application/sdp' },
        });
        console.log('[RTC-WHEP] Resposta do SRS:', { stream, status: srsRes.status });
        if (!srsRes.ok) {
            console.error('[RTC-WHEP] SRS retornou erro:', { stream, status: srsRes.status });
            return res.status(srsRes.status).send(srsRes.bodyText);
        }
        // Rewrite location header for ICE trickle to go through backend proxy
        if (srsRes.headers.get('location')) {
            const loc = srsRes.headers.get('location');
            res.set('location', loc.replace('/rtc/v1/whep/', '/api/rtc/v1/whep/'));
            // Location reescrito para ICE trickle via proxy
        }
        if (srsRes.headers.get('ETag')) {
            res.set('ETag', srsRes.headers.get('ETag'));
        }
        // Remover candidatos ICE com IPs internos (Docker) do SDP answer
        // para que clientes externos não tentem conectar em IPs inacessíveis
        const publicIp = process.env.PUBLIC_IP || process.env.SRS_PUBLIC_IP || '';
        const cleanedSdp = rewritePrivateIpsInSdp(srsRes.bodyText, publicIp);
        if (cleanedSdp !== srsRes.bodyText) {
            console.log('[RTC-WHEP] 🧹 IPs privados removidos do SDP answer');
        }
        console.log('[RTC-WHEP] Sucesso:', { status: 201, sdpLength: cleanedSdp.length });
        res.status(201).send(cleanedSdp);
    }
    catch (err) {
        console.error('[RTC] WHEP proxy error:', err);
        res.status(502).send(`WHEP proxy error: ${err.message}`);
    }
});
// @route PATCH /api/rtc/v1/whep/:sessionId
// Proxy ICE trickle PATCH → SRS (WHEP)
router.patch('/rtc/v1/whep/:sessionId', auth_1.protect, whipSdpParser, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const eTag = req.headers['etag'];
        const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whep/${sessionId}`;
        const srsRes = await httpClient_1.httpClient.requestRaw('PATCH', srsUrl, req.body, {
            headers: {
                'Content-Type': 'application/trickle-ice-sdpfrag',
                'ETag': eTag || '',
            },
        });
        if (srsRes.headers.get('ETag')) {
            res.set('ETag', srsRes.headers.get('ETag'));
        }
        res.status(srsRes.status).send(srsRes.bodyText);
    }
    catch (err) {
        console.error('[RTC] WHEP PATCH error:', err);
        res.status(502).send(`WHEP PATCH error: ${err.message}`);
    }
});
// @route DELETE /api/rtc/v1/whep/:sessionId
// Proxy DELETE → SRS WHEP session cleanup
router.delete('/rtc/v1/whep/:sessionId', auth_1.protect, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whep/${sessionId}`;
        const srsRes = await httpClient_1.httpClient.requestRaw('DELETE', srsUrl);
        console.log('[RTC] WHEP DELETE:', { sessionId, status: srsRes.status });
        res.status(srsRes.status).send(srsRes.bodyText);
    }
    catch (err) {
        console.error('[RTC] WHEP DELETE error:', err);
        res.status(502).send(`WHEP DELETE error: ${err.message}`);
    }
});
exports.default = router;
