"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.egressClient = exports.roomService = exports.livekitUrl = exports.livekitServerUrl = void 0;
exports.generateLiveKitToken = generateLiveKitToken;
exports.roomExists = roomExists;
exports.getLiveRoomName = getLiveRoomName;
exports.ensureLiveKitRoom = ensureLiveKitRoom;
exports.startLiveEgress = startLiveEgress;
exports.stopLiveEgress = stopLiveEgress;
exports.sendLiveKitChatMessage = sendLiveKitChatMessage;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const protocol_1 = require("@livekit/protocol");
const env_1 = require("../config/env");
// LiveKit server URL (HTTP API)
exports.livekitServerUrl = env_1.ENV.LIVEKIT_SERVER_URL || `https://${env_1.ENV.LIVEKIT_URL?.replace('wss://', '').replace('ws://', '') || 'sfu.livego.store'}`;
// LiveKit WebSocket URL (para o frontend conectar)
exports.livekitUrl = env_1.ENV.LIVEKIT_URL;
// RoomServiceClient singleton — reutilizado por todas as rotas
exports.roomService = new livekit_server_sdk_1.RoomServiceClient(exports.livekitServerUrl, env_1.ENV.LIVEKIT_API_KEY, env_1.ENV.LIVEKIT_API_SECRET);
// EgressClient singleton — usado para iniciar/parar Egress para cada transmissão
exports.egressClient = new livekit_server_sdk_1.EgressClient(exports.livekitServerUrl, env_1.ENV.LIVEKIT_API_KEY, env_1.ENV.LIVEKIT_API_SECRET);
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
async function roomExists(roomName) {
    try {
        const rooms = await exports.roomService.listRooms();
        return rooms.some(r => r.name === roomName);
    }
    catch (_) {
        return false;
    }
}
/**
 * Gera o nome da sala LiveKit para uma transmissão ao vivo.
 */
function getLiveRoomName(streamId) {
    return `live_${streamId}`;
}
/**
 * Garante que uma sala LiveKit exista para a transmissão ao vivo.
 * Cria a sala se não existir.
 */
async function ensureLiveKitRoom(streamId) {
    const roomName = getLiveRoomName(streamId);
    if (!(await roomExists(roomName))) {
        await exports.roomService.createRoom({
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
async function startLiveEgress(streamId) {
    try {
        const roomName = getLiveRoomName(streamId);
        const srsRtmpUrl = `rtmp://srs:1935/live/${streamId}`;
        await exports.egressClient.startRoomCompositeEgress(roomName, {
            stream: new protocol_1.StreamOutput({
                urls: [srsRtmpUrl],
                protocol: protocol_1.StreamProtocol.RTMP,
            }),
        }, {
            layout: 'speaker',
            encodingOptions: protocol_1.EncodingOptionsPreset.H264_720P_30,
        });
        console.log(`[EGRESS] Egress iniciado para room ${roomName} -> ${srsRtmpUrl}`);
    }
    catch (err) {
        console.warn(`[EGRESS] Falha ao iniciar egress para ${streamId}:`, err.message);
    }
}
/**
 * Para todos os Egress ativos de uma transmissão ao vivo.
 */
async function stopLiveEgress(streamId) {
    try {
        const roomName = getLiveRoomName(streamId);
        const egressList = await exports.egressClient.listEgress({ roomName, active: true });
        for (const egress of egressList) {
            if (egress.egressId) {
                await exports.egressClient.stopEgress(egress.egressId);
                console.log(`[EGRESS] Egress parado: ${egress.egressId} para room ${roomName}`);
            }
        }
        if (egressList.length === 0) {
            console.log(`[EGRESS] Nenhum egress ativo encontrado para room ${roomName}`);
        }
    }
    catch (err) {
        console.warn(`[EGRESS] Falha ao parar egress para ${streamId}:`, err.message);
    }
}
/**
 * Envia uma mensagem de chat para todos os participantes de uma sala LiveKit.
 * Usa DataPacket com tópico 'livechat' e entrega confiável.
 */
async function sendLiveKitChatMessage(streamId, payload) {
    try {
        const roomName = getLiveRoomName(streamId);
        const data = new TextEncoder().encode(JSON.stringify(payload));
        await exports.roomService.sendData(roomName, data, protocol_1.DataPacket_Kind.RELIABLE, {
            topic: 'livechat',
        });
        console.log(`[LIVEKIT-CHAT] Mensagem enviada para sala ${roomName}`);
    }
    catch (err) {
        // Se a sala não existir, criar e tentar novamente
        if (err.message?.includes('not found') || err.message?.includes('does not exist')) {
            try {
                const roomName = getLiveRoomName(streamId);
                await exports.roomService.createRoom({
                    name: roomName,
                    emptyTimeout: 600,
                    maxParticipants: 200,
                });
                const data = new TextEncoder().encode(JSON.stringify(payload));
                await exports.roomService.sendData(roomName, data, protocol_1.DataPacket_Kind.RELIABLE, {
                    topic: 'livechat',
                });
                console.log(`[LIVEKIT-CHAT] Sala criada e mensagem enviada: ${roomName}`);
            }
            catch (retryErr) {
                console.warn('[LIVEKIT-CHAT] Erro ao enviar mensagem (após criar sala):', retryErr.message);
            }
        }
        else {
            console.warn('[LIVEKIT-CHAT] Erro ao enviar mensagem:', err.message);
        }
    }
}
