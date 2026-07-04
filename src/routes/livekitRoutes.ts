import express from 'express';
import { AccessToken, IngressClient, RoomServiceClient } from 'livekit-server-sdk';
import { ENV } from '../config/env';

const router = express.Router();

// LiveKit Server SDK client
const livekitServerUrl = ENV.LIVEKIT_SERVER_URL || `https://${ENV.LIVEKIT_URL?.replace('wss://', '').replace('ws://', '') || 'sfu.livego.store'}`;
const roomService = new RoomServiceClient(
  livekitServerUrl,
  ENV.LIVEKIT_API_KEY,
  ENV.LIVEKIT_API_SECRET
);

// Helper: gerar token de acesso LiveKit
async function generateLiveKitToken(identity: string, room: string, metadata?: string): Promise<string> {
  const at = new AccessToken(ENV.LIVEKIT_API_KEY, ENV.LIVEKIT_API_SECRET, {
    identity,
    ttl: '6h',
    metadata,
  });
  at.addGrant({ roomJoin: true, room });
  return at.toJwt();
}

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

export default router;
