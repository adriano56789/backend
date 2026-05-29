import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { BinaryProtocol, EventType } from './services/BinaryProtocol';
import { BackendProtobufService } from './services/protobuf/ProtobufService';
import { mqttBridge } from './services/MqttBridge';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';

let io: SocketIOServer;

export const initSocket = (server: any) => {
    io = new SocketIOServer(server, {
        cors: {
            origin: '*', 
            methods: ['GET', 'POST']
        },
        // Configurações para tratamento de dados binários
        allowEIO3: true,
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
        // Habilitar tratamento de dados binários
        maxHttpBufferSize: 1e8 // 100 MB
    });

    // Middleware de autenticação JWT no Socket.IO
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) return next(new Error('Autenticação necessária: token JWT não enviado'));
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
            socket.data.userId = decoded.id;
            next();
        } catch {
            next(new Error('Token JWT inválido ou expirado'));
        }
    });
    
    // Log de conexões para debug
    io.on('connection', (socket) => {
        console.log(` [SOCKET] Client connected: ${socket.id} (user: ${socket.data.userId})`);
        console.log(` [SOCKET] Transport: ${socket.conn.transport.name}`);
        
        socket.on('disconnect', (reason) => {
            console.log(` [SOCKET] Client disconnected: ${socket.id} - Reason: ${reason}`);
        });
        
        // Eventos binários como BuzzCast
        socket.on('binary_data', async (data) => {
            console.log(` [BINARY] Binary data received from ${socket.id}:`, data);
            
            // Broadcast para outros clientes na mesma sala
            if (data instanceof ArrayBuffer) {
                // Decodificar para saber tipo e stream
                const event = BinaryProtocol.decode(data);
                if (!event) return;

                // ATUALIZAÇÃO DE STATUS: Registrar atividade do usuário sempre que enviar dados binários
                const userId = socket.data.userId;
                if (userId) {
                    try {
                        // 1. Integrar com UserStatusManager para evitar timeout de heartbeat
                        const { default: UserStatusManager } = await import('./middleware/UserStatusManager');
                        const manager = UserStatusManager.getInstance();
                        if (manager) {
                            await manager.handleHeartbeat(userId);
                        }

                        // 2. Garantir persistência no banco (redundância de segurança)
                        const { User, UserStatus } = await import('./models');
                        const now = new Date();

                        // Atualizar UserStatus (Mongoose)
                        await UserStatus.findOneAndUpdate(
                            { userId },
                            { $set: { isOnline: true, lastSeen: now } },
                            { upsert: true }
                        );

                        await User.findOneAndUpdate(
                            { id: userId },
                            { $set: { isOnline: true, lastSeen: now } }
                        );

                        if (event.type === EventType.HEARTBEAT) {
                            console.log(` 💓 [HEARTBEAT] Binary heartbeat processed for ${userId}`);
                        }
                    } catch (err) {
                        console.error(` [SOCKET] Erro ao atualizar status via binary_data:`, err);
                    }
                }

                if (event.streamId) {
                    // Broadcast para todos na stream (exceto remetente)
                    socket.to(event.streamId).emit('binary_data', data);
                    const b64 = Buffer.from(new Uint8Array(data)).toString('base64');
                    mqttBridge.publish(`livego/room/${event.streamId}`, { event: 'binary_data', binaryBase64: b64, _room: event.streamId }).catch(() => {});
                    
                    console.log(` [BINARY] Broadcasted ${EventType[event.type]} to stream ${event.streamId}`);
                }
            }
        });
        
        // Eventos JSON existentes (mantidos para compatibilidade)
        socket.on('send_chat_message', async (data) => {
            console.log(` [CHAT] Chat message received:`, data);
            
            // Codificar usando Protobuf e enviar como binário
            const buffer = BackendProtobufService.encodeChatEvent(
                data.streamId,
                data.userId,
                data.userName,
                data.userAvatar,
                data.message
            );
            
            if (buffer) {
                // Broadcast como binário para todos na stream
                // (io.emit monkey-patched em server.ts publica automaticamente no MQTT)
                io.to(data.streamId).emit('binary_data', buffer);
                
                console.log(` [PROTOBUF] Chat message encoded and broadcasted:`, buffer.length, 'bytes');
            }
        });
        
        socket.on('send_gift', async (data) => {
            console.log(` [GIFT] Gift event received:`, data);
            
            // Adicionar EXP para o usuário que enviou o presente
            try {
                const { UserLevelService } = await import('./services/UserLevelService');
                await UserLevelService.addExp({
                    userId: data.fromUserId,
                    amount: Math.floor(data.giftPrice * data.quantity * 0.1), // 10% do valor do presente em EXP
                    reason: `Gift: ${data.giftName} x${data.quantity}`,
                    streamId: data.streamId
                });
            } catch (error) {
                console.error(' [GIFT] Error adding EXP:', error);
            }
            
            // Codificar usando Protobuf e enviar como binário
            const buffer = BackendProtobufService.encodeGiftEvent(
                data.streamId,
                data.fromUserId,
                data.fromUserName,
                data.fromUserAvatar,
                data.toUserId,
                data.toUserName,
                data.toUserAvatar,
                data.giftId,
                data.giftName,
                data.giftIcon,
                data.giftPrice,
                data.quantity
            );
            
            if (buffer) {
                // Broadcast como binário para todos na stream
                // (io.emit monkey-patched em server.ts publica automaticamente no MQTT)
                io.to(data.streamId).emit('binary_data', buffer);
                
                console.log(` [PROTOBUF] Gift event encoded and broadcasted:`, buffer.length, 'bytes');
            }
        });
        
        socket.on('user_joined', async (data) => {
            console.log(` [USER] User joined received:`, data);
            
            // Adicionar EXP por entrar na stream
            try {
                const { UserLevelService } = await import('./services/UserLevelService');
                await UserLevelService.addExp({
                    userId: data.userId,
                    amount: 5, // 5 EXP por entrar na stream
                    reason: 'Joined stream',
                    streamId: data.streamId
                });
            } catch (error) {
                console.error(' [USER] Error adding EXP:', error);
            }
            
            // Codificar usando Protobuf e enviar como binário
            const buffer = BackendProtobufService.encodeUserJoinedEvent(
                data.streamId,
                data.userId,
                data.userName,
                data.userAvatar,
                data.userLevel
            );
            
            if (buffer) {
                // Broadcast como binário para todos na stream
                // (io.emit monkey-patched em server.ts publica automaticamente no MQTT)
                io.to(data.streamId).emit('binary_data', buffer);
                
                console.log(` [PROTOBUF] User joined encoded and broadcasted:`, buffer.length, 'bytes');
            }
        });
        
        // Eventos de seguimento
        socket.on('follow_user', async (data: { followerId: string; followedId: string; streamId?: string }) => {
            try {
                const { FollowersService } = await import('./services/FollowersService');
                const result = await FollowersService.followUser({
                    followerId: data.followerId,
                    followingId: data.followedId, // Corrigir nome do parâmetro
                    streamId: data.streamId
                });
                
                // Notificar sobre novo follow
                io.emit('follow_notification', {
                    type: 'follow',
                    followerId: data.followerId,
                    followedId: data.followedId,
                    isFriendship: result.isFriendship,
                    streamId: data.streamId,
                    timestamp: Date.now()
                });
                
                console.log(`👤 [FOLLOW] User ${data.followerId} followed ${data.followedId}`);
            } catch (error) {
                console.error('❌ [FOLLOW] Error processing follow:', error);
            }
        });
        
        socket.on('unfollow_user', async (data: { followerId: string; followedId: string }) => {
            try {
                const { FollowersService } = await import('./services/FollowersService');
                await FollowersService.unfollowUser({
                    followerId: data.followerId,
                    followingId: data.followedId // Corrigir nome do parâmetro
                });
                
                // Notificar sobre unfollow
                io.emit('follow_notification', {
                    type: 'unfollow',
                    followerId: data.followerId,
                    followedId: data.followedId,
                    timestamp: Date.now()
                });
                
                console.log(`👤 [FOLLOW] User ${data.followerId} unfollowed ${data.followedId}`);
            } catch (error) {
                console.error('❌ [FOLLOW] Error processing unfollow:', error);
            }
        });
        
        // Eventos de amizade
        socket.on('friendship_request', async (data: { fromUserId: string; toUserId: string; message?: string }) => {
            try {
                const { FriendshipService } = await import('./services/FriendshipService');
                const request = await FriendshipService.createFriendshipRequest(data);
                
                // Notificar destinatário sobre solicitação
                io.to(data.toUserId).emit('friendship_notification', {
                    type: 'request_received',
                    request,
                    timestamp: Date.now()
                });
                
                console.log(` [FRIENDSHIP] Friendship request: ${data.fromUserId} -> ${data.toUserId}`);
            } catch (error) {
                console.error(' [FRIENDSHIP] Error creating friendship request:', error);
            }
        });
        
        socket.on('friendship_accept', async (data: { friendshipId: string; userId: string }) => {
            try {
                const { FriendshipService } = await import('./services/FriendshipService');
                const friendship = await FriendshipService.acceptFriendshipRequest(data.friendshipId, data.userId);
                
                // Notificar ambos os usuários sobre nova amizade
                io.emit('friendship_notification', {
                    type: 'friendship_created',
                    friendship,
                    timestamp: Date.now()
                });
                
                console.log(` [FRIENDSHIP] Friendship accepted: ${data.friendshipId}`);
            } catch (error) {
                console.error(' [FRIENDSHIP] Error accepting friendship:', error);
            }
        });
    });
    
    return io;
};

export const getIO = (): SocketIOServer => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
