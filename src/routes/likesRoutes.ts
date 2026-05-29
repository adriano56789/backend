import express from 'express';
import { Streamer, User } from '../models';

const router = express.Router();

// POST /api/streams/:id/like - Adicionar curtida na transmissão
router.post('/streams/:id/like', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        const userId = req.body.userId;

        if (!userId) {
            return res.status(400).json({ error: 'ID do usuário é obrigatório' });
        }

        // Verificar se a transmissão existe
        const streamer = await Streamer.findOne({ id: streamId });
        if (!streamer) {
            return res.status(404).json({ error: 'Transmissão não encontrada' });
        }

        // Incrementar contador de curtidas no banco de dados + persistir atividade do usuário
        const currentLikes = streamer.likes || 0;
        const newLikes = currentLikes + 1;
        
        await Streamer.updateOne(
            { id: streamId },
            { $set: { likes: newLikes } }
        );

        // Persistir atividade do usuário que curtiu
        await User.findOneAndUpdate(
            { id: userId },
            { 
                $push: { 
                    recentActivities: {
                        action: 'like',
                        resource: 'content_engagement',
                        timestamp: new Date(),
                        endpoint: '/api/streams/:id/like'
                    }
                }
            }
        );

        // Emitir WebSocket para atualização em tempo real
        const io = req.app.get('io');
        if (io) {
            io.to(streamId).emit('stream_liked', {
                streamId,
                totalLikes: newLikes,
                userId: userId
            });
        }

        res.json({
            success: true,
            totalLikes: newLikes,
            message: 'Curtida registrada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao registrar curtida:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET /api/streams/:id/likes - Obter contador de curtidas
router.get('/streams/:id/likes', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        console.log(`[LIKES-API] Buscando likes para stream: ${streamId}`);
        console.log(`[LIKES-API] User-Agent: ${req.get('User-Agent')}`);
        console.log(`[LIKES-API] Timestamp: ${new Date().toISOString()}`);

        // Verificar se a transmissão existe
        const streamer = await Streamer.findOne({ id: streamId });
        console.log(`[LIKES-API] Stream encontrada no banco: ${streamer ? 'SIM' : 'NÃO'}`);
        
        if (!streamer) {
            console.log(`[LIKES-API] ERRO 404 - Stream não encontrada: ${streamId}`);
            
            // Buscar todas as streams para debug
            const allStreams = await Streamer.find({}).select('id isLive hostId name').limit(10);
            console.log(`[LIKES-API] Streams disponíveis no banco:`, allStreams.map(s => ({ id: s.id, isLive: s.isLive, hostId: s.hostId, name: s.name })));
            
            return res.status(404).json({ error: 'Transmissão não encontrada' });
        }

        // Retornar contador de curtidas do banco de dados
        const totalLikes = streamer.likes || 0;
        console.log(`[LIKES-API] Likes encontrados: ${totalLikes}, isLive: ${streamer.isLive}`);

        res.json({
            streamId,
            totalLikes,
            isLive: streamer.isLive
        });

    } catch (error) {
        console.error('[LIKES-API] Erro ao obter curtidas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST /api/streams/:id/likes/reset - Resetar contador (apenas para o streamer)
router.post('/streams/:id/likes/reset', async (req, res) => {
    try {
        const { id: streamId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'ID do usuário é obrigatório' });
        }

        // Verificar se o usuário é o dono da transmissão
        const streamer = await Streamer.findOne({ id: streamId, hostId: userId });
        if (!streamer) {
            return res.status(403).json({ error: 'Apenas o dono da transmissão pode resetar as curtidas' });
        }

        // Resetar contador no banco de dados
        await Streamer.updateOne(
            { id: streamId },
            { $set: { likes: 0 } }
        );

        // Emitir WebSocket para atualização em tempo real
        const io = req.app.get('io');
        if (io) {
            io.to(streamId).emit('stream_likes_reset', {
                streamId,
                totalLikes: 0
            });
        }

        res.json({
            success: true,
            totalLikes: 0,
            message: 'Contador de curtidas resetado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao resetar curtidas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

export default router;
