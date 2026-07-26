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
const mongoose_1 = require("mongoose");
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
// PUT /api/livekit/rooms/:roomName/metadata - Atualizar Room Metadata (APENAS API OFICIAL)
// Docs: https://docs.livekit.io/transport/data/state/room-metadata/
router.put('/rooms/:roomName/metadata', async (req, res) => {
    const { roomName } = req.params;
    const { metadata } = req.body;
    if (!metadata || typeof metadata !== 'object') {
        return res.status(400).json({ error: 'metadata object is required' });
    }
    try {
        // Verificar se a sala existe no LiveKit
        if (!(await (0, LiveKitTokenService_1.roomExists)(roomName))) {
            return res.status(404).json({ error: 'Room not found on LiveKit server' });
        }
        // updateRoomMetadata() aceita uma string JSON e sincroniza para todos os clientes
        await LiveKitTokenService_1.roomService.updateRoomMetadata(roomName, JSON.stringify(metadata));
        console.log(`[LIVEKIT] Room metadata atualizada: ${roomName}`, JSON.stringify(metadata));
        res.json({ success: true, roomName, metadata });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao atualizar room metadata:', error.message);
        res.status(502).json({ success: false, error: `Falha ao atualizar room metadata: ${error.message}` });
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
                        io.to(roomName).emit('livekit_participant_joined', {
                            room: roomName,
                            identity: participantIdentity,
                            name: participant.name || participantIdentity,
                            timestamp: new Date().toISOString()
                        });
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
// ========================================
// LiveKit Room Config — Dados completos referenciados por configId
// ========================================
/**
 * GET /api/livekit/room-config/:configId
 *
 * Retorna a configuração completa de uma sala/live a partir de um configId.
 * O configId pode ser o streamId (ID da live) ou o MongoDB _id do StreamSession.
 *
 * Esse endpoint implementa o padrão "Reference by ID" do LiveKit:
 * - Dados grandes NÃO são armazenados no Room Metadata (limite 512 KiB)
 * - Apenas um identificador (configId) é colocado no metadata
 * - O frontend usa esse ID para buscar os dados completos via API
 *
 * Docs: https://docs.livekit.io/transport/data/state/room-metadata/#size-limits
 */
router.get('/room-config/:configId', async (req, res) => {
    const { configId } = req.params;
    if (!configId) {
        return res.status(400).json({ error: 'configId is required' });
    }
    try {
        const db = mongoose_1.default.connection.db;
        if (!db) {
            return res.status(503).json({ success: false, error: 'Database not connected' });
        }
        const collection = db.collection('streamsessions');
        // Buscar por streamId ou _id (MongoDB não lança erro para _id inválido — apenas não acha)
        const config = await collection.findOne({
            $or: [
                { streamId: configId },
                { _id: configId }
            ]
        });
        if (!config) {
            return res.status(404).json({ success: false, error: 'Config not found' });
        }
        res.json({
            success: true,
            config: {
                id: config._id.toString(),
                streamId: config.streamId,
                hostId: config.hostId,
                startTime: config.startTime,
                viewers: config.viewers,
                coins: config.coins,
                giftsReceived: config.giftsReceived,
                messagesCount: config.messagesCount,
                peakViewers: config.peakViewers,
                followers: config.followers,
                members: config.members,
                fans: config.fans,
                isMicrophoneMuted: config.isMicrophoneMuted,
                isStreamMuted: config.isStreamMuted,
                isAutoFollowEnabled: config.isAutoFollowEnabled,
                isAutoPrivateInviteEnabled: config.isAutoPrivateInviteEnabled,
                endTime: config.endTime || null,
                totalDuration: config.totalDuration || null,
            },
        });
    }
    catch (error) {
        console.error('[LIVEKIT] Erro ao buscar room config:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.default = router;
