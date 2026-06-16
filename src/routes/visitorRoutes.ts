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

        // Salva a visita imediatamente sem depender de User.findOne
        const visitorDocId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        await Visitor.findOneAndUpdate(
            { visitorId: visitorName, visitedId: profileName },
            {
                $set: {
                    id: visitorDocId,
                    visitorId: visitorName,
                    visitedId: profileName,
                    visitedAt: new Date(),
                    visitorName: visitorName,
                    visitorAvatar: ''
                }
            },
            { upsert: true, new: true }
        );

        // Tenta enriquecer com dados do usuário (não bloqueante)
        try {
            const userData = await User.findOne({ name: visitorName }).select('name avatarUrl');
            if (userData) {
                await Visitor.findOneAndUpdate(
                    { visitorId: visitorName, visitedId: profileName },
                    { $set: { visitorName: userData.name, visitorAvatar: userData.avatarUrl || '' } }
                );
            }
        } catch { /* fallback silencioso */ }

        // Incrementa profileViews (tenta name e id)
        await User.findOneAndUpdate({ name: profileName }, { $inc: { profileViews: 1 } }).catch(() => {});
        await User.findOneAndUpdate({ id: profileName }, { $inc: { profileViews: 1 } }).catch(() => {});

        res.json({ success: true });
    } catch (error) {
        console.error('[VISITOR] Erro ao registrar visita:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

export default router;
