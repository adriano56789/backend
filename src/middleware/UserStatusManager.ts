import { Server as SocketIOServer } from 'socket.io';
import { UserStatus, User } from '../models';

interface HeartbeatMap {
    [userId: string]: {
        lastHeartbeat: number;
        intervalId?: NodeJS.Timeout;
        isAlive: boolean;
    };
}

let instance: UserStatusManager | null = null;

class UserStatusManager {
    private io: SocketIOServer;
    private heartbeatMap: HeartbeatMap = {};
    private readonly HEARTBEAT_INTERVAL = 30000; // 30 segundos
    private readonly HEARTBEAT_TIMEOUT = 60000; // 60 segundos para considerar offline

    constructor(io: SocketIOServer) {
        this.io = io;
        this.setupEventHandlers();
        instance = this;
    }

    public static getInstance(): UserStatusManager | null {
        return instance;
    }

    private setupEventHandlers() {
        // Quando usuário se conecta
        this.io.on('connection', (socket) => {
            console.log(`Usuário conectado: ${socket.id}`);

            // Registrar heartbeat do usuário
            socket.on('user_heartbeat', async (data: { userId: string }) => {
                await this.handleHeartbeat(data.userId, socket);
            });

            // Quando usuário entra no app (autenticação)
            socket.on('user_online', async (data: { userId: string }) => {
                await this.setUserOnline(data.userId);
                this.startHeartbeat(data.userId, socket);
            });

            // Quando usuário sai do app
            socket.on('user_offline', async (data: { userId: string }) => {
                await this.setUserOffline(data.userId);
                this.stopHeartbeat(data.userId);
            });

            // Quando socket desconecta
            socket.on('disconnect', () => {
                console.log(`Usuário desconectado: ${socket.id}`);
                this.handleDisconnect(socket);
            });
        });
    }

    public async handleHeartbeat(userId: string, socket?: any) {
        const now = Date.now();
        
        if (!this.heartbeatMap[userId]) {
            this.heartbeatMap[userId] = {
                lastHeartbeat: now,
                isAlive: true
            };
            // Se o usuário não estava no mapa, garantir que ele seja marcado como online no DB
            await this.setUserOnline(userId);
        } else {
            this.heartbeatMap[userId].lastHeartbeat = now;
            this.heartbeatMap[userId].isAlive = true;
        }

        // Enviar confirmação do heartbeat
        if (socket) {
            socket.emit('heartbeat_ack', {
                userId,
                timestamp: now,
                nextHeartbeat: now + this.HEARTBEAT_INTERVAL
            });
        }
    }

    private async setUserOnline(userId: string) {
        try {
            // Importar dinamicamente para evitar circular dependency
            const { User, UserStatus } = await import('../models');
            const now = new Date();

            await UserStatus.findOneAndUpdate(
                { userId: userId },
                { $set: { isOnline: true, lastSeen: now } },
                { upsert: true }
            );

            await User.findOneAndUpdate(
                { id: userId },
                { 
                    $set: { isOnline: true, lastSeen: now, lastLogin: now },
                    $inc: { loginCount: 1 },
                    $push: { 
                        recentActivities: {
                            action: 'user_online',
                            resource: 'user_session',
                            timestamp: now,
                            endpoint: 'websocket_connection'
                        }
                    }
                },
                { upsert: true }
            );

            // Broadcast para todos os usuários interessados
            this.io.emit('user_status_changed', {
                userId: userId,
                isOnline: true,
                timestamp: now
            });

            console.log(` Usuário ${userId} marcado como online`);
        } catch (error) {
            console.error('Erro ao marcar usuário como online:', error);
        }
    }

    private async setUserOffline(userId: string) {
        try {
            // Importar dinamicamente
            const { User, UserStatus } = await import('../models');
            const now = new Date();

            await UserStatus.findOneAndUpdate(
                { userId: userId },
                { $set: { isOnline: false, lastSeen: now } },
                { upsert: true }
            );

            await User.findOneAndUpdate(
                { id: userId },
                { 
                    $set: { isOnline: false, lastSeen: now },
                    $push: { 
                        recentActivities: {
                            action: 'user_offline',
                            resource: 'user_session',
                            timestamp: now,
                            endpoint: 'websocket_disconnection'
                        }
                    }
                }
            );

            // Broadcast para todos os usuários interessados
            this.io.emit('user_status_changed', {
                userId: userId,
                isOnline: false,
                lastSeen: now,
                timestamp: now
            });

            console.log(` Usuário ${userId} marcado como offline`);
        } catch (error) {
            console.error('Erro ao marcar usuário como offline:', error);
        }
    }

    private startHeartbeat(userId: string, socket: any) {
        // Limpar heartbeat anterior se existir
        this.stopHeartbeat(userId);

        // Iniciar novo heartbeat
        const intervalId = setInterval(() => {
            const heartbeat = this.heartbeatMap[userId];
            if (!heartbeat || !heartbeat.isAlive) {
                this.stopHeartbeat(userId);
                this.setUserOffline(userId);
                return;
            }

            // Resetar status alive para verificar no próximo ciclo
            heartbeat.isAlive = false;

            // Enviar solicitação de heartbeat
            socket.emit('heartbeat_request', { 
                userId, 
                timestamp: Date.now() 
            });
        }, this.HEARTBEAT_INTERVAL);

        this.heartbeatMap[userId] = {
            lastHeartbeat: Date.now(),
            intervalId,
            isAlive: true
        };

        console.log(`Heartbeat iniciado para usuário ${userId}`);
    }

    private stopHeartbeat(userId: string) {
        const heartbeat = this.heartbeatMap[userId];
        if (heartbeat && heartbeat.intervalId) {
            clearInterval(heartbeat.intervalId);
        }
        delete this.heartbeatMap[userId];
        console.log(`Heartbeat parado para usuário ${userId}`);
    }

    private handleDisconnect(socket: any) {
        // Encontrar e limpar heartbeats associados a este socket
        for (const userId in this.heartbeatMap) {
            const heartbeat = this.heartbeatMap[userId];
            if (heartbeat && !heartbeat.isAlive) {
                this.stopHeartbeat(userId);
                this.setUserOffline(userId);
            }
        }
    }

    // Limpar usuários inativos (executar periodicamente)
    public cleanupInactiveUsers() {
        const now = Date.now();
        
        for (const userId in this.heartbeatMap) {
            const heartbeat = this.heartbeatMap[userId];
            if (heartbeat && (now - heartbeat.lastHeartbeat) > this.HEARTBEAT_TIMEOUT) {
                this.stopHeartbeat(userId);
                this.setUserOffline(userId);
            }
        }
    }

    // Obter status atual do usuário
    public async getUserStatus(userId: string) {
        try {
            const status = await UserStatus.findOne({ userId: userId });
            return status || {
                userId: userId,
                isOnline: false,
                lastSeen: new Date(),
                updatedAt: new Date()
            };
        } catch (error) {
            console.error('Erro ao obter status do usuário:', error);
            return null;
        }
    }

    // Obter todos os usuários online
    public async getOnlineUsers(limit = 50, offset = 0) {
        try {
            const onlineUsers = await UserStatus.find({ isOnline: true })
                .sort({ updatedAt: -1 })
                .limit(limit)
                .skip(offset)
                .select('userId lastSeen updatedAt');
            
            return onlineUsers;
        } catch (error) {
            console.error('Erro ao obter usuários online:', error);
            return [];
        }
    }
}

export default UserStatusManager;
