import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
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
