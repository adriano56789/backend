import { Server as SocketIOServer } from 'socket.io';
import { logWebSocketEvent } from '../middleware/ActivityLogger';
import { ActivityType } from '../models/UserActivity';
import { User } from '../models/User';
import { Gift } from '../models/Gift';

export class ActivityEventService {
    private static instance: ActivityEventService;
    private io: SocketIOServer | null = null;
    
    private constructor() {}
    
    static getInstance(): ActivityEventService {
        if (!ActivityEventService.instance) {
            ActivityEventService.instance = new ActivityEventService();
        }
        return ActivityEventService.instance;
    }
    
    // Inicializar o serviço com instância do Socket.IO
    initialize(io: SocketIOServer): void {
        this.io = io;
        this.setupEventListeners();
        console.log('ActivityEventService initialized');
    }
    
    // Configurar listeners para eventos WebSocket
    private setupEventListeners(): void {
        if (!this.io) return;
        
        // Eventos de Live Stream
        this.io.on('connection', (socket) => {
            this.setupSocketListeners(socket);
        });
    }
    
    // Configurar listeners para socket específico
    private setupSocketListeners(socket: any): void {
        const userId = socket.userId;
        
        if (!userId) return;
        
        // Live Stream Events
        socket.on('join_live', async (data: any) => {
            await this.logActivity(userId, 'join_live', data, {
                targetId: data.streamId,
                targetType: 'live'
            });
            
            // Broadcast para outros usuários na mesma live
            socket.to(`live_${data.streamId}`).emit('user_joined_live', {
                userId,
                streamId: data.streamId,
                timestamp: new Date()
            });
        });
        
        socket.on('leave_live', async (data: any) => {
            await this.logActivity(userId, 'leave_live', data, {
                targetId: data.streamId,
                targetType: 'live'
            });
            
            // Broadcast para outros usuários na mesma live
            socket.to(`live_${data.streamId}`).emit('user_left_live', {
                userId,
                streamId: data.streamId,
                timestamp: new Date()
            });
        });
        
        // Social Events
        socket.on('follow_user', async (data: any) => {
            await this.logActivity(userId, 'follow_user', data, {
                targetId: data.targetUserId,
                targetType: 'user'
            });
            
            // Notificar o usuário que foi seguido
            this.io?.to(`user_${data.targetUserId}`).emit('user_followed_you', {
                followerId: userId,
                timestamp: new Date()
            });
        });
        
        socket.on('unfollow_user', async (data: any) => {
            await this.logActivity(userId, 'unfollow_user', data, {
                targetId: data.targetUserId,
                targetType: 'user'
            });
        });
        
        socket.on('block_user', async (data: any) => {
            await this.logActivity(userId, 'block_user', data, {
                targetId: data.targetUserId,
                targetType: 'user'
            });
        });
        
        socket.on('unblock_user', async (data: any) => {
            await this.logActivity(userId, 'unblock_user', data, {
                targetId: data.targetUserId,
                targetType: 'user'
            });
        });
        
        // Gift Events
        socket.on('send_gift', async (data: any) => {
            await this.logActivity(userId, 'send_gift', data, {
                targetId: data.toUserId,
                targetType: 'user'
            });

            // Buscar dados do sender e do gift para enriquecer payload
            let senderName = '';
            let senderAvatarFrameId: string | null = null;
            let giftAnimationType: string | null = null;

            try {
                const [sender, gift] = await Promise.all([
                    User.findOne({ id: userId }).select('name activeFrameId').lean(),
                    Gift.findOne({ id: data.giftId }).select('name videoUrl').lean()
                ]);
                if (sender) {
                    senderName = (sender as any).name || '';
                    senderAvatarFrameId = (sender as any).activeFrameId || null;
                }
                if (gift) {
                    giftAnimationType = (gift as any).videoUrl || null;
                }
            } catch (err) {
                console.error('[ActivityEvent] Erro ao buscar dados para gift_sent:', err);
            }
            
            // Broadcast para todos na live
            socket.to(`live_${data.streamId}`).emit('gift_sent', {
                fromUserId: userId,
                toUserId: data.toUserId,
                giftId: data.giftId,
                giftName: data.giftName,
                quantity: data.quantity,
                streamId: data.streamId,
                senderName,
                senderAvatarFrameId,
                giftAnimationType,
                timestamp: new Date()
            });
            
            // Notificar especificamente o destinatário
            this.io?.to(`user_${data.toUserId}`).emit('gift_received', {
                fromUserId: userId,
                giftId: data.giftId,
                giftName: data.giftName,
                quantity: data.quantity,
                senderName,
                senderAvatarFrameId,
                giftAnimationType,
                timestamp: new Date()
            });
        });
        
        // Chat Events
        socket.on('send_message', async (data: any) => {
            await this.logActivity(userId, 'send_message', data, {
                targetId: data.conversationId || data.toUserId,
                targetType: data.conversationId ? 'conversation' : 'user'
            });
            
            if (data.conversationId) {
                // Mensagem em conversa específica
                this.io?.to(`conversation_${data.conversationId}`).emit('new_message', {
                    messageId: data.messageId,
                    fromUserId: userId,
                    conversationId: data.conversationId,
                    content: data.content,
                    timestamp: new Date()
                });
            } else if (data.toUserId) {
                // Mensagem direta
                this.io?.to(`user_${data.toUserId}`).emit('new_direct_message', {
                    messageId: data.messageId,
                    fromUserId: userId,
                    content: data.content,
                    timestamp: new Date()
                });
            }
        });
        
        // Content Events
        socket.on('like_content', async (data: any) => {
            await this.logActivity(userId, 'like_content', data, {
                targetId: data.contentId,
                targetType: data.contentType
            });
            
            // Notificar dono do conteúdo
            this.io?.to(`user_${data.contentOwnerId}`).emit('content_liked', {
                likerId: userId,
                contentId: data.contentId,
                contentType: data.contentType,
                timestamp: new Date()
            });
        });
        
        socket.on('unlike_content', async (data: any) => {
            await this.logActivity(userId, 'unlike_content', data, {
                targetId: data.contentId,
                targetType: data.contentType
            });
        });
        
        socket.on('comment_content', async (data: any) => {
            await this.logActivity(userId, 'comment_content', data, {
                targetId: data.contentId,
                targetType: data.contentType
            });
            
            // Broadcast comentário
            if (data.streamId) {
                this.io?.to(`live_${data.streamId}`).emit('new_comment', {
                    commenterId: userId,
                    contentId: data.contentId,
                    contentType: data.contentType,
                    comment: data.comment,
                    timestamp: new Date()
                });
            }
        });
        
        // Profile Events
        socket.on('update_profile', async (data: any) => {
            await this.logActivity(userId, 'update_profile', data, {
                targetType: 'profile'
            });
        });
        
        socket.on('change_avatar', async (data: any) => {
            await this.logActivity(userId, 'change_avatar', data, {
                targetType: 'profile'
            });
            
            // Notificar seguidores sobre mudança de avatar
            this.io?.emit('user_avatar_changed', {
                userId,
                newAvatarUrl: data.avatarUrl,
                timestamp: new Date()
            });
        });
        
        // System Events
        socket.on('login', async (data: any) => {
            await this.logActivity(userId, 'login', data, {
                targetType: 'system'
            });
            
            // Notificar amigos que usuário está online
            this.io?.emit('friend_online', {
                userId,
                timestamp: new Date()
            });
        });
        
        socket.on('logout', async (data: any) => {
            await this.logActivity(userId, 'logout', data, {
                targetType: 'system'
            });
            
            // Notificar amigos que usuário está offline
            this.io?.emit('friend_offline', {
                userId,
                timestamp: new Date()
            });
        });
        
        // Room Management
        socket.on('join_room', (room: any) => {
            socket.join(room);
        });
        
        socket.on('leave_room', (room: any) => {
            socket.leave(room);
        });
        
        // Disconnect
        socket.on('disconnect', async () => {
            await this.logActivity(userId, 'logout', {}, {
                targetType: 'system'
            });
            
            this.io?.emit('friend_offline', {
                userId,
                timestamp: new Date()
            });
        });
    }
    
