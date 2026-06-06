"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const urls_1 = require("../config/urls");
const Photo_1 = require("../models/Photo");
const Like_1 = require("../models/Like");
const models_1 = require("../models");
const router = express_1.default.Router();
// POST /api/photos/upload - Upload de foto para chat
router.post('/upload', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhuma imagem enviada' });
        }
        const user = await models_1.User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // Gerar URL da foto dinamicamente a partir da requisição
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.get('host') || 'api.livego.store';
        const baseUrl = `${proto}://${host}`;
        const photoUrl = `${baseUrl}/uploads/photos/${req.file.filename}`;
        // Adicionar ao array de fotos do usuário 
        if (!user.photos) {
            user.photos = [];
        }
        user.photos.push(photoUrl);
        await user.save();
        res.json({
            success: true,
            photoUrl,
            photos: user.photos
        });
    }
    catch (error) {
        console.error('Erro ao fazer upload de foto:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/photos/chat-message - Enviar mensagem de chat com foto
router.post('/chat-message', async (req, res) => {
    try {
        const { fromUserId, toUserId, text, chatId } = req.body;
        if (!fromUserId || !toUserId || !text || !chatId) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }
        // Verificar se há arquivo de foto
        let imageUrl = null;
        if (req.file) {
            imageUrl = (0, urls_1.getChatImageUrl)(req.file.filename);
        }
        // Criar mensagem com foto
        const createdMessage = await models_1.Message.create({
            chatId,
            fromUserId,
            toUserId,
            text,
            imageUrl,
            type: imageUrl ? 'image' : 'text',
            status: 'sent',
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        // Emitir via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('new_chat_message', {
                id: createdMessage.messageId,
                chatId,
                fromUserId,
                toUserId,
                text,
                imageUrl,
                type: createdMessage.type,
                status: createdMessage.status,
                messageId: createdMessage.messageId,
                createdAt: createdMessage.createdAt
            });
        }
        res.json({
            success: true,
            message: {
                id: createdMessage.messageId,
                imageUrl,
                type: createdMessage.type,
                messageId: createdMessage.messageId
            }
        });
    }
    catch (error) {
        console.error('Erro ao enviar mensagem com foto:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/users/:id/photos - Listar fotos do usuário
router.get('/users/:id/photos', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await models_1.User.findOne({ id }).select('photos');
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json({
            photos: user.photos || []
        });
    }
    catch (error) {
        console.error('Erro ao buscar fotos:', error);
        res.status(500).json({ error: error.message });
    }
});
// DELETE /api/users/:id/photos/:index - Remover foto
router.delete('/users/:id/photos/:index', async (req, res) => {
    try {
        const { id, index } = req.params;
        const user = await models_1.User.findOne({ id });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        const photoIndex = parseInt(index);
        if (isNaN(photoIndex) || photoIndex < 0 || !user.photos || photoIndex >= user.photos.length) {
            return res.status(400).json({ error: 'Índice de foto inválido' });
        }
        // Remover foto do array
        user.photos.splice(photoIndex, 1);
        await user.save();
        res.json({
            success: true,
            photos: user.photos
        });
    }
    catch (error) {
        console.error('Erro ao remover foto:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST /api/photos/:id/like - Dar like em uma foto
router.post('/:id/like', async (req, res) => {
    try {
        const userId = req.body.userId;
        const photoId = req.params.id;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        // Verificar se a foto existe
        let photo = await Photo_1.Photo.findOne({ _id: photoId });
        // Se não existir e for uma foto de chat (ID começa com "chat_"), criar automaticamente
        if (!photo && photoId.startsWith('chat_')) {
            // Extrair URL da foto de chat se possível, ou usar URL dinâmica
            const photoUrl = req.body.photoUrl || (0, urls_1.getChatImageUrl)(photoId.replace('chat_', '') + '.jpg');
            photo = await Photo_1.Photo.create({
                userId: userId,
                url: photoUrl,
                caption: 'Imagem compartilhada no chat',
                likes: 0,
                comments: 0,
                shares: 0,
                isPublic: true,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`✅ Foto de chat criada automaticamente: ${photoId}`);
        }
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }
        // Verificar se já deu like
        const existingLike = await Like_1.Like.findOne({ userId, photoId });
        if (existingLike) {
            return res.status(400).json({ error: 'Already liked' });
        }
        // Criar novo like + persistir atividade
        const like = await Like_1.Like.create({
            userId,
            photoId,
            timestamp: new Date().toISOString()
        });
        // Persistir atividade de like na foto
        await models_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: 'photo_liked',
                    resource: 'photo_interaction',
                    timestamp: new Date(),
                    endpoint: '/api/photos/:id/like'
                }
            }
        }).catch(console.error);
        // Incrementar contador de likes da foto
        await Photo_1.Photo.updateOne({ id: photoId }, { $inc: { likes: 1 } });
        // Buscar foto atualizada para retornar likes corretos
        const updatedPhoto = await Photo_1.Photo.findOne({ id: photoId });
        const io = req.app.get('io');
        io.emit('photo_updated', { photoId, userId, likes: updatedPhoto?.likes });
        res.json({
            success: true,
            likes: updatedPhoto?.likes || 1,
            isLiked: true
        });
    }
    catch (error) {
        console.error('Error liking photo:', error);
        res.status(500).json({ error: error.message });
    }
});
// DELETE /api/photos/:id/like - Remover like de uma foto
router.delete('/:id/like', async (req, res) => {
    try {
        const userId = req.body.userId;
        const photoId = req.params.id;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        // Verificar se o like existe
        const like = await Like_1.Like.findOne({ userId, photoId });
        if (!like) {
            return res.status(404).json({ error: 'Like not found' });
        }
        // Remover like + persistir atividade
        await Like_1.Like.deleteOne({ userId, photoId });
        // Persistir atividade de unlike na foto
        await models_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: 'photo_unliked',
                    resource: 'photo_interaction',
                    timestamp: new Date(),
                    endpoint: '/api/photos/:id/like'
                }
            }
        }).catch(console.error);
        // Decrementar contador de likes da foto
        await Photo_1.Photo.updateOne({ id: photoId }, { $inc: { likes: -1 } });
        const updatedPhotoAfter = await Photo_1.Photo.findOne({ id: photoId });
        const io = req.app.get('io');
        io.emit('photo_updated', { photoId, userId, likes: updatedPhotoAfter?.likes });
        res.json({
            success: true,
            liked: false
        });
    }
    catch (error) {
        console.error('Error unliking photo:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
