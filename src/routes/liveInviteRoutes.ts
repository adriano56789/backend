// @ts-nocheck
import express from 'express';
import { LiveUser, LiveInvite } from '../models/LiveInvite';
import { Streamer, Battle, User, LiveCard } from '../models';
import { getUserIdFromToken } from '../middleware/auth';

const router = express.Router();

const SRS_HOST = process.env.SRS_HOST || 'api.livego.store';

// Timeout tracking for invites (30s auto-reject)
const inviteTimeouts = new Map<string, NodeJS.Timeout>();

function clearInviteTimeout(inviteId: string) {
    const existing = inviteTimeouts.get(inviteId);
    if (existing) {
        clearTimeout(existing);
        inviteTimeouts.delete(inviteId);
    }
}

// ─── Papel do participante (REST API) ───
// Persiste o papel do usuário na live para exibição de co-host/PK
// e evita duplicar registros de LiveUser por username.
router.post('/role', async (req, res) => {
    try {
        const { userId, username, name, avatarUrl, streamId, role } = req.body;
        const uid = userId || username;
        if (!uid || !streamId) {
            return res.status(400).json({ success: false, error: 'userId e streamId são obrigatórios' });
        }

        const status = role === 'co-host' ? 'co-host' : role === 'pk-battle' ? 'pk-battle' : 'viewing';

        await LiveUser.findOneAndUpdate(
            { username: uid },
            {
                userId: uid,
                username: uid,
                name: name || username || uid,
                avatarUrl: avatarUrl || '',
                status,
                currentStreamId: streamId,
                lastActive: new Date()
            },
            { upsert: true, returnDocument: 'after' }
        );

        res.status(200).json({ success: true, status });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao definir papel do participante:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
            { upsert: true, returnDocument: 'after' }
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

const buscarStreamersDisponiveis = async (currentHostId: string, apenasLive: boolean) => {
    // Buscar ao vivo de TODAS as fontes em paralelo
    const [liveCards, streamers, liveUsers] = await Promise.all([
        // 1º: LiveCard — fonte principal para WHIP/WebRTC
        LiveCard.find({
            isLive: true,
            streamStatus: { $in: ['active', 'live'] },
            hostId: { $ne: currentHostId }
        }).sort({ updatedAt: -1 }).limit(20).lean(),
        // 2º: Streamer — fonte legada para RTMP/SRS
        Streamer.find({
            isLive: true,
            hostId: { $ne: currentHostId }
        }).sort({ startTime: -1 }).lean(),
        // 3º: User — flag isLive como fallback
        User.find({
            isLive: true,
            id: { $ne: currentHostId }
        }).sort({ updatedAt: -1 }).limit(20).lean()
    ]);

    // Mapa para deduplicar por hostId/userId
    const seen = new Set<string>();
    seen.add(currentHostId);
    const docs: any[] = [];

    const addIfNotSeen = (id: string, obj: any) => {
        if (seen.has(id)) return;
        seen.add(id);
        docs.push(obj);
    };

    // Adicionar LiveCards
    for (const c of liveCards) {
        addIfNotSeen(c.hostId, {
            hostId: c.hostId,
            name: c.name || c.hostId,
            avatar: c.avatar || '',
            isLive: true,
            streamStatus: c.streamStatus || 'active'
        });
    }

    // Adicionar Streamers (não duplicados)
    for (const s of streamers) {
        addIfNotSeen(s.hostId, {
            hostId: s.hostId,
            name: s.name || s.hostId,
            avatar: s.avatar || '',
            isLive: true,
            streamStatus: s.streamStatus || 'active'
        });
    }

    // Adicionar Users (não duplicados)
    for (const u of liveUsers) {
        addIfNotSeen(u.id, {
            hostId: u.id,
            name: u.name || (u as any).username || u.id,
            avatar: u.avatarUrl || '',
            isLive: true,
            streamStatus: 'active'
        });
    }

    // Se não for modo battle, incluir também streamers recentes (últimas 24h)
    if (!apenasLive && docs.length === 0) {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentStreamers = await Streamer.find({
            hostId: { $ne: currentHostId, $nin: [...seen] },
            $or: [
                { startTime: { $gte: dayAgo } },
                { updatedAt: { $gte: dayAgo } }
            ]
        }).sort({ startTime: -1 }).limit(20).lean();

        for (const s of recentStreamers) {
            addIfNotSeen(s.hostId, {
                hostId: s.hostId,
                name: s.name || s.hostId,
                avatar: s.avatar || '',
                isLive: s.isLive || false,
                streamStatus: s.streamStatus || 'ended'
            });
        }
    }

    // Último fallback: qualquer streamer
    if (!apenasLive && docs.length === 0) {
        const anyStreamers = await Streamer.find({ hostId: { $ne: currentHostId, $nin: [...seen] } })
            .sort({ updatedAt: -1 }).limit(20).lean();

        for (const s of anyStreamers) {
            addIfNotSeen(s.hostId, {
                hostId: s.hostId,
                name: s.name || s.hostId,
                avatar: s.avatar || '',
                isLive: s.isLive || false,
                streamStatus: s.streamStatus || 'ended'
            });
        }
    }

    console.log(`[LiveInvite] buscarStreamersDisponiveis(currentHostId=${currentHostId}, apenasLive=${apenasLive}) → ${docs.length} resultados (${liveCards.length} LiveCards, ${streamers.length} Streamers, ${liveUsers.length} Users)`);

    return docs.map((s: any) => ({
        userId: s.hostId,
        username: s.name || s.hostId,
        name: s.name || s.hostId,
        avatarUrl: s.avatar || '',
        status: 'broadcasting'
    }));
};

router.get('/online-users', async (req, res) => {
    try {
        const { streamId, mode } = req.query;
        if (!streamId) {
            return res.status(400).json({ success: false, error: 'streamId é obrigatório' });
        }

        // Extrair hostId do JWT para excluir o próprio usuário da lista
        const tokenUserId = getUserIdFromToken(req);
        console.log(`[LiveInvite] GET /online-users streamId=${streamId} mode=${mode} tokenUserId=${tokenUserId}`);

        // Busca espectadores na sala (sempre) + streamers disponíveis
        const [viewers, streamerUsers] = await Promise.all([
            LiveUser.find({
                currentStreamId: streamId,
                status: { $in: ['viewing', 'co-host', 'pk-battle', 'broadcasting'] }
            }).sort({ lastActive: -1 }).lean(),
            buscarStreamersDisponiveis(tokenUserId || (streamId as string), mode === 'battle')
        ]);

        console.log(`[LiveInvite] viewers=${viewers.length} streamerUsers=${streamerUsers.length}`);

        // Combina viewers + streamers, sem duplicar IDs, excluindo o próprio usuário
        const seen = new Set<string>();
        if (tokenUserId) seen.add(tokenUserId);
        const combined = [...viewers, ...streamerUsers].filter(u => {
            const id = u.userId || (u as any).username;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });

        console.log(`[LiveInvite] combined final=${combined.length} usuários`);
        if (combined.length > 0) {
            console.log(`[LiveInvite] usuários:`, combined.map((u: any) => ({ userId: u.userId, name: u.name, status: u.status })));
        }

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

        // Auto-reject after 30s timeout
        const timeoutMs = 30000;
        const timeoutId = setTimeout(async () => {
            try {
                const stillPending = await LiveInvite.findById(invite._id);
                if (!stillPending || stillPending.status !== 'pending') return;

                stillPending.status = 'expired';
                await stillPending.save();

                const io = (req as any).app.get('io');
                if (io) {
                    io.to(`user_${inviterUsername}`).emit('live_invite_response', {
                        inviteId: invite._id.toString(),
                        status: 'expired',
                        from: inviteeUsername,
                        inviteeName
                    });
                    io.to(`user_${inviteeUsername}`).emit('live_invite_timeout', {
                        inviteId: invite._id.toString(),
                        type: inviteType,
                        from: inviterUsername,
                        fromName: inviterName || inviterUsername
                    });
                }
                console.log(`[LiveInvite] Convite ${invite._id} expirou automaticamente (30s timeout)`);
            } catch (err) {
                console.error('[LiveInvite] Erro ao processar timeout do convite:', err);
            } finally {
                inviteTimeouts.delete(invite._id.toString());
            }
        }, timeoutMs);
        inviteTimeouts.set(invite._id.toString(), timeoutId);

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

        // Notificação centralizada via NotificationService
        try {
            const { NotificationService } = await import('../services/NotificationService');
            await NotificationService.notifyLiveInvite(
                io,
                inviteeUsername,
                inviterUsername,
                inviterName || inviterUsername,
                inviteType,
                invite._id.toString(),
                streamId,
            );
        } catch (notifErr) {
            console.error('[LiveInvite] Erro NotificationService:', notifErr);
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
            { returnDocument: 'after' }
        );

        if (!invite) {
            return res.status(404).json({ success: false, error: 'Convite não encontrado' });
        }

        // Limpar timeout do convite
        clearInviteTimeout(inviteId);

        // Se aceito, atualizar status do LiveUser
        if (action === 'accepted') {
            const newStatus = invite.inviteType === 'co-host' ? 'co-host' : 'pk-battle';
            await Promise.all([
                LiveUser.findOneAndUpdate(
                    { username: invite.inviterUsername },
                    { status: newStatus, lastActive: new Date() }
                ),
                LiveUser.findOneAndUpdate(
                    { username: invite.inviteeUsername },
                    { status: newStatus, lastActive: new Date() }
                )
            ]);
        }

        const io = (req as any).app.get('io');
        if (io) {
            io.to(`user_${invite.inviterUsername}`).emit('live_invite_response', {
                inviteId,
                status: action,
                from: invite.inviteeUsername
            });
        }

        // Notificação centralizada via NotificationService
        try {
            const { NotificationService } = await import('../services/NotificationService');
            await NotificationService.notifyLiveInviteResponded(
                io,
                invite.inviterUsername,
                invite.inviteeUsername,
                invite.inviteeName || invite.inviteeUsername,
                invite.inviteType,
                action as 'accepted' | 'declined',
                inviteId,
                invite.streamId,
            );
        } catch (notifErr) {
            console.error('[LiveInvite] Erro NotificationService respond:', notifErr);
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

// ─── Convites enviados (respostas) ────────────────────────────────────
// Usado pelo inviter para detectar accepted/declined/expired via polling,
// já que o chat/presença usam Socket.IO mas os convites co-host/PK não têm
// evento próprio de resposta via socket.
router.get('/invites/sent', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({ success: false, error: 'username é obrigatório' });
        }

        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const invites = await LiveInvite.find({
            inviterUsername: username,
            status: { $ne: 'pending' },
            updatedAt: { $gte: fiveMinAgo }
        }).sort({ updatedAt: -1 }).lean();

        res.status(200).json({ success: true, invites });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao listar convites enviados:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Co-Host Exit ─────────────────────────────────────────────────────
router.post('/co-host/exit', async (req, res) => {
    try {
        const { userId, streamId } = req.body;
        if (!userId || !streamId) {
            return res.status(400).json({ success: false, error: 'userId e streamId são obrigatórios' });
        }

        await LiveInvite.updateMany(
            {
                $or: [{ inviterUsername: userId }, { inviteeUsername: userId }],
                status: 'pending',
                inviteType: 'co-host'
            },
            { status: 'declined', updatedAt: new Date() }
        );

        await LiveUser.findOneAndUpdate(
            { username: userId },
            { status: 'viewing', lastActive: new Date() }
        );

        const io = (req as any).app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('live_cohost_exited', { userId, streamId });
            io.to(streamId).emit('live_user_left', { userId, username: userId });
        }

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao sair de co-host:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Battle Exit ──────────────────────────────────────────────────────
router.post('/battle/exit', async (req, res) => {
    try {
        const { userId, streamId, battleId } = req.body;
        if (!userId || !streamId) {
            return res.status(400).json({ success: false, error: 'userId e streamId são obrigatórios' });
        }

        await LiveInvite.updateMany(
            {
                $or: [{ inviterUsername: userId }, { inviteeUsername: userId }],
                status: 'pending',
                inviteType: 'pk-battle'
            },
            { status: 'declined', updatedAt: new Date() }
        );

        await LiveUser.findOneAndUpdate(
            { username: userId },
            { status: 'viewing', lastActive: new Date() }
        );

        if (battleId) {
            try {
                const battle = await Battle.findById(battleId);
                if (battle && battle.status === 'active') {
                    battle.status = 'finished';
                    battle.endedAt = new Date();
                    await battle.save();

                    const io = (req as any).app.get('io');
                    if (io) {
                        [battle.streamerA?.toString(), battle.streamerB?.toString()].forEach(async (uid) => {
                            const u = await User.findById(uid);
                            if (u) {
                                io.to(`user_${u.id}`).emit('pk_battle_end', {
                                    battleId,
                                    winner: null,
                                    scoreA: battle.scoreA,
                                    scoreB: battle.scoreB,
                                    endedAt: battle.endedAt,
                                    reason: 'exit'
                                });
                            }
                        });
                    }
                }
            } catch (pkErr) {
                console.error('[LiveInvite] Erro ao encerrar batalha no exit:', pkErr);
            }
        }

        const io = (req as any).app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('live_battle_exited', { userId, streamId, battleId });
            io.to(streamId).emit('live_user_left', { userId, username: userId });
        }

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('[LiveInvite] Erro ao sair da batalha:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;

