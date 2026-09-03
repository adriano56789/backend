"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const db_1 = require("../config/db");
const userResponse_1 = require("../utils/userResponse");
const router = express_1.default.Router();
// GET /api/identification/users - Listar todos os usuários
router.get('/users', async (req, res) => {
    try {
        await (0, db_1.connectDB)();
        const users = await models_1.User.find().lean();
        res.json((0, userResponse_1.standardizeUsersList)(users));
    }
    catch (error) {
        console.error('[IDENTIFICATION] Erro ao listar usuários:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/identification/users/:id - Localizar usuário pelo ID
router.get('/users/:id', async (req, res) => {
    try {
        await (0, db_1.connectDB)();
        const { id } = req.params;
        const user = await models_1.User.findOne({ id }).lean();
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json((0, userResponse_1.standardizeUserResponse)(user));
    }
    catch (error) {
        console.error('[IDENTIFICATION] Erro ao buscar usuário:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/identification/validate - Validar se um ID existe
router.post('/validate', async (req, res) => {
    try {
        await (0, db_1.connectDB)();
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ valid: false, error: 'ID não fornecido' });
        }
        const exists = await models_1.User.findOne({ id }).lean();
        res.json({ valid: !!exists, id, user: exists ? (0, userResponse_1.standardizeUserResponse)(exists) : null });
    }
    catch (error) {
        console.error('[IDENTIFICATION] Erro ao validar ID:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/identification/check/:id - Verificar se um ID existe (GET version)
router.get('/check/:id', async (req, res) => {
    try {
        await (0, db_1.connectDB)();
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ valid: false, error: 'ID não fornecido' });
        }
        const exists = await models_1.User.findOne({ id }).lean();
        res.json({ valid: !!exists, id });
    }
    catch (error) {
        console.error('[IDENTIFICATION] Erro ao verificar ID:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/identification/stats - Estatísticas de usuários
router.get('/stats', async (req, res) => {
    try {
        await (0, db_1.connectDB)();
        const [totalUsers, activeUsers, onlineUsers] = await Promise.all([
            models_1.User.countDocuments(),
            models_1.User.countDocuments({ isOnline: true }),
            models_1.User.countDocuments({ isLive: true }),
        ]);
        res.json({ totalUsers, activeUsers, onlineUsers });
    }
    catch (error) {
        console.error('[IDENTIFICATION] Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
