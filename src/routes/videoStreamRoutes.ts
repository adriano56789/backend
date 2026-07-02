import express from 'express';
import { User } from '../models/User';
import { Streamer } from '../models/Streamer';
import { srsService } from '../services/srsService';
import { ENV } from '../config/env';

const router = express.Router();

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
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        // Verificar se a streamKey é válida para este usuário
        const streamer = await Streamer.findOne({ 
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
        const hlsUrl = srsService.getHlsUrl(streamId);
        const flvUrl = srsService.getFlvUrl(streamId);
        const webrtcUrl = srsService.getWebRTCPlayUrl(streamId);

        // Atualizar status do stream
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: {
                isLive: true,
                streamStatus: 'active',
                title: title || streamer.title,
                description: description || streamer.description,
                startTime: new Date(),
                hlsUrl: hlsUrl,
                flvUrl: flvUrl,
                webrtcUrl: webrtcUrl
            } }
        );

        // Atualizar status do usuário
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { isLive: true, currentStreamId: streamId, lastStreamStart: new Date() } }
        );

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
                    direct_hls: `http://${ENV.SRS_HOST}:${ENV.SRS_HTTP_PORT || '8080'}/live/${streamId}.m3u8`
                },
                rtmpUrl: `rtmp://${ENV.SRS_HOST || 'localhost'}:${ENV.SRS_RTMP_PORT || '1935'}/live/${streamKey}`,
                status: 'live'
            }
        });

    } catch (error: any) {
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
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        // Verificar se a stream pertence a este usuário
        const streamer = await Streamer.findOne({ 
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
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { isLive: false, streamStatus: 'ended', endTime: new Date() } }
        );

        // Atualizar status do usuário
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { isLive: false, isOnline: false, currentStreamId: null, lastStreamEnd: new Date() } }
        );

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

    } catch (error: any) {
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
        const streamer = await Streamer.findOne({ id: streamId });
        if (!streamer) {
            return res.status(404).json({
                success: false,
                error: 'Stream não encontrada'
            });
        }

        // Gerar URLs atualizadas
        const hlsUrl = srsService.getHlsUrl(streamId);
        const flvUrl = srsService.getFlvUrl(streamId);
        const webrtcUrl = srsService.getWebRTCPlayUrl(streamId);

        // Atualizar URLs no streamer se necessário
        await Streamer.findOneAndUpdate(
            { id: streamId },
            { $set: { hlsUrl: hlsUrl, flvUrl: flvUrl, webrtcUrl: webrtcUrl } }
        );

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

    } catch (error: any) {
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
        const streamer = await Streamer.findOne({ id: streamId });
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

    } catch (error: any) {
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
        const streamer = await Streamer.findOne({ id: streamId });
        if (!streamer) {
            return res.status(404).json({
                success: false,
                error: 'Stream não encontrada'
            });
        }

        // Enviar para o SRS via WHIP
        const result = await srsService.publish(streamId, offerSdp);

        if (result.code === 0) {
            console.log('[VIDEO-STREAM] WebRTC publish successful:', { streamId, sessionId: result.sessionid });

            // Atualizar status do stream
            await Streamer.findOneAndUpdate(
                { id: streamId },
                { $set: { isLive: true, streamStatus: 'active', startTime: new Date(), webrtcSessionId: result.sessionid } }
            );

            // Criar/atualizar LiveCard
            try {
                const { LiveCard } = await import('../models');
                await LiveCard.findOneAndUpdate(
                    { hostId: streamId },
                    { $set: {
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
                    } },
                    { upsert: true }
                );
            } catch (cardErr) {
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
        } else {
            console.error('[VIDEO-STREAM] WebRTC publish failed:', { streamId, code: result.code });

            res.status(500).json({
                success: false,
                error: 'Falha ao publicar stream via WebRTC',
                code: result.code
            });
        }

    } catch (error: any) {
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
        const streamer = await Streamer.findOne({ id: streamId, isLive: true });
        if (!streamer) {
            return res.status(404).json({
                success: false,
                error: 'Stream não encontrada ou não está ativa'
            });
        }

        // Enviar para o SRS via WHEP
        const result = await srsService.play(streamId, offerSdp);

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
        } else {
            console.error('[VIDEO-STREAM] WebRTC play failed:', { streamId, code: result.code });

            res.status(500).json({
                success: false,
                error: 'Falha ao reproduzir stream via WebRTC',
                code: result.code
            });
        }

    } catch (error: any) {
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
        const srsHost = ENV.SRS_HOST || 'localhost';
        const srsHttpPort = ENV.SRS_HTTP_PORT || '8080';

        // Forçar HTTP para comunicação interna backend -> SRS para maior performance e evitar erros de SSL
        let srsUrl = `http://${srsHost}:${srsHttpPort}/live/${filename}`;

        console.log(`[VIDEO-STREAM] Proxying HLS request: ${filename} -> ${srsUrl}`);

        let response = await fetch(srsUrl);

        // Fallback: Se falhar com o prefixo 'stream_', tentar sem o prefixo
        if (!response.status.toString().startsWith('2') && filename.startsWith('stream_')) {
            const alternativeFilename = filename.replace('stream_', '');
            const alternativeUrl = `http://${srsHost}:${srsHttpPort}/live/${alternativeFilename}`;
            console.log(`[VIDEO-STREAM] ${response.status} detected. Trying alternative URL: ${alternativeUrl}`);
            const altRes = await fetch(alternativeUrl);
            if (altRes.ok) {
                response = altRes;
                srsUrl = alternativeUrl;
            }
        }

        if (!response.ok) {
            console.error(`[VIDEO-STREAM] SRS returned error ${response.status} for ${srsUrl}`);
            return res.status(response.status).send(`SRS error: ${response.status}`);
        }

        const contentType = filename.endsWith('.m3u8')
            ? 'application/vnd.apple.mpegurl'
            : filename.endsWith('.ts')
                ? 'video/MP2T'
                : filename.endsWith('.flv')
                    ? 'video/x-flv'
                    : response.headers.get('content-type') || 'application/octet-stream';

        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'no-cache');

        if (filename.endsWith('.m3u8')) {
            const body = await response.text();
            // Proxying absolute and relative URLs inside the manifest
            const proxied = body.replace(/^(.*\.(ts|m3u8))/gm, (match) => {
                if (match.startsWith('http')) return match;
                return `${req.protocol}://${req.get('host')}/api/video/http/live/${match}`;
            });
            res.send(proxied);
        } else {
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (error) {
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

        const result = await srsService.publish(streamId, sdp);

        if (result.code === 0) {
            console.log('[RTC] Publish successful:', { sessionId: result.sessionid });

            if (streamKey) {
                await Streamer.findOneAndUpdate(
                    { id: streamKey },
                { $set: { isLive: true, streamStatus: 'active', startTime: new Date(), webrtcSessionId: result.sessionid } }
                );

                // Criar/atualizar LiveCard
                try {
                    const streamer = await Streamer.findOne({ id: streamKey }).lean();
                    const { LiveCard } = await import('../models');
                    await LiveCard.findOneAndUpdate(
                        { hostId: streamKey },
                        { $set: {
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
                        } },
                        { upsert: true }
                    );
                } catch (cardErr) {
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
        } else {
            console.error('[RTC] Publish failed:', { code: result.code });
            res.status(500).json({
                success: false,
                error: 'Falha ao publicar stream via SRS',
                code: result.code
            });
        }
    } catch (error: any) {
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

        const result = await srsService.stop(sessionId);

        if (result.code === 0) {
            console.log('[RTC] Session stopped:', { sessionId });
            res.json({
                success: true,
                data: result
            });
        } else {
            console.warn('[RTC] Stop returned non-zero:', { sessionId, code: result.code });
            res.json({
                success: true,
                data: result
            });
        }
    } catch (error: any) {
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

        const result = await srsService.play(streamId, sdp);

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
        } else {
            console.error('[RTC] Play failed:', { code: result.code });
            res.status(500).json({
                success: false,
                error: 'Falha ao reproduzir stream via SRS',
                code: result.code
            });
        }
    } catch (error: any) {
        console.error('[RTC] Erro no play:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno no play',
            details: error.message
        });
    }
});

