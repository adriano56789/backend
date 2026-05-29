import express from 'express';
import { ChildProcess } from 'child_process';
import { User, Streamer, Battle } from '../models';
import { startBattleMixer, stopMixer } from '../services/FfmpegService';

const router = express.Router();
const activeMixers = new Map<string, ChildProcess>();
const battleTimers = new Map<string, NodeJS.Timeout>();

// GET /api/pk — listar batalhas ativas
router.get('/', async (req, res) => {
  try {
    const userId = req.headers['user-id'] as string || req.query.userId as string;
    const filter: any = { status: { $ne: 'finished' } };
    if (userId) {
      filter.$or = [
        { streamerA: userId },
        { streamerB: userId }
      ];
    }
    const battles = await Battle.find(filter)
      .populate('streamerA', 'id name displayName avatarUrl')
      .populate('streamerB', 'id name displayName avatarUrl')
      .sort({ createdAt: -1 })
      .lean();
    res.json(battles);
  } catch (error: any) {
    console.error('[PK] Erro ao listar batalhas:', error);
    res.status(500).json({ error: 'Erro ao listar batalhas' });
  }
});

// GET /api/pk/:battleId — detalhes de uma batalha
router.get('/:battleId', async (req, res) => {
  try {
    const battle = await Battle.findById(req.params.battleId)
      .populate('streamerA', 'id name displayName avatarUrl')
      .populate('streamerB', 'id name displayName avatarUrl')
      .populate('winner', 'id name displayName avatarUrl');
    if (!battle) {
      return res.status(404).json({ error: 'Batalha não encontrada' });
    }
    res.json(battle);
  } catch (error: any) {
    console.error('[PK] Erro ao buscar batalha:', error);
    res.status(500).json({ error: 'Erro ao buscar batalha' });
  }
});

// GET /api/pk/active/:userId — batalhas ativas do usuário
router.get('/active/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const battles = await Battle.find({
      $or: [{ streamerA: userId }, { streamerB: userId }],
      status: 'active'
    })
      .populate('streamerA', 'id name displayName avatarUrl')
      .populate('streamerB', 'id name displayName avatarUrl')
      .sort({ createdAt: -1 })
      .lean();
    res.json(battles);
  } catch (error: any) {
    console.error('[PK] Erro ao buscar batalhas ativas:', error);
    res.status(500).json({ error: 'Erro ao buscar batalhas ativas' });
  }
});

// GET /api/pk/config — configuração PK
router.get('/config', async (req, res) => {
  const userId = req.headers['user-id'] as string;
  if (userId) {
    await User.findOneAndUpdate(
      { id: userId },
      { $push: { recentActivities: { action: 'pk_config_viewed', resource: 'pk_battle', timestamp: new Date(), endpoint: '/api/pk/config' } } }
    ).catch(console.error);
  }
  res.json({ duration: 300 });
});

