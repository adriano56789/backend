import express from 'express';
import { WebhookReceiver } from 'livekit-server-sdk';
import { ENV } from '../config/env';
import { roomService, generateLiveKitToken, roomExists, getLiveRoomName, ensureLiveKitRoom } from '../services/LiveKitTokenService';
import { getUserIdFromToken } from '../middleware/auth';
import { Battle, CallInvitation, StreamParticipant, LiveKitWebhookLog, Streamer } from '../models';
import { egressService } from '../services/LiveKitEgressService';

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
// LiveKit Webhook — Delivery, retries & idempotência
// ========================================
// Docs: https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/
//
// LiveKit envia webhooks com at-least-once delivery. Duplicatas são garantidas.
// Cada evento tem um campo `id` (UUID) que usamos como chave de deduplicação.
//
// Fluxo:
//   1. Validar assinatura JWT (WebhookReceiver)
//   2. Verificar idempotência (eventId unique index no MongoDB)
//   3. Retornar 2xx imediatamente
//   4. Processar assíncronamente (fire-and-forget)

const webhookReceiver = new WebhookReceiver(
  ENV.LIVEKIT_API_KEY,
  ENV.LIVEKIT_API_SECRET
);

// Helper: extrair o ID real da stream removendo o prefixo da sala LiveKit
const extractStreamId = (lkRoomName: string): string => {
  if (lkRoomName.startsWith('live_')) return lkRoomName.slice(5);
  if (lkRoomName.startsWith('pk_')) return lkRoomName.slice(3);
  if (lkRoomName.startsWith('call_')) return lkRoomName.slice(5);
  return lkRoomName;
};

/**
 * Processa um evento de webhook do LiveKit.
 * Chamado de forma assíncrona (fire-and-forget) após o 200 ser retornado.
 * Cada handler é idempotente: executar duas vezes produz o mesmo resultado.
 */
