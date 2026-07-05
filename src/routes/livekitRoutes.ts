import express from 'express';
import { IngressClient, WebhookReceiver } from 'livekit-server-sdk';
import { ENV } from '../config/env';
import { roomService, livekitServerUrl, generateLiveKitToken, roomExists } from '../services/LiveKitTokenService';
import { getUserIdFromToken } from '../middleware/auth';
import { Battle, CallInvitation, StreamParticipant, LiveKitWebhookLog } from '../models';

const router = express.Router();

// GET /api/livekit/token - Gerar token de acesso
router.get('/token', async (req, res) => {
  const identity = req.query.identity as string || `user_${Date.now()}`;
  const room = req.query.room as string || `room_${Date.now()}`;
  const metadata = req.query.metadata as string;

  try {
    const token = await generateLiveKitToken(identity, room, metadata);
    res.json({
      success: true,
      token,
      identity,
      room,
      livekitUrl: ENV.LIVEKIT_URL,
    });
  } catch (error: any) {
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
    const token = await generateLiveKitToken(identity, room, metadata);
    res.json({
      success: true,
      token,
      identity,
      room,
      livekitUrl: ENV.LIVEKIT_URL,
    });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao gerar token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/livekit/rooms - Criar sala no LiveKit (APENAS API OFICIAL)
router.post('/rooms', async (req, res) => {
  const { name, emptyTimeout = 300, maxParticipants = 50 } = req.body;
  if (!name) return res.status(400).json({ error: 'Room name required' });

  try {
    await roomService.createRoom({
      name,
      emptyTimeout,
      maxParticipants,
    });

    console.log(`[LIVEKIT] Sala criada no LiveKit: ${name}`);
    res.json({
      success: true,
      room: { name, emptyTimeout, maxParticipants, createdAt: new Date() },
    });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao criar sala no LiveKit:', error.message);
    res.status(502).json({ success: false, error: `Falha ao criar sala no LiveKit: ${error.message}` });
  }
});

// POST /api/livekit/rooms/:roomName/join - Entrar na sala LiveKit (APENAS API OFICIAL)
router.post('/rooms/:roomName/join', async (req, res) => {
  const { roomName } = req.params;
  const { identity, name, role = 'participant' } = req.body;

  if (!identity) return res.status(400).json({ error: 'Identity required' });

  try {
    // Verificar se a sala existe no LiveKit
    const rooms = await roomService.listRooms();
    const roomExists = rooms.some(r => r.name === roomName);
    if (!roomExists) {
      return res.status(404).json({ error: 'Room not found on LiveKit server' });
    }

    // Gerar token LiveKit para este participante
    const token = await generateLiveKitToken(identity, roomName, JSON.stringify({ name, role }));

    // Obter participantes atuais da sala real
    let participantCount = 0;
    try {
      const participants = await roomService.listParticipants(roomName);
      participantCount = participants.length;
    } catch (_) {}

    console.log(`[LIVEKIT] Participante ${identity} entrou na sala ${roomName} (LiveKit oficial)`);

    res.json({
      success: true,
      room: { name: roomName, participantCount },
      participant: { identity, name: name || identity, role },
      token,
      livekitUrl: ENV.LIVEKIT_URL,
    });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao processar join na sala LiveKit:', error.message);
    res.status(502).json({ success: false, error: `Falha ao entrar na sala LiveKit: ${error.message}` });
  }
});

// GET /api/livekit/rooms - Listar salas (APENAS API OFICIAL, SEM FALLBACK)
router.get('/rooms', async (req, res) => {
  try {
    const liveRooms = await roomService.listRooms();
    const roomList = liveRooms.map(r => ({
      name: r.name,
      emptyTimeout: r.emptyTimeout,
      maxParticipants: r.maxParticipants,
      createdAt: new Date(Number(r.creationTimeMs ?? r.creationTime)),
      participantCount: r.numParticipants || 0,
    }));

    res.json({ success: true, rooms: roomList });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao listar salas do LiveKit:', error.message);
    res.status(502).json({ success: false, error: `Falha ao listar salas do LiveKit: ${error.message}` });
  }
});

// DELETE /api/livekit/rooms/:roomName - Deletar sala (APENAS API OFICIAL, SEM FALLBACK)
router.delete('/rooms/:roomName', async (req, res) => {
  const { roomName } = req.params;

  try {
    await roomService.deleteRoom(roomName);
    console.log(`[LIVEKIT] Sala ${roomName} deletada do LiveKit`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao deletar sala do LiveKit:', error.message);
    res.status(502).json({ success: false, error: `Falha ao deletar sala do LiveKit: ${error.message}` });
  }
});

// GET /api/livekit/rooms/:roomName/participants - Listar participantes (APENAS API OFICIAL, SEM FALLBACK)
router.get('/rooms/:roomName/participants', async (req, res) => {
  const { roomName } = req.params;

  try {
    const participants = await roomService.listParticipants(roomName);
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
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao listar participantes do LiveKit:', error.message);
    res.status(502).json({ success: false, error: `Falha ao listar participantes do LiveKit: ${error.message}` });
  }
});

// GET /api/livekit/rooms/:roomName/participants/:identity - Buscar participante (APENAS API OFICIAL, SEM FALLBACK)
router.get('/rooms/:roomName/participants/:identity', async (req, res) => {
  const { roomName, identity } = req.params;

  try {
    const participants = await roomService.listParticipants(roomName);
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
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao buscar participante no LiveKit:', error.message);
    res.status(502).json({ success: false, error: `Falha ao buscar participante no LiveKit: ${error.message}` });
  }
});

// POST /api/livekit/rooms/:roomName/participants/:identity/kick - Remover participante (APENAS API OFICIAL, SEM FALLBACK)
router.post('/rooms/:roomName/participants/:identity/kick', async (req, res) => {
  const { roomName, identity } = req.params;

  try {
    await roomService.removeParticipant(roomName, identity);
    console.log(`[LIVEKIT] Participante ${identity} removido da sala ${roomName} (LiveKit oficial)`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao remover participante do LiveKit:', error.message);
    res.status(502).json({ success: false, error: `Falha ao remover participante do LiveKit: ${error.message}` });
  }
});

// POST /api/livekit/rooms/:roomName/participants/:identity/tracks/:trackSid/mute - Mutar track (APENAS API OFICIAL, SEM FALLBACK)
router.post('/rooms/:roomName/participants/:identity/tracks/:trackSid/mute', async (req, res) => {
  const { roomName, identity, trackSid } = req.params;
  const { muted } = req.body;

  try {
    await roomService.mutePublishedTrack(roomName, identity, trackSid, muted);
    console.log(`[LIVEKIT] Track ${trackSid} ${muted ? 'mutada' : 'desmutada'} para ${identity} (LiveKit oficial)`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao mutar track no LiveKit:', error.message);
    res.status(502).json({ success: false, error: `Falha ao mutar track no LiveKit: ${error.message}` });
  }
});

// ========================================
// LiveKit Ingress API
// ========================================

const ingressClient = new IngressClient(
  livekitServerUrl,
  ENV.LIVEKIT_API_KEY,
  ENV.LIVEKIT_API_SECRET
);

// POST /api/livekit/ingresses - Criar um ingress (ponto de entrada RTMP)
router.post('/ingresses', async (req, res) => {
  try {
    const {
      inputType: rawInputType,
      name,
      roomName,
      participantIdentity,
      participantName,
      participantMetadata,
      enableTranscoding = true,
      url,
    } = req.body;

    if (!roomName || !participantIdentity) {
      return res.status(400).json({ error: 'roomName and participantIdentity are required' });
    }

    const IngressInput = require('@livekit/protocol').IngressInput;
    const inputType = typeof rawInputType === 'number' ? rawInputType : (IngressInput[rawInputType] ?? 0);

    const ingress = await ingressClient.createIngress(inputType, {
      name: name || `ingress_${roomName}_${Date.now()}`,
      roomName,
      participantIdentity,
      participantName: participantName || participantIdentity,
      participantMetadata,
      enableTranscoding,
      url,
    });

    console.log(`[LIVEKIT] Ingress criado: ${ingress.ingressId} -> ${roomName}`);
    res.json({ success: true, ingress });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao criar ingress:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/livekit/ingresses - Listar ingresses
router.get('/ingresses', async (req, res) => {
  try {
    const roomName = req.query.roomName as string;
    const ingresses = await ingressClient.listIngress(roomName);
    res.json({ success: true, ingresses });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao listar ingresses:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/livekit/ingresses/:ingressId - Atualizar um ingress
router.put('/ingresses/:ingressId', async (req, res) => {
  try {
    const { ingressId } = req.params;
    const {
      name,
      roomName,
      participantIdentity,
      participantName,
      participantMetadata,
      enableTranscoding,
    } = req.body;

    const ingress = await ingressClient.updateIngress(ingressId, {
      name,
      roomName,
      participantIdentity,
      participantName,
      participantMetadata,
      enableTranscoding,
    });

    res.json({ success: true, ingress });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao atualizar ingress:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/livekit/ingresses/:ingressId - Deletar um ingress
router.delete('/ingresses/:ingressId', async (req, res) => {
  try {
    const { ingressId } = req.params;
    await ingressClient.deleteIngress(ingressId);
    console.log(`[LIVEKIT] Ingress ${ingressId} deletado`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao deletar ingress:', error);
    res.status(500).json({ success: false, error: error.message });
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
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { battleId, name, canPublish = false } = req.body;

    if (!battleId) {
      return res.status(400).json({ error: 'battleId is required' });
    }

    // Validar se a batalha existe e está ativa
    const battle = await Battle.findById(battleId).lean();
    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }
    if (battle.status === 'finished') {
      return res.status(400).json({ error: 'Battle already ended' });
    }

    const roomName = `pk_${battleId}`;

    // Verificar se a sala já existe (usando getRoom ao invés de listRooms)
    if (!(await roomExists(roomName))) {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 600,
        maxParticipants: 10,
      });
      console.log(`[LIVEKIT-PK] Sala criada: ${roomName} (batalha ${battleId})`);
    }

    // Gerar token reutilizando o helper
    const token = await generateLiveKitToken(
      userId,
      roomName,
      JSON.stringify({ name, type: 'pk', battleId }),
      { canPublish }
    );

    console.log(`[LIVEKIT-PK] Token gerado para ${userId} na sala ${roomName} (publish: ${canPublish})`);

    res.json({
      success: true,
      token,
      identity: userId,
      room: roomName,
      battleId,
      livekitUrl: ENV.LIVEKIT_URL,
      serverUrl: ENV.LIVEKIT_SERVER_URL,
    });
  } catch (error: any) {
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
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { battleId } = req.body;
    if (!battleId) {
      return res.status(400).json({ error: 'battleId is required' });
    }

    const roomName = `pk_${battleId}`;

    if (await roomExists(roomName)) {
      await roomService.deleteRoom(roomName);
      console.log(`[LIVEKIT-PK] Sala ${roomName} encerrada por ${userId}`);
    } else {
      console.log(`[LIVEKIT-PK] Sala ${roomName} já não existe`);
    }

    res.json({ success: true, message: `PK room ${roomName} deleted` });
  } catch (error: any) {
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
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invitationId, name } = req.body;

    if (!invitationId) {
      return res.status(400).json({ error: 'invitationId is required' });
    }

    // Validar se o convite existe e está pendente
    const invitation = await CallInvitation.findById(invitationId).lean();
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

    if (!(await roomExists(roomName))) {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 600,
        maxParticipants: 10,
      });
      console.log(`[LIVEKIT-CALL] Sala criada: ${roomName} (convite ${invitationId})`);
    }

    // HOST pode publicar áudio/vídeo
    const token = await generateLiveKitToken(
      userId,
      roomName,
      JSON.stringify({ name, type: 'call', invitationId, role: 'host' }),
      { canPublish: true }
    );

    console.log(`[LIVEKIT-CALL] Sala ${roomName} inicializada por ${userId} (host)`);

    res.json({
      success: true,
      token,
      identity: userId,
      room: roomName,
      invitationId,
      role: 'host',
      livekitUrl: ENV.LIVEKIT_URL,
      serverUrl: ENV.LIVEKIT_SERVER_URL,
    });
  } catch (error: any) {
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
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invitationId, name } = req.body;

    if (!invitationId) {
      return res.status(400).json({ error: 'invitationId is required' });
    }

    // Validar se o convite existe
    const invitation = await CallInvitation.findById(invitationId).lean();
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

    if (!(await roomExists(roomName))) {
      return res.status(404).json({
        success: false,
        error: 'Call room not found. The host may not have started the call yet.',
      });
    }

    // GUEST pode publicar áudio/vídeo também
    const token = await generateLiveKitToken(
      userId,
      roomName,
      JSON.stringify({ name, type: 'call', invitationId, role: 'guest' }),
      { canPublish: true }
    );

    // Buscar participantes atuais
    let participantCount = 0;
    try {
      const participants = await roomService.listParticipants(roomName);
      participantCount = participants.length;
    } catch (_) {}

    console.log(`[LIVEKIT-CALL] Guest ${userId} entrou na sala ${roomName}`);

    res.json({
      success: true,
      token,
      identity: userId,
      room: roomName,
      invitationId,
      role: 'guest',
      participantCount,
      livekitUrl: ENV.LIVEKIT_URL,
      serverUrl: ENV.LIVEKIT_SERVER_URL,
    });
  } catch (error: any) {
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
    const userId = getUserIdFromToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invitationId } = req.body;
    if (!invitationId) {
      return res.status(400).json({ error: 'invitationId is required' });
    }

    const roomName = `call_${invitationId}`;

    if (await roomExists(roomName)) {
      await roomService.deleteRoom(roomName);
      console.log(`[LIVEKIT-CALL] Sala ${roomName} encerrada por ${userId}`);
    } else {
      console.log(`[LIVEKIT-CALL] Sala ${roomName} já não existe`);
    }

    res.json({ success: true, message: `Call room ${roomName} deleted` });
  } catch (error: any) {
    console.error('[LIVEKIT-CALL] Erro ao encerrar sala:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// LiveKit Webhook — Eventos assíncronos do LiveKit Server
// ========================================

const webhookReceiver = new WebhookReceiver(
  ENV.LIVEKIT_API_KEY,
  ENV.LIVEKIT_API_SECRET
);

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
    let event: any;
    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      event = await webhookReceiver.receive(
        rawBody,
        authHeader
      );
    } catch (err: any) {
      console.warn('[LIVEKIT-WEBHOOK] ❌ Assinatura inválida:', err.message);
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const eventType = event.event as string;
    const roomName = event.room?.name as string;
    const roomSid = event.room?.sid as string;
    const participant = event.participant as any;

    console.log(`[LIVEKIT-WEBHOOK] 📨 Evento recebido: ${eventType} | sala: ${roomName || 'N/A'}`);

    // Helper: persistir log do evento no MongoDB (fire-and-forget — não bloqueia)
    const persistLog = (success: boolean, errorMsg?: string) => {
      LiveKitWebhookLog.create({
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
          id: (event as any).id,
          createdAt: (event as any).createdAt,
        },
        processedAt: new Date(),
      }).catch((logErr: any) =>
        console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao persistir log:', logErr.message)
      );
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
          const updated = await Battle.findOneAndUpdate(
            { _id: battleId as any, status: { $ne: 'finished' } },
            { $set: { status: 'finished', endedAt: new Date() } },
            { new: true }
          );

          if (updated) {
            console.log(`[LIVEKIT-WEBHOOK] ✅ PK Battle ${battleId} marcada como finished`);

            // Notificar via WebSocket
            const io = req.app.get('io');
            if (io) {
              io.to(`battle_${battleId}`).emit('pk_battle_ended', {
                battleId,
                winner: (updated as any).winner,
                heartsA: (updated as any).heartsA,
                heartsB: (updated as any).heartsB,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            console.log(`[LIVEKIT-WEBHOOK] ℹ️ PK Battle ${battleId} já estava finalizada ou não encontrada`);
          }

          persistLog(true);
        } catch (dbErr: any) {
          console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao atualizar Battle:', dbErr.message);
          persistLog(false, dbErr.message);
        }
      }

      // Sala Call: call_<invitationId>
      if (roomName.startsWith('call_')) {
        const invitationId = roomName.slice(5);
        console.log(`[LIVEKIT-WEBHOOK] 📞 Chamada finalizada: ${invitationId} (sala ${roomName})`);

        try {
          await CallInvitation.findOneAndUpdate(
            { id: invitationId, status: { $ne: 'ended' } },
            { $set: { status: 'ended', updatedAt: new Date() } }
          );

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
        } catch (dbErr: any) {
          console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao atualizar CallInvitation:', dbErr.message);
          persistLog(false, dbErr.message);
        }
      }

      // Room finished sem prefixo conhecido — loga sucesso mesmo assim
      if (!roomName.startsWith('pk_') && !roomName.startsWith('call_')) {
        persistLog(true);
      }

      return res.status(200).json({ received: true });
    }

    // ─── participant_joined ───────────────────────────────────────────────
    if (eventType === 'participant_joined') {
      if (roomName && participant?.identity) {
        const participantIdentity = participant.identity as string;
        console.log(`[LIVEKIT-WEBHOOK] 👤 Participante entrou: ${participantIdentity} na sala ${roomName}`);

        try {
          await StreamParticipant.findOneAndUpdate(
            { streamId: roomName, userId: participantIdentity },
            {
              $set: {
                streamId: roomName,
                userId: participantIdentity,
                userName: participant.name || participantIdentity,
                role: roomName.startsWith('pk_') ? 'pk_participant' : 'call_participant',
                joinedAt: new Date(),
              }
            },
            { upsert: true }
          );

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
        } catch (dbErr: any) {
          console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao registrar participante:', dbErr.message);
          persistLog(false, dbErr.message);
        }
      } else {
        persistLog(true);
      }

      return res.status(200).json({ received: true });
    }

    // ─── participant_left ──────────────────────────────────────────────────
    if (eventType === 'participant_left') {
      if (roomName && participant?.identity) {
        const participantIdentity = participant.identity as string;
        console.log(`[LIVEKIT-WEBHOOK] 👋 Participante saiu: ${participantIdentity} da sala ${roomName}`);

        try {
          await StreamParticipant.deleteOne({
            streamId: roomName,
            userId: participantIdentity
          });

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
        } catch (dbErr: any) {
          console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao remover participante:', dbErr.message);
          persistLog(false, dbErr.message);
        }
      } else {
        persistLog(true);
      }

      return res.status(200).json({ received: true });
    }

    // ─── Outros eventos (track_published, etc.) ────────────────────────────────
    console.log(`[LIVEKIT-WEBHOOK] ℹ️ Evento ignorado: ${eventType}`);
    persistLog(true);
    return res.status(200).json({ received: true, event: eventType });

  } catch (error: any) {
    console.error('[LIVEKIT-WEBHOOK] ❌ Erro geral:', error.message);
    await LiveKitWebhookLog.create({
      event: 'error',
      success: false,
      error: error.message,
      processedAt: new Date(),
    }).catch(() => {});
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
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    // Montar filtro
    const filter: any = {};

    if (req.query.event) {
      filter.event = req.query.event as string;
    }
    if (req.query.roomName) {
      filter.roomName = req.query.roomName as string;
    }
    if (req.query.success !== undefined) {
      filter.success = req.query.success === 'true';
    }

    // Filtrar por data
    if (req.query.startDate) {
      filter.createdAt = { $gte: new Date(req.query.startDate as string) };
    }
    if (req.query.endDate) {
      filter.createdAt = { ...filter.createdAt, $lte: new Date(req.query.endDate as string) };
    }

    const [logs, total] = await Promise.all([
      LiveKitWebhookLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LiveKitWebhookLog.countDocuments(filter),
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
  } catch (error: any) {
    console.error('[LIVEKIT-WEBHOOK-LOGS] ❌ Erro ao consultar logs:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
