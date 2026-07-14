"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = __importDefault(require("express"));
const index_1 = require("../models/index");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Middleware para obter userId do token autenticado
const getCurrentUserId = (req) => {
    return req.user?.id || req.user?._id;
};
// GET /api/users/:userId/photos/avatar - Buscar avatar principal
router.get('/:userId/photos/avatar', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`🔍 Buscando avatar principal para usuário: ${userId}`);
        const avatar = await index_1.ProfilePhoto.findOne({
            userId,
            photoType: 'avatar',
            isMain: true,
            isActive: true
        });
        if (!avatar) {
            return res.status(404).json({
                success: false,
                error: 'Avatar não encontrado'
            });
        }
        res.json({
            success: true,
            data: {
                id: avatar.obraId,
                url: avatar.photoUrl,
                obraId: avatar.obraId,
                photoUrl: avatar.photoUrl,
                isMain: avatar.isMain,
                metadata: avatar.metadata,
                createdAt: avatar.createdAt
            }
        });
    }
    catch (error) {
        console.error('❌ Erro ao buscar avatar:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar avatar',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// GET /api/users/:userId/photos/cover - Buscar capa do perfil
router.get('/:userId/photos/cover', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`🔍 Buscando capa para usuário: ${userId}`);
        const cover = await index_1.ProfilePhoto.findOne({
            userId,
            photoType: 'cover',
            isActive: true
        });
        if (!cover) {
            return res.status(404).json({
                success: false,
                error: 'Capa não encontrada'
            });
        }
        res.json({
            success: true,
            data: {
                id: cover.obraId,
                url: cover.photoUrl,
                obraId: cover.obraId,
                photoUrl: cover.photoUrl,
                metadata: cover.metadata,
                createdAt: cover.createdAt
            }
        });
    }
    catch (error) {
        console.error('❌ Erro ao buscar capa:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar capa',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// GET /api/users/:userId/photos/gallery - Buscar galeria completa
router.get('/:userId/photos/gallery', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`🔍 Buscando galeria para usuário: ${userId}`);
        const gallery = await index_1.ProfilePhoto.find({
            userId,
            photoType: 'gallery',
            isActive: true
        }).sort({ order: 1 });
        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            data: gallery.map(photo => ({
                id: photo.obraId,
                url: photo.photoUrl,
                obraId: photo.obraId,
                photoUrl: photo.photoUrl,
                order: photo.order,
                metadata: photo.metadata,
                createdAt: photo.createdAt
            }))
        });
    }
    catch (error) {
        console.error('❌ Erro ao buscar galeria:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar galeria',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// GET /api/users/:userId/photos - Buscar todas as fotos do usuário
router.get('/:userId/photos', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`🔍 Buscando todas as fotos para usuário: ${userId}`);
        const photos = await index_1.ProfilePhoto.find({
            userId,
            isActive: true
        }).sort({ createdAt: -1 });
        // Organizar por tipo
        const avatar = photos.find(p => p.photoType === 'avatar' && p.isMain);
        const cover = photos.find(p => p.photoType === 'cover');
        const gallery = photos.filter(p => p.photoType === 'gallery');
        res.json({
            success: true,
            data: {
                avatar: avatar ? {
                    id: avatar.obraId,
                    url: avatar.photoUrl,
                    obraId: avatar.obraId,
                    photoUrl: avatar.photoUrl,
                    isMain: avatar.isMain,
                    metadata: avatar.metadata
                } : null,
                cover: cover ? {
                    id: cover.obraId,
                    url: cover.photoUrl,
                    obraId: cover.obraId,
                    photoUrl: cover.photoUrl,
                    metadata: cover.metadata
                } : null,
                gallery: gallery.map(photo => ({
                    id: photo.obraId,
                    url: photo.photoUrl,
                    obraId: photo.obraId,
                    photoUrl: photo.photoUrl,
                    order: photo.order,
                    metadata: photo.metadata
                }))
            }
        });
    }
    catch (error) {
        console.error('❌ Erro ao buscar fotos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar fotos',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// POST /api/users/:userId/photos - Adicionar nova foto
router.post('/:userId/photos', async (req, res) => {
    try {
        const { userId } = req.params;
        const { photoUrl, photoType, order = 0, metadata, obraId } = req.body;
        if (!photoUrl || !photoType) {
            return res.status(400).json({
                success: false,
                error: 'photoUrl e photoType são obrigatórios'
            });
        }
        console.log(`📸 Adicionando foto para usuário ${userId}: ${photoType}`);
        // Se for avatar, remover o status principal dos outros avatares
        if (photoType === 'avatar') {
            await index_1.ProfilePhoto.updateMany({ userId, photoType: 'avatar', isMain: true }, { $set: { isMain: false } });
        }
        const newPhoto = await index_1.ProfilePhoto.create({
            obraId: obraId || `obra_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            photoUrl,
            photoType,
            isMain: photoType === 'avatar',
            order,
            metadata: metadata || {
                originalName: `photo_${Date.now()}.jpg`,
                size: 0,
                mimeType: 'image/jpeg',
                uploadedAt: new Date()
            }
        });
        // Persistir atividade de upload de foto de perfil
        await index_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: `profile_${photoType}_uploaded`,
                    resource: 'profile_photo',
                    timestamp: new Date(),
                    endpoint: '/api/users/:userId/photos'
                }
            }
        }).catch(console.error);
        console.log(`✅ Foto criada: ${newPhoto.obraId}`);
        res.status(201).json({
            success: true,
            data: newPhoto,
            message: 'Foto adicionada com sucesso'
        });
    }
    catch (error) {
        console.error('❌ Erro ao adicionar foto:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao adicionar foto',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// PUT /api/users/:userId/photos/:obraId/set-main - Definir foto como avatar principal
router.put('/:userId/photos/:obraId/set-main', async (req, res) => {
    try {
        const { userId, obraId } = req.params;
        console.log(`👤 Definindo foto ${obraId} como avatar principal do usuário ${userId}`);
        // Verificar se a foto existe e pertence ao usuário
        const photo = await index_1.ProfilePhoto.findOne({ obraId: obraId, userId, photoType: 'avatar' });
        if (!photo) {
            return res.status(404).json({
                success: false,
                error: 'Foto não encontrada'
            });
        }
        // Remover status principal de outros avatares
        await index_1.ProfilePhoto.updateMany({ userId, photoType: 'avatar', isMain: true }, { isMain: false });
        // Definir esta foto como principal
        const updatedPhoto = await index_1.ProfilePhoto.findOneAndUpdate({ obraId: obraId }, { isMain: true, updatedAt: new Date() }, { returnDocument: 'after' });
        if (updatedPhoto) {
            // VALIDAÇÃO: Bloquear URLs Base64 - apenas permitir URLs normais
            if (updatedPhoto.photoUrl && updatedPhoto.photoUrl.startsWith('data:image')) {
                return res.status(400).json({
                    success: false,
                    error: 'URLs Base64 não são permitidas. Use o upload de arquivos.'
                });
            }
            await index_1.User.findOneAndUpdate({ id: userId }, { avatarUrl: updatedPhoto.photoUrl, updatedAt: new Date() });
            console.log(`✅ Avatar do usuário atualizado: ${updatedPhoto.photoUrl}`);
            // Sincronizar avatar com streams ativas do usuário
            await index_1.Streamer.updateMany({ hostId: userId }, {
                avatar: updatedPhoto.photoUrl,
                updatedAt: new Date()
            });
            console.log(`✅ Avatar sincronizado com streams do usuário: ${userId}`);
        }
        console.log(`✅ Foto ${obraId} definida como avatar principal`);
        res.json({
            success: true,
            message: 'Avatar principal atualizado com sucesso'
        });
    }
    catch (error) {
        console.error('❌ Erro ao definir avatar principal:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao definir avatar principal',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// PUT /api/users/:userId/photos/:obraId/order - Atualizar ordem da foto na galeria
router.put('/:userId/photos/:obraId/order', async (req, res) => {
    try {
        const { userId, obraId } = req.params;
        const { order } = req.body;
        if (order === undefined || order < 0) {
            return res.status(400).json({
                success: false,
                error: 'order é obrigatório e deve ser >= 0'
            });
        }
        console.log(`🔄 Atualizando ordem da foto ${obraId} para ${order}`);
        const photo = await index_1.ProfilePhoto.findOneAndUpdate({ obraId: obraId, userId, photoType: 'gallery' }, { $set: { order, updatedAt: new Date() } }, { returnDocument: 'after' });
        if (!photo) {
            return res.status(404).json({
                success: false,
                error: 'Foto não encontrada na galeria'
            });
        }
        console.log(`✅ Ordem atualizada: ${photo.obraId} -> ${order}`);
        res.json({
            success: true,
            data: photo,
            message: 'Ordem atualizada com sucesso'
        });
    }
    catch (error) {
        console.error('❌ Erro ao atualizar ordem:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar ordem',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// === ROTAS PARA USUÁRIO AUTENTICADO (me) ===
// GET /api/users/me/photos - Buscar todas as fotos do usuário atual
router.get('/me/photos', auth_1.protect, async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não autenticado'
            });
        }
        console.log(`🔍 Buscando fotos do usuário autenticado: ${userId}`);
        const photos = await index_1.ProfilePhoto.find({
            userId,
            isActive: true
        }).sort({ createdAt: -1 });
        // Organizar por tipo
        const avatar = photos.find(p => p.photoType === 'avatar' && p.isMain);
        const cover = photos.find(p => p.photoType === 'cover');
        const gallery = photos.filter(p => p.photoType === 'gallery');
        res.json({
            success: true,
            data: {
                avatar: avatar ? {
                    id: avatar.obraId,
                    url: avatar.photoUrl,
                    obraId: avatar.obraId,
                    photoUrl: avatar.photoUrl,
                    isMain: avatar.isMain,
                    metadata: avatar.metadata
                } : null,
                cover: cover ? {
                    id: cover.obraId,
                    url: cover.photoUrl,
                    obraId: cover.obraId,
                    photoUrl: cover.photoUrl,
                    metadata: cover.metadata
                } : null,
                gallery: gallery.map(photo => ({
                    id: photo.obraId,
                    url: photo.photoUrl,
                    obraId: photo.obraId,
                    photoUrl: photo.photoUrl,
                    order: photo.order,
                    metadata: photo.metadata
                }))
            }
        });
    }
    catch (error) {
        console.error('❌ Erro ao buscar fotos do usuário:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar fotos',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// DELETE /api/users/me/photos/:obraId - Remover foto do usuário atual
router.delete('/me/photos/:obraId', auth_1.protect, async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        const { obraId } = req.params;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não autenticado'
            });
        }
        console.log(`🗑️ Removendo foto ${obraId} do usuário ${userId}`);
        const photo = await index_1.ProfilePhoto.findOne({ obraId: obraId, userId });
        if (!photo) {
            return res.status(404).json({
                success: false,
                error: 'Foto não encontrada'
            });
        }
        // Soft delete - marcar como inativa em vez de remover
        await index_1.ProfilePhoto.findOneAndUpdate({ obraId: obraId }, { $set: { isActive: false, updatedAt: new Date() } });
        // Persistir atividade de remoção de foto
        await index_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: 'profile_photo_deleted',
                    resource: 'profile_photo',
                    timestamp: new Date(),
                    endpoint: '/api/users/me/photos/:obraId'
                }
            }
        }).catch(console.error);
        console.log(`✅ Foto ${obraId} removida (soft delete)`);
        res.json({
            success: true,
            message: 'Foto removida com sucesso'
        });
    }
    catch (error) {
        console.error('❌ Erro ao remover foto:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao remover foto',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// PUT /api/users/me/photos/:obraId/set-main - Definir foto como avatar principal do usuário atual
router.put('/me/photos/:obraId/set-main', auth_1.protect, async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        const { obraId } = req.params;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não autenticado'
            });
        }
        console.log(`👤 Definindo foto ${obraId} como avatar principal do usuário ${userId}`);
        // Verificar se a foto existe e pertence ao usuário
        const photo = await index_1.ProfilePhoto.findOne({ obraId: obraId, userId, photoType: 'avatar' });
        if (!photo) {
            return res.status(404).json({
                success: false,
                error: 'Foto não encontrada'
            });
        }
        // Remover status principal de outros avatares
        await index_1.ProfilePhoto.updateMany({ userId, photoType: 'avatar', isMain: true }, { $set: { isMain: false } });
        // Definir esta foto como principal
        const updatedPhoto = await index_1.ProfilePhoto.findOneAndUpdate({ obraId: obraId }, { $set: { isMain: true, updatedAt: new Date() } }, { returnDocument: 'after' });
        if (updatedPhoto) {
            // VALIDAÇÃO: Bloquear URLs Base64 - apenas permitir URLs normais
            if (updatedPhoto.photoUrl && updatedPhoto.photoUrl.startsWith('data:image')) {
                return res.status(400).json({
                    success: false,
                    error: 'URLs Base64 não são permitidas. Use o upload de arquivos.'
                });
            }
            await index_1.User.findOneAndUpdate({ id: userId }, { $set: { avatarUrl: updatedPhoto.photoUrl, updatedAt: new Date() } });
            console.log(`✅ Avatar do usuário atualizado: ${updatedPhoto.photoUrl}`);
            // Sincronizar avatar com streams ativas do usuário
            await index_1.Streamer.updateMany({ hostId: userId }, {
                $set: {
                    avatar: updatedPhoto.photoUrl,
                    updatedAt: new Date()
                }
            });
            console.log(`✅ Avatar sincronizado com streams do usuário: ${userId}`);
        }
        console.log(`✅ Foto ${obraId} definida como avatar principal`);
        res.json({
            success: true,
            message: 'Avatar principal atualizado com sucesso'
        });
    }
    catch (error) {
        console.error('❌ Erro ao definir avatar principal:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao definir avatar principal',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// PUT /api/users/:userId/photos/reorder - Reordenar fotos na galeria
router.put('/:userId/photos/reorder', async (req, res) => {
    try {
        const { userId } = req.params;
        const { photoOrders } = req.body; // Array de { obraId, order }
        console.log(`🔄 Reordenando fotos para usuário: ${userId}`);
        // Validar entrada
        if (!Array.isArray(photoOrders)) {
            return res.status(400).json({
                success: false,
                error: 'photoOrders deve ser um array'
            });
        }
        // Atualizar ordem de cada foto
        const bulkOps = photoOrders.map(({ obraId, order }) => ({
            updateOne: {
                filter: { obraId, userId, photoType: 'gallery' },
                update: { $set: { order } }
            }
        }));
        await index_1.ProfilePhoto.bulkWrite(bulkOps);
        res.json({
            success: true,
            message: 'Fotos reordenadas com sucesso'
        });
    }
    catch (error) {
        console.error('❌ Erro ao reordenar fotos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao reordenar fotos',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
// DELETE /api/users/:userId/photos/:obraId - Remover foto específica
router.delete('/:userId/photos/:obraId', async (req, res) => {
    try {
        const { userId, obraId } = req.params;
        console.log(`🗑️ Removendo foto ${obraId} do usuário ${userId}`);
        const photo = await index_1.ProfilePhoto.findOne({ obraId: obraId, userId });
        if (!photo) {
            return res.status(404).json({
                success: false,
                error: 'Foto não encontrada'
            });
        }
        // Soft delete - marcar como inativa em vez de remover
        await index_1.ProfilePhoto.findOneAndUpdate({ obraId: obraId }, { $set: { isActive: false, updatedAt: new Date() } });
        // Persistir atividade de remoção de foto
        await index_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: 'profile_photo_deleted',
                    resource: 'profile_photo',
                    timestamp: new Date(),
                    endpoint: '/api/users/:userId/photos/:obraId'
                }
            }
        }).catch(console.error);
        console.log(`✅ Foto ${obraId} removida (soft delete)`);
        res.json({
            success: true,
            message: 'Foto removida com sucesso'
        });
    }
    catch (error) {
        console.error('❌ Erro ao remover foto:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao remover foto',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});
exports.default = router;
