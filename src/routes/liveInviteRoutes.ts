import express from 'express';
import { LiveUser, LiveInvite } from '../models/LiveInvite';
import Streamer from '../models/Streamer';

const router = express.Router();

const SRS_HOST = process.env.SRS_HOST || 'api.livego.store';

router.post('/join', async (req, res) => {
    try {
        const { userId, username, name, avatarUrl, streamId, socketId } = req.body;
        if (!userId || !username || !streamId) {
            return res.status(400).json({ success: false, error: 'userId, username e streamId são obrigatórios' });
        }

        const liveUser = await LiveUser.findOneAndUpdate(
            { username },
            {
                userId,
                username,
                name: name || username,
                avatarUrl: avatarUrl || '',
                status: 'viewing',
                currentStreamId: streamId,
                socketId: socketId || null,
                lastActive: new Date()
            },
            { upsert: true, new: true }
        );

        const io = (req as any).app.get('io');
        if (io) {
            io.to(`live_${streamId}`).emit('live_user_joined', {
                username: liveUser.username,
                name: liveUser.name,
                avatarUrl: liveUser.avatarUrl,
                status: liveUser.status
            });
        }

        res.status(200).json({ success: true, user: liveUser });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao registrar entrada na live:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/online-users', async (req, res) => {
    try {
        const { streamId, mode } = req.query;
        if (!streamId) {
            return res.status(400).json({ success: false, error: 'streamId é obrigatório' });
        }

        if (mode === 'battle') {
            const liveStreamers = await Streamer.find({
                isLive: true,
                streamStatus: 'active',
                hostId: { $ne: streamId }
            }).sort({ startTime: -1 }).lean();

            const users = liveStreamers.map(s => ({
                userId: s.hostId,
                username: s.name || s.hostId,
                name: s.name || s.hostId,
                avatarUrl: s.avatar || '',
                status: 'broadcasting'
            }));

            return res.status(200).json({ success: true, users });
        }

        const users = await LiveUser.find({
            currentStreamId: streamId,
            status: { $in: ['viewing', 'co-host', 'pk-battle', 'broadcasting'] }
        }).sort({ lastActive: -1 });

        res.status(200).json({ success: true, users });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao listar usuários online:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/invite', async (req, res) => {
    try {
        const { inviterUsername, inviterName, inviteeUsername, inviteeName, inviteType, streamId } = req.body;

        if (!inviterUsername || !inviteeUsername || !inviteType || !streamId) {
            return res.status(400).json({ success: false, error: 'Campos obrigatórios faltando' });
        }

        const existing = await LiveInvite.findOne({
            inviterUsername,
            inviteeUsername,
            streamId,
            status: 'pending'
        });

        if (existing) {
            return res.status(409).json({ success: false, error: 'Já existe um convite pendente para este usuário' });
        }

        const streamKey = `${inviteType}_${inviterUsername}_${inviteeUsername}_${Date.now().toString().slice(-4)}`;
        const whipUrl = `webrtc://${SRS_HOST}/rtc/v1/publish/live/${streamKey}`;
        const whepUrl = `webrtc://${SRS_HOST}/rtc/v1/play/live/${streamKey}`;
        const inviteLink = `https://livego.store/live/${streamId}?invite=${streamKey}`;

        const newInvite = await LiveInvite.create({
            inviterUsername,
            inviterName: inviterName || inviterUsername,
            inviteeUsername,
            inviteeName: inviteeName || inviteeUsername,
            inviteType,
            status: 'pending',
            streamId,
            inviteLink,
            srsSfuConfig: {
                whipUrl,
                whepUrl,
                streamKey,
                rtcRoomId: streamId
            }
        });

        const io = (req as any).app.get('io');
        if (io) {
            const invitee = await LiveUser.findOne({ username: inviteeUsername, currentStreamId: streamId });
            if (invitee && invitee.socketId) {
                io.to(invitee.socketId).emit('live_invite_received', {
                    inviteId: newInvite._id,
                    inviterUsername: newInvite.inviterUsername,
                    inviterName: newInvite.inviterName,
                    inviteType: newInvite.inviteType,
                    streamId: newInvite.streamId
                });
            }
        }

        res.status(201).json({ success: true, invite: newInvite });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao criar convite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/invite/respond', async (req, res) => {
    try {
        const { inviteId, status } = req.body;

        if (!inviteId || !status) {
            return res.status(400).json({ success: false, error: 'inviteId e status são obrigatórios' });
        }

        if (!['accepted', 'declined'].includes(status)) {
            return res.status(400).json({ success: false, error: 'status deve ser accepted ou declined' });
        }

        const invite = await LiveInvite.findById(inviteId);
        if (!invite) {
            return res.status(404).json({ success: false, error: 'Convite não encontrado ou expirado' });
        }

        if (invite.status !== 'pending') {
            return res.status(409).json({ success: false, error: `Convite já foi ${invite.status}` });
        }

        invite.status = status;
        await invite.save();

        if (status === 'accepted') {
            const targetStatus = invite.inviteType === 'pk-battle' ? 'pk-battle' : 'co-host';
            await LiveUser.findOneAndUpdate(
                { username: invite.inviteeUsername, currentStreamId: invite.streamId },
                { status: targetStatus }
            );
            await LiveUser.findOneAndUpdate(
                { username: invite.inviterUsername, currentStreamId: invite.streamId },
                { status: targetStatus }
            );
        }

        const io = (req as any).app.get('io');
        if (io) {
            const inviter = await LiveUser.findOne({ username: invite.inviterUsername, currentStreamId: invite.streamId });
            if (inviter && inviter.socketId) {
                io.to(inviter.socketId).emit('live_invite_response', {
                    inviteId: invite._id,
                    status: invite.status,
                    inviteeUsername: invite.inviteeUsername,
                    inviteeName: invite.inviteeName,
                    inviteType: invite.inviteType
                });
            }

            if (status === 'accepted') {
                io.to(`live_${invite.streamId}`).emit('live_user_status_change', {
                    username: invite.inviteeUsername,
                    status: invite.inviteType === 'pk-battle' ? 'pk-battle' : 'co-host'
                });
                io.to(`live_${invite.streamId}`).emit('live_user_status_change', {
                    username: invite.inviterUsername,
                    status: invite.inviteType === 'pk-battle' ? 'pk-battle' : 'co-host'
                });
            }
        }

        res.status(200).json({ success: true, invite });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao responder convite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/leave', async (req, res) => {
    try {
        const { username, streamId } = req.body;
        if (!username) {
            return res.status(400).json({ success: false, error: 'username é obrigatório' });
        }

        const removed = await LiveUser.findOneAndDelete({ username, ...(streamId ? { currentStreamId: streamId } : {}) });

        const io = (req as any).app.get('io');
        if (io && removed) {
            io.to(`live_${removed.currentStreamId}`).emit('live_user_left', {
                username: removed.username
            });
        }

        res.status(200).json({ success: true, message: 'Usuário removido da live' });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao remover usuário:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
