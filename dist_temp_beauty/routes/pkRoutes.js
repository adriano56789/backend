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
const activityHelpers_1 = require("../utils/activityHelpers");
const FfmpegService_1 = require("../services/FfmpegService");
const WebhookBroadcasterService_1 = require("../services/WebhookBroadcasterService");
const router = express_1.default.Router();
const activeMixers = new Map();
const battleTimers = new Map();
// GET /api/pk — listar batalhas ativas
router.get('/', async (req, res) => {
    try {
        const userId = req.headers['user-id'] || req.query.userId;
        const filter = { status: { $ne: 'finished' } };
        if (userId) {
            const user = await models_1.User.findOne({ id: userId }).select('_id').lean();
            if (user) {
                filter.$or = [
                    { streamerA: user._id },
                    { streamerB: user._id }
                ];
            }
        }
        const battles = await models_1.Battle.find(filter)
            .populate('streamerA', 'id name displayName avatarUrl')
            .populate('streamerB', 'id name displayName avatarUrl')
            .sort({ createdAt: -1 })
            .lean();
        res.json(battles);
    }
    catch (error) {
        console.error('[PK] Erro ao listar batalhas:', error);
        res.status(500).json({ error: 'Erro ao listar batalhas' });
    }
});
// GET /api/pk/:battleId — detalhes de uma batalha
router.get('/:battleId', async (req, res) => {
    try {
        const battle = await models_1.Battle.findById(req.params.battleId)
            .populate('streamerA', 'id name displayName avatarUrl')
            .populate('streamerB', 'id name displayName avatarUrl')
            .populate('winner', 'id name displayName avatarUrl');
        if (!battle) {
            return res.status(404).json({ error: 'Batalha não encontrada' });
        }
        res.json(battle);
    }
    catch (error) {
        console.error('[PK] Erro ao buscar batalha:', error);
        res.status(500).json({ error: 'Erro ao buscar batalha' });
    }
});
// GET /api/pk/active/:userId — batalhas ativas do usuário
router.get('/active/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await models_1.User.findOne({ id: userId }).select('_id').lean();
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        const battles = await models_1.Battle.find({
            $or: [{ streamerA: user._id }, { streamerB: user._id }],
            status: 'active'
        })
            .populate('streamerA', 'id name displayName avatarUrl')
            .populate('streamerB', 'id name displayName avatarUrl')
            .sort({ createdAt: -1 })
            .lean();
        res.json(battles);
    }
    catch (error) {
        console.error('[PK] Erro ao buscar batalhas ativas:', error);
        res.status(500).json({ error: 'Erro ao buscar batalhas ativas' });
    }
});
// GET /api/pk/config — configuração PK
router.get('/config', async (req, res) => {
    const userId = req.headers['user-id'];
    if (userId) {
        await (0, activityHelpers_1.pushRecentActivity)(userId, {
            action: 'pk_config_viewed',
            resource: 'pk_battle',
            endpoint: '/api/pk/config'
        }, console.error);
    }
    res.json({ duration: 300 });
});
// POST /api/pk/config — atualizar configuração
router.post('/config', async (req, res) => {
    const userId = req.body.userId || req.headers['user-id'];
    if (userId) {
        await (0, activityHelpers_1.pushRecentActivity)(userId, {
            action: 'pk_config_updated',
            resource: 'pk_battle',
            endpoint: '/api/pk/config'
        }, console.error);
    }
    res.json({ success: true, config: {} });
});
// POST /api/pk/start — iniciar batalha PK
router.post('/start', async (req, res) => {
    try {
        const { challengerId, opponentId, durationSeconds } = req.body;
        if (!challengerId || !opponentId) {
            return res.status(400).json({ error: 'challengerId e opponentId são obrigatórios' });
        }
        const [challenger, opponent] = await Promise.all([
            models_1.User.findOne({ id: challengerId }),
            models_1.User.findOne({ id: opponentId })
        ]);
        if (!challenger || !opponent) {
            return res.status(404).json({ error: 'Um dos usuários não foi encontrado' });
        }
        const battle = await models_1.Battle.create({
            streamerA: challenger._id,
            streamerB: opponent._id,
            status: 'active',
            durationSeconds: durationSeconds || 300,
            startedAt: new Date()
        });
        const populated = await models_1.Battle.findById(battle._id)
            .populate('streamerA', 'id name displayName avatarUrl')
            .populate('streamerB', 'id name displayName avatarUrl');
        // 🪝 Webhook LiveGo: batalha criada + iniciada
        try {
            (0, WebhookBroadcasterService_1.emitWebhook)('LiveGo.CallbackAfterCreateBattle', { BattleId: battle._id.toString(), FromRoomId: challengerId, ToRoomIdList: [opponentId], Duration: (durationSeconds || 300) * 1000, NeedResponse: false, ExtensionInfo: '', EventTime: Date.now() });
        }
        catch (e) {
            console.warn('[WEBHOOK] battle created', e);
        }
        try {
            (0, WebhookBroadcasterService_1.emitWebhook)('LiveGo.CallbackAfterStartBattle', { BattleId: battle._id.toString(), FromRoomId: challengerId, ToRoomIdList: [opponentId], StartTime: battle.startedAt ? battle.startedAt.getTime() : Date.now(), Duration: (durationSeconds || 300) * 1000, EventTime: Date.now() });
        }
        catch (e) {
            console.warn('[WEBHOOK] battle started', e);
        }
        // Iniciar MCU fallback (FFmpeg) se ambas streams estiverem ativas
        const [streamA, streamB] = await Promise.all([
            models_1.Streamer.findOne({ hostId: challengerId, isLive: true }),
            models_1.Streamer.findOne({ hostId: opponentId, isLive: true })
        ]);
        if (streamA?.streamKey && streamB?.streamKey) {
            const mixer = (0, FfmpegService_1.startBattleMixer)(battle._id.toString(), streamA.streamKey, streamB.streamKey);
            if (mixer)
                activeMixers.set(battle._id.toString(), mixer);
        }
        // Timer automático para encerrar a PK quando o tempo acabar
        const pkDuration = (durationSeconds || 300) * 1000;
        const autoEndTimer = setTimeout(async () => {
            try {
                const currentBattle = await models_1.Battle.findById(battle._id);
                if (!currentBattle || currentBattle.status !== 'active')
                    return;
                let winnerId = null;
                if (currentBattle.scoreA > currentBattle.scoreB) {
                    const w = await models_1.User.findById(currentBattle.streamerA.toString());
                    if (w)
                        winnerId = w.id;
                }
                else if (currentBattle.scoreB > currentBattle.scoreA) {
                    const w = await models_1.User.findById(currentBattle.streamerB.toString());
                    if (w)
                        winnerId = w.id;
                }
                currentBattle.status = 'finished';
                currentBattle.endedAt = new Date();
                if (winnerId) {
                    const wu = await models_1.User.findOne({ id: winnerId });
                    if (wu)
                        currentBattle.winner = wu._id;
                }
                await currentBattle.save();
                const mixer = activeMixers.get(battle._id.toString());
                if (mixer) {
                    (0, FfmpegService_1.stopMixer)(mixer);
                    activeMixers.delete(battle._id.toString());
                }
                const io = req.app.get('io');
                if (io) {
                    [challengerId, opponentId].forEach(uid => {
                        io.to(`user_${uid}`).emit('pk_battle_end', {
                            battleId: battle._id.toString(),
                            winner: winnerId,
                            scoreA: currentBattle.scoreA,
                            scoreB: currentBattle.scoreB,
                            endedAt: currentBattle.endedAt,
                            reason: 'timeout'
                        });
                    });
                }
                console.log(`⏰ [PK Timer] Batalha ${battle._id} encerrada automaticamente por tempo limite`);
                // 🪝 Webhook LiveGo: batalha encerrada (timer)
                try {
                    (0, WebhookBroadcasterService_1.emitWebhook)('LiveGo.CallbackAfterEndBattle', { BattleId: battle._id.toString(), Duration: pkDuration, CreateTime: Math.floor((battle.startedAt ? battle.startedAt.getTime() : Date.now()) / 1000), EndTime: Math.floor(Date.now() / 1000), OpType: 0, FromRoomId: challengerId, ToRoomIdList: [opponentId], ScoreA: currentBattle.scoreA, ScoreB: currentBattle.scoreB, Winner: winnerId || null, Reason: 'timeout', EventTime: Date.now() });
                }
                catch (e) {
                    console.warn('[WEBHOOK] battle ended (timer)', e);
                }
            }
            catch (err) {
                console.error(`[PK Timer] Erro ao encerrar batalha ${battle._id}:`, err);
            }
        }, pkDuration);
        battleTimers.set(battle._id.toString(), autoEndTimer);
        const io = req.app.get('io');
        if (io) {
            [challengerId, opponentId].forEach(uid => {
                io.to(`user_${uid}`).emit('pk_battle_start', {
                    battleId: battle._id.toString(),
                    streamerA: challengerId,
                    streamerB: opponentId,
                    durationSeconds: durationSeconds || 300,
                    startedAt: battle.startedAt,
                });
            });
        }
        await (0, activityHelpers_1.pushRecentActivity)(challengerId, {
            action: 'pk_battle_started',
            resource: 'pk_battle',
            endpoint: '/api/pk/start'
        }, console.error);
        res.json({
            success: true,
            battleId: battle._id.toString(),
            battle: populated,
        });
    }
    catch (error) {
        console.error('[PK] Erro ao iniciar batalha:', error);
        res.status(500).json({ error: 'Erro ao iniciar batalha' });
    }
});
// POST /api/pk/vote — votar (incrementar score)
router.post('/vote', async (req, res) => {
    try {
        const { battleId, streamerId } = req.body;
        if (!battleId || !streamerId) {
            return res.status(400).json({ error: 'battleId e streamerId são obrigatórios' });
        }
        const battle = await models_1.Battle.findById(battleId);
        if (!battle || battle.status !== 'active') {
            return res.status(400).json({ error: 'Batalha não está ativa' });
        }
        const field = battle.streamerA.toString() === streamerId ? 'scoreA' : 'scoreB';
        const updated = await models_1.Battle.findByIdAndUpdate(battleId, { $inc: { [field]: 1 } }, { returnDocument: 'after' });
        const io = req.app.get('io');
        if (io && updated) {
            io.to(`battle_${battleId}`).emit('pk_score_update', {
                battleId,
                scoreA: updated.scoreA,
                scoreB: updated.scoreB
            });
        }
        res.json({ success: true, scoreA: updated?.scoreA || 0, scoreB: updated?.scoreB || 0 });
    }
    catch (error) {
        console.error('[PK] Erro ao votar:', error);
        res.status(500).json({ error: 'Erro ao votar' });
    }
});
// POST /api/pk/end — encerrar batalha por userId+streamId (frontend)
router.post('/end', async (req, res) => {
    try {
        const { userId, streamId } = req.body;
        if (!userId || !streamId) {
            return res.status(400).json({ error: 'userId e streamId são obrigatórios' });
        }
        const user = await models_1.User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        const battle = await models_1.Battle.findOne({
            $or: [
                { streamerA: user._id },
                { streamerB: user._id }
            ],
            status: 'active'
        }).sort({ createdAt: -1 });
        if (!battle) {
            return res.json({ success: true, message: 'Nenhuma batalha ativa encontrada' });
        }
        // Limpar timer automático
        const existingTimer = battleTimers.get(battle._id.toString());
        if (existingTimer) {
            clearTimeout(existingTimer);
            battleTimers.delete(battle._id.toString());
        }
        const update = { status: 'finished', endedAt: new Date() };
        if (battle.scoreA > battle.scoreB)
            update.winner = battle.streamerA;
        else if (battle.scoreB > battle.scoreA)
            update.winner = battle.streamerB;
        const updated = await models_1.Battle.findByIdAndUpdate(battle._id, update, { returnDocument: 'after' });
        const io = req.app.get('io');
        if (io) {
            const populated = await updated?.populate('streamerA streamerB winner');
            const streamerAUser = populated?.streamerA;
            const streamerBUser = populated?.streamerB;
            [streamerAUser?.id, streamerBUser?.id].forEach(uid => {
                if (uid) {
                    io.to(`user_${uid}`).emit('pk_battle_end', {
                        battleId: battle._id.toString(),
                        winner: update.winner || null,
                        scoreA: updated?.scoreA || 0,
                        scoreB: updated?.scoreB || 0,
                        endedAt: update.endedAt,
                        reason: 'manual'
                    });
                }
            });
        }
        const mixer = activeMixers.get(battle._id.toString());
        if (mixer) {
            (0, FfmpegService_1.stopMixer)(mixer);
            activeMixers.delete(battle._id.toString());
        }
        res.json({ success: true, battle: updated });
    }
    catch (error) {
        console.error('[PK] Erro ao encerrar batalha:', error);
        res.status(500).json({ error: 'Erro ao encerrar batalha' });
    }
});
// POST /api/pk/end/:battleId — encerrar batalha
router.post('/end/:battleId', async (req, res) => {
    try {
        const { battleId } = req.params;
        const { winnerId } = req.body;
        const battle = await models_1.Battle.findById(battleId);
        if (!battle) {
            return res.status(404).json({ error: 'Batalha não encontrada' });
        }
        if (battle.status === 'finished') {
            return res.status(400).json({ error: 'Batalha já encerrada' });
        }
        // Limpar timer automático se existir
        const existingTimer = battleTimers.get(battleId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            battleTimers.delete(battleId);
        }
        const update = {
            status: 'finished',
            endedAt: new Date()
        };
        if (winnerId) {
            const winnerIsA = battle.streamerA.toString() === winnerId;
            const winnerIsB = battle.streamerB.toString() === winnerId;
            if (winnerIsA || winnerIsB) {
                const user = await models_1.User.findOne({ id: winnerId });
                if (user) {
                    update.winner = user._id;
                }
            }
        }
        else {
            if (battle.scoreA > battle.scoreB)
                update.winner = battle.streamerA;
            else if (battle.scoreB > battle.scoreA)
                update.winner = battle.streamerB;
        }
        const updated = await models_1.Battle.findByIdAndUpdate(battleId, update, { returnDocument: 'after' })
            .populate('streamerA', 'id name displayName avatarUrl')
            .populate('streamerB', 'id name displayName avatarUrl')
            .populate('winner', 'id name displayName avatarUrl');
        const io = req.app.get('io');
        if (io && updated) {
            const populated = await updated.populate('streamerA streamerB winner');
            const streamerAUser = populated.streamerA;
            const streamerBUser = populated.streamerB;
            [streamerAUser?.id, streamerBUser?.id].forEach(uid => {
                if (uid) {
                    io.to(`user_${uid}`).emit('pk_battle_end', {
                        battleId,
                        winner: winnerId || null,
                        scoreA: updated.scoreA,
                        scoreB: updated.scoreB,
                        endedAt: updated.endedAt
                    });
                }
            });
        }
        // Encerrar MCU mixer se ativo
        const mixer = activeMixers.get(battleId);
        if (mixer) {
            (0, FfmpegService_1.stopMixer)(mixer);
            activeMixers.delete(battleId);
        }
        const userId = req.body.userId || req.headers['user-id'];
        if (userId) {
            await (0, activityHelpers_1.pushRecentActivity)(userId, {
                action: 'pk_battle_ended',
                resource: 'pk_battle',
                endpoint: '/api/pk/end'
            }, console.error);
        }
        // 🪝 Webhook LiveGo: batalha encerrada (manual)
        if (updated) {
            try {
                (0, WebhookBroadcasterService_1.emitWebhook)('LiveGo.CallbackAfterEndBattle', { BattleId: battleId, CreateTime: battle.createdAt ? Math.floor(new Date(battle.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000), EndTime: Math.floor(Date.now() / 1000), OpType: 1, ScoreA: updated.scoreA, ScoreB: updated.scoreB, Winner: winnerId || null, Reason: 'manual', EventTime: Date.now() });
            }
            catch (e) {
                console.warn('[WEBHOOK] battle ended', e);
            }
        }
        res.json({ success: true, battle: updated });
    }
    catch (error) {
        console.error('[PK] Erro ao encerrar batalha:', error);
        res.status(500).json({ error: 'Erro ao encerrar batalha' });
    }
});
// POST /api/pk/heart — batimento cardíaco (keepalive)
router.post('/heart', async (req, res) => {
    const userId = req.body.userId || req.headers['user-id'];
    if (userId) {
        await (0, activityHelpers_1.pushRecentActivity)(userId, {
            action: 'pk_heart_sent',
            resource: 'pk_battle',
            endpoint: '/api/pk/heart'
        });
    }
    res.json({ success: true });
});
// GET /api/pk/invites/pending/:userId — convites PK pendentes
router.get('/invites/pending/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await models_1.User.findOne({ id: userId }).select('_id').lean();
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        }
        const { PKInvite } = await Promise.resolve().then(() => __importStar(require('../models')));
        const invites = await PKInvite.find({
            invitedId: user._id.toString(),
            status: 'pending'
        })
            .populate('inviterId', 'id name displayName avatarUrl')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, invites });
    }
    catch (error) {
        console.error('[PK] Erro ao buscar convites pendentes:', error);
        res.json({ success: true, invites: [] });
    }
});
// POST /api/pk/invites/:inviteId/respond — responder a convite PK
router.post('/invites/:inviteId/respond', async (req, res) => {
    try {
        const { inviteId } = req.params;
        const { status } = req.body;
        if (!status || !['accepted', 'declined'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Status deve ser accepted ou declined' });
        }
        const { PKInvite } = await Promise.resolve().then(() => __importStar(require('../models')));
        const invite = await PKInvite.findByIdAndUpdate(inviteId, { $set: { status, respondedAt: new Date() } }, { returnDocument: 'after' }).populate('inviterId', 'id name displayName avatarUrl');
        if (!invite) {
            return res.status(404).json({ success: false, error: 'Convite não encontrado' });
        }
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${invite.invitedId}`).emit('pk_invite_response', {
                inviteId,
                status,
                battleId: invite.battleId || null
            });
        }
        // 🪝 Webhook LiveGo: lista de assentos alterada (resposta a convite PK)
        try {
            (0, WebhookBroadcasterService_1.emitWebhook)('LiveGo.CallbackAfterSeatListChange', { RoomId: invite.battleId || '', InviteId: inviteId, Action: status, InviteType: 'pk-battle', Inviter: (invite.inviterId)?.id || invite.inviterId || '', Invitee: (invite.invitedId)?.toString() || '', Timestamp: Date.now() });
        }
        catch (e) {
            console.warn('[WEBHOOK] seat change (pk)', e);
        }
        res.json({ success: true, invite });
    }
    catch (error) {
        console.error('[PK] Erro ao responder convite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
