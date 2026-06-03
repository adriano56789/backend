"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const userResponse_1 = require("../utils/userResponse");
const router = express_1.default.Router();
// Função auxiliar para calcular signo
const calculateZodiacSign = (birthDate) => {
    const month = birthDate.getMonth() + 1;
    const day = birthDate.getDate();
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
        return 'Áries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
        return 'Touro';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
        return 'Gêmeos';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
        return 'Câncer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
        return 'Leão';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
        return 'Virgem';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
        return 'Libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
        return 'Escorpião';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
        return 'Sagitário';
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
        return 'Capricórnio';
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
        return 'Aquário';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
        return 'Peixes';
    return 'Desconhecido';
};
// Middleware para extrair usuário do token JWT
const getCurrentUserId = (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        console.log('❌ Nenhum token fornecido');
        return null;
    }
    try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('✅ Token decodificado - userId:', decoded.id);
        return decoded.id;
    }
    catch (error) {
        console.log('❌ Erro ao decodificar token:', error);
        return null;
    }
};
router.get('/imagens', async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const photos = await models_1.ProfilePhoto.find({ userId, isActive: true }).sort({ createdAt: -1 });
        // Converter ProfilePhoto[] para Obra[] (formato que frontend espera)
        const obras = photos.map(photo => ({
            id: photo.obraId,
            url: photo.photoUrl
        }));
        res.json(obras);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/imagens/:id', async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        console.log(`🗑️ Tentando deletar foto ${req.params.id} do usuário ${userId}`);
        // Usar 'obraId' para compatibilidade com frontend
        const photo = await models_1.ProfilePhoto.findOneAndUpdate({ obraId: req.params.id, userId }, { $set: { isActive: false } }, { new: true });
        if (!photo) {
            console.log(`❌ Foto não encontrada: ${req.params.id}`);
            return res.status(404).json({ error: 'Photo not found' });
        }
        console.log(`✅ Foto deletada: ${photo.obraId}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('❌ Erro ao deletar foto:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/imagens/ordenar', async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { orderedIds } = req.body;
        console.log(`🔄 Ordenando fotos: ${orderedIds.join(', ')}`);
        // Update order of photos - usar 'id' em vez de '_id'
        const updatePromises = orderedIds.map((photoId, index) => models_1.Photo.findOneAndUpdate({ id: photoId, userId }, { $set: { order: index } }, { new: true }));
        const updatedPhotos = await Promise.all(updatePromises);
        console.log(`✅ ${updatedPhotos.length} fotos ordenadas`);
        res.json({ success: true, images: updatedPhotos });
    }
    catch (error) {
        console.error('❌ Erro ao ordenar fotos:', error);
        res.status(500).json({ error: error.message });
    }
});
const singleValueRoutes = [
    { route: 'apelido', field: 'name' },
    { route: 'genero', field: 'gender' },
    { route: 'aniversario', field: 'birthday' },
    { route: 'apresentacao', field: 'bio' },
    { route: 'residencia', field: 'residence' },
    { route: 'estado-emocional', field: 'emotional_status' },
    { route: 'tags', field: 'tags' },
    { route: 'profissao', field: 'profession' }
];
singleValueRoutes.forEach(({ route, field }) => {
    router.get(`/${route}`, async (req, res) => {
        try {
            const userId = getCurrentUserId(req);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const user = await models_1.User.findOne({ id: userId });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({
                id: user.id,
                value: user[field] || ''
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.put(`/${route}`, async (req, res) => {
        try {
            const userId = getCurrentUserId(req);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const { value } = req.body;
            const user = await models_1.User.findOneAndUpdate({ id: userId }, {
                $set: { [field]: value },
                $push: {
                    recentActivities: {
                        action: 'profile_update',
                        resource: 'user_profile',
                        timestamp: new Date(),
                        endpoint: `/api/perfil/${route}`
                    }
                }
            }, { new: true });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            // Se for aniversário, salvar também no modelo Birthday
            if (field === 'birthday' && value) {
                const parts = value.split('/');
                if (parts.length === 3) {
                    const [day, month, year] = parts.map(Number);
                    const birthDate = new Date(year, month - 1, day);
                    const age = new Date().getFullYear() - birthDate.getFullYear();
                    const zodiacSign = calculateZodiacSign(birthDate);
                    await models_1.Birthday.findOneAndUpdate({ userId }, { $set: {
                            userId,
                            birthDate,
                            age,
                            zodiacSign,
                            isActive: true,
                            updatedAt: new Date()
                        } }, { upsert: true, new: true });
                    await models_1.User.findOneAndUpdate({ id: userId }, { $set: { age, zodiacSign, birthDate } });
                    const io = req.app.get('io');
                    if (io) {
                        io.emit('user_profile_updated', {
                            userId,
                            profile: { age, birthDate, zodiacSign, birthday: value },
                            timestamp: new Date()
                        });
                    }
                }
            }
            res.json({ success: true, user: (0, userResponse_1.standardizeUserResponse)(user) });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
});
exports.default = router;