// @route GET /api/rtc/ice-servers
// Retorna servidores ICE (STUN/TURN) para WebRTC
router.get('/rtc/ice-servers', (req, res) => {
  const turnHost = process.env.TURN_HOST || process.env.SRS_HOST || '72.60.249.175';
  const turnPort = process.env.TURN_PORT || '3478';
  const turnUsername = process.env.TURN_USERNAME || 'livego';
  const turnCredential = process.env.TURN_CREDENTIAL || process.env.SRS_TURN_PASSWORD || 'livegosecretpassword';

  res.json({
    success: true,
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      {
        urls: `turn:${turnHost}:${turnPort}?transport=udp`,
        username: turnUsername,
        credential: turnCredential
      },
      {
        urls: `turn:${turnHost}:${turnPort}?transport=tcp`,
        username: turnUsername,
        credential: turnCredential
      }
    ]
  });
});

// Helper para construir URL base do SRS com protocolo dinâmico
const getSrsApiBaseUrl = (): string => {
  const host = ENV.SRS_HOST || 'localhost';
  const port = ENV.SRS_API_PORT || '1985';
  return `http://${host}:${port}`;
};

const rawSdpParser = express.text({ type: '*/*' });

// @route POST /api/rtc/v1/whip/
// Proxy raw SDP → SRS WHIP endpoint (via backend proxy)
router.post('/rtc/v1/whip/', rawSdpParser, async (req, res) => {
  try {
    const { app, stream } = req.query;
    const sdp = req.body;
    if (!sdp || !stream) {
      return res.status(400).send('Missing SDP body or stream query param');
    }

    const sanitizedSdp = srsService.sanitizeSDP(sdp);

    const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whip/?app=${encodeURIComponent(String(app || 'live'))}&stream=${encodeURIComponent(String(stream))}`;
    console.log('[RTC] WHIP proxy:', { stream, srsUrl });

    const srsRes = await fetch(srsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: sanitizedSdp,
    });

    // Rewrite location header for ICE trickle to go through backend proxy
    if (srsRes.headers.get('location')) {
      const loc = srsRes.headers.get('location')!;
      res.set('location', loc.replace('/rtc/v1/whip/', '/api/rtc/v1/whip/'));
    }
    if (srsRes.headers.get('ETag')) {
      res.set('ETag', srsRes.headers.get('ETag')!);
    }

    const body = await srsRes.text();
    console.log('[RTC] WHIP response:', { status: srsRes.status, length: body.length });
    res.status(srsRes.status).send(body);
  } catch (err: any) {
    console.error('[RTC] WHIP proxy error:', err);
    res.status(502).send(`WHIP proxy error: ${err.message}`);
  }
});

// @route PATCH /api/rtc/v1/whip/:sessionId
// Proxy ICE trickle PATCH → SRS
router.patch('/rtc/v1/whip/:sessionId', rawSdpParser, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const eTag = req.headers['etag'] as string;

    const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whip/${sessionId}`;
    const srsRes = await fetch(srsUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/trickle-ice-sdpfrag',
        'ETag': eTag || '',
      },
      body: req.body,
    });

    if (srsRes.headers.get('ETag')) {
      res.set('ETag', srsRes.headers.get('ETag')!);
    }

    res.status(srsRes.status).send(await srsRes.text());
  } catch (err: any) {
    console.error('[RTC] WHIP PATCH error:', err);
    res.status(502).send(`WHIP PATCH error: ${err.message}`);
  }
});

