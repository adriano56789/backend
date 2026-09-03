"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewUserNotificationService = void 0;
const socket_1 = require("../socket");
const LiveMessage_1 = require("../models/LiveMessage");
const LiveCard_1 = require("../models/LiveCard");
const User_1 = require("../models/User");
const WELCOME_MESSAGES = [
    (name) => `🎉 ${name} acabou de entrar no LiveGo. Dê as boas-vindas!`,
    (name) => `✨ ${name} é uma nova usuária da plataforma.`,
    (name) => `👋 ${name} acabou de criar sua conta! Seja bem-vindo(a)!`,
    (name) => `🌟 ${name} chegou agora no LiveGo!`,
];
const GLOBAL_STREAM_ID = '__global__';
class NewUserNotificationService {
    static async notifyNewUser(userId) {
        try {
            const user = await User_1.User.findOne({ id: userId }).lean();
            if (!user)
                return;
            if (!user.isNewUser || user.newUserNotified)
                return;
            const userName = user.name || userId;
            const msgIndex = Math.floor(Math.random() * WELCOME_MESSAGES.length);
            const welcomeText = WELCOME_MESSAGES[msgIndex](userName);
            const io = (0, socket_1.getIO)();
            // Marcar como notificado
            await User_1.User.findOneAndUpdate({ id: userId }, { $set: { isNewUser: false, newUserNotified: true } });
            const now = new Date();
            // 1. SEMPRE salvar mensagem global (mesmo sem streams ativas)
            await LiveMessage_1.LiveMessage.create({
                streamId: GLOBAL_STREAM_ID,
                userId: 'system',
                userName: 'Sistema',
                avatarUrl: '',
                level: 0,
                text: welcomeText,
                type: 'system',
                timestamp: now
            }).catch(err => console.warn('[NEW-USER] Erro ao salvar mensagem global:', err.message));
            // 2. Broadcast global
            io.emit('new_user_arrived', {
                userId,
                userName,
                message: welcomeText,
                timestamp: now.toISOString()
            });
            // 3. Inserir em TODAS as streams ativas
            const activeStreams = await LiveCard_1.LiveCard.find({
                isLive: true,
                streamStatus: { $in: ['active', 'live'] }
            }).lean();
            for (const stream of activeStreams) {
                const streamId = stream.streamKey || stream.hostId;
                const msg = {
                    streamId,
                    userId: 'system',
                    userName: 'Sistema',
                    avatarUrl: '',
                    level: 0,
                    text: welcomeText,
                    type: 'system',
                    timestamp: now
                };
                await LiveMessage_1.LiveMessage.create(msg).catch(() => { });
            }
            console.log(`[NEW-USER] Notificação enviada: ${userName} (${userId})`);
        }
        catch (error) {
            console.error('[NEW-USER] Erro ao notificar novo usuário:', error);
        }
    }
    static async getRecentNewUsers(limit = 20) {
        const messages = await LiveMessage_1.LiveMessage.find({
            streamId: GLOBAL_STREAM_ID,
            type: 'system'
        })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
        return messages;
    }
}
exports.NewUserNotificationService = NewUserNotificationService;
