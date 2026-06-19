import express from 'express';
import { LiveUser, LiveInvite } from '../models/LiveInvite';
import { Streamer } from '../models';

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

const buscarStreamersDisponiveis = async (streamId: string, apenasLive: boolean) => {
    // 1º: streamers ao vivo agora
    const filtroLive: any = { isLive: true, streamStatus: 'active', hostId: { $ne: streamId } };
    let docs = await Streamer.find(filtroLive).sort({ startTime: -1 }).lean();

    // 2º: streamers ativos nas últimas 24h
    if (docs.length === 0) {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        docs = await Streamer.find({
            hostId: { $ne: streamId },
            $or: [
                { isLive: true },
                { startTime: { $gte: dayAgo } },
                { updatedAt: { $gte: dayAgo } }
            ]
        }).sort({ startTime: -1 }).limit(20).lean();
    }

    // 3º: qualquer streamer do banco (exceto o atual)
    if (docs.length === 0) {
        docs = await Streamer.find({ hostId: { $ne: streamId } })
            .sort({ updatedAt: -1 }).limit(20).lean();
    }

    return docs.map(s => ({
        userId: s.hostId,
        username: s.name || s.hostId,
        name: s.name || s.hostId,
        avatarUrl: s.avatar || '',
        status: (s.isLive && s.streamStatus === 'active') ? 'broadcasting' : 'offline'
    }));
};

router.get('/online-users', async (req, res) => {
    try {
        const { streamId, mode } = req.query;
        if (!streamId) {
            return res.status(400).json({ success: false, error: 'streamId é obrigatório' });
        }

        // Busca espectadores na sala (sempre) + streamers disponíveis
        const [viewers, streamerUsers] = await Promise.all([
            LiveUser.find({
                currentStreamId: streamId,
                status: { $in: ['viewing', 'co-host', 'pk-battle', 'broadcasting'] }
            }).sort({ lastActive: -1 }).lean(),
            buscarStreamersDisponiveis(streamId as string, mode === 'battle')
        ]);

        // Combina viewers + streamers, sem duplicar IDs
        const seen = new Set<string>();
        const combined = [...viewers, ...streamerUsers].filter(u => {
            const id = u.userId || (u as any).username;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });

        res.status(200).json({ success: true, users: combined });
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

        const invite = await LiveInvite.create({
            inviterUsername,
            inviterName: inviterName || inviterUsername,
            inviteeUsername,
            inviteeName: inviteeName || inviteeUsername,
            inviteType,
            streamId,
            status: 'pending'
        });

        const io = (req as any).app.get('io');
        if (io) {
            io.to(`user_${inviteeUsername}`).emit('live_invite', {
                type: inviteType,
                from: inviterUsername,
                fromName: inviterName || inviterUsername,
                streamId,
                inviteId: invite._id
            });
        }

        res.status(200).json({ success: true, invite });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao criar convite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/invite/respond', async (req, res) => {
    try {
        const { inviteId, action } = req.body;

        if (!inviteId || !action) {
            return res.status(400).json({ success: false, error: 'inviteId e action são obrigatórios' });
        }

        if (!['accepted', 'declined'].includes(action)) {
            return res.status(400).json({ success: false, error: 'action deve ser accepted ou declined' });
        }

        const invite = await LiveInvite.findByIdAndUpdate(
            inviteId,
            { status: action, updatedAt: new Date() },
            { new: true }
        );

        if (!invite) {
            return res.status(404).json({ success: false, error: 'Convite não encontrado' });
        }

        const io = (req as any).app.get('io');
        if (io) {
            io.to(`user_${invite.inviterUsername}`).emit('live_invite_response', {
                inviteId,
                status: action,
                from: invite.inviteeUsername
            });
        }

        res.status(200).json({ success: true, invite });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao responder convite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/invites/pending', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({ success: false, error: 'username é obrigatório' });
        }

        const invites = await LiveInvite.find({ inviteeUsername: username, status: 'pending' })
            .sort({ createdAt: -1 }).lean();

        res.status(200).json({ success: true, invites });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao listar convites pendentes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
