import express from 'express';
import { User } from '../models';
import { connectDB } from '../config/db';
import { standardizeUserResponse, standardizeUsersList } from '../utils/userResponse';

const router = express.Router();

interface IdentificationQuery {
    id?: string;
    email?: string;
    name?: string;
}

// GET /api/identification/users - Listar todos os usuários
router.get('/users', async (req, res) => {
    try {
        await connectDB();
        const users = await User.find().lean();
        res.json(standardizeUsersList(users));
    } catch (error: any) {
        console.error('[IDENTIFICATION] Erro ao listar usuários:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/identification/users/:id - Localizar usuário pelo ID
router.get('/users/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;

        const user = await User.findOne({ id }).lean();
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json(standardizeUserResponse(user));
    } catch (error: any) {
        console.error('[IDENTIFICATION] Erro ao buscar usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/identification/validate - Validar se um ID existe
router.post('/validate', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ valid: false, error: 'ID não fornecido' });
        }

        const exists = await User.findOne({ id }).lean();
        res.json({ valid: !!exists, id, user: exists ? standardizeUserResponse(exists) : null });
    } catch (error: any) {
        console.error('[IDENTIFICATION] Erro ao validar ID:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/identification/check/:id - Verificar se um ID existe (GET version)
router.get('/check/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ valid: false, error: 'ID não fornecido' });
        }

        const exists = await User.findOne({ id }).lean();
        res.json({ valid: !!exists, id });
    } catch (error: any) {
        console.error('[IDENTIFICATION] Erro ao verificar ID:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/identification/stats - Estatísticas de usuários
router.get('/stats', async (req, res) => {
    try {
        await connectDB();
        const [totalUsers, activeUsers, onlineUsers] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isOnline: true }),
            User.countDocuments({ isLive: true }),
        ]);
        res.json({ totalUsers, activeUsers, onlineUsers });
    } catch (error: any) {
        console.error('[IDENTIFICATION] Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;