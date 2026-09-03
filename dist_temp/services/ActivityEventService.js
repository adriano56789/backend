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
exports.activityEventService = exports.ActivityEventService = void 0;
const ActivityLogger_1 = require("../middleware/ActivityLogger");
const User_1 = require("../models/User");
const Gift_1 = require("../models/Gift");
class ActivityEventService {
    constructor() {
        this.io = null;
    }
    static getInstance() {
        if (!ActivityEventService.instance) {
            ActivityEventService.instance = new ActivityEventService();
        }
        return ActivityEventService.instance;
    }
    // Inicializar o serviço com instância do Socket.IO
    initialize(io) {
        this.io = io;
        this.setupEventListeners();
        console.log('ActivityEventService initialized');
    }
    // Configurar listeners para eventos WebSocket
    setupEventListeners() {
        if (!this.io)
            return;
        // Eventos de Live Stream
        this.io.on('connection', (socket) => {
            this.setupSocketListeners(socket);
        });
    }
    // Configurar listeners para socket específico
    setupSocketListeners(socket) {
        const userId = socket.userId;
        if (!userId)
            return;
        // Live Stream Events
        socket.on('join_live', async (data) => {
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
        socket.on('leave_live', async (data) => {
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
        socket.on('follow_user', async (data) => {
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
        socket.on('unfollow_user', async (data) => {
            await this.logActivity(userId, 'unfollow_user', data, {
                targetId: data.targetUserId,
                targetType: 'user'
            });
        });
        socket.on('block_user', async (data) => {
            await this.logActivity(userId, 'block_user', data, {
                targetId: data.targetUserId,
                targetType: 'user'
            });
        });
        socket.on('unblock_user', async (data) => {
            await this.logActivity(userId, 'unblock_user', data, {
                targetId: data.targetUserId,
                targetType: 'user'
            });
        });
        // Gift Events
        socket.on('send_gift', async (data) => {
            await this.logActivity(userId, 'send_gift', data, {
                targetId: data.toUserId,
                targetType: 'user'
            });
            // Buscar dados do sender e do gift para enriquecer payload
            let senderName = '';
            let senderAvatarFrameId = null;
            let giftAnimationType = null;
            try {
                const [sender, gift] = await Promise.all([
                    User_1.User.findOne({ id: userId }).select('name activeFrameId').lean(),
                    Gift_1.Gift.findOne({ id: data.giftId }).select('name videoUrl').lean()
                ]);
                if (sender) {
                    senderName = sender.name || '';
                    senderAvatarFrameId = sender.activeFrameId || null;
                }
                if (gift) {
                    giftAnimationType = gift.videoUrl || null;
                }
            }
            catch (err) {
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
        socket.on('send_message', async (data) => {
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
            }
            else if (data.toUserId) {
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
        socket.on('like_content', async (data) => {
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
        socket.on('unlike_content', async (data) => {
            await this.logActivity(userId, 'unlike_content', data, {
                targetId: data.contentId,
                targetType: data.contentType
            });
        });
        socket.on('comment_content', async (data) => {
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
        socket.on('update_profile', async (data) => {
            await this.logActivity(userId, 'update_profile', data, {
                targetType: 'profile'
            });
        });
        socket.on('change_avatar', async (data) => {
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
        socket.on('login', async (data) => {
            await this.logActivity(userId, 'login', data, {
                targetType: 'system'
            });
            // Notificar amigos que usuário está online
            this.io?.emit('friend_online', {
                userId,
                timestamp: new Date()
            });
        });
        socket.on('logout', async (data) => {
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
        socket.on('join_room', (room) => {
            socket.join(room);
        });
        socket.on('leave_room', (room) => {
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
    async logActivity(userId, event, data, targetInfo) {
        try {
            await (0, ActivityLogger_1.logWebSocketEvent)(userId, event, data, targetInfo);
        }
        catch (error) {
            console.error('Error logging WebSocket activity:', error);
        }
    }
    // Método para broadcast de atividades em tempo real
    broadcastActivity(activity) {
        if (!this.io)
            return;
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
    notifyFollowersActivity(userId, activity) {
        if (!this.io)
            return;
        // Enviar para todos os seguidores do usuário
        this.io.to(`followers_${userId}`).emit('following_activity', {
            userId,
            activity,
            timestamp: new Date()
        });
    }
    // Método para enviar atividades recentes para um usuário
    async sendRecentActivities(userId, limit = 20) {
        if (!this.io)
            return;
        try {
            const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
            const activities = await UserActivity.findBasic(userId, limit);
            this.io.to(`user_${userId}`).emit('recent_activities', {
                activities,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('Error sending recent activities:', error);
        }
    }
    // Método para enviar estatísticas de atividades
    async sendActivityStats(userId) {
        if (!this.io)
            return;
        try {
            const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
            const stats = await UserActivity.getUserActivityStats(userId);
            this.io.to(`user_${userId}`).emit('activity_stats', {
                stats,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('Error sending activity stats:', error);
        }
    }
    // Método para criar salas específicas
    createRoom(roomName, userId) {
        if (!this.io)
            return;
        if (userId) {
            this.io.to(`user_${userId}`).emit('room_created', {
                roomName,
                userId,
                timestamp: new Date()
            });
        }
    }
    // Método para entrar em sala específica
    joinRoom(socket, roomName) {
        socket.join(roomName);
        socket.emit('joined_room', {
            roomName,
            timestamp: new Date()
        });
    }
    // Método para sair de sala específica
    leaveRoom(socket, roomName) {
        socket.leave(roomName);
        socket.emit('left_room', {
            roomName,
            timestamp: new Date()
        });
    }
    // Método para enviar atividades globais
    async sendGlobalActivities() {
        if (!this.io)
            return;
        try {
            const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
            const activities = await UserActivity.getRecentActivities(50);
            this.io.emit('global_activities', {
                activities,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('Error sending global activities:', error);
        }
    }
    // Método para enviar atividades por tipo
    async sendActivitiesByType(activityType) {
        if (!this.io)
            return;
        try {
            const { UserActivity } = await Promise.resolve().then(() => __importStar(require('../models/UserActivity')));
            const activities = await UserActivity.getActivitiesByType(activityType, 30);
            this.io.emit(`activities_${activityType}`, {
                activities,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('Error sending activities by type:', error);
        }
    }
    // Método para limpeza de salas inativas
    cleanupInactiveRooms() {
        if (!this.io)
            return;
        // Implementar lógica para limpar salas inativas
        console.log('Cleaning up inactive rooms');
    }
}
exports.ActivityEventService = ActivityEventService;
// Exportar instância singleton
exports.activityEventService = ActivityEventService.getInstance();