    // Método auxiliar para logging de atividades
    private async logActivity(userId: string, event: string, data: any, targetInfo?: { targetId?: string; targetType?: string }): Promise<void> {
        try {
            await logWebSocketEvent(userId, event, data, targetInfo);
        } catch (error) {
            console.error('Error logging WebSocket activity:', error);
        }
    }
    
    // Método para broadcast de atividades em tempo real
    broadcastActivity(activity: any): void {
        if (!this.io) return;
        
        // Broadcast para todos os usuários interessados
        this.io.emit('activity_update', {
            activity,
            timestamp: new Date()
        });
        
        // Broadcast específico para tipo de atividade
        this.io.emit(`activity_${activity.activityType}`, activity);
        
        // Broadcast para usuário específico
        if (activity.userId) {
            this.io.to(`user_${activity.userId}`).emit('user_activity', activity);
        }
        
        // Broadcast para alvo específico
        if (activity.targetId && activity.targetType) {
            this.io.to(`${activity.targetType}_${activity.targetId}`).emit('target_activity', activity);
        }
    }
    
    // Método para notificar usuários sobre atividades de seus seguidos
    notifyFollowersActivity(userId: string, activity: any): void {
        if (!this.io) return;
        
        // Enviar para todos os seguidores do usuário
        this.io.to(`followers_${userId}`).emit('following_activity', {
            userId,
            activity,
            timestamp: new Date()
        });
    }
    
