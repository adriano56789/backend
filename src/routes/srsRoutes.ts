import express from 'express';
import { User } from '../models/User';
import { Streamer } from '../models/Streamer';
import { Battle } from '../models/Battle';
import { Followers } from '../models/Followers';

const router = express.Router();

// Idempotência: evita processar callbacks duplicados do SRS
const processedCallbacks = new Set<string>();
const RECONNECT_WINDOW_MS = 15000; // 15s janela de reconexão para PK
const reconnectionTimers = new Map<string, NodeJS.Timeout>();

function isDuplicate(clientId: string, action: string): boolean {
  const key = `${action}:${clientId}`;
  if (processedCallbacks.has(key)) return true;
  processedCallbacks.add(key);
  setTimeout(() => processedCallbacks.delete(key), 5000); // limpa após 5s
  return false;
}


// @route POST /api/srs/publish
// Callback SRS quando publisher inicia transmissão
router.post('/publish', async (req, res) => {
    try {
        // Registrar TODOS os dados reais enviados pelo SRS
        console.log('[SRS-PUBLISH] === DADOS REAIS DO SRS ===');
        console.log('[SRS-PUBLISH] Body completo:', JSON.stringify(req.body, null, 2));
        console.log('[SRS-PUBLISH] Headers:', req.headers);
        console.log('[SRS-PUBLISH] IP:', req.ip || req.socket.remoteAddress);
        console.log('[SRS-PUBLISH] User-Agent:', req.headers['user-agent']);
        
        const { 
            action,           // "on_publish"
            client_id,        // ID do cliente SRS
            ip,              // IP do publisher
            vhost,           // Virtual host
            app,             // Aplicação (ex: "live")
            stream,          // Stream key
            param,           // Parâmetros adicionais (contém userId, timestamp)
            tcUrl            // URL completa da conexão
        } = req.body;
        
        // Extrair parâmetros reais do stream (se vier com query string)
        let realStreamKey = stream;
        let userId = null;
        let timestamp = null;
        
        if (stream && stream.includes('?')) {
            const urlParts = stream.split('?');
            realStreamKey = urlParts[0];
            const queryString = urlParts[1];
            const params = new URLSearchParams(queryString);
            
            userId = params.get('userId');
            timestamp = params.get('timestamp');
            
            console.log('[SRS-PUBLISH] Parâmetros extraídos do stream:', {
                originalStream: stream,
                realStreamKey,
                userId,
                timestamp
            });
        }
        
        console.log('[SRS-PUBLISH] Dados processados:', {
            action,
            client_id,
            ip,
            vhost,
            app,
            stream,
            param,
            tcUrl
        });
        
        // Idempotência: ignorar callbacks duplicados
        if (client_id && isDuplicate(client_id, 'on_publish')) {
            console.log(`[SRS-PUBLISH] Callback duplicado ignorado (client_id: ${client_id})`);
            return res.json({ code: 0, msg: 'OK' });
        }
        
        // Cancelar timer de reconexão se existir (streamer voltou)
        if (realStreamKey && reconnectionTimers.has(realStreamKey)) {
            const timer = reconnectionTimers.get(realStreamKey);
            clearTimeout(timer);
            reconnectionTimers.delete(realStreamKey);
            console.log(`[SRS-PUBLISH] Reconexão detectada — stream ${realStreamKey} voltou dentro da janela`);
        }
        
        // Validar e usar os campos do SRS
        if (!action || action !== 'on_publish') {
            console.warn(`[SRS-PUBLISH] Action inválido: ${action}`);
        }
        
        if (!vhost || vhost !== '__defaultVhost__') {
            console.warn(`[SRS-PUBLISH] Virtual host inválido: ${vhost}`);
        }
        
        if (!app || app !== 'live') {
            console.warn(`[SRS-PUBLISH] Aplicação inválida: ${app}`);
        }
        
        if (!tcUrl || !tcUrl.includes('rtmp://')) {
            console.warn(`[SRS-PUBLISH] tcUrl inválido: ${tcUrl}`);
        }
        
        let responseCode = 0;
        let responseMsg = 'OK';
        
        // Validar streamKey real e atualizar status
        if (realStreamKey) {
            console.log('[SRS-PUBLISH] Validando streamKey real:', realStreamKey);
            const streamer = await Streamer.findOne({ streamKey: realStreamKey });
            
            if (streamer) {
                // Atualizar status do stream para live
                await Streamer.findOneAndUpdate(
                    { streamKey: realStreamKey },
                    { 
                        isLive: true,
                        streamStatus: 'live',
                        startTime: new Date(),
                        srsClientId: client_id,
                        srsPublishData: {
                            action,
                            client_id,
                            ip,
                            vhost,
                            app,
                            stream,
                            param,
                            tcUrl,
                            timestamp: new Date()
                        }
                    }
                );
                
                // Atualizar status do usuário + persistir atividade
                await User.findOneAndUpdate(
                    { id: streamer.hostId },
                    { 
                        isLive: true,
                        currentStreamId: streamer.id,
                        lastStreamStart: new Date(),
                        $push: { 
                            recentActivities: {
                                action: 'stream_started_srs',
                                resource: 'streaming_srs',
                                timestamp: new Date(),
                                endpoint: '/api/srs/publish'
                            }
                        }
                    }
                );
                
                console.log(`[SRS-PUBLISH] Usuário ${streamer.hostId} online - stream ${realStreamKey} iniciado`);
                
                // Notificar seguidores via Socket.IO
                const io = req.app.get('io');
                if (io) {
                    // Buscar dados do host para a notificação
                    const host = await User.findOne({ id: streamer.hostId });
                    const hostName = host?.name || streamer.hostId;
                    const hostAvatar = host?.avatarUrl || '';

                    // Notificar cada seguidor individualmente
                    const followers = await Followers.find({ followingId: streamer.hostId, isActive: true });
                    for (const follower of followers) {
                        io.to(`user_${follower.followerId}`).emit('notification', {
                            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${follower.followerId}`,
                            userId: follower.followerId,
                            type: 'user_live',
                            message: `${hostName} entrou ao vivo!`,
                            data: {
                                streamerId: streamer.hostId,
                                streamerName: hostName,
                                streamId: realStreamKey,
                                streamName: streamer.title || hostName,
                                avatarUrl: hostAvatar
                            },
                            timestamp: new Date(),
                            read: false
                        });

                        io.to(`user_${follower.followerId}`).emit('unread_notification', {
                            userId: follower.followerId,
                            count: 1,
                            timestamp: new Date()
                        });
                    }

                    // Broadcast global: stream_live (lista pública da Home)
                    io.emit('stream_live', {
                        streamId: streamer.id,
                        hostId: streamer.hostId,
                        streamKey: realStreamKey,
                        timestamp: new Date()
                    });

                    // Evento global de live_started
                    io.emit('live_started', {
                        streamerId: streamer.hostId,
                        streamerName: hostName,
                        streamKey: realStreamKey,
                        avatarUrl: hostAvatar
                    });

                    console.log(`[SRS-PUBLISH] Notificações enviadas para ${followers.length} seguidores de ${hostName}`);
                }
                
                responseCode = 0;
                responseMsg = 'OK';
            } else {
                console.warn(`[SRS-PUBLISH] StreamKey ${realStreamKey} não encontrado no banco`);
                // Stream não encontrado - bloquear publicação
                responseCode = 1;
                responseMsg = 'Stream not found';
            }
        } else {
            console.warn('[SRS-PUBLISH] Stream não fornecido no callback');
            responseCode = 1;
            responseMsg = 'Stream required';
        }
        
        // Resposta obrigatória conforme documentação SRS
        res.json({
            code: responseCode,
            msg: responseMsg
        });
        
        console.log('[SRS-PUBLISH] === FIM DO PROCESSAMENTO ===');
    } catch (error: any) {
        console.error('[SRS-PUBLISH] Erro:', error);
        // Resposta de erro conforme documentação SRS
        res.json({
            code: 1,
            msg: 'Error processing publish'
        });
    }
});

// @route POST /api/srs/unpublish
// Callback SRS quando publisher para transmissão
router.post('/unpublish', async (req, res) => {
    try {
        // Registrar TODOS os dados reais enviados pelo SRS
        console.log('[SRS-UNPUBLISH] === DADOS REAIS DO SRS ===');
        console.log('[SRS-UNPUBLISH] Body completo:', JSON.stringify(req.body, null, 2));
        console.log('[SRS-UNPUBLISH] Headers:', req.headers);
        console.log('[SRS-UNPUBLISH] IP:', req.ip || req.socket.remoteAddress);
        console.log('[SRS-UNPUBLISH] User-Agent:', req.headers['user-agent']);
        
        const { 
            action,           // "on_unpublish"
            client_id,        // ID do cliente SRS
            ip,              // IP do publisher
            vhost,           // Virtual host
            app,             // Aplicação (ex: "live")
            stream,          // Stream key
            param,           // Parâmetros adicionais
            tcUrl            // URL completa da conexão
        } = req.body;
        
        // Extrair parâmetros reais do stream (se vier com query string)
        let realStreamKey = stream;
        let userId = null;
        let timestamp = null;
        
        if (stream && stream.includes('?')) {
            const urlParts = stream.split('?');
            realStreamKey = urlParts[0];
            const queryString = urlParts[1];
            const params = new URLSearchParams(queryString);
            
            userId = params.get('userId');
            timestamp = params.get('timestamp');
            
            console.log('[SRS-UNPUBLISH] Parâmetros extraídos do stream:', {
                originalStream: stream,
                realStreamKey,
                userId,
                timestamp
            });
        }
        
        console.log('[SRS-UNPUBLISH] Dados processados:', {
            action,
            client_id,
            ip,
            vhost,
            app,
            stream,
            param,
            tcUrl
        });
        
        // Idempotência: ignorar callbacks duplicados
        if (client_id && isDuplicate(client_id, 'on_unpublish')) {
            console.log(`[SRS-UNPUBLISH] Callback duplicado ignorado (client_id: ${client_id})`);
            return res.json({ code: 0, msg: 'OK' });
        }
        
        // Validar e usar os campos do SRS
        if (!action || action !== 'on_unpublish') {
            console.warn(`[SRS-UNPUBLISH] Action inválido: ${action}`);
        }
        
        if (!vhost || vhost !== '__defaultVhost__') {
            console.warn(`[SRS-UNPUBLISH] Virtual host inválido: ${vhost}`);
        }
        
        if (!app || app !== 'live') {
            console.warn(`[SRS-UNPUBLISH] Aplicação inválida: ${app}`);
        }
        
        // Atualizar status do stream usando a streamKey real
        if (realStreamKey) {
            console.log('[SRS-UNPUBLISH] Validando streamKey real:', realStreamKey);
            const streamer = await Streamer.findOne({ streamKey: realStreamKey });
            
            if (streamer) {
                // Verificar se o streamer está em PK ativa — entrar em janela de reconexão
                const activeBattle = await Battle.findOne({
                    $or: [
                        { streamerA: streamer.hostId },
                        { streamerB: streamer.hostId }
                    ],
                    status: 'active'
                });

                if (activeBattle) {
                    console.log(`[SRS-UNPUBLISH] Streamer ${streamer.hostId} está em PK — iniciando janela de reconexão de ${RECONNECT_WINDOW_MS}ms`);
                    
                    // Se já existe um timer, não criar outro
                    if (!reconnectionTimers.has(realStreamKey)) {
                        const timer = setTimeout(async () => {
                            console.log(`[SRS-UNPUBLISH] Janela de reconexão expirou para ${realStreamKey} — encerrando PK`);

                            // Marcar stream como offline no banco
                            await Streamer.findOneAndUpdate(
                                { streamKey: realStreamKey },
                                { isLive: false, streamStatus: 'ended', endTime: new Date() }
                            );
                            await User.findOneAndUpdate(
                                { id: streamer.hostId },
                                { isLive: false, currentStreamId: null, lastStreamEnd: new Date(),
                                  $push: { recentActivities: { action: 'stream_ended_srs', resource: 'streaming_srs', timestamp: new Date(), endpoint: '/api/srs/unpublish' } } }
                            ).catch(() => {});

                            // Encerrar PK
                            await Battle.findOneAndUpdate({ _id: activeBattle._id }, { status: 'finished', endedAt: new Date() });
                            
                            const io = req.app.get('io');
                            if (io) {
                                io.emit('pk_battle_end', {
                                    battleId: activeBattle._id.toString(),
                                    winner: null,
                                    reason: 'streamer_disconnected'
                                });
                                io.emit('stream_ended', { streamId: streamer.id, hostId: streamer.hostId });
                            }
                            
                            reconnectionTimers.delete(realStreamKey);
                        }, RECONNECT_WINDOW_MS);
                        
                        reconnectionTimers.set(realStreamKey, timer);
                    }
                    
                    // Não marcar como offline ainda — aguardar reconexão
                    return res.json({ code: 0, msg: 'Reconnection window' });
                }
            }
            
            await Streamer.findOneAndUpdate(
                { streamKey: realStreamKey },
                { 
                    isLive: false,
                    streamStatus: 'ended',
                    endTime: new Date(),
                    srsClientId: client_id,
                    srsUnpublishData: {
                        action,
                        client_id,
                        ip,
                        vhost,
                        app,
                        stream,
                        param,
                        tcUrl,
                        timestamp: new Date()
                    }
                }
            );
            
            // Atualizar status do usuário + persistir atividade
            if (streamer) {
                await User.findOneAndUpdate(
                    { id: streamer.hostId },
                    { 
                        isLive: false,
                        currentStreamId: null,
                        lastStreamEnd: new Date(),
                        $push: { 
                            recentActivities: {
                                action: 'stream_ended_srs',
                                resource: 'streaming_srs',
                                timestamp: new Date(),
                                endpoint: '/api/srs/unpublish'
                            }
                        }
                    }
                );
                
                // Broadcast WebSocket: notificar viewers que a stream encerrou
                const io = req.app.get('io');
                if (io) {
                    io.to(streamer.id).emit('stream_ended', {
                        streamId: streamer.id,
                        hostId: streamer.hostId,
                        timestamp: new Date()
                    });
                    io.emit('stream_ended', {
                        streamId: streamer.id,
                        hostId: streamer.hostId
                    });
                }
                
                console.log(`[SRS-UNPUBLISH] Usuário ${streamer.hostId} offline - stream ${realStreamKey} encerrado`);
            }
        }
        
        // Resposta obrigatória conforme documentação SRS
        res.json({
            code: 0,
            msg: 'OK'
        });
        
        console.log('[SRS-UNPUBLISH] === FIM DO PROCESSAMENTO ===');
    } catch (error: any) {
        console.error('[SRS-UNPUBLISH] Erro:', error);
        // Resposta de erro conforme documentação SRS
        res.json({
            code: 1,
            msg: 'Error processing unpublish'
        });
    }
});

// @route POST /api/srs/play
// Callback SRS quando viewer inicia reprodução
router.post('/play', async (req, res) => {
    try {
        console.log('[SRS-PLAY] === CALLBACK DO SRS ===');
        console.log('[SRS-PLAY] Body:', JSON.stringify(req.body, null, 2));
        
        const { 
            action,           // "on_play"
            client_id,        // ID do cliente SRS
            ip,              // IP do viewer
            vhost,           // Virtual host
            app,             // Aplicação (ex: "live")
            stream,          // Stream key
            param,           // Parâmetros adicionais
            tcUrl,           // URL completa da conexão
            pageUrl          // URL da página do viewer (opcional)
        } = req.body;
        
        console.log('[SRS-PLAY] Viewer conectado:', {
            client_id,
            ip,
            vhost,
            app,
            stream,
            param,
            tcUrl,
            pageUrl
        });
        
        // Validar e usar os campos do SRS
        if (!action || action !== 'on_play') {
            console.warn(`[SRS-PLAY] Action inválido: ${action}`);
        }
        
        if (!vhost || vhost !== '__defaultVhost__') {
            console.warn(`[SRS-PLAY] Virtual host inválido: ${vhost}`);
        }
        
        if (!app || app !== 'live') {
            console.warn(`[SRS-PLAY] Aplicação inválida: ${app}`);
        }
        
        // Tentar identificar usuário pelo stream e persistir atividade de viewer
        if (stream) {
            const streamer = await Streamer.findOne({ streamKey: stream });
            if (streamer) {
                // Persistir atividade de viewer para o streamer (não para o viewer anônimo)
                await User.findOneAndUpdate(
                    { id: streamer.hostId },
                    { 
                        $push: { 
                            recentActivities: {
                                action: 'stream_viewer_connected',
                                resource: 'streaming_srs',
                                timestamp: new Date(),
                                endpoint: '/api/srs/play'
                            }
                        }
                    }
                ).catch(console.error);
            }
        }

        // Sempre permitir reprodução por padrão
        res.json({
            code: 0,
            msg: 'OK'
        });
        
    } catch (error: any) {
        console.error('[SRS-PLAY] Erro:', error);
        res.json({
            code: 1,
            msg: 'Error processing play'
        });
    }
});

// @route POST /api/srs/stop
// Callback SRS quando viewer para reprodução
router.post('/stop', async (req, res) => {
    try {
        console.log('[SRS-STOP] === CALLBACK DO SRS ===');
        console.log('[SRS-STOP] Body:', JSON.stringify(req.body, null, 2));
        
        const { 
            action,           // "on_stop"
            client_id,        // ID do cliente SRS
            ip,              // IP do viewer
            vhost,           // Virtual host
            app,             // Aplicação (ex: "live")
            stream,          // Stream key
            param            // Parâmetros adicionais
        } = req.body;
        
        console.log('[SRS-STOP] Viewer desconectado:', {
            client_id,
            ip,
            vhost,
            app,
            stream,
            param
        });
        
        // Validar e usar os campos do SRS
        if (!action || action !== 'on_stop') {
            console.warn(`[SRS-STOP] Action inválido: ${action}`);
        }
        
        if (!vhost || vhost !== '__defaultVhost__') {
            console.warn(`[SRS-STOP] Virtual host inválido: ${vhost}`);
        }
        
        if (!app || app !== 'live') {
            console.warn(`[SRS-STOP] Aplicação inválida: ${app}`);
        }
        
        // Tentar identificar usuário pelo stream e persistir atividade de viewer desconectado
        if (stream) {
            const streamer = await Streamer.findOne({ streamKey: stream });
            if (streamer) {
                // Persistir atividade de viewer desconectado para o streamer
                await User.findOneAndUpdate(
                    { id: streamer.hostId },
                    { 
                        $push: { 
                            recentActivities: {
                                action: 'stream_viewer_disconnected',
                                resource: 'streaming_srs',
                                timestamp: new Date(),
                                endpoint: '/api/srs/stop'
                            }
                        }
                    }
                ).catch(console.error);
            }
        }

        // Sempre permitir stop por padrão
        res.json({
            code: 0,
            msg: 'OK'
        });
        
    } catch (error: any) {
        console.error('[SRS-STOP] Erro:', error);
        res.json({
            code: 1,
            msg: 'Error processing stop'
        });
    }
});

// @route POST /api/srs/hls
// Callback SRS quando segmento HLS é criado
router.post('/hls', async (req, res) => {
    try {
        console.log('[SRS-HLS] === CALLBACK DO SRS ===');
        console.log('[SRS-HLS] Body:', JSON.stringify(req.body, null, 2));
        
        const { 
            action,           // "on_hls"
            client_id,        // ID do cliente SRS
            ip,              // IP do cliente
            vhost,           // Virtual host
            app,             // Aplicação (ex: "live")
            stream,          // Stream key
            param,           // Parâmetros adicionais
            duration,        // Duração do segmento
            cwd,             // Diretório de trabalho
            file,            // Arquivo do segmento
            url,             // URL do segmento
            m3u8,            // Caminho do arquivo m3u8
            m3u8_url,        // URL do arquivo m3u8
            seq_no           // Número do sequência
        } = req.body;
        
        console.log('[SRS-HLS] Segmento HLS criado:', {
            action,
            client_id,
            stream,
            duration,
            file,
            url,
            m3u8,
            m3u8_url,
            seq_no,
            app,
            vhost,
            ip
        });
        
        // Validar e usar os campos do SRS
        if (!action || action !== 'on_hls') {
            console.warn(`[SRS-HLS] Action inválido: ${action}`);
        }
        
        // Validar aplicação esperada
        if (app && app !== 'live') {
            console.warn(`[SRS-HLS] Aplicação inesperada: ${app} (esperado: 'live')`);
        }
        
        // Validar stream key
        if (!stream) {
            console.warn('[SRS-HLS] Stream key ausente');
        }
        
        // HLS gera muitos callbacks, então não processamos pesado aqui
        // Apenas logamos para debugging, persistimos atividade e retornamos sucesso
        
        // Tentar identificar usuário pelo stream e persistir atividade de processamento HLS
        if (stream) {
            const streamer = await Streamer.findOne({ streamKey: stream });
            if (streamer) {
                // Persistir atividade de processamento HLS para o streamer
                await User.findOneAndUpdate(
                    { id: streamer.hostId },
                    { 
                        $push: { 
                            recentActivities: {
                                action: 'stream_hls_processed',
                                resource: 'streaming_srs',
                                timestamp: new Date(),
                                endpoint: '/api/srs/hls'
                            }
                        }
                    }
                ).catch(console.error);
            }
        }
        
        // Resposta obrigatória conforme documentação SRS
        res.json({
            code: 0,
            msg: 'OK'
        });
        
    } catch (error: any) {
        console.error('[SRS-HLS] Erro:', error);
        // Resposta de erro conforme documentação SRS
        res.json({
            code: 1,
            msg: 'Error processing hls'
        });
    }
});

// @route POST /api/srs/connect
// Callback SRS quando cliente conecta
router.post('/connect', async (req, res) => {
    try {
        console.log('[SRS-CONNECT] === CALLBACK DO SRS ===');
        console.log('[SRS-CONNECT] Body:', JSON.stringify(req.body, null, 2));
        
        const { 
            action,           // "on_connect"
            client_id,        // ID do cliente SRS
            ip,              // IP do cliente
            vhost,           // Virtual host
            app,             // Aplicação (ex: "live")
            stream,          // Stream (opcional)
            param,           // Parâmetros adicionais
            tcUrl,           // URL completa da conexão
            pageUrl          // URL da página (opcional)
        } = req.body;
        
        console.log('[SRS-CONNECT] Cliente conectado:', {
            action,
            client_id,
            ip,
            vhost,
            app,
            stream,
            param,
            tcUrl,
            pageUrl
        });
        
        // Validar e usar os campos do SRS
        if (!action || action !== 'on_connect') {
            console.warn(`[SRS-CONNECT] Action inválido: ${action}`);
        }
        
        if (!vhost || vhost !== '__defaultVhost__') {
            console.warn(`[SRS-CONNECT] Virtual host inválido: ${vhost}`);
        }
        
        if (!app || app !== 'live') {
            console.warn(`[SRS-CONNECT] Aplicação inválida: ${app}`);
        }
        
        // Sempre permitir conexão por padrão
        res.json({
            code: 0,
            msg: 'OK'
        });
        
    } catch (error: any) {
        console.error('[SRS-CONNECT] Erro:', error);
        res.json({
            code: 1,
            msg: 'Error processing connect'
        });
    }
});

// @route POST /api/srs/close
// Callback SRS quando cliente desconecta
router.post('/close', async (req, res) => {
    try {
        console.log('[SRS-CLOSE] === CALLBACK DO SRS ===');
        console.log('[SRS-CLOSE] Body:', JSON.stringify(req.body, null, 2));
        
        const { 
            action,           // "on_close"
            client_id,        // ID do cliente SRS
            ip,              // IP do cliente
            vhost,           // Virtual host
            app,             // Aplicação (ex: "live")
            stream,          // Stream (opcional)
            param,           // Parâmetros adicionais
            tcUrl            // URL completa da conexão
        } = req.body;
        
        console.log('[SRS-CLOSE] Cliente desconectado:', {
            action,
            client_id,
            ip,
            vhost,
            app,
            stream,
            param,
            tcUrl
        });
        
        // Validar e usar os campos do SRS
        if (!action || action !== 'on_close') {
            console.warn(`[SRS-CLOSE] Action inválido: ${action}`);
        }
        
        if (!vhost || vhost !== '__defaultVhost__') {
            console.warn(`[SRS-CLOSE] Virtual host inválido: ${vhost}`);
        }
        
        // Validar tcUrl para conexões RTMP
        if (tcUrl && !tcUrl.includes('rtmp://')) {
            console.warn(`[SRS-CLOSE] tcUrl não é RTMP: ${tcUrl}`);
        }
        
        // Validar client_id para rastreamento
        if (!client_id) {
            console.warn('[SRS-CLOSE] client_id ausente');
        }
        
        // Log adicional para stream específico
        if (stream) {
            console.log(`[SRS-CLOSE] Stream encerrada: ${stream}`);
        }
        
        // Sempre permitir close por padrão
        res.json({
            code: 0,
            msg: 'OK'
        });
        
    } catch (error: any) {
        console.error('[SRS-CLOSE] Erro:', error);
        res.json({
            code: 1,
            msg: 'Error processing close'
        });
    }
});

export default router;
