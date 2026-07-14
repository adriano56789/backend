"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomService = exports.livekitUrl = exports.livekitServerUrl = void 0;
exports.generateLiveKitToken = generateLiveKitToken;
exports.roomExists = roomExists;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const env_1 = require("../config/env");
// LiveKit server URL (HTTP API)
exports.livekitServerUrl = env_1.ENV.LIVEKIT_SERVER_URL || `https://${env_1.ENV.LIVEKIT_URL?.replace('wss://', '').replace('ws://', '') || 'sfu.livego.store'}`;
// LiveKit WebSocket URL (para o frontend conectar)
exports.livekitUrl = env_1.ENV.LIVEKIT_URL;
// RoomServiceClient singleton — reutilizado por todas as rotas
exports.roomService = new livekit_server_sdk_1.RoomServiceClient(exports.livekitServerUrl, env_1.ENV.LIVEKIT_API_KEY, env_1.ENV.LIVEKIT_API_SECRET);
/**
 * Gera um token JWT de acesso ao LiveKit.
 *
 * @param identity  - ID do usuário (ex: userId)
 * @param room      - Nome da sala no LiveKit
 * @param metadata  - Metadados opcionais (JSON string)
 * @param extraGrants - Grants adicionais (ex: { canPublish: true })
 */
async function generateLiveKitToken(identity, room, metadata, extraGrants) {
    const at = new livekit_server_sdk_1.AccessToken(env_1.ENV.LIVEKIT_API_KEY, env_1.ENV.LIVEKIT_API_SECRET, {
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
async function roomExists(roomName) {
    try {
        const rooms = await exports.roomService.listRooms();
        return rooms.some(r => r.name === roomName);
    }
    catch (_) {
        return false;
    }
}