// POST /api/pk/config — atualizar configuração
router.post('/config', async (req, res) => {
  const userId = req.body.userId || req.headers['user-id'] as string;
  if (userId) {
    await User.findOneAndUpdate(
      { id: userId },
      { $push: { recentActivities: { action: 'pk_config_updated', resource: 'pk_battle', timestamp: new Date(), endpoint: '/api/pk/config' } } }
    ).catch(console.error);
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
      User.findOne({ id: challengerId }),
      User.findOne({ id: opponentId })
    ]);
    if (!challenger || !opponent) {
      return res.status(404).json({ error: 'Um dos usuários não foi encontrado' });
    }

    const battle = await Battle.create({
      streamerA: challenger._id,
      streamerB: opponent._id,
      status: 'active',
      durationSeconds: durationSeconds || 300,
      startedAt: new Date()
    });

    const populated = await Battle.findById(battle._id)
      .populate('streamerA', 'id name displayName avatarUrl')
      .populate('streamerB', 'id name displayName avatarUrl');

    // Iniciar MCU fallback (FFmpeg) se ambas streams estiverem ativas
    const [streamA, streamB] = await Promise.all([
      Streamer.findOne({ hostId: challengerId, isLive: true }),
      Streamer.findOne({ hostId: opponentId, isLive: true })
    ]);
    if (streamA?.streamKey && streamB?.streamKey) {
      const mixer = startBattleMixer(battle._id.toString(), streamA.streamKey, streamB.streamKey);
      if (mixer) activeMixers.set(battle._id.toString(), mixer);
    }

    // Timer automático para encerrar a PK quando o tempo acabar
    const pkDuration = (durationSeconds || 300) * 1000;
    const autoEndTimer = setTimeout(async () => {
      try {
        const currentBattle = await Battle.findById(battle._id);
        if (!currentBattle || currentBattle.status !== 'active') return;

        let winnerId: string | null = null;
        if (currentBattle.scoreA > currentBattle.scoreB) {
          const w = await User.findById(currentBattle.streamerA.toString());
          if (w) winnerId = w.id;
        } else if (currentBattle.scoreB > currentBattle.scoreA) {
          const w = await User.findById(currentBattle.streamerB.toString());
          if (w) winnerId = w.id;
        }

        currentBattle.status = 'finished';
        currentBattle.endedAt = new Date();
        if (winnerId) {
          const wu = await User.findOne({ id: winnerId });
          if (wu) currentBattle.winner = wu._id;
        }
        await currentBattle.save();

        const mixer = activeMixers.get(battle._id.toString());
        if (mixer) { stopMixer(mixer); activeMixers.delete(battle._id.toString()); }

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
      } catch (err) {
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
          startedAt: battle.startedAt
        });
      });
    }

    await User.findOneAndUpdate(
      { id: challengerId },
      { $push: { recentActivities: { action: 'pk_battle_started', resource: 'pk_battle', timestamp: new Date(), endpoint: '/api/pk/start' } } }
    ).catch(console.error);

    res.json({ success: true, battleId: battle._id.toString(), battle: populated });
  } catch (error: any) {
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

    const battle = await Battle.findById(battleId);
    if (!battle || battle.status !== 'active') {
      return res.status(400).json({ error: 'Batalha não está ativa' });
    }

    const field = battle.streamerA.toString() === streamerId ? 'scoreA' : 'scoreB';
    const updated = await Battle.findByIdAndUpdate(
      battleId,
      { $inc: { [field]: 1 } },
      { new: true }
    );

    const io = req.app.get('io');
    if (io && updated) {
      io.to(`battle_${battleId}`).emit('pk_score_update', {
        battleId,
        scoreA: updated.scoreA,
        scoreB: updated.scoreB
      });
    }

    res.json({ success: true, scoreA: updated?.scoreA || 0, scoreB: updated?.scoreB || 0 });
  } catch (error: any) {
    console.error('[PK] Erro ao votar:', error);
    res.status(500).json({ error: 'Erro ao votar' });
  }
});

// POST /api/pk/end/:battleId — encerrar batalha
router.post('/end/:battleId', async (req, res) => {
  try {
    const { battleId } = req.params;
    const { winnerId } = req.body;

    const battle = await Battle.findById(battleId);
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

    const update: any = {
      status: 'finished',
      endedAt: new Date()
    };

    if (winnerId) {
      const winnerIsA = battle.streamerA.toString() === winnerId;
      const winnerIsB = battle.streamerB.toString() === winnerId;
      if (winnerIsA || winnerIsB) {
        const user = await User.findOne({ id: winnerId });
        if (user) {
          update.winner = user._id;
        }
      }
    } else {
      if (battle.scoreA > battle.scoreB) update.winner = battle.streamerA;
      else if (battle.scoreB > battle.scoreA) update.winner = battle.streamerB;
    }

    const updated = await Battle.findByIdAndUpdate(battleId, update, { new: true })
      .populate('streamerA', 'id name displayName avatarUrl')
      .populate('streamerB', 'id name displayName avatarUrl')
      .populate('winner', 'id name displayName avatarUrl');

    const io = req.app.get('io');
    if (io && updated) {
      const populated = await updated.populate('streamerA streamerB winner');
      const streamerAUser = populated.streamerA as any;
      const streamerBUser = populated.streamerB as any;
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
      stopMixer(mixer);
      activeMixers.delete(battleId);
    }

    const userId = req.body.userId || req.headers['user-id'] as string;
    if (userId) {
      await User.findOneAndUpdate(
        { id: userId },
        { $push: { recentActivities: { action: 'pk_battle_ended', resource: 'pk_battle', timestamp: new Date(), endpoint: '/api/pk/end' } } }
      ).catch(console.error);
    }

    res.json({ success: true, battle: updated });
  } catch (error: any) {
    console.error('[PK] Erro ao encerrar batalha:', error);
    res.status(500).json({ error: 'Erro ao encerrar batalha' });
  }
});

// POST /api/pk/heart — batimento cardíaco (keepalive)
router.post('/heart', async (req, res) => {
  const userId = req.body.userId || req.headers['user-id'] as string;
  if (userId) {
    await User.findOneAndUpdate(
      { id: userId },
      { $push: { recentActivities: { action: 'pk_heart_sent', resource: 'pk_battle', timestamp: new Date(), endpoint: '/api/pk/heart' } } }
    ).catch(console.error);
  }
  res.json({ success: true });
});

export default router;
