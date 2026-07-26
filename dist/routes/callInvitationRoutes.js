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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const activityHelpers_1 = require("../utils/activityHelpers");
const LiveKitTokenService_1 = require("../services/LiveKitTokenService");
const env_1 = require("../config/env");
const router = express_1.default.Router();
async function broadcastGuestList(roomId, io) {
    const activeGuests = await models_1.CallInvitation.find({ roomId, status: 'accepted' }).lean();
    io.to(roomId).emit('guest_list_update', {
        roomId,
        guests: activeGuests.map(g => ({
            id: g.guestId,
            name: g.guestName,
            hostId: g.hostId
        })),
        count: activeGuests.length
    });
}
// POST /api/call-invitation/invite
router.post('/invite', async (req, res) => {
    try {
        const hostId = (0, auth_1.getUserIdFromToken)(req);
        if (!hostId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { guestId, guestName, streamId } = req.body;
        if (!guestId || !streamId) {
            return res.status(400).json({ error: 'guestId e streamId são obrigatórios' });
        }
        const stream = await models_1.Streamer.findOne({ id: streamId, hostId, isLive: true, streamStatus: 'active' });
        if (!stream) {
            return res.status(404).json({ error: 'Stream não encontrada ou não está ativa' });
        }
        const guest = await models_1.User.findOne({ id: guestId });
        if (!guest)
            return res.status(404).json({ error: 'Usuário convidado não encontrado' });
        if (!/^[a-zA-Z0-9_]{4,30}$/.test(guestId)) {
            return res.status(400).json({ error: 'ID de usuário inválido' });
        }
        const existing = await models_1.CallInvitation.findOne({
            hostId, guestId, roomId: stream.roomId, status: 'pending'
        });
        if (existing) {
            return res.status(400).json({ error: 'Já existe um convite ativo para este usuário' });
        }
        const invitation = await models_1.CallInvitation.create({
            hostId,
            hostName: req.user?.name || 'Host',
            guestId,
            guestName: guestName || guest.name || 'Convidado',
            roomId: stream.roomId,
            streamId: stream.id,
            streamKey: stream.streamKey || '',
            status: 'pending'
        });
        const invitationId = invitation._id.toString();
        const livekitRoom = `call_${invitationId}`;
        // Criar sala LiveKit para a chamada bidirecional
        try {
            if (!(await (0, LiveKitTokenService_1.roomExists)(livekitRoom))) {
                await LiveKitTokenService_1.roomService.createRoom({
                    name: livekitRoom,
                    emptyTimeout: 600,
                    maxParticipants: 10,
                });
                console.log(`[LiveKit-Call] Sala criada: ${livekitRoom}`);
            }
        }
        catch (lkErr) {
            console.error('[LiveKit-Call] Erro ao criar sala:', lkErr);
        }
        invitation.livekitRoom = livekitRoom;
        await invitation.save();
        await Promise.all([
            (0, activityHelpers_1.pushRecentActivity)(hostId, { action: 'call_invite_sent', resource: 'video_call', endpoint: '/api/call-invitation/invite' }),
            (0, activityHelpers_1.pushRecentActivity)(guestId, { action: 'call_invite_received', resource: 'video_call', endpoint: '/api/call-invitation/invite' })
        ]);
        // Gerar token do host com permissões bidirecionais
        let hostToken = '';
        try {
            hostToken = await (0, LiveKitTokenService_1.generateLiveKitToken)(hostId, livekitRoom, JSON.stringify({ name: req.user?.name || 'Host', type: 'call', invitationId, role: 'host' }), { canPublish: true });
            invitation.hostLiveKitToken = hostToken;
            await invitation.save();
        }
        catch (lkErr) {
            console.error('[LiveKit-Call] Erro ao gerar token do host:', lkErr);
        }
        const io = req.app.get('io');
        if (io) {
            const livekitUrl = env_1.ENV.LIVEKIT_URL;
            io.to(`user_${guestId}`).emit('call_invitation', {
                type: 'invitation_received',
                invitation: {
                    id: invitationId,
                    hostId: invitation.hostId,
                    hostName: invitation.hostName,
                    roomId: invitation.roomId,
                    streamId: invitation.streamId,
                    streamTitle: stream.name,
                    livekitRoom,
                    livekitUrl,
                    guest: {
                        id: guest.id, name: guest.name, avatarUrl: guest.avatarUrl || '',
                        level: guest.level || 1, diamonds: guest.diamonds || 0,
                        fans: guest.fans || 0, following: guest.following || 0,
                        isVIP: guest.isVIP || false, isAvatarProtected: guest.isAvatarProtected || false
                    }
                }
            });
            io.to(`user_${hostId}`).emit('call_invitation', {
                type: 'invitation_sent',
                invitation: { id: invitationId, guestId, guestName: guestName || guest.name }
            });
            io.to(`user_${hostId}`).emit('guest_invitation_sent', {
                invitationId,
                guestId,
                guestName: guestName || guest.name,
                hostId,
                roomId: invitation.roomId,
                streamId: invitation.streamId
            });
        }
        // Notificação centralizada via NotificationService (LiveNotification + socket + FCM)
        try {
            const { NotificationService } = await Promise.resolve().then(() => __importStar(require('../services/NotificationService')));
            await NotificationService.notifyCallInvitation(io, guestId, hostId, invitation.hostName, invitationId, invitation.roomId, invitation.streamId, livekitRoom);
        }
        catch (notifErr) {
            console.error('[CallInvitation] Erro NotificationService:', notifErr);
        }
        console.log(`📞 [Call Invitation] Host ${hostId} convidou ${guestId} para a stream ${streamId}`);
        res.json({ success: true, invitationId });
    }
    catch (error) {
        console.error('❌ [Call Invitation] Erro ao enviar convite:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/call-invitation/respond
router.post('/respond', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { invitationId, response } = req.body;
        if (!invitationId || !response) {
            return res.status(400).json({ error: 'invitationId e response são obrigatórios' });
        }
        const invitation = await models_1.CallInvitation.findById(invitationId);
        if (!invitation)
            return res.status(404).json({ error: 'Convite não encontrado' });
        if (invitation.guestId !== userId)
            return res.status(403).json({ error: 'Você não pode responder a este convite' });
        if (invitation.status !== 'pending')
            return res.status(400).json({ error: 'Convite já foi respondido' });
        const newStatus = response === 'accept' ? 'accepted' : 'declined';
        invitation.status = newStatus;
        invitation.updatedAt = new Date();
        if (newStatus === 'accepted') {
            const webrtcUrl = `webrtc://livego.store/live/guest_${invitation.guestId}`;
            invitation.signalingUrl = webrtcUrl;
        }
        await invitation.save();
        await (0, activityHelpers_1.pushRecentActivity)(userId, { action: response === 'accept' ? 'call_accepted' : 'call_declined', resource: 'video_call', endpoint: '/api/call-invitation/respond' });
        const io = req.app.get('io');
        if (response === 'accept' && io) {
            const guestUser = await models_1.User.findOne({ id: userId });
            const livekitRoom = invitation.livekitRoom || `call_${invitationId}`;
            // Garantir que a sala LiveKit existe
            try {
                if (!(await (0, LiveKitTokenService_1.roomExists)(livekitRoom))) {
                    await LiveKitTokenService_1.roomService.createRoom({ name: livekitRoom, emptyTimeout: 600, maxParticipants: 10 });
                }
            }
            catch (_) { }
            // Gerar tokens com permissões bidirecionais para ambos
            let hostToken = invitation.hostLiveKitToken || '';
            let guestToken = invitation.guestLiveKitToken || '';
            try {
                if (!hostToken) {
                    hostToken = await (0, LiveKitTokenService_1.generateLiveKitToken)(invitation.hostId, livekitRoom, JSON.stringify({ name: invitation.hostName, type: 'call', invitationId, role: 'host' }), { canPublish: true });
                    invitation.hostLiveKitToken = hostToken;
                }
                guestToken = await (0, LiveKitTokenService_1.generateLiveKitToken)(invitation.guestId, livekitRoom, JSON.stringify({ name: invitation.guestName, type: 'call', invitationId, role: 'guest' }), { canPublish: true });
                invitation.guestLiveKitToken = guestToken;
                await invitation.save();
            }
            catch (lkErr) {
                console.error('[LiveKit-Call] Erro ao gerar tokens bidirecionais:', lkErr);
            }
            const livekitUrl = env_1.ENV.LIVEKIT_URL;
            io.to(`user_${invitation.hostId}`).emit('call_invitation', {
                type: 'invitation_accepted',
                invitation: {
                    id: invitation._id.toString(),
                    guestId: invitation.guestId,
                    guestName: invitation.guestName,
                    guestAvatar: guestUser?.avatarUrl || '',
                    roomId: invitation.roomId,
                    livekitRoom,
                    livekitUrl,
                    livekitToken: hostToken
                }
            });
            io.to(`user_${invitation.hostId}`).emit('guest_invitation_accepted', {
                invitationId: invitation._id.toString(),
                guestId: invitation.guestId,
                guestName: invitation.guestName,
                hostId: invitation.hostId,
                roomId: invitation.roomId,
                livekitRoom,
                livekitUrl,
                livekitToken: hostToken
            });
            io.to(`user_${userId}`).emit('call_invitation', {
                type: 'call_joined',
                invitation: {
                    id: invitation._id.toString(),
                    roomId: invitation.roomId,
                    streamId: invitation.streamId,
                    livekitRoom,
                    livekitUrl,
                    livekitToken: guestToken
                }
            });
            // Broadcast multi-guest
            await broadcastGuestList(invitation.roomId, io);
            io.to(`user_${invitation.hostId}`).emit('guest_joined', {
                guestId: invitation.guestId,
                guestName: invitation.guestName,
                hostId: invitation.hostId,
                roomId: invitation.roomId
            });
            io.to(`user_${userId}`).emit('guest_joined', {
                guestId: invitation.guestId,
                guestName: invitation.guestName,
                hostId: invitation.hostId,
                roomId: invitation.roomId
            });
            console.log(`✅ [Call Invitation] ${userId} aceitou o convite para a stream ${invitation.streamId}`);
            // Notificação centralizada via NotificationService
            try {
                const { NotificationService } = await Promise.resolve().then(() => __importStar(require('../services/NotificationService')));
                await NotificationService.notifyCallResponded(io, invitation.hostId, invitation.guestId, invitation.guestName, invitation._id.toString(), 'accepted', invitation.roomId, livekitRoom);
            }
            catch (notifErr) {
                console.error('[CallInvitation] Erro NotificationService accept:', notifErr);
            }
        }
        else if (io) {
            io.to(`user_${invitation.hostId}`).emit('call_invitation', {
                type: 'invitation_declined',
                invitation: { id: invitation._id.toString(), guestId: invitation.guestId, guestName: invitation.guestName }
            });
            console.log(`❌ [Call Invitation] ${userId} recusou o convite para a stream ${invitation.streamId}`);
            // Notificação centralizada via NotificationService
            try {
                const { NotificationService } = await Promise.resolve().then(() => __importStar(require('../services/NotificationService')));
                await NotificationService.notifyCallResponded(io, invitation.hostId, invitation.guestId, invitation.guestName, invitation._id.toString(), 'declined');
            }
            catch (notifErr) {
                console.error('[CallInvitation] Erro NotificationService decline:', notifErr);
            }
        }
        res.json({ success: true, status: invitation.status });
    }
    catch (error) {
        console.error('❌ [Call Invitation] Erro ao responder convite:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/call-invitation/end
router.post('/end', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { invitationId } = req.body;
        if (!invitationId)
            return res.status(400).json({ error: 'invitationId é obrigatório' });
        const invitation = await models_1.CallInvitation.findById(invitationId);
        if (!invitation)
            return res.status(404).json({ error: 'Convite não encontrado' });
        if (invitation.hostId !== userId && invitation.guestId !== userId) {
            return res.status(403).json({ error: 'Você não pode encerrar esta chamada' });
        }
        invitation.status = 'ended';
        invitation.updatedAt = new Date();
        await invitation.save();
        await Promise.all([
            (0, activityHelpers_1.pushRecentActivity)(invitation.hostId, { action: 'call_ended', resource: 'video_call', endpoint: '/api/call-invitation/end' }),
            (0, activityHelpers_1.pushRecentActivity)(invitation.guestId, { action: 'call_ended', resource: 'video_call', endpoint: '/api/call-invitation/end' })
        ]);
        const io = req.app.get('io');
        if (io) {
            [invitation.hostId, invitation.guestId].forEach(uid => {
                io.to(`user_${uid}`).emit('call_invitation', { type: 'call_ended', invitation: { id: invitation._id.toString(), endedBy: userId } });
            });
            // Remove from guest list and notify room
            io.to(invitation.roomId).emit('guest_left', {
                guestId: invitation.guestId,
                guestName: invitation.guestName,
                hostId: invitation.hostId,
                roomId: invitation.roomId
            });
            await broadcastGuestList(invitation.roomId, io);
        }
        console.log(`📞 [Call Invitation] Chamada ${invitationId} encerrada por ${userId}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('❌ [Call Invitation] Erro ao encerrar chamada:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/call-invitation/active/:userId
router.get('/active/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const invitations = await models_1.CallInvitation.find({
            $or: [{ hostId: userId }, { guestId: userId }],
            status: 'pending'
        }).sort({ createdAt: -1 }).lean();
        res.json({ success: true, invitations });
    }
    catch (error) {
        console.error('❌ [Call Invitation] Erro ao listar convites:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/call-invitation/guests/:roomId — listar guests ativos numa sala
router.get('/guests/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const guests = await models_1.CallInvitation.find({ roomId, status: 'accepted' })
            .select('guestId guestName hostId roomId createdAt')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, guests, count: guests.length });
    }
    catch (error) {
        console.error('❌ [Call Invitation] Erro ao listar guests:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
