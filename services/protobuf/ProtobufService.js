"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackendProtobufService = void 0;
exports.initProtobuf = initProtobuf;
const protobuf = __importStar(require("protobufjs"));
const path = __importStar(require("path"));
// Carregar o arquivo .proto
let root;
let LiveEvent;
let ChatEvent;
let GiftEvent;
let UserJoinedEvent;
let StreamStatusEvent;
let StreamInfoEvent;
let JoinStreamEvent;
// Inicializar o Protobuf
async function initProtobuf() {
    try {
        const protoPath = path.join(__dirname, '../../../protobuf/livego.proto');
        root = await protobuf.load(protoPath);
        LiveEvent = root.lookupType('livego.LiveEvent');
        ChatEvent = root.lookupType('livego.ChatEvent');
        GiftEvent = root.lookupType('livego.GiftEvent');
        UserJoinedEvent = root.lookupType('livego.UserJoinedEvent');
        StreamStatusEvent = root.lookupType('livego.StreamStatusEvent');
        StreamInfoEvent = root.lookupType('livego.StreamInfoEvent');
        JoinStreamEvent = root.lookupType('livego.JoinStreamEvent');
        console.log('✅ [BACKEND-PROTOBUF] Protocol buffers loaded successfully');
    }
    catch (error) {
        console.error('❌ [BACKEND-PROTOBUF] Error loading protocol buffers:', error);
    }
}
// Classe de serviço para Protobuf no Backend
class BackendProtobufService {
    static async init() {
        if (!this.initialized) {
            await initProtobuf();
            this.initialized = true;
        }
    }
    // Codificar evento de chat para binário
    static encodeChatEvent(streamId, userId, userName, userAvatar, message) {
        try {
            const chatEvent = {
                chat: {
                    base: {
                        type: 'chat',
                        timestamp: Date.now(),
                        stream_id: streamId
                    },
                    chat: {
                        user_id: userId,
                        user_name: userName,
                        user_avatar: userAvatar,
                        message: message,
                        timestamp: Date.now()
                    }
                }
            };
            const errMsg = ChatEvent.verify(chatEvent);
            if (errMsg) {
                console.error('❌ [BACKEND-PROTOBUF] ChatEvent verification failed:', errMsg);
                return null;
            }
            const protobufMessage = ChatEvent.create(chatEvent);
            const buffer = ChatEvent.encode(protobufMessage).finish();
            console.log(`📦 [BACKEND-PROTOBUF] Chat event encoded:`, buffer.length, 'bytes');
            return Buffer.from(buffer);
        }
        catch (error) {
            console.error('❌ [BACKEND-PROTOBUF] Error encoding chat event:', error);
            return null;
        }
    }
    // Codificar evento de presente para binário
    static encodeGiftEvent(streamId, fromUserId, fromUserName, fromUserAvatar, toUserId, toUserName, toUserAvatar, giftId, giftName, giftIcon, giftPrice, quantity = 1) {
        try {
            const giftEvent = {
                gift: {
                    base: {
                        type: 'gift',
                        timestamp: Date.now(),
                        stream_id: streamId
                    },
                    from_user: {
                        user_id: fromUserId,
                        user_name: fromUserName,
                        user_avatar: fromUserAvatar,
                        user_level: 1
                    },
                    to_user: {
                        user_id: toUserId,
                        user_name: toUserName,
                        user_avatar: toUserAvatar,
                        user_level: 1
                    },
                    gift: {
                        gift_id: giftId,
                        gift_name: giftName,
                        gift_icon: giftIcon,
                        gift_price: giftPrice,
                        quantity: quantity,
                        total_value: giftPrice * quantity
                    },
                    timestamp: Date.now()
                }
            };
            const errMsg = GiftEvent.verify(giftEvent);
            if (errMsg) {
                console.error('❌ [BACKEND-PROTOBUF] GiftEvent verification failed:', errMsg);
                return null;
            }
            const protobufMessage = GiftEvent.create(giftEvent);
            const buffer = GiftEvent.encode(protobufMessage).finish();
            console.log(`📦 [BACKEND-PROTOBUF] Gift event encoded:`, buffer.length, 'bytes');
            return Buffer.from(buffer);
        }
        catch (error) {
            console.error('❌ [BACKEND-PROTOBUF] Error encoding gift event:', error);
            return null;
        }
    }
    // Codificar evento de entrada de usuário para binário
    static encodeUserJoinedEvent(streamId, userId, userName, userAvatar, userLevel = 1) {
        try {
            const userJoinedEvent = {
                user_joined: {
                    base: {
                        type: 'user_joined',
                        timestamp: Date.now(),
                        stream_id: streamId
                    },
                    user: {
                        user_id: userId,
                        user_name: userName,
                        user_avatar: userAvatar,
                        user_level: userLevel
                    },
                    timestamp: Date.now()
                }
            };
            const errMsg = UserJoinedEvent.verify(userJoinedEvent);
            if (errMsg) {
                console.error('❌ [BACKEND-PROTOBUF] UserJoinedEvent verification failed:', errMsg);
                return null;
            }
            const protobufMessage = UserJoinedEvent.create(userJoinedEvent);
            const buffer = UserJoinedEvent.encode(protobufMessage).finish();
            console.log(`📦 [BACKEND-PROTOBUF] User joined event encoded:`, buffer.length, 'bytes');
            return Buffer.from(buffer);
        }
        catch (error) {
            console.error('❌ [BACKEND-PROTOBUF] Error encoding user joined event:', error);
            return null;
        }
    }
    // Codificar evento de status da stream para binário
    static encodeStreamStatusEvent(streamId, status, viewers = 0, hostId = '', hostName = '') {
        try {
            const streamStatusEvent = {
                stream_status: {
                    base: {
                        type: 'stream_status',
                        timestamp: Date.now(),
                        stream_id: streamId
                    },
                    status: {
                        status: status,
                        viewers: viewers,
                        host_id: hostId,
                        host_name: hostName
                    },
                    timestamp: Date.now()
                }
            };
            const errMsg = StreamStatusEvent.verify(streamStatusEvent);
            if (errMsg) {
                console.error('❌ [BACKEND-PROTOBUF] StreamStatusEvent verification failed:', errMsg);
                return null;
            }
            const protobufMessage = StreamStatusEvent.create(streamStatusEvent);
            const buffer = StreamStatusEvent.encode(protobufMessage).finish();
            console.log(`📦 [BACKEND-PROTOBUF] Stream status event encoded:`, buffer.length, 'bytes');
            return Buffer.from(buffer);
        }
        catch (error) {
            console.error('❌ [BACKEND-PROTOBUF] Error encoding stream status event:', error);
            return null;
        }
    }
    // Codificar evento de join_stream para binário
    static encodeJoinStreamEvent(streamId, userId) {
        try {
            const joinStreamEvent = {
                join_stream: {
                    base: {
                        type: 'join_stream',
                        timestamp: Date.now(),
                        stream_id: streamId
                    },
                    user_id: userId,
                    timestamp: Date.now()
                }
            };
            const errMsg = JoinStreamEvent.verify(joinStreamEvent);
            if (errMsg) {
                console.error('❌ [BACKEND-PROTOBUF] JoinStreamEvent verification failed:', errMsg);
                return null;
            }
            const protobufMessage = JoinStreamEvent.create(joinStreamEvent);
            const buffer = JoinStreamEvent.encode(protobufMessage).finish();
            console.log(`📦 [BACKEND-PROTOBUF] Join stream event encoded:`, buffer.length, 'bytes');
            return Buffer.from(buffer);
        }
        catch (error) {
            console.error('❌ [BACKEND-PROTOBUF] Error encoding join stream event:', error);
            return null;
        }
    }
    static encodeStreamInfoEvent(streamId, title, description, hostId, hostName, hostAvatar, viewers, coins, status) {
        try {
            const streamInfoEvent = {
                stream_info: {
                    base: {
                        type: 'stream_info',
                        timestamp: Date.now(),
                        stream_id: streamId
                    },
                    info: {
                        stream_id: streamId,
                        stream_title: title,
                        stream_description: description,
                        host_id: hostId,
                        host_name: hostName,
                        host_avatar: hostAvatar,
                        viewers: viewers,
                        coins: coins,
                        status: status,
                        start_time: Date.now()
                    },
                    timestamp: Date.now()
                }
            };
            const errMsg = StreamInfoEvent.verify(streamInfoEvent);
            if (errMsg) {
                console.error('❌ [BACKEND-PROTOBUF] StreamInfoEvent verification failed:', errMsg);
                return null;
            }
            const protobufMessage = StreamInfoEvent.create(streamInfoEvent);
            const buffer = StreamInfoEvent.encode(protobufMessage).finish();
            console.log(`📦 [BACKEND-PROTOBUF] Stream info event encoded:`, buffer.length, 'bytes');
            return Buffer.from(buffer);
        }
        catch (error) {
            console.error('❌ [BACKEND-PROTOBUF] Error encoding stream info event:', error);
            return null;
        }
    }
    // Converter buffer para HEX (para debug)
    static bufferToHex(buffer) {
        return buffer.toString('hex').toUpperCase().match(/.{2}/g)?.join(' ') || '';
    }
    // Converter HEX para buffer
    static hexToBuffer(hex) {
        const hexString = hex.replace(/\s/g, '');
        const buffer = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
            buffer[i / 2] = parseInt(hexString.substr(i, 2), 16);
        }
        return buffer;
    }
    // Decodificar evento binário para objeto
    static decodeEvent(buffer) {
        try {
            // Tentar decodificar como LiveEvent principal
            try {
                const message = LiveEvent.decode(buffer);
                const event = LiveEvent.toObject(message);
                return event;
            }
            catch (e) {
                // Se falhar, tentar decodificar cada tipo específico
                const events = [
                    { type: 'chat', decoder: ChatEvent, eventName: 'ChatEvent' },
                    { type: 'gift', decoder: GiftEvent, eventName: 'GiftEvent' },
                    { type: 'user_joined', decoder: UserJoinedEvent, eventName: 'UserJoinedEvent' },
                    { type: 'stream_status', decoder: StreamStatusEvent, eventName: 'StreamStatusEvent' },
                    { type: 'stream_info', decoder: StreamInfoEvent, eventName: 'StreamInfoEvent' },
                    { type: 'join_stream', decoder: JoinStreamEvent, eventName: 'JoinStreamEvent' }
                ];
                for (const eventConfig of events) {
                    try {
                        const message = eventConfig.decoder.decode(buffer);
                        const event = eventConfig.decoder.toObject(message);
                        console.log(`📦 [BACKEND-PROTOBUF] ${eventConfig.eventName} decoded:`, event);
                        return event;
                    }
                    catch (innerError) {
                        // Continuar tentando o próximo tipo
                    }
                }
                console.error('❌ [BACKEND-PROTOBUF] Unable to decode event with any known type');
                return null;
            }
        }
        catch (error) {
            console.error('❌ [BACKEND-PROTOBUF] Error decoding event:', error);
            return null;
        }
    }
}
exports.BackendProtobufService = BackendProtobufService;
BackendProtobufService.initialized = false;
