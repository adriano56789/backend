import { AccessToken, RoomServiceClient, EgressClient } from 'livekit-server-sdk';
import { DataPacket_Kind, EncodingOptionsPreset, StreamOutput, StreamProtocol } from '@livekit/protocol';
import { ENV } from '../config/env';

// LiveKit server URL (HTTP API)
export const livekitServerUrl = ENV.LIVEKIT_SERVER_URL || `https://${ENV.LIVEKIT_URL?.replace('wss://', '').replace('ws://', '') || 'sfu.livego.store'}`;

// LiveKit WebSocket URL (para o frontend conectar)
export const livekitUrl = ENV.LIVEKIT_URL;

// RoomServiceClient singleton — reutilizado por todas as rotas
export const roomService = new RoomServiceClient(
  livekitServerUrl,
  ENV.LIVEKIT_API_KEY,
  ENV.LIVEKIT_API_SECRET
);

// EgressClient singleton — usado para iniciar/parar Egress para cada transmissão
export const egressClient = new EgressClient(
  livekitServerUrl,
  ENV.LIVEKIT_API_KEY,
  ENV.LIVEKIT_API_SECRET
);

/**
 * Gera um token JWT de acesso ao LiveKit.
 *
 * @param identity  - ID do usuário (ex: userId)
 * @param room      - Nome da sala no LiveKit
 * @param metadata  - Metadados opcionais (JSON string)
 * @param extraGrants - Grants adicionais (ex: { canPublish: true })
 */
export async function generateLiveKitToken(
  identity: string,
  room: string,
  metadata?: string,
  extraGrants?: Record<string, boolean>
): Promise<string> {
  const at = new AccessToken(ENV.LIVEKIT_API_KEY, ENV.LIVEKIT_API_SECRET, {
    identity,
    ttl: '6h',
    metadata,
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublishData: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
    // Para salas de live principal, a publicação de mídia é via WHIP/SRS, não LiveKit.
    // Garantir que canPublish seja false para todos os participantes na sala principal.
    canPublish: room.startsWith("live_") ? false : (extraGrants?.canPublish ?? false),
    ...extraGrants,
  });
  return at.toJwt();
}

/**
 * Verifica se uma sala existe no LiveKit.
 * Usa listRooms() e filtra pelo nome (mais compatível com a SDK).
 */
export async function roomExists(roomName: string): Promise<boolean> {
  try {
    const rooms = await roomService.listRooms();
    return rooms.some(r => r.name === roomName);
  } catch (_) {
    return false;
  }
}

/**
 * Gera o nome da sala LiveKit para uma transmissão ao vivo.
 */
export function getLiveRoomName(streamId: string): string {
  return `live_${streamId}`;
}

/**
 * Garante que uma sala LiveKit exista para a transmissão ao vivo.
 * Cria a sala se não existir.
 */
export async function ensureLiveKitRoom(streamId: string): Promise<string> {
  const roomName = getLiveRoomName(streamId);
  if (!(await roomExists(roomName))) {
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 600,
      maxParticipants: 200,
    });
    console.log(`[LIVEKIT-CHAT] Sala criada: ${roomName}`);
  }
  return roomName;
}

/**
 * Envia uma mensagem de chat para todos os participantes de uma sala LiveKit.
 * Usa DataPacket com tópico 'livechat' e entrega confiável.
 */
/**
 * Inicia o Egress para uma transmissão ao vivo.
 * Envia o áudio/vídeo da sala LiveKit para o SRS via RTMP, que gera HLS.
 */
export async function startLiveEgress(streamId: string): Promise<void> {
  try {
    const roomName = getLiveRoomName(streamId);
    const srsRtmpUrl = `rtmp://srs:1935/live/${streamId}`;

    await egressClient.startRoomCompositeEgress(roomName, {
      stream: new StreamOutput({
        urls: [srsRtmpUrl],
        protocol: StreamProtocol.RTMP,
      }),
    }, {
      layout: 'speaker',
      encodingOptions: EncodingOptionsPreset.H264_720P_30,
    });

    console.log(`[EGRESS] Egress iniciado para room ${roomName} -> ${srsRtmpUrl}`);
  } catch (err: any) {
    console.warn(`[EGRESS] Falha ao iniciar egress para ${streamId}:`, err.message);
  }
}

/**
 * Para todos os Egress ativos de uma transmissão ao vivo.
 */
export async function stopLiveEgress(streamId: string): Promise<void> {
  try {
    const roomName = getLiveRoomName(streamId);
    const egressList = await egressClient.listEgress({ roomName, active: true });

    for (const egress of egressList) {
      if (egress.egressId) {
        await egressClient.stopEgress(egress.egressId);
        console.log(`[EGRESS] Egress parado: ${egress.egressId} para room ${roomName}`);
      }
    }

    if (egressList.length === 0) {
      console.log(`[EGRESS] Nenhum egress ativo encontrado para room ${roomName}`);
    }
  } catch (err: any) {
    console.warn(`[EGRESS] Falha ao parar egress para ${streamId}:`, err.message);
  }
}

/**
 * Envia uma mensagem de chat para todos os participantes de uma sala LiveKit.
 * Usa DataPacket com tópico 'livechat' e entrega confiável.
 */
export async function sendLiveKitChatMessage(
  streamId: string,
  payload: Record<string, any>
): Promise<void> {
  try {
    const roomName = getLiveRoomName(streamId);
    const data = new TextEncoder().encode(JSON.stringify(payload));
    await roomService.sendData(roomName, data, DataPacket_Kind.RELIABLE, {
      topic: 'livechat',
    });
    console.log(`[LIVEKIT-CHAT] Mensagem enviada para sala ${roomName}`);
  } catch (err: any) {
    // Se a sala não existir, criar e tentar novamente
    if (err.message?.includes('not found') || err.message?.includes('does not exist')) {
      try {
        const roomName = getLiveRoomName(streamId);
        await roomService.createRoom({
          name: roomName,
          emptyTimeout: 600,
          maxParticipants: 200,
        });
        const data = new TextEncoder().encode(JSON.stringify(payload));
        await roomService.sendData(roomName, data, DataPacket_Kind.RELIABLE, {
          topic: 'livechat',
        });
        console.log(`[LIVEKIT-CHAT] Sala criada e mensagem enviada: ${roomName}`);
      } catch (retryErr: any) {
        console.warn('[LIVEKIT-CHAT] Erro ao enviar mensagem (após criar sala):', retryErr.message);
      }
    } else {
      console.warn('[LIVEKIT-CHAT] Erro ao enviar mensagem:', err.message);
    }
  }
}
