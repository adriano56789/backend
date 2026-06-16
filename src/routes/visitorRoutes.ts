import express from 'express';
import { User, Visitor } from '../models';

const router = express.Router();

// POST /api/visitors/record - Registrar visita ao perfil
router.post('/record', async (req, res) => {
    try {
        const { profileName, visitorName } = req.body;

        if (!profileName || !visitorName) {
            return res.status(400).json({ error: 'profileName e visitorName são obrigatórios' });
        }

        if (profileName === visitorName) {
            return res.status(400).json({ error: 'Usuário não pode visitar o próprio perfil' });
        }

        const [visitor, profile] = await Promise.all([
            User.findOne({ name: visitorName }).select('name avatarUrl identification'),
            User.findOne({ name: profileName }).select('name avatarUrl identification')
        ]);

        if (!visitor || !profile) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        await Visitor.findOneAndUpdate(
            { visitorName, visitedName: profileName },
            {
                $set: {
                    id: visitorId,
                    visitorId: visitorName,
                    visitedId: profileName,
                    visitedAt: new Date(),
                    visitorName: visitor.name,
                    visitorAvatar: visitor.avatarUrl
                }
            },
            { upsert: true, new: true }
        );

        await User.findOneAndUpdate(
            { name: profileName },
            { $inc: { profileViews: 1 } }
        ).catch(console.error);

        res.json({ success: true });
    } catch (error) {
        console.error('[VISITOR] Erro ao registrar visita:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

export default router;