    // Método para enviar atividades recentes para um usuário
    async sendRecentActivities(userId: string, limit: number = 20): Promise<void> {
        if (!this.io) return;
        
        try {
            const { UserActivity } = await import('../models/UserActivity');
            const activities = await (UserActivity as any).findBasic(userId, limit);
            
            this.io.to(`user_${userId}`).emit('recent_activities', {
                activities,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error sending recent activities:', error);
        }
    }
    
    // Método para enviar estatísticas de atividades
    async sendActivityStats(userId: string): Promise<void> {
        if (!this.io) return;
        
        try {
            const { UserActivity } = await import('../models/UserActivity');
            const stats = await (UserActivity as any).getUserActivityStats(userId);
            
            this.io.to(`user_${userId}`).emit('activity_stats', {
                stats,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error sending activity stats:', error);
        }
    }
    
    // Método para criar salas específicas
    createRoom(roomName: string, userId?: string): void {
        if (!this.io) return;
        
        if (userId) {
            this.io.to(`user_${userId}`).emit('room_created', {
                roomName,
                userId,
                timestamp: new Date()
            });
        }
    }
    
    // Método para entrar em sala específica
    joinRoom(socket: any, roomName: string): void {
        socket.join(roomName);
        socket.emit('joined_room', {
            roomName,
            timestamp: new Date()
        });
    }
    
    // Método para sair de sala específica
    leaveRoom(socket: any, roomName: string): void {
        socket.leave(roomName);
        socket.emit('left_room', {
            roomName,
            timestamp: new Date()
        });
    }
    
    // Método para enviar atividades globais
    async sendGlobalActivities(): Promise<void> {
        if (!this.io) return;
        
        try {
            const { UserActivity } = await import('../models/UserActivity');
            const activities = await (UserActivity as any).getRecentActivities(50);
            
            this.io.emit('global_activities', {
                activities,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error sending global activities:', error);
        }
    }
    
    // Método para enviar atividades por tipo
    async sendActivitiesByType(activityType: ActivityType): Promise<void> {
        if (!this.io) return;
        
        try {
            const { UserActivity } = await import('../models/UserActivity');
            const activities = await (UserActivity as any).getActivitiesByType(activityType, 30);
            
            this.io.emit(`activities_${activityType}`, {
                activities,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error sending activities by type:', error);
        }
    }
    
    // Método para limpeza de salas inativas
    cleanupInactiveRooms(): void {
        if (!this.io) return;
        
        // Implementar lógica para limpar salas inativas
        console.log('Cleaning up inactive rooms');
    }
}

// Exportar instância singleton
export const activityEventService = ActivityEventService.getInstance();
