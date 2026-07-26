"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const livekit_server_sdk_1 = require("livekit-server-sdk");
const env_1 = require("../config/env");
const LiveKitTokenService_1 = require("../services/LiveKitTokenService");
const auth_1 = require("../middleware/auth");
const models_1 = require("../models");
const LiveKitEgressService_1 = require("../services/LiveKitEgressService");
const router = express_1.default.Router();
// GET /api/livekit/token - Gerar token de acesso
router.get('/token', async (req, res) => {
    const identity = req.query.identity || `user_${Date.now()}`;
    const room = req.query.room || `room_${Date.now()}`;
    const metadata = req.query.metadata;
    try {
        const token = await (0, LiveKitTokenService_1.generateLiveKitToken)(identity, room, metadata);
        res.json({
            success: true,
            token,
            identity,
            room,
            livekitUrl: env_1.ENV.LIVEKIT_URL,
        });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao gerar token:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/livekit/token - Gerar token via POST
router.post('/token', async (req, res) => {
    const { identity, room, metadata } = req.body;
    if (!identity || !room) {
        return res.status(400).json({ error: 'identity and room are required' });
    }
    try {
        const token = await (0, LiveKitTokenService_1.generateLiveKitToken)(identity, room, metadata);
        res.json({
            success: true,
            token,
            identity,
            room,
            livekitUrl: env_1.ENV.LIVEKIT_URL,
        });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao gerar token:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/livekit/rooms - Criar sala no LiveKit (APENAS API OFICIAL)
router.post('/rooms', async (req, res) => {
    const { name, emptyTimeout = 300, maxParticipants = 50 } = req.body;
    if (!name)
        return res.status(400).json({ error: 'Room name required' });
    try {
        await LiveKitTokenService_1.roomService.createRoom({
            name,
            emptyTimeout,
            maxParticipants,
        });
        console.log(`[LIVEKIT] Sala criada no LiveKit: ${name}`);
        res.json({
            success: true,
            room: { name, emptyTimeout, maxParticipants, createdAt: new Date() },
        });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao criar sala no LiveKit:', error.message);
        res.status(502).json({ success: false, error: `Falha ao criar sala no LiveKit: ${error.message}` });
    }
});
// POST /api/livekit/rooms/:roomName/join - Entrar na sala LiveKit (APENAS API OFICIAL)
router.post('/rooms/:roomName/join', async (req, res) => {
    const { roomName } = req.params;
    const { identity, name, role = 'participant' } = req.body;
    if (!identity)
        return res.status(400).json({ error: 'Identity required' });
    try {
        // Verificar se a sala existe no LiveKit
        const rooms = await LiveKitTokenService_1.roomService.listRooms();
        const roomExists = rooms.some(r => r.name === roomName);
        if (!roomExists) {
            return res.status(404).json({ error: 'Room not found on LiveKit server' });
        }
        // Gerar token LiveKit para este participante
        const token = await (0, LiveKitTokenService_1.generateLiveKitToken)(identity, roomName, JSON.stringify({ name, role }));
        // Obter participantes atuais da sala real
        let participantCount = 0;
        try {
            const participants = await LiveKitTokenService_1.roomService.listParticipants(roomName);
            participantCount = participants.length;
        }
        catch (_) { }
        console.log(`[LIVEKIT] Participante ${identity} entrou na sala ${roomName} (LiveKit oficial)`);
        res.json({
            success: true,
            room: { name: roomName, participantCount },
            participant: { identity, name: name || identity, role },
            token,
            livekitUrl: env_1.ENV.LIVEKIT_URL,
        });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao processar join na sala LiveKit:', error.message);
        res.status(502).json({ success: false, error: `Falha ao entrar na sala LiveKit: ${error.message}` });
    }
});
// GET /api/livekit/rooms - Listar salas (APENAS API OFICIAL, SEM FALLBACK)
router.get('/rooms', async (req, res) => {
    try {
        const liveRooms = await LiveKitTokenService_1.roomService.listRooms();
        const roomList = liveRooms.map(r => ({
            name: r.name,
            emptyTimeout: r.emptyTimeout,
            maxParticipants: r.maxParticipants,
            createdAt: new Date(Number(r.creationTimeMs ?? r.creationTime)),
            participantCount: r.numParticipants || 0,
        }));
        res.json({ success: true, rooms: roomList });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao listar salas do LiveKit:', error.message);
        res.status(502).json({ success: false, error: `Falha ao listar salas do LiveKit: ${error.message}` });
    }
});
// DELETE /api/livekit/rooms/:roomName - Deletar sala (APENAS API OFICIAL, SEM FALLBACK)
router.delete('/rooms/:roomName', async (req, res) => {
    const { roomName } = req.params;
    try {
        await LiveKitTokenService_1.roomService.deleteRoom(roomName);
        console.log(`[LIVEKIT] Sala ${roomName} deletada do LiveKit`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao deletar sala do LiveKit:', error.message);
        res.status(502).json({ success: false, error: `Falha ao deletar sala do LiveKit: ${error.message}` });
    }
});
// GET /api/livekit/rooms/:roomName/participants - Listar participantes (APENAS API OFICIAL, SEM FALLBACK)
router.get('/rooms/:roomName/participants', async (req, res) => {
    const { roomName } = req.params;
    try {
        const participants = await LiveKitTokenService_1.roomService.listParticipants(roomName);
        const list = participants.map(p => ({
            identity: p.identity,
            name: p.name,
            joinedAt: p.joinedAt,
            metadata: p.metadata,
            trackCount: p.tracks?.length || 0,
            tracks: p.tracks?.map(t => ({
                sid: t.sid,
                source: t.source,
                muted: t.muted,
                type: t.type,
            })) || [],
        }));
        res.json({ success: true, participants: list });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao listar participantes do LiveKit:', error.message);
        res.status(502).json({ success: false, error: `Falha ao listar participantes do LiveKit: ${error.message}` });
    }
});
// GET /api/livekit/rooms/:roomName/participants/:identity - Buscar participante (APENAS API OFICIAL, SEM FALLBACK)
router.get('/rooms/:roomName/participants/:identity', async (req, res) => {
    const { roomName, identity } = req.params;
    try {
        const participants = await LiveKitTokenService_1.roomService.listParticipants(roomName);
        const participant = participants.find(p => p.identity === identity);
        if (!participant) {
            return res.status(404).json({ error: 'Participant not found on LiveKit server' });
        }
        res.json({
            success: true,
            participant: {
                identity: participant.identity,
                name: participant.name,
                joinedAt: participant.joinedAt,
                metadata: participant.metadata,
                tracks: participant.tracks?.map(t => ({
                    sid: t.sid,
                    source: t.source,
                    muted: t.muted,
                    type: t.type,
                })) || [],
            },
        });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao buscar participante no LiveKit:', error.message);
        res.status(502).json({ success: false, error: `Falha ao buscar participante no LiveKit: ${error.message}` });
    }
});
// POST /api/livekit/rooms/:roomName/participants/:identity/kick - Remover participante (APENAS API OFICIAL, SEM FALLBACK)
router.post('/rooms/:roomName/participants/:identity/kick', async (req, res) => {
    const { roomName, identity } = req.params;
    try {
        await LiveKitTokenService_1.roomService.removeParticipant(roomName, identity);
        console.log(`[LIVEKIT] Participante ${identity} removido da sala ${roomName} (LiveKit oficial)`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao remover participante do LiveKit:', error.message);
        res.status(502).json({ success: false, error: `Falha ao remover participante do LiveKit: ${error.message}` });
    }
});
// POST /api/livekit/rooms/:roomName/participants/:identity/tracks/:trackSid/mute - Mutar track (APENAS API OFICIAL, SEM FALLBACK)
router.post('/rooms/:roomName/participants/:identity/tracks/:trackSid/mute', async (req, res) => {
    const { roomName, identity, trackSid } = req.params;
    const { muted } = req.body;
    try {
        await LiveKitTokenService_1.roomService.mutePublishedTrack(roomName, identity, trackSid, muted);
        console.log(`[LIVEKIT] Track ${trackSid} ${muted ? 'mutada' : 'desmutada'} para ${identity} (LiveKit oficial)`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao mutar track no LiveKit:', error.message);
        res.status(502).json({ success: false, error: `Falha ao mutar track no LiveKit: ${error.message}` });
    }
});
// ========================================
// LiveKit PK — Salas para Batalhas PK
// ========================================
/**
 * POST /api/livekit/pk/join
 *
 * Cria ou entra em uma sala LiveKit para PK Battle.
 * - Autentica o usuário via JWT
 * - Valida se a batalha existe e está ativa
 * - Cria sala no LiveKit se não existir
 * - Gera token JWT de acesso
 */
router.post('/pk/join', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { battleId, name, canPublish = false } = req.body;
        if (!battleId) {
            return res.status(400).json({ error: 'battleId is required' });
        }
        // Validar se a batalha existe e está ativa
        const battle = await models_1.Battle.findById(battleId).lean();
        if (!battle) {
            return res.status(404).json({ error: 'Battle not found' });
        }
        if (battle.status === 'finished') {
            return res.status(400).json({ error: 'Battle already ended' });
        }
        const roomName = `pk_${battleId}`;
        // Verificar se a sala já existe (usando getRoom ao invés de listRooms)
        if (!(await (0, LiveKitTokenService_1.roomExists)(roomName))) {
            await LiveKitTokenService_1.roomService.createRoom({
                name: roomName,
                emptyTimeout: 600,
                maxParticipants: 10,
            });
            console.log(`[LIVEKIT-PK] Sala criada: ${roomName} (batalha ${battleId})`);
        }
        // Gerar token reutilizando o helper
        const token = await (0, LiveKitTokenService_1.generateLiveKitToken)(userId, roomName, JSON.stringify({ name, type: 'pk', battleId }), { canPublish });
        console.log(`[LIVEKIT-PK] Token gerado para ${userId} na sala ${roomName} (publish: ${canPublish})`);
        res.json({
            success: true,
            token,
            identity: userId,
            room: roomName,
            battleId,
            livekitUrl: env_1.ENV.LIVEKIT_URL,
            serverUrl: env_1.ENV.LIVEKIT_SERVER_URL,
        });
    }
    catch (error) {
        console.error('[LIVEKIT-PK] Erro:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/livekit/pk/end
 *
 * Encerra uma sala PK no LiveKit (ignora se não existir).
 */
router.post('/pk/end', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { battleId } = req.body;
        if (!battleId) {
            return res.status(400).json({ error: 'battleId is required' });
        }
        const roomName = `pk_${battleId}`;
        if (await (0, LiveKitTokenService_1.roomExists)(roomName)) {
            await LiveKitTokenService_1.roomService.deleteRoom(roomName);
            console.log(`[LIVEKIT-PK] Sala ${roomName} encerrada por ${userId}`);
        }
        else {
            console.log(`[LIVEKIT-PK] Sala ${roomName} já não existe`);
        }
        res.json({ success: true, message: `PK room ${roomName} deleted` });
    }
    catch (error) {
        console.error('[LIVEKIT-PK] Erro ao encerrar sala:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ========================================
// LiveKit Call — Chamadas de Vídeo
// ========================================
/**
 * POST /api/livekit/call/init
 *
 * Inicializa uma chamada de vídeo via LiveKit (HOST).
 * - Autentica o usuário via JWT
 * - Valida se o convite existe e está pending
 * - Cria sala no LiveKit
 * - Gera token com permissão de publish para o host
 */
router.post('/call/init', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { invitationId, name } = req.body;
        if (!invitationId) {
            return res.status(400).json({ error: 'invitationId is required' });
        }
        // Validar se o convite existe e está pendente
        const invitation = await models_1.CallInvitation.findById(invitationId).lean();
        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }
        if (invitation.hostId !== userId) {
            return res.status(403).json({ error: 'Only the host can init the call' });
        }
        if (invitation.status !== 'pending' && invitation.status !== 'accepted') {
            return res.status(400).json({ error: `Invitation is ${invitation.status}, cannot init call` });
        }
        const roomName = `call_${invitationId}`;
        if (!(await (0, LiveKitTokenService_1.roomExists)(roomName))) {
            await LiveKitTokenService_1.roomService.createRoom({
                name: roomName,
                emptyTimeout: 600,
                maxParticipants: 10,
            });
            console.log(`[LIVEKIT-CALL] Sala criada: ${roomName} (convite ${invitationId})`);
        }
        // HOST pode publicar áudio/vídeo
        const token = await (0, LiveKitTokenService_1.generateLiveKitToken)(userId, roomName, JSON.stringify({ name, type: 'call', invitationId, role: 'host' }), { canPublish: true });
        console.log(`[LIVEKIT-CALL] Sala ${roomName} inicializada por ${userId} (host)`);
        res.json({
            success: true,
            token,
            identity: userId,
            room: roomName,
            invitationId,
            role: 'host',
            livekitUrl: env_1.ENV.LIVEKIT_URL,
            serverUrl: env_1.ENV.LIVEKIT_SERVER_URL,
        });
    }
    catch (error) {
        console.error('[LIVEKIT-CALL] Erro ao iniciar chamada:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/livekit/call/join
 *
 * Entra em uma chamada de vídeo existente via LiveKit (GUEST).
 * - Autentica o usuário via JWT
 * - Verifica se o convite existe e está accepted
 * - Verifica se a sala LiveKit existe
 * - Gera token com permissão de publish para o guest
 */
router.post('/call/join', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { invitationId, name } = req.body;
        if (!invitationId) {
            return res.status(400).json({ error: 'invitationId is required' });
        }
        // Validar se o convite existe
        const invitation = await models_1.CallInvitation.findById(invitationId).lean();
        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }
        if (invitation.guestId !== userId) {
            return res.status(403).json({ error: 'This invitation is not for you' });
        }
        if (invitation.status !== 'accepted') {
            return res.status(400).json({ error: 'Invitation has not been accepted yet. Call /api/call-invitation/respond first.' });
        }
        const roomName = `call_${invitationId}`;
        if (!(await (0, LiveKitTokenService_1.roomExists)(roomName))) {
            return res.status(404).json({
                success: false,
                error: 'Call room not found. The host may not have started the call yet.',
            });
        }
        // GUEST pode publicar áudio/vídeo também
        const token = await (0, LiveKitTokenService_1.generateLiveKitToken)(userId, roomName, JSON.stringify({ name, type: 'call', invitationId, role: 'guest' }), { canPublish: true });
        // Buscar participantes atuais
        let participantCount = 0;
        try {
            const participants = await LiveKitTokenService_1.roomService.listParticipants(roomName);
            participantCount = participants.length;
        }
        catch (_) { }
        console.log(`[LIVEKIT-CALL] Guest ${userId} entrou na sala ${roomName}`);
        res.json({
            success: true,
            token,
            identity: userId,
            room: roomName,
            invitationId,
            role: 'guest',
            participantCount,
            livekitUrl: env_1.ENV.LIVEKIT_URL,
            serverUrl: env_1.ENV.LIVEKIT_SERVER_URL,
        });
    }
    catch (error) {
        console.error('[LIVEKIT-CALL] Erro ao entrar na chamada:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/livekit/call/end
 *
 * Encerra uma sala de chamada de vídeo no LiveKit.
 */
router.post('/call/end', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { invitationId } = req.body;
        if (!invitationId) {
            return res.status(400).json({ error: 'invitationId is required' });
        }
        const roomName = `call_${invitationId}`;
        if (await (0, LiveKitTokenService_1.roomExists)(roomName)) {
            await LiveKitTokenService_1.roomService.deleteRoom(roomName);
            console.log(`[LIVEKIT-CALL] Sala ${roomName} encerrada por ${userId}`);
        }
        else {
            console.log(`[LIVEKIT-CALL] Sala ${roomName} já não existe`);
        }
        res.json({ success: true, message: `Call room ${roomName} deleted` });
    }
    catch (error) {
        console.error('[LIVEKIT-CALL] Erro ao encerrar sala:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ========================================
// LiveKit Webhook — Eventos assíncronos do LiveKit Server
// ========================================
const webhookReceiver = new livekit_server_sdk_1.WebhookReceiver(env_1.ENV.LIVEKIT_API_KEY, env_1.ENV.LIVEKIT_API_SECRET);
/**
 * POST /api/livekit/webhook
 *
 * Recebe eventos do LiveKit Server (room_finished, participant_joined, etc.)
 * e sincroniza com o banco de dados.
 *
 * Headers esperados:
 *   Authorization: <JWT assinado com a API Secret>
 *   Content-Type: application/webhook+json
 */
router.post('/webhook', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.warn('[LIVEKIT-WEBHOOK] ❌ Authorization header ausente');
            return res.status(401).json({ error: 'Missing Authorization header' });
        }
        // Validar assinatura do webhook usando WebhookReceiver
        let event;
        try {
            const rawBody = req.rawBody || JSON.stringify(req.body);
            event = await webhookReceiver.receive(rawBody, authHeader);
        }
        catch (err) {
            console.warn('[LIVEKIT-WEBHOOK] ❌ Assinatura inválida:', err.message);
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }
        const eventType = event.event;
        const roomName = event.room?.name;
        const roomSid = event.room?.sid;
        const participant = event.participant;
        console.log(`[LIVEKIT-WEBHOOK] 📨 Evento recebido: ${eventType} | sala: ${roomName || 'N/A'}`);
        // Helper: extrair o ID real da stream removendo o prefixo da sala LiveKit
        const extractStreamId = (lkRoomName) => {
            if (lkRoomName.startsWith('live_'))
                return lkRoomName.slice(5);
            if (lkRoomName.startsWith('pk_'))
                return lkRoomName.slice(3);
            if (lkRoomName.startsWith('call_'))
                return lkRoomName.slice(5);
            return lkRoomName;
        };
        // Helper: persistir log do evento no MongoDB (fire-and-forget — não bloqueia)
        const persistLog = (success, errorMsg) => {
            models_1.LiveKitWebhookLog.create({
                event: eventType,
                roomName: roomName || undefined,
                roomSid: roomSid || undefined,
                participantIdentity: participant?.identity || undefined,
                participantName: participant?.name || undefined,
                success,
                error: errorMsg,
                rawEvent: {
                    event: eventType,
                    room: event.room ? { sid: event.room.sid, name: event.room.name } : undefined,
                    participant: participant ? { identity: participant.identity, name: participant.name } : undefined,
                    id: event.id,
                    createdAt: event.createdAt,
                },
                processedAt: new Date(),
            }).catch((logErr) => console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao persistir log:', logErr.message));
        };
        // ─── room_finished ────────────────────────────────────────────────────
        if (eventType === 'room_finished') {
            if (!roomName) {
                console.warn('[LIVEKIT-WEBHOOK] room_finished sem room.name');
                persistLog(true);
                return res.status(200).json({ received: true });
            }
            // Sala PK: pk_<battleId>
            if (roomName.startsWith('pk_')) {
                const battleId = roomName.slice(3);
                console.log(`[LIVEKIT-WEBHOOK] 🏆 PK Battle finalizada: ${battleId} (sala ${roomName})`);
                try {
                    const updated = await models_1.Battle.findOneAndUpdate({ _id: battleId, status: { $ne: 'finished' } }, { $set: { status: 'finished', endedAt: new Date() } }, { returnDocument: 'after' });
                    if (updated) {
                        console.log(`[LIVEKIT-WEBHOOK] ✅ PK Battle ${battleId} marcada como finished`);
                        // Notificar via WebSocket
                        const io = req.app.get('io');
                        if (io) {
                            io.to(`battle_${battleId}`).emit('pk_battle_ended', {
                                battleId,
                                winner: updated.winner,
                                heartsA: updated.heartsA,
                                heartsB: updated.heartsB,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                    else {
                        console.log(`[LIVEKIT-WEBHOOK] ℹ️ PK Battle ${battleId} já estava finalizada ou não encontrada`);
                    }
                    persistLog(true);
                }
                catch (dbErr) {
                    console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao atualizar Battle:', dbErr.message);
                    persistLog(false, dbErr.message);
                }
            }
            // Sala Call: call_<invitationId>
            if (roomName.startsWith('call_')) {
                const invitationId = roomName.slice(5);
                console.log(`[LIVEKIT-WEBHOOK] 📞 Chamada finalizada: ${invitationId} (sala ${roomName})`);
                try {
                    await models_1.CallInvitation.findOneAndUpdate({ id: invitationId, status: { $ne: 'ended' } }, { $set: { status: 'ended', updatedAt: new Date() } });
                    console.log(`[LIVEKIT-WEBHOOK] ✅ CallInvitation ${invitationId} marcada como ended`);
                    // Notificar via WebSocket
                    const io = req.app.get('io');
                    if (io) {
                        io.emit('call_ended', {
                            invitationId,
                            timestamp: new Date().toISOString()
                        });
                    }
                    persistLog(true);
                }
                catch (dbErr) {
                    console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao atualizar CallInvitation:', dbErr.message);
                    persistLog(false, dbErr.message);
                }
            }
            // Sala Live: live_<streamId>
            if (roomName.startsWith('live_')) {
                const streamId = roomName.slice(5);
                console.log(`[LIVEKIT-WEBHOOK] 📡 Live finalizada: ${streamId} (sala ${roomName})`);
                try {
                    const result = await models_1.StreamParticipant.deleteMany({ streamId: roomName });
                    console.log(`[LIVEKIT-WEBHOOK] ✅ ${result.deletedCount} participante(s) removido(s) da sala ${roomName}`);
                    persistLog(true);
                }
                catch (dbErr) {
                    console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao limpar participantes da live:', dbErr.message);
                    persistLog(false, dbErr.message);
                }
            }
            // Room finished sem prefixo conhecido — loga sucesso mesmo assim
            if (!roomName.startsWith('pk_') && !roomName.startsWith('call_') && !roomName.startsWith('live_')) {
                persistLog(true);
            }
            return res.status(200).json({ received: true });
        }
        // ─── participant_joined ───────────────────────────────────────────────
        if (eventType === 'participant_joined') {
            if (roomName && participant?.identity) {
                const participantIdentity = participant.identity;
                console.log(`[LIVEKIT-WEBHOOK] 👤 Participante entrou: ${participantIdentity} na sala ${roomName}`);
                try {
                    const cleanStreamId = extractStreamId(roomName);
                    const participantRole = roomName.startsWith('pk_')
                        ? 'pk_participant'
                        : roomName.startsWith('live_')
                            ? 'live_viewer'
                            : 'call_participant';
                    await models_1.StreamParticipant.findOneAndUpdate({ streamId: roomName, userId: participantIdentity }, {
                        $set: {
                            streamId: roomName,
                            cleanStreamId,
                            userId: participantIdentity,
                            userName: participant.name || participantIdentity,
                            role: participantRole,
                            joinedAt: new Date(),
                        }
                    }, { upsert: true });
                    console.log(`[LIVEKIT-WEBHOOK] ✅ Participante ${participantIdentity} registrado na sala ${roomName}`);
                    // Notificar via WebSocket
                    const io = req.app.get('io');
                    if (io) {
                        const participantPayload = {
                            room: roomName,
                            identity: participantIdentity,
                            name: participant.name || participantIdentity,
                            timestamp: new Date().toISOString()
                        };
                        // Emitir para sala com prefixo live_ (roomName = live_<streamId>)
                        io.to(roomName).emit('livekit_participant_joined', participantPayload);
                        // Emitir também para sala sem prefixo (sockets podem ter entrado pelo streamId direto)
                        const cleanStreamId = extractStreamId(roomName);
                        if (cleanStreamId && cleanStreamId !== roomName) {
                            io.to(cleanStreamId).emit('livekit_participant_joined', participantPayload);
                        }
                    }
                    persistLog(true);
                }
                catch (dbErr) {
                    console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao registrar participante:', dbErr.message);
                    persistLog(false, dbErr.message);
                }
            }
            else {
                persistLog(true);
            }
            return res.status(200).json({ received: true });
        }
        // ─── participant_left ──────────────────────────────────────────────────
        if (eventType === 'participant_left') {
            if (roomName && participant?.identity) {
                const participantIdentity = participant.identity;
                console.log(`[LIVEKIT-WEBHOOK] 👋 Participante saiu: ${participantIdentity} da sala ${roomName}`);
                try {
                    await models_1.StreamParticipant.deleteOne({
                        streamId: roomName,
                        userId: participantIdentity
                    });
                    // Também remover por cleanStreamId se existir (fallback para registros antigos)
                    const cleanStreamId = extractStreamId(roomName);
                    if (cleanStreamId !== roomName) {
                        await models_1.StreamParticipant.deleteMany({
                            cleanStreamId,
                            userId: participantIdentity
                        }).catch(() => { });
                    }
                    console.log(`[LIVEKIT-WEBHOOK] ✅ Participante ${participantIdentity} removido da sala ${roomName}`);
                    // Notificar via WebSocket
                    const io = req.app.get('io');
                    if (io) {
                        io.to(roomName).emit('livekit_participant_left', {
                            room: roomName,
                            identity: participantIdentity,
                            timestamp: new Date().toISOString()
                        });
                    }
                    persistLog(true);
                }
                catch (dbErr) {
                    console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao remover participante:', dbErr.message);
                    persistLog(false, dbErr.message);
                }
            }
            else {
                persistLog(true);
            }
            return res.status(200).json({ received: true });
        }
        // ─── Outros eventos (track_published, etc.) ────────────────────────────────
        console.log(`[LIVEKIT-WEBHOOK] ℹ️ Evento ignorado: ${eventType}`);
        persistLog(true);
        return res.status(200).json({ received: true, event: eventType });
    }
    catch (error) {
        console.error('[LIVEKIT-WEBHOOK] ❌ Erro geral:', error.message);
        await models_1.LiveKitWebhookLog.create({
            event: 'error',
            success: false,
            error: error.message,
            processedAt: new Date(),
        }).catch(() => { });
        // Sempre retornar 200 para evitar re-envios do LiveKit
        return res.status(200).json({ received: true });
    }
});
/**
 * GET /api/livekit/webhook/logs
 *
 * Consulta o histórico de eventos de webhook recebidos.
 *
 * Query params:
 *   page          - Número da página (default: 1)
 *   limit         - Itens por página (default: 50, max: 200)
 *   event         - Filtrar por tipo de evento (ex: room_finished)
 *   roomName      - Filtrar por nome da sala (ex: pk_abc123)
 *   success       - Filtrar por sucesso (true/false)
 */
router.get('/webhook/logs', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;
        // Montar filtro
        const filter = {};
        if (req.query.event) {
            filter.event = req.query.event;
        }
        if (req.query.roomName) {
            filter.roomName = req.query.roomName;
        }
        if (req.query.success !== undefined) {
            filter.success = req.query.success === 'true';
        }
        // Filtrar por data
        if (req.query.startDate) {
            filter.createdAt = { $gte: new Date(req.query.startDate) };
        }
        if (req.query.endDate) {
            filter.createdAt = { ...filter.createdAt, $lte: new Date(req.query.endDate) };
        }
        const [logs, total] = await Promise.all([
            models_1.LiveKitWebhookLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            models_1.LiveKitWebhookLog.countDocuments(filter),
        ]);
        res.json({
            success: true,
            data: logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('[LIVEKIT-WEBHOOK-LOGS] ❌ Erro ao consultar logs:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
// POST /api/livekit/chat-token - Gerar token para sala live (unificado: mídia + chat + eventos)
// Host recebe canPublish=true para publicar câmera/microfone.
// Viewers recebem canPublish=false (somente subscribe + data).
router.post('/chat-token', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Usuario nao autenticado' });
        }
        const { streamId } = req.body;
        if (!streamId) {
            return res.status(400).json({ success: false, message: 'streamId e obrigatorio' });
        }
        const liveRoomName = (0, LiveKitTokenService_1.getLiveRoomName)(streamId);
        await (0, LiveKitTokenService_1.ensureLiveKitRoom)(streamId);
        // Detectar host: consultar Streamer no DB para comparar hostId
        const streamer = await models_1.Streamer.findOne({ id: streamId }).lean();
        const isHost = !!streamer && String(streamer.hostId) === String(userId);
        const token = await (0, LiveKitTokenService_1.generateLiveKitToken)(userId, liveRoomName, JSON.stringify({ type: 'livechat', streamId }), { canPublish: isHost, canPublishData: true, canSubscribe: true });
        const lkUrl = env_1.ENV.LIVEKIT_URL || 'wss://livego.store/livekit';
        console.log(`[LIVEKIT-CHAT-TOKEN] streamId=${streamId} userId=${userId} isHost=${isHost}`);
        res.json({ success: true, token, serverUrl: lkUrl, roomName: liveRoomName });
    }
    catch (error) {
        console.error('[LIVEKIT-CHAT-TOKEN] Erro:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ========================================
// LiveKit Egress — RTMP para SRS
// ========================================
/**
 * POST /api/livekit/egress/start-rtmp
 *
 * Inicia um Egress RTMP para enviar o stream do LiveKit para o SRS.
 *
 * Body:
 *   - roomId: Nome da sala LiveKit (ex: live_streamId)
 *   - streamId: ID do stream no SRS (ex: streamId)
 *   - rtmpUrl: URL RTMP do SRS (opcional, usa padrão se não fornecido)
 */
router.post('/egress/start-rtmp', async (req, res) => {
    try {
        const { roomId, streamId, rtmpUrl } = req.body;
        if (!roomId || !streamId) {
            return res.status(400).json({ error: 'roomId and streamId are required' });
        }
        // O LiveKit Egress (app-egress) precisa alcançar o SRS pelo IP público ou host.
        // SRS_HOST já está definido como o IP público da VPS (2.25.192.154) no .env
        // Isso garante que o container app-egress consiga fazer push RTMP para o SRS.
        const rtmpHost = process.env.SRS_HOST || process.env.SRS_RTMP_HOST || '2.25.192.154';
        const defaultRtmpUrl = `rtmp://${rtmpHost}:${env_1.ENV.SRS_RTMP_PORT || 1935}/live/${streamId}`;
        const finalRtmpUrl = rtmpUrl || defaultRtmpUrl;
        console.log('[EGRESS] RTMP Egress → SRS host:', rtmpHost, 'URL:', finalRtmpUrl);
        console.log(`[EGRESS] Iniciando RTMP Egress:`, { roomId, streamId, rtmpUrl: finalRtmpUrl });
        const result = await LiveKitEgressService_1.egressService.startRTMPEgress(roomId, streamId, finalRtmpUrl);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (error) {
        console.error('[EGRESS] Erro ao iniciar RTMP Egress:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/livekit/egress/stop
 *
 * Para um Egress em andamento.
 *
 * Body:
 *   - egressId: ID do Egress a parar
 */
router.post('/egress/stop', async (req, res) => {
    try {
        const { egressId } = req.body;
        if (!egressId) {
            return res.status(400).json({ error: 'egressId is required' });
        }
        console.log(`[EGRESS] Parando Egress: ${egressId}`);
        const result = await LiveKitEgressService_1.egressService.stopEgress(egressId);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (error) {
        console.error('[EGRESS] Erro ao parar Egress:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/livekit/egress/list
 *
 * Lista todos os Egress ativos (útil para debug).
 */
router.get('/egress/list', async (req, res) => {
    try {
        const result = await LiveKitEgressService_1.egressService.listEgress();
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (error) {
        console.error('[EGRESS] Erro ao listar Egress:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/livekit/egress/status/:egressId
 *
 * Obtém o status atual de um Egress específico.
 * Útil para polling do frontend para saber se o Egress está ativo.
 *
 * Estados possíveis:
 *   - EGRESS_STARTING: inicializando
 *   - EGRESS_ACTIVE: transmitindo ativamente
 *   - EGRESS_ENDING: desligando
 *   - EGRESS_COMPLETE: finalizado com sucesso
 *   - EGRESS_FAILED: falhou (ver error no response)
 *   - EGRESS_LIMIT_REACHED: parou por limite
 */
router.get('/egress/status/:egressId', async (req, res) => {
    try {
        const { egressId } = req.params;
        if (!egressId) {
            return res.status(400).json({ success: false, error: 'egressId is required' });
        }
        console.log(`[EGRESS] Consulta de status: ${egressId}`);
        const result = await LiveKitEgressService_1.egressService.getEgressStatus(egressId);
        if (result.success) {
            res.json(result);
        }
        else {
            res.status(500).json(result);
        }
    }
    catch (error) {
        console.error('[EGRESS] Erro ao consultar status do Egress:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/hls/validate/:streamId
 *
 * Valida se o pipeline HLS está funcionando para uma stream específica.
 * Testa se o SRS está gerando o playlist .m3u8 e os segmentos .ts.
 *
 * Response:
 *   - manifestOk: true se o .m3u8 foi encontrado
 *   - segmentsOk: true se há segmentos .ts listados
 *   - segmentCount: número de segmentos .ts
 *   - manifestUrl: URL completa do .m3u8
 *   - firstSegmentUrl: URL do primeiro segmento .ts
 */
router.get('/hls/validate/:streamId', async (req, res) => {
    const { streamId } = req.params;
    if (!streamId) {
        return res.status(400).json({ success: false, error: 'streamId is required' });
    }
    try {
        const srsHost = env_1.ENV.SRS_HOST || 'localhost';
        const srsHttpPort = env_1.ENV.SRS_HTTP_PORT || 8080;
        const normalizedId = streamId.startsWith('stream_') ? streamId : `stream_${streamId}`;
        const manifestUrl = `http://${srsHost}:${srsHttpPort}/live/${normalizedId}.m3u8`;
        console.log(`[HLS-VALIDATE] Testando manifest: ${manifestUrl}`);
        // 1) Fetch do .m3u8
        let manifestBody;
        try {
            const response = await fetch(manifestUrl, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                console.warn(`[HLS-VALIDATE] Manifest retornou ${response.status} para ${streamId}`);
                return res.json({
                    success: true,
                    streamId,
                    manifestOk: false,
                    segmentsOk: false,
                    segmentCount: 0,
                    manifestUrl,
                    statusCode: response.status,
                    statusText: response.statusText,
                    firstSegmentUrl: null,
                    message: `SRS retornou HTTP ${response.status} para o manifest. Egress pode não ter enviado mídia ainda.`,
                });
            }
            manifestBody = await response.text();
        }
        catch (fetchErr) {
            console.warn(`[HLS-VALIDATE] Falha ao buscar manifest: ${fetchErr.message}`);
            return res.json({
                success: true,
                streamId,
                manifestOk: false,
                segmentsOk: false,
                segmentCount: 0,
                manifestUrl,
                statusCode: null,
                statusText: fetchErr.message,
                firstSegmentUrl: null,
                message: `Não foi possível conectar ao SRS: ${fetchErr.message}. Verifique se o SRS está rodando e acessível.`,
            });
        }
        // 2) Validar que é um playlist HLS válido
        const isM3u8 = manifestBody.startsWith('#EXTM3U');
        if (!isM3u8) {
            return res.json({
                success: true,
                streamId,
                manifestOk: false,
                segmentsOk: false,
                segmentCount: 0,
                manifestUrl,
                statusCode: 200,
                firstSegmentUrl: null,
                message: 'Manifest não é um playlist HLS válido (não começa com #EXTM3U)',
            });
        }
        // 3) Extrair segmentos .ts
        const tsSegments = [];
        const lines = manifestBody.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.endsWith('.ts') && !trimmed.startsWith('#')) {
                tsSegments.push(trimmed);
            }
        }
        const segmentsOk = tsSegments.length > 0;
        const firstSegmentUrl = segmentsOk
            ? new URL(tsSegments[0], manifestUrl).toString()
            : null;
        console.log(`[HLS-VALIDATE] Resultado para ${streamId}: manifestOk=true, segments=${tsSegments.length}`);
        res.json({
            success: true,
            streamId,
            manifestOk: true,
            segmentsOk,
            segmentCount: tsSegments.length,
            manifestUrl,
            statusCode: 200,
            firstSegmentUrl,
            segments: tsSegments.slice(0, 5), // primeiros 5 segmentos para debug
            message: segmentsOk
                ? `Pipeline HLS operacional: ${tsSegments.length} segmentos .ts disponíveis`
                : 'Manifest existe mas sem segmentos .ts - aguardando mídia do Egress',
        });
        // 4) Validar CORS e HTTPS no endpoint público
        const backendUrl = process.env.BACKEND_URL || 'https://api.livego.store';
        const publicBase = `${backendUrl.replace(/\/+$/, '')}/api/video/http`;
        const publicManifestUrl = `${publicBase}/live/${normalizedId}.m3u8`;
        let publicCorsOk = false;
        let publicHttpsOk = false;
        try {
            const publicResp = await fetch(publicManifestUrl, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
                headers: { 'Origin': 'https://livego.store' },
            });
            publicHttpsOk = publicResp.ok;
            const corsHeader = publicResp.headers.get('access-control-allow-origin');
            publicCorsOk = corsHeader === '*' || corsHeader === 'https://livego.store';
            console.log(`[HLS-VALIDATE] HTTPS: ${publicHttpsOk ? '✅' : '❌'} CORS: ${publicCorsOk ? '✅' : '❌'} (${corsHeader || 'none'})`);
        }
        catch (publicErr) {
            console.warn(`[HLS-VALIDATE] HTTPS/CORS check falhou: ${publicErr.message}`);
        }
        res.json({
            success: true,
            streamId,
            manifestOk: true,
            segmentsOk,
            segmentCount: tsSegments.length,
            manifestUrl,
            publicManifestUrl,
            publicHttpsOk,
            publicCorsOk,
            statusCode: 200,
            firstSegmentUrl,
            segments: tsSegments.slice(0, 5),
            message: segmentsOk
                ? `Pipeline HLS operacional: ${tsSegments.length} segmentos .ts disponíveis. HTTPS: ${publicHttpsOk ? 'OK' : 'FALHA'}, CORS: ${publicCorsOk ? 'OK' : 'FALHA'}`
                : 'Manifest existe mas sem segmentos .ts - aguardando mídia do Egress',
        });
    }
    catch (error) {
        console.error('[HLS-VALIDATE] Erro:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            streamId,
            manifestOk: false,
            segmentsOk: false,
        });
    }
});
exports.default = router;
