import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { BinaryProtocol, EventType } from './services/BinaryProtocol';
import { BackendProtobufService } from './services/protobuf/ProtobufService';
import { mqttBridge } from './services/MqttBridge';
import { ENV } from './config/env';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';

let io: SocketIOServer;

export const initSocket = (server: any) => {
    const allowedOrigins = ENV.CORS_ORIGIN.split(',').map(o => o.trim());

    io = new SocketIOServer(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
                if (isLocal || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            },
            methods: ['GET', 'POST'],
            credentials: true
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

        // Auto-join user to their personal room for targeted events (chat, notifications, etc.)
        socket.join(`user_${socket.data.userId}`);

        // Marcar como online no banco imediatamente na conexão
        const userId = socket.data.userId;
        if (userId) {
            import('./models').then(({ User, UserStatus }) => {
                const now = new Date();
                UserStatus.findOneAndUpdate(
                    { userId },
                    { $set: { isOnline: true, lastSeen: now } },
                    { upsert: true }
                ).catch(() => {});
                User.findOneAndUpdate(
                    { id: userId },
                    { $set: { isOnline: true, lastSeen: now } }
                ).catch(() => {});
            });

            // Buscar nome do usuário e notificar presença
            import('./models').then(({ User }) => {
                User.findOne({ id: userId }).select('name').lean().then(user => {
                    const userName = (user as any)?.name || userId;
                    import('./services/PresenceService').then(({ PresenceService }) => {
                        PresenceService.userEnteredApp(userId, userName);
                    });
                });
            });
        }
        
        socket.on('disconnect', (reason) => {
            console.log(` [SOCKET] Client disconnected: ${socket.id} - Reason: ${reason}`);

            // Notificar saída do aplicativo
            if (userId) {
                import('./models').then(({ User }) => {
                    User.findOne({ id: userId }).select('name').lean().then(user => {
                        const userName = (user as any)?.name || userId;
                        import('./services/PresenceService').then(({ PresenceService }) => {
                            PresenceService.userLeftApp(userId, userName);
                        });
                    });
                });
            }
        });

        // Evento de abertura do aplicativo (enviado pelo frontend ao abrir o app)
        socket.on('user_app_open', async () => {
            if (userId) {
                const { User } = await import('./models');
                const user = await User.findOne({ id: userId }).select('name isNewUser newUserNotified').lean();
                const userName = (user as any)?.name || userId;
                const { PresenceService } = await import('./services/PresenceService');
                await PresenceService.userEnteredApp(userId, userName);

                // Se for novo usuário e ainda não foi notificado, dispara a notificação
                if ((user as any)?.isNewUser && !(user as any)?.newUserNotified) {
                    const { NewUserNotificationService } = await import('./services/NewUserNotificationService');
                    await NewUserNotificationService.notifyNewUser(userId);
                }
            }
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

                // Processar eventos de presente para ganho de EXP
                if (event.type === EventType.GIFT_SENT && event.data) {
                    try {
                        const giftData = event.data;
                        const { UserLevelService } = await import('./services/UserLevelService');
                        const expResult = await UserLevelService.addExp({
                            userId: giftData.fromUserId,
                            amount: Math.max(1, Math.floor(giftData.giftPrice * giftData.quantity)),
                            reason: `Gift: ${giftData.giftName} x${giftData.quantity}`,
                            streamId: event.streamId
                        });
                        const userRoom = `user_${giftData.fromUserId}`;
                        io.to(userRoom).emit('level_updated', {
                            userId: giftData.fromUserId,
                            currentLevel: expResult.currentLevel,
                            currentExp: expResult.currentExp,
                            expForNextLevel: expResult.expForNextLevel,
                            totalExp: expResult.totalExp,
                            progress: expResult.progress,
                            timestamp: new Date().toISOString()
                        });
                        if (expResult.leveledUp) {
                            io.to(userRoom).emit('level_up', {
                                userId: giftData.fromUserId,
                                newLevel: expResult.currentLevel,
                                newLevels: expResult.newLevels,
                                timestamp: new Date().toISOString()
                            });
                        }
                    } catch (err) {
                        console.error(' [BINARY] Error processing gift EXP:', err);
                    }
                }
            }
        });
        
        // Eventos JSON existentes (mantidos para compatibilidade)
        socket.on('send_chat_message', async (data) => {
            console.log(` [CHAT] Chat message received:`, data);
            
            // Garantir que o remetente está na sala da stream
            if (data.streamId) {
                socket.join(data.streamId);
            }
            
            // 1. Persistir mensagem no LiveMessage
            try {
                const { LiveMessage } = await import('./models/index');
                await LiveMessage.create({
                    streamId: data.streamId,
                    userId: data.userId,
                    userName: data.userName || 'Usuário',
                    avatarUrl: data.userAvatar || '',
                    level: data.userLevel || 1,
                    text: data.message || '',
                    timestamp: new Date()
                }).catch(err => console.warn('[CHAT] Erro ao persistir live_message:', err));
            } catch (err) {
                console.warn('[CHAT] Erro ao importar LiveMessage:', err);
            }
            
            // 2. Emitir evento JSON live_message para todos na stream (incluindo remetente)
            const messagePayload = {
                userId: data.userId,
                userName: data.userName || 'Usuário',
                avatarUrl: data.userAvatar || '',
                level: data.userLevel || 1,
                text: data.message || '',
                timestamp: new Date().toISOString()
            };
            io.to(data.streamId).emit('live_message', messagePayload);
            
            // 3. Codificar usando Protobuf e enviar como binário (para compatibilidade)
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
            
            console.log(` [CHAT] live_message JSON broadcasted to stream ${data.streamId}`);
        });
        
        socket.on('send_gift', async (data) => {
            console.log(`🎁 [GIFT] Evento recebido: Presente ${data.giftName} (x${data.quantity}) de ${data.fromUserId} para ${data.toUserId}`);
            
            // Garantir que o remetente está na sala da stream
            if (data.streamId) {
                socket.join(data.streamId);
            }
            
            // Adicionar EXP para o usuário que enviou o presente
            try {
                const { UserLevelService } = await import('./services/UserLevelService');
                console.log(`📤 [GIFT] Enviando update de EXP para o banco (User ${data.fromUserId})...`);
                const expResult = await UserLevelService.addExp({
                    userId: data.fromUserId,
                    amount: Math.max(1, Math.floor(data.giftPrice * data.quantity)),
                    reason: `Gift: ${data.giftName} x${data.quantity}`,
                    streamId: data.streamId
                });
                console.log(`✅ [GIFT] EXP persistido. Novo total: ${expResult.totalExp}`);
                // Emitir atualização de nível em tempo real
                const userRoom = `user_${data.fromUserId}`;
                io.to(userRoom).emit('level_updated', {
                    userId: data.fromUserId,
                    currentLevel: expResult.currentLevel,
                    currentExp: expResult.currentExp,
                    expForNextLevel: expResult.expForNextLevel,
                    totalExp: expResult.totalExp,
                    progress: expResult.progress,
                    timestamp: new Date().toISOString()
                });
                if (expResult.leveledUp) {
                    io.to(userRoom).emit('level_up', {
                        userId: data.fromUserId,
                        newLevel: expResult.currentLevel,
                        newLevels: expResult.newLevels,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error(' [GIFT] Error adding EXP:', error);
            }
            
            // Atualizar saldo de diamantes, enviados e receptores em tempo real
            try {
                const totalValue = Math.max(1, Math.floor((data.giftPrice || 0) * (data.quantity || 1)));
                if (data.fromUserId && totalValue > 0) {
                    const { User } = await import('./models/index');
                    // Deduzir diamantes e incrementar enviados
                    console.log(`📤 [GIFT] Deduzindo ${totalValue} diamantes do remetente ${data.fromUserId} (Usando nome/id)...`);
                    const senderUpdate = await User.findOneAndUpdate(
                        { id: data.fromUserId },
                        { $inc: { diamonds: -totalValue, enviados: totalValue } },
                        { returnDocument: 'after' }
                    );

                    if (!senderUpdate) {
                        console.error(`❌ [GIFT] REMETENTE NÃO ENCONTRADO: ${data.fromUserId}`);
                    } else {
                        console.log(`✅ [GIFT] Saldo do remetente persistido. Novo saldo: ${senderUpdate.diamonds}. updatedAt: ${senderUpdate.updatedAt}`);
                    }

                    // Emitir atualização de saldo para o remetente
                    const userRoom = `user_${data.fromUserId}`;
                    const updatedSender = await User.findOne({ id: data.fromUserId }).select('diamonds enviados receptores earnings updatedAt').lean();

                    if (updatedSender) {
                        io.to(userRoom).emit('diamonds_updated', {
                            userId: data.fromUserId,
                            diamonds: (updatedSender as any).diamonds,
                            enviados: (updatedSender as any).enviados,
                            change: -totalValue,
                            timestamp: new Date().toISOString(),
                            source: 'gift_sent'
                        });
                        io.to(userRoom).emit('user_stats_updated', {
                            userId: data.fromUserId,
                            stats: updatedSender
                        });
                    }

                    // Se houver streamId, atualizar também o receptor (host da stream)
                    if (data.streamId) {
                        const { Streamer } = await import('./models/Streamer');
                        const stream = await Streamer.findOne({ id: data.streamId }).select('hostId').lean();
                        if (stream && stream.hostId && stream.hostId !== data.fromUserId) {
                            console.log(`📤 [GIFT] Adicionando ${totalValue} ganhos para o host ${stream.hostId}...`);
                            const receiverUpdate = await User.findOneAndUpdate(
                                { id: stream.hostId },
                                { $inc: { receptores: totalValue, diamonds: totalValue, earnings: totalValue } },
                                { returnDocument: 'after' }
                            );

                            if (!receiverUpdate) {
                                console.warn(`⚠️ [GIFT] HOST NÃO ENCONTRADO por id: ${stream.hostId}`);
                            } else {
                                console.log(`✅ [GIFT] Ganhos do host persistidos. Novo total: ${receiverUpdate.earnings}. updatedAt: ${receiverUpdate.updatedAt}`);
                            }

                            const updatedReceiver = await User.findOne({ id: stream.hostId }).select('diamonds enviados receptores earnings updatedAt').lean();

                            if (updatedReceiver) {
                                io.to(`user_${stream.hostId}`).emit('diamonds_updated', {
                                    userId: stream.hostId,
                                    diamonds: (updatedReceiver as any).diamonds,
                                    receptores: (updatedReceiver as any).receptores,
                                    change: totalValue,
                                    timestamp: new Date().toISOString(),
                                    source: 'gift_received'
                                });
                                io.to(`user_${stream.hostId}`).emit('user_stats_updated', {
                                    userId: stream.hostId,
                                    stats: updatedReceiver
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(' [GIFT] Error updating diamond balance:', error);
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
                
                // Também emitir evento JSON para garantir sincronização cross-cliente
                // Este é o caminho principal para o frontend (live_gift_received)
                const totalValue = Math.max(1, Math.floor((data.giftPrice || 0) * (data.quantity || 1)));
                io.to(data.streamId).emit('live_gift_received', {
                    from: {
                        id: data.fromUserId || '',
                        name: data.fromUserName || '',
                        avatarUrl: data.fromUserAvatar || '',
                        level: data.fromUserLevel || 1,
                        identification: data.fromUserId || '',
                    },
                    toUser: {
                        id: data.toUserId || '',
                        name: data.toUserName || '',
                    },
                    gift: {
                        name: data.giftName || '',
                        price: data.giftPrice || 0,
                        icon: data.giftIcon || '🎁',
                        category: data.giftCategory || 'Popular',
                    },
                    quantity: data.quantity || 1,
                    totalValue,
                    roomId: data.streamId || '',
                    timestamp: Date.now(),
                });
                
                // Atualizar contador de moedas da live para todos na sala
                try {
                    const { Streamer } = await import('./models/Streamer');
                    const stream = await Streamer.findOne({ id: data.streamId }).select('diamonds').lean();
                    if (stream) {
                        io.to(data.streamId).emit('live_coins_updated', {
                            streamId: data.streamId,
                            coins: (stream as any).diamonds || 0,
                            totalCoins: (stream as any).diamonds || 0,
                            timestamp: new Date().toISOString(),
                        });
                    }
                } catch (err) {
                    console.warn(' [GIFT] Error fetching live coins:', err);
                }
                
                console.log(` [PROTOBUF] Gift event encoded and broadcasted:`, buffer.length, 'bytes');
            }
        });
        
        socket.on('user_joined', async (data) => {
            console.log(` [USER] User joined received:`, data);
            
            // Juntar socket à sala da stream para receber broadcasts em tempo real
            if (data.streamId) {
                socket.join(data.streamId);
                console.log(` [USER] Socket ${socket.id} joined room ${data.streamId}`);
            }
            
            // Adicionar EXP por entrar na stream
            try {
                const { UserLevelService } = await import('./services/UserLevelService');
                const expResult = await UserLevelService.addExp({
                    userId: data.userId,
                    amount: 5, // 5 EXP por entrar na stream
                    reason: 'Joined stream',
                    streamId: data.streamId
                });
                // Emitir atualização de nível em tempo real
                const userRoom = `user_${data.userId}`;
                io.to(userRoom).emit('level_updated', {
                    userId: data.userId,
                    currentLevel: expResult.currentLevel,
                    currentExp: expResult.currentExp,
                    expForNextLevel: expResult.expForNextLevel,
                    totalExp: expResult.totalExp,
                    progress: expResult.progress,
                    timestamp: new Date().toISOString()
                });
                if (expResult.leveledUp) {
                    io.to(userRoom).emit('level_up', {
                        userId: data.userId,
                        newLevel: expResult.currentLevel,
                        newLevels: expResult.newLevels,
                        timestamp: new Date().toISOString()
                    });
                }
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

                // === NOTIFICAR DESTINATÁRIO via serviço centralizado (sininho + FCM) ===
                try {
                    const { NotificationService } = await import('./services/NotificationService');
                    const { User } = await import('./models/index');
                    const fromUser = await User.findOne({ id: data.fromUserId }).select('name avatarUrl').lean();
                    if (fromUser) {
                        await NotificationService.notifyFriendInvite(
                            io,
                            data.toUserId,
                            data.fromUserId,
                            (fromUser as any).name || 'Alguém',
                            (fromUser as any).avatarUrl || '',
                            (request as any)._id || (request as any).id || '',
                            data.message
                        );
                    }
                } catch (notifErr) {
                    console.warn('[SOCKET-FRIEND-INVITE-NOTIFICATION] Erro:', notifErr);
                }
                
                console.log(` [FRIENDSHIP] Friendship request: ${data.fromUserId} -> ${data.toUserId}`);
            } catch (error) {
                console.error(' [FRIENDSHIP] Error creating friendship request:', error);
            }
        });
        
        // Evento para broadcast de mudanças de estado das transmissões
        socket.on('live_broadcast', async (data: { type: 'started' | 'ended'; streamId: string; hostId: string; streamData?: any }) => {
            try {
                const broadcastData = {
                    type: data.type,
                    streamId: data.streamId,
                    hostId: data.hostId,
                    streamData: data.streamData || null,
                    timestamp: new Date().toISOString()
                };
                io.emit('live_state_changed', broadcastData);
                console.log(` [LIVE-BROADCAST] ${data.type} - stream: ${data.streamId}, host: ${data.hostId}`);
            } catch (error) {
                console.error(' [LIVE-BROADCAST] Error:', error);
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
