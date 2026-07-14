"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canSendMessage = canSendMessage;
const User_1 = require("../models/User");
const Followers_1 = require("../models/Followers");
async function canSendMessage(senderId, receiverId) {
    try {
        const receiver = await User_1.User.findOne({ id: receiverId }).select('chatPermission').lean();
        if (!receiver)
            return { allowed: false, reason: 'Usuário não encontrado' };
        const permission = receiver.chatPermission || 'all';
        if (permission === 'all')
            return { allowed: true };
        if (permission === 'none')
            return { allowed: false, reason: 'Este usuário não aceita mensagens privadas' };
        const follow = await Followers_1.Followers.findOne({ followerId: senderId, followingId: receiverId, isActive: true }).lean();
        if (!follow)
            return { allowed: false, reason: 'Apenas seguidores podem enviar mensagens' };
        return { allowed: true };
    }
    catch (err) {
        console.error('[chatPermission] Erro ao verificar permissão:', err);
        return { allowed: false, reason: 'Erro ao verificar permissão' };
    }
}