// @route DELETE /api/rtc/v1/whip/:sessionId
// Proxy DELETE → SRS WHIP session cleanup
router.delete('/rtc/v1/whip/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whip/${sessionId}`;
    const srsRes = await fetch(srsUrl, { method: 'DELETE' });
    console.log('[RTC] WHIP DELETE:', { sessionId, status: srsRes.status });
    res.status(srsRes.status).send(await srsRes.text());
  } catch (err: any) {
    console.error('[RTC] WHIP DELETE error:', err);
    res.status(502).send(`WHIP DELETE error: ${err.message}`);
  }
});

// @route POST /api/rtc/v1/whep/
// Proxy raw SDP → SRS WHEP endpoint (via backend proxy)
router.post('/rtc/v1/whep/', rawSdpParser, async (req, res) => {
  try {
    const { app, stream } = req.query;
    const sdp = req.body;
    if (!sdp || !stream) {
      return res.status(400).send('Missing SDP body or stream query param');
    }

    const sanitizedSdp = srsService.sanitizeSDP(sdp);

    const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whep/?app=${encodeURIComponent(String(app || 'live'))}&stream=${encodeURIComponent(String(stream))}`;
    console.log('[RTC] WHEP proxy:', { stream, srsUrl });

    const srsRes = await fetch(srsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: sanitizedSdp,
    });

    // Rewrite location header for ICE trickle to go through backend proxy
    if (srsRes.headers.get('location')) {
      const loc = srsRes.headers.get('location')!;
      res.set('location', loc.replace('/rtc/v1/whep/', '/api/rtc/v1/whep/'));
    }
    if (srsRes.headers.get('ETag')) {
      res.set('ETag', srsRes.headers.get('ETag')!);
    }

    const body = await srsRes.text();
    console.log('[RTC] WHEP response:', { status: srsRes.status, length: body.length });
    res.status(srsRes.status).send(body);
  } catch (err: any) {
    console.error('[RTC] WHEP proxy error:', err);
    res.status(502).send(`WHEP proxy error: ${err.message}`);
  }
});

// @route PATCH /api/rtc/v1/whep/:sessionId
// Proxy ICE trickle PATCH → SRS (WHEP)
router.patch('/rtc/v1/whep/:sessionId', rawSdpParser, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const eTag = req.headers['etag'] as string;

    const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whep/${sessionId}`;
    const srsRes = await fetch(srsUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/trickle-ice-sdpfrag',
        'ETag': eTag || '',
      },
      body: req.body,
    });

    if (srsRes.headers.get('ETag')) {
      res.set('ETag', srsRes.headers.get('ETag')!);
    }

    res.status(srsRes.status).send(await srsRes.text());
  } catch (err: any) {
    console.error('[RTC] WHEP PATCH error:', err);
    res.status(502).send(`WHEP PATCH error: ${err.message}`);
  }
});

// @route DELETE /api/rtc/v1/whep/:sessionId
// Proxy DELETE → SRS WHEP session cleanup
router.delete('/rtc/v1/whep/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const srsUrl = `${getSrsApiBaseUrl()}/rtc/v1/whep/${sessionId}`;
    const srsRes = await fetch(srsUrl, { method: 'DELETE' });
    console.log('[RTC] WHEP DELETE:', { sessionId, status: srsRes.status });
    res.status(srsRes.status).send(await srsRes.text());
  } catch (err: any) {
    console.error('[RTC] WHEP DELETE error:', err);
    res.status(502).send(`WHEP DELETE error: ${err.message}`);
  }
});

export default router;
