import express from 'express';
import { User, Visitor } from '../models';

const router = express.Router();

async function findUser(identifier: string) {
    let user = await User.findOne({ name: identifier }).select('name avatarUrl identification id');
    if (!user) {
        user = await User.findOne({ id: identifier }).select('name avatarUrl identification id');
    }
    return user;
}

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

        console.log(`[VISITOR] Buscando visitante: ${visitorName}, perfil: ${profileName}`);

        const [visitor, profile] = await Promise.all([
            findUser(visitorName),
            findUser(profileName)
        ]);

        if (!visitor || !profile) {
            console.error(`[VISITOR] Usuário não encontrado - visitante: ${visitor ? 'OK' : 'NULO'}, perfil: ${profile ? 'OK' : 'NULO'}`);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        console.log(`[VISITOR] Visitante: ${visitor.name} (id: ${visitor.id}), Perfil: ${profile.name} (id: ${profile.id})`);

        const visitorDocId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        await Visitor.findOneAndUpdate(
            { visitorId: visitorName, visitedId: profileName },
            {
                $set: {
                    id: visitorDocId,
                    visitorId: visitorName,
                    visitedId: profileName,
                    visitedAt: new Date(),
                    visitorName: visitor.name,
                    visitorAvatar: visitor.avatarUrl || ''
                }
            },
            { upsert: true, new: true }
        );

        console.log(`[VISITOR] Visita registrada: ${visitorName} → ${profileName}`);

        // Incrementar contador de visitas no perfil (tenta name e id)
        await User.findOneAndUpdate(
            { name: profileName },
            { $inc: { profileViews: 1 } }
        ).catch(() => {});
        await User.findOneAndUpdate(
            { id: profileName },
            { $inc: { profileViews: 1 } }
        ).catch(() => {});

        res.json({ success: true });
    } catch (error) {
        console.error('[VISITOR] Erro ao registrar visita:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

export default router;