async function processWebhookEvent(event: any): Promise<void> {
  const eventType = event.event as string;
  const roomName = event.room?.name as string;
  const participant = event.participant as any;

  // ─── room_started ─────────────────────────────────────────────────────
  if (eventType === 'room_started') {
    if (!roomName) return;

    console.log(`[LIVEKIT-WEBHOOK] 🏠 Sala iniciada: ${roomName} (sid: ${event.room?.sid || 'N/A'})`);

    // Sala PK: pk_<battleId> — marcar battle como active se necessário
    if (roomName.startsWith('pk_')) {
      const battleId = roomName.slice(3);
      try {
        const updated = await Battle.findOneAndUpdate(
          { _id: battleId as any, status: { $ne: 'active' } },
          { $set: { status: 'active', startedAt: new Date() } },
          { returnDocument: 'after' }
        );
        if (updated) {
          console.log(`[LIVEKIT-WEBHOOK] ✅ PK Battle ${battleId} marcada como active`);
        }
      } catch (dbErr: any) {
        console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao processar room_started (PK):', dbErr.message);
      }
    }

    // Sala Call: call_<invitationId> — marcar convite como active
    if (roomName.startsWith('call_')) {
      const invitationId = roomName.slice(5);
      try {
        await CallInvitation.findOneAndUpdate(
          { id: invitationId, status: { $ne: 'active' } },
          { $set: { status: 'active', updatedAt: new Date() } }
        );
        console.log(`[LIVEKIT-WEBHOOK] ✅ CallInvitation ${invitationId} marcada como active`);
      } catch (dbErr: any) {
        console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao processar room_started (Call):', dbErr.message);
      }
    }

    // Sala Live: log
    if (roomName.startsWith('live_')) {
      console.log(`[LIVEKIT-WEBHOOK] 📡 Sala live ${roomName.slice(5)} iniciada`);
    }

    return;
  }

  // ─── room_finished ────────────────────────────────────────────────────
  if (eventType === 'room_finished') {
    if (!roomName) return;

    // Sala PK: pk_<battleId>
    if (roomName.startsWith('pk_')) {
      const battleId = roomName.slice(3);
      console.log(`[LIVEKIT-WEBHOOK] 🏆 PK Battle finalizada: ${battleId}`);
      try {
        const updated = await Battle.findOneAndUpdate(
          { _id: battleId as any, status: { $ne: 'finished' } },
          { $set: { status: 'finished', endedAt: new Date() } },
          { returnDocument: 'after' }
        );
        if (updated) {
          console.log(`[LIVEKIT-WEBHOOK] ✅ PK Battle ${battleId} marcada como finished`);
          const io = (global as any).io;
          if (io) {
            io.to(`battle_${battleId}`).emit('pk_battle_ended', {
              battleId,
              winner: (updated as any).winner,
              heartsA: (updated as any).heartsA,
              heartsB: (updated as any).heartsB,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (dbErr: any) {
        console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao processar room_finished (PK):', dbErr.message);
      }
    }

    // Sala Call: call_<invitationId>
    if (roomName.startsWith('call_')) {
      const invitationId = roomName.slice(5);
      console.log(`[LIVEKIT-WEBHOOK] 📞 Chamada finalizada: ${invitationId}`);
      try {
        await CallInvitation.findOneAndUpdate(
          { id: invitationId, status: { $ne: 'ended' } },
          { $set: { status: 'ended', updatedAt: new Date() } }
        );
        console.log(`[LIVEKIT-WEBHOOK] ✅ CallInvitation ${invitationId} marcada como ended`);
        const io = (global as any).io;
        if (io) {
          io.emit('call_ended', {
            invitationId,
            timestamp: new Date().toISOString()
          });
        }
      } catch (dbErr: any) {
        console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao processar room_finished (Call):', dbErr.message);
      }
    }

    // Sala Live: live_<streamId>
    if (roomName.startsWith('live_')) {
      console.log(`[LIVEKIT-WEBHOOK] 📡 Live finalizada: ${roomName.slice(5)}`);
      try {
        const result = await StreamParticipant.deleteMany({ streamId: roomName });
        console.log(`[LIVEKIT-WEBHOOK] ✅ ${result.deletedCount} participante(s) removido(s) da sala ${roomName}`);
      } catch (dbErr: any) {
        console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao limpar participantes (room_finished):', dbErr.message);
      }
    }

    return;
  }

  // ─── participant_joined ───────────────────────────────────────────────
  if (eventType === 'participant_joined') {
    if (!roomName || !participant?.identity) return;

    const participantIdentity = participant.identity as string;
    console.log(`[LIVEKIT-WEBHOOK] 👤 Participante entrou: ${participantIdentity} na sala ${roomName}`);

    try {
      const cleanStreamId = extractStreamId(roomName);
      const participantRole = roomName.startsWith('pk_')
        ? 'pk_participant'
        : roomName.startsWith('live_')
          ? 'live_viewer'
          : 'call_participant';

      // Upsert idempotente: atualiza joinedAt a cada entrega duplicada
      await StreamParticipant.findOneAndUpdate(
        { streamId: roomName, userId: participantIdentity },
        {
          $set: {
            streamId: roomName,
            cleanStreamId,
            userId: participantIdentity,
            userName: participant.name || participantIdentity,
            role: participantRole,
            joinedAt: new Date(),
          }
        },
        { upsert: true }
      );

      console.log(`[LIVEKIT-WEBHOOK] ✅ Participante ${participantIdentity} registrado na sala ${roomName}`);

      const io = (global as any).io;
      if (io) {
        const participantPayload = {
          room: roomName,
          identity: participantIdentity,
          name: participant.name || participantIdentity,
          timestamp: new Date().toISOString()
        };
        io.to(roomName).emit('livekit_participant_joined', participantPayload);
        if (cleanStreamId && cleanStreamId !== roomName) {
          io.to(cleanStreamId).emit('livekit_participant_joined', participantPayload);
        }
      }
    } catch (dbErr: any) {
      console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao registrar participante:', dbErr.message);
    }

    return;
  }

  // ─── participant_left ──────────────────────────────────────────────────
  if (eventType === 'participant_left') {
    if (!roomName || !participant?.identity) return;

    const participantIdentity = participant.identity as string;
    console.log(`[LIVEKIT-WEBHOOK] 👋 Participante saiu: ${participantIdentity} da sala ${roomName}`);

    try {
      // Delete idempotente: deletar algo que não existe é um no-op
      await StreamParticipant.deleteOne({
        streamId: roomName,
        userId: participantIdentity
      });

      const cleanStreamId = extractStreamId(roomName);
      if (cleanStreamId !== roomName) {
        await StreamParticipant.deleteMany({
          cleanStreamId,
          userId: participantIdentity
        }).catch(() => {});
      }

      console.log(`[LIVEKIT-WEBHOOK] ✅ Participante ${participantIdentity} removido da sala ${roomName}`);

      const io = (global as any).io;
      if (io) {
        io.to(roomName).emit('livekit_participant_left', {
          room: roomName,
          identity: participantIdentity,
          timestamp: new Date().toISOString()
        });
      }
    } catch (dbErr: any) {
      console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao remover participante:', dbErr.message);
    }

    return;
  }

  // ─── participant_connection_aborted ────────────────────────────────────
  if (eventType === 'participant_connection_aborted') {
    if (!roomName || !participant?.identity) return;

    const participantIdentity = participant.identity as string;
    console.log(`[LIVEKIT-WEBHOOK] ⚡ Conexão abortada: ${participantIdentity} da sala ${roomName}`);

    try {
      await StreamParticipant.deleteOne({
        streamId: roomName,
        userId: participantIdentity
      });

      const cleanStreamId = extractStreamId(roomName);
      if (cleanStreamId !== roomName) {
        await StreamParticipant.deleteMany({
          cleanStreamId,
          userId: participantIdentity
        }).catch(() => {});
      }

      console.log(`[LIVEKIT-WEBHOOK] ✅ Participante ${participantIdentity} removido (connection_aborted) da sala ${roomName}`);

      const io = (global as any).io;
      if (io) {
        io.to(roomName).emit('livekit_participant_left', {
          room: roomName,
          identity: participantIdentity,
          reason: 'connection_aborted',
          timestamp: new Date().toISOString()
        });
      }
    } catch (dbErr: any) {
      console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao remover participante (abort):', dbErr.message);
    }

    return;
  }

  // ─── track_published ───────────────────────────────────────────────────
  if (eventType === 'track_published') {
    const trackInfo = (event as any).track || {};
    console.log(`[LIVEKIT-WEBHOOK] 🎙️ Track publicada: ${trackInfo.sid || 'N/A'} (${trackInfo.kind || 'unknown'}) por ${participant?.identity || 'N/A'} em ${roomName || 'N/A'}`);
    return;
  }

  // ─── track_unpublished ─────────────────────────────────────────────────
  if (eventType === 'track_unpublished') {
    const trackInfo = (event as any).track || {};
    console.log(`[LIVEKIT-WEBHOOK] 🔇 Track removida: ${trackInfo.sid || 'N/A'} (${trackInfo.kind || 'unknown'}) por ${participant?.identity || 'N/A'} em ${roomName || 'N/A'}`);
    return;
  }

  // ─── Outros eventos ────────────────────────────────────────────────────
  console.log(`[LIVEKIT-WEBHOOK] ℹ️ Evento não processado: ${eventType}`);
}

/**
 * POST /api/livekit/webhook
 *
 * Recebe eventos do LiveKit Server.
 *
 * Fluxo (conforme docs oficiais):
 *   1. Validar assinatura JWT (WebhookReceiver com API_KEY/API_SECRET)
 *   2. Insert atômico do eventId (dedup lock) — estado "pending"
 *   3. Retornar 2xx IMEDIATAMENTE
 *   4. Processar assíncronamente (fire-and-forget)
 *   5. Atualizar log com sucesso/erro real após processamento
 *
 * Headers esperados:
 *   Authorization: <JWT assinado com a API Secret>
 *   Content-Type: application/webhook+json
 *
 * Docs: https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/#delivery-and-retries
 */
router.post('/webhook', async (req, res) => {
  try {
    // ── 1. Validar Authorization header ──
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.warn('[LIVEKIT-WEBHOOK] ❌ Authorization header ausente');
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    // ── 2. Validar assinatura JWT ──
    let event: any;
    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      event = await webhookReceiver.receive(rawBody, authHeader);
    } catch (err: any) {
      console.warn('[LIVEKIT-WEBHOOK] ❌ Assinatura inválida:', err.message);
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const eventType = event.event as string;
    const eventId = (event as any).id as string;
    const roomName = event.room?.name as string;
    const participant = event.participant as any;

    if (!eventType || !eventId) {
      console.warn('[LIVEKIT-WEBHOOK] ❌ Evento sem event type ou id');
      return res.status(400).json({ error: 'Missing event or id field' });
    }

    console.log(`[LIVEKIT-WEBHOOK] 📨 ${eventType} | id: ${eventId} | sala: ${roomName || 'N/A'}`);

    // ── 3. Idempotência: insert atômico do eventId ──
    //    Unique index garante que só uma entrega passa daqui.
    //    Se o eventId já existe → duplicata → ignorar.
    //    O log é criado com success: false (pending) — será atualizado após processamento.
    let logDoc: any;
    try {
      logDoc = await LiveKitWebhookLog.create({
        eventId,
        event: eventType,
        roomName: roomName || undefined,
        roomSid: event.room?.sid || undefined,
        participantIdentity: participant?.identity || undefined,
        participantName: participant?.name || undefined,
        success: false,
        duplicate: false,
        rawEvent: {
          event: eventType,
          id: eventId,
          room: event.room ? { sid: event.room.sid, name: event.room.name } : undefined,
          participant: participant ? { identity: participant.identity, name: participant.name } : undefined,
          createdAt: (event as any).createdAt,
        },
        processedAt: new Date(),
      });
    } catch (dbErr: any) {
      // Duplicate key error (code 11000) = evento já processado
      if (dbErr.code === 11000) {
        console.log(`[LIVEKIT-WEBHOOK] 🔁 Evento duplicado ignorado: ${eventType} (id: ${eventId})`);
        return res.status(200).json({ received: true, duplicate: true });
      }
      // Outro erro de DB — logar mas retornar 200 (não re-enviar)
      console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao registrar evento:', dbErr.message);
    }

    // ── 4. Retornar 200 IMEDIATAMENTE ──
    res.status(200).json({ received: true });

    // ── 5. Processar assincronamente (fire-and-forget) ──
    //    Após processamento, atualizar o log com success: true ou success: false + error
    processWebhookEvent(event)
      .then(async () => {
        // Processamento OK — atualizar log com sucesso real
        if (logDoc) {
          await LiveKitWebhookLog.updateOne(
            { _id: logDoc._id },
            { $set: { success: true, processedAt: new Date() } }
          ).catch((err: any) =>
            console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao atualizar log (success):', err.message)
          );
        }
      })
      .catch(async (err: any) => {
        // Processamento falhou — registrar erro real no log
        console.error(`[LIVEKIT-WEBHOOK] ❌ Erro no processamento de ${eventType}:`, err.message);
        if (logDoc) {
          await LiveKitWebhookLog.updateOne(
            { _id: logDoc._id },
            { $set: { success: false, error: err.message, processedAt: new Date() } }
          ).catch((logErr: any) =>
            console.error('[LIVEKIT-WEBHOOK] ❌ Erro ao atualizar log (error):', logErr.message)
          );
        }
      });

  } catch (error: any) {
    console.error('[LIVEKIT-WEBHOOK] ❌ Erro geral:', error.message);
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
 *   duplicate     - Filtrar por duplicatas (true/false)
 *   eventId       - Filtrar por ID do evento (UUID)
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
    if (req.query.duplicate !== undefined) {
      filter.duplicate = req.query.duplicate === 'true';
    }
    if (req.query.eventId) {
      filter.eventId = req.query.eventId as string;
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


// POST /api/livekit/chat-token - Gerar token para sala live (unificado: mídia + chat + eventos)
// Host recebe canPublish=true para publicar câmera/microfone.
// Viewers recebem canPublish=false (somente subscribe + data).
router.post('/chat-token', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Usuario nao autenticado' });
        }
        const { streamId } = req.body;
        if (!streamId) {
            return res.status(400).json({ success: false, message: 'streamId e obrigatorio' });
        }
        const liveRoomName = getLiveRoomName(streamId);
        await ensureLiveKitRoom(streamId);

        // Detectar host: consultar Streamer no DB para comparar hostId
        const streamer = await Streamer.findOne({ id: streamId }).lean();
        const isHost = !!streamer && String(streamer.hostId) === String(userId);

        const token = await generateLiveKitToken(
            userId,
            liveRoomName,
            JSON.stringify({ type: 'livechat', streamId }),
            { canPublish: isHost, canPublishData: true, canSubscribe: true }
        );
        const lkUrl = ENV.LIVEKIT_URL || 'wss://livego.store/livekit';
        console.log(`[LIVEKIT-CHAT-TOKEN] streamId=${streamId} userId=${userId} isHost=${isHost}`);
        res.json({ success: true, token, serverUrl: lkUrl, roomName: liveRoomName });
    } catch (error: any) {
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
    const defaultRtmpUrl = `rtmp://${rtmpHost}:${ENV.SRS_RTMP_PORT || 1935}/live/${streamId}`;
    const finalRtmpUrl = rtmpUrl || defaultRtmpUrl;

    console.log('[EGRESS] RTMP Egress → SRS host:', rtmpHost, 'URL:', finalRtmpUrl);

    console.log(`[EGRESS] Iniciando RTMP Egress:`, { roomId, streamId, rtmpUrl: finalRtmpUrl });

    const result = await egressService.startRTMPEgress(roomId, streamId, finalRtmpUrl);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
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
    const result = await egressService.stopEgress(egressId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
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
    const result = await egressService.listEgress();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
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
    const result = await egressService.getEgressStatus(egressId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
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
    const srsHost = ENV.SRS_HOST || 'localhost';
    const srsHttpPort = ENV.SRS_HTTP_PORT || 8080;
    const normalizedId = streamId.startsWith('stream_') ? streamId : `stream_${streamId}`;
    const manifestUrl = `http://${srsHost}:${srsHttpPort}/live/${normalizedId}.m3u8`;

    console.log(`[HLS-VALIDATE] Testando manifest: ${manifestUrl}`);

    // 1) Fetch do .m3u8
    let manifestBody: string;
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
    } catch (fetchErr: any) {
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
    const tsSegments: string[] = [];
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
    } catch (publicErr: any) {
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
  } catch (error: any) {
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

// ═══════════════════════════════════════════════════════════════════
// 📡 ROOM METADATA — Sincronização de estado da sala
// Docs: https://docs.livekit.io/transport/data/state/room-metadata/
// ═══════════════════════════════════════════════════════════════════

// PUT /api/livekit/rooms/:roomName/metadata - Atualizar Room Metadata (APENAS API OFICIAL)
// Docs: https://docs.livekit.io/transport/data/state/room-metadata/
router.put('/rooms/:roomName/metadata', async (req, res) => {
  const { roomName } = req.params;
  const { metadata } = req.body;
  if (!metadata || typeof metadata !== 'object') {
    return res.status(400).json({ error: 'metadata object is required' });
  }
  try {
    if (!(await roomExists(roomName))) {
      return res.status(404).json({ error: 'Room not found on LiveKit server' });
    }
    // updateRoomMetadata() aceita uma string JSON e sincroniza para todos os clientes
    // via RoomEvent.RoomMetadataChanged
    await roomService.updateRoomMetadata(roomName, JSON.stringify(metadata));
    console.log(`[LIVEKIT] Room metadata atualizada: ${roomName}`, JSON.stringify(metadata));
    res.json({ success: true, roomName, metadata });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao atualizar room metadata:', error.message);
    res.status(502).json({ success: false, error: `Falha ao atualizar room metadata: ${error.message}` });
  }
});

// PUT /api/livekit/rooms/:roomName/participants/:identity - Atualizar participante
router.put('/rooms/:roomName/participants/:identity', async (req, res) => {
  const { roomName, identity } = req.params;
  const { metadata, permission } = req.body;
  try {
    if (!(await roomExists(roomName))) {
      return res.status(404).json({ error: 'Room not found on LiveKit server' });
    }
    await roomService.updateParticipant(roomName, identity, {
      metadata: metadata || undefined,
      permission: permission || undefined,
    });
    console.log(`[LIVEKIT] Participante atualizado: ${identity} na sala ${roomName}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao atualizar participante:', error.message);
    res.status(502).json({ success: false, error: `Falha ao atualizar participante: ${error.message}` });
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📡 ROOM CONFIG — Reference by ID pattern
// Docs: https://docs.livekit.io/transport/data/state/room-metadata/#size-limits
// ═══════════════════════════════════════════════════════════════════

// GET /api/livekit/room-config/:configId - Buscar configuração completa da sala
// O configId é um ID real no MongoDB (streamId ou _id).
// Dados grandes ficam no DB, apenas o ID fica no Room Metadata (limite 512 KiB).
router.get('/room-config/:configId', async (req, res) => {
  const { configId } = req.params;
  if (!configId) {
    return res.status(400).json({ error: 'configId is required' });
  }
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }
    const collection = db.collection('streamsessions');
    // Buscar por streamId ou _id (MongoDB não lança erro para _id inválido — apenas não acha)
    const config = await collection.findOne({
      $or: [
        { streamId: configId },
        { _id: configId },
      ],
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
      },
    });
  } catch (error: any) {
    console.error('[LIVEKIT] Erro ao buscar room config:', error.message);
    res.status(502).json({ success: false, error: `Falha ao buscar config: ${error.message}` });
  }
});

export default router;
