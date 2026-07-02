import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import { Streamer } from '../models';

const router = express.Router();

router.use(protect);

router.post('/validate-access', async (req: AuthRequest, res) => {
  try {
    const { streamId, action } = req.body;
    const userId = req.user!.id;

    if (!streamId || !action) {
      return res.status(400).json({ allowed: false, reason: 'streamId e action são obrigatórios' });
    }

    if (action !== 'publish' && action !== 'play') {
      return res.status(400).json({ allowed: false, reason: 'action deve ser publish ou play' });
    }

    const stream = await Streamer.findOne({
      $or: [
        { id: streamId },
        { streamKey: streamId }
      ]
    }).lean();

    if (!stream) {
      return res.status(404).json({ allowed: false, reason: 'Transmissão não encontrada' });
    }

    if (action === 'publish') {
      if (stream.hostId !== userId) {
        return res.status(403).json({
          allowed: false,
          reason: 'Apenas o host da transmissão pode publicar'
        });
      }

      return res.json({ allowed: true });
    }

    if (action === 'play') {
      if (stream.kickedUsers?.includes(userId)) {
        return res.status(403).json({
          allowed: false,
          reason: 'Você foi removido desta transmissão'
        });
      }

      if (stream.isPrivate) {
        const isAuthorized =
          userId === stream.hostId ||
          stream.moderators?.includes(userId);

        if (!isAuthorized) {
          return res.status(403).json({
            allowed: false,
            reason: 'Esta transmissão é privada'
          });
        }
      }

      return res.json({ allowed: true });
    }
  } catch (error: any) {
    console.error('[STREAM-ACCESS] Erro ao validar acesso:', error.message);
    res.status(500).json({ allowed: false, reason: 'Erro interno ao validar acesso' });
  }
});

export default router;
