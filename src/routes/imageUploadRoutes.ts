import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { User, ProfilePhoto } from '../models';
import { protect, getUserIdFromToken } from '../middleware/auth';

const router = express.Router();

// Configuração do Multer para upload de galeria
const galleryStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/gallery');
        
        // Criar diretório se não existir
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Gerar nome único: gallery_timestamp.extensão
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `gallery_${uniqueSuffix}${ext}`);
    }
});

// Configuração do Multer para upload de vídeos
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/videos');
        
        // Criar diretório se não existir
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Gerar nome único: video_timestamp.extensão
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `video_${uniqueSuffix}${ext}`);
    }
});

const galleryUpload = multer({
    storage: galleryStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        // Aceitar apenas imagens
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem são permitidos'));
        }
    }
});

const videoUpload = multer({
    storage: videoStorage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max para vídeos
    },
    fileFilter: (req, file, cb) => {
        // Aceitar apenas vídeos
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de vídeo são permitidos'));
        }
    }
});

// POST /api/upload/gallery - Upload de imagem para galeria
router.post('/gallery', protect, galleryUpload.single('image'), async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Não autorizado - token inválido' 
            });
        }
        
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nenhum arquivo enviado' 
            });
        }

        // Construir URL da imagem
        const baseUrl = process.env.BASE_URL || 'https://api.livego.store';
        const imageUrl = `${baseUrl}/uploads/gallery/${req.file.filename}`;
        
        console.log(`📸 Upload de imagem para galeria do usuário ${userId}: ${imageUrl}`);

        // Criar registro da imagem na galeria
        const obraId = `gallery_${Date.now()}_${userId}`;
        const newPhoto = await ProfilePhoto.create({
            obraId,
            userId,
            photoUrl: imageUrl,
            photoType: 'gallery',
            isMain: false,
            order: 0,
            isActive: true,
            metadata: {
                originalName: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype,
                width: 0, // TODO: processar imagem para obter dimensões
                height: 0,
                uploadedAt: new Date()
            }
        });

        res.json({
            success: true,
            imageUrl,
            photoId: obraId,
            obraId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype,
            message: 'Imagem enviada para a galeria com sucesso'
        });

    } catch (error: any) {
        console.error('❌ Erro ao fazer upload para galeria:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao fazer upload da imagem',
            details: error.message
        });
    }
});

// POST /api/upload/video - Upload de vídeo
router.post('/video', protect, videoUpload.single('video'), async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Não autorizado - token inválido' 
            });
        }
        
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nenhum arquivo enviado' 
            });
        }

        // Construir URL do vídeo
        const baseUrl = process.env.BASE_URL || 'https://api.livego.store';
        const videoUrl = `${baseUrl}/uploads/videos/${req.file.filename}`;
        
        console.log(`🎥 Upload de vídeo do usuário ${userId}: ${videoUrl}`);

        // Criar registro do vídeo na galeria
        const obraId = `video_${Date.now()}_${userId}`;
        const newVideo = await ProfilePhoto.create({
            obraId,
            userId,
            photoUrl: videoUrl,
            photoType: 'video', // Usar 'video'
            isMain: false,
            order: 0,
            isActive: true,
            metadata: {
                originalName: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype,
                duration: 0, // TODO: processar vídeo para obter duração
                width: 0,
                height: 0,
                uploadedAt: new Date()
            }
        });

        res.json({
            success: true,
            videoUrl,
            videoId: obraId,
            obraId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype,
            message: 'Vídeo enviado com sucesso'
        });

    } catch (error: any) {
        console.error('❌ Erro ao fazer upload de vídeo:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao fazer upload do vídeo',
            details: error.message
        });
    }
});

// GET /api/user/:userId/images - Obter todas as imagens do usuário
router.get('/user/:userId/images', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = getUserIdFromToken(req);
        
        // Verificar se o usuário está solicitando suas próprias imagens
        if (userId !== currentUserId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Acesso negado - você só pode ver suas próprias imagens' 
            });
        }

        const images = await ProfilePhoto.find({ 
            userId,
            isActive: true 
        }).sort({ order: 1, createdAt: -1 });

        res.json({
            success: true,
            images: images.map(img => ({
                id: img.id,
                url: img.photoUrl,
                filename: img.metadata?.originalName || 'unknown',
                size: img.metadata?.size || 0,
                uploadedAt: img.createdAt,
                type: img.photoType,
                isMain: img.isMain
            })),
            count: images.length
        });

    } catch (error: any) {
        console.error('❌ Erro ao obter imagens do usuário:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao obter imagens',
            details: error.message
        });
    }
});

// GET /api/user/:userId/avatar - Obter avatar do usuário
router.get('/user/:userId/avatar', async (req, res) => {
    try {
        const { userId } = req.params;

        // Primeiro tentar obter do campo avatarUrl do usuário
        const user = await User.findOne({ id: userId });
        
        if (user?.avatarUrl) {
            return res.json({
                success: true,
                avatarUrl: user.avatarUrl,
                source: 'user_profile'
            });
        }

        // Se não tiver, tentar obter do ProfilePhoto
        const avatar = await ProfilePhoto.findOne({ 
            userId,
            photoType: 'avatar',
            isMain: true,
            isActive: true 
        });

        res.json({
            success: true,
            avatarUrl: avatar?.photoUrl || null,
            source: avatar ? 'profile_photos' : 'none'
        });

    } catch (error: any) {
        console.error('❌ Erro ao obter avatar do usuário:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao obter avatar',
            details: error.message
        });
    }
});

// PUT /api/user/:userId/avatar - Atualizar avatar do usuário
router.put('/user/:userId/avatar', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = getUserIdFromToken(req);
        const { avatarUrl } = req.body;
        
        // Verificar se o usuário está atualizando seu próprio avatar
        if (userId !== currentUserId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Acesso negado - você só pode atualizar seu próprio avatar' 
            });
        }

        if (!avatarUrl) {
            return res.status(400).json({ 
                success: false, 
                error: 'URL do avatar é obrigatória' 
            });
        }

        // Verificar se o usuário existe
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Usuário não encontrado' 
            });
        }

        // Atualizar avatarUrl do usuário
        const updatedUser = await User.findOneAndUpdate(
            { id: userId },
            { $set: { avatarUrl, updatedAt: new Date() } },
            { new: true }
        );

        // Emitir evento WebSocket para atualização em tempo real
        const io = req.app.get('io');
        if (io) {
            io.emit('avatar_updated', { userId, avatarUrl, timestamp: new Date().toISOString() });
        }

        res.json({
            success: true,
            avatarUrl,
            user: updatedUser,
            message: 'Avatar atualizado com sucesso'
        });

    } catch (error: any) {
        console.error('❌ Erro ao atualizar avatar:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao atualizar avatar',
            details: error.message
        });
    }
});

// DELETE /api/images/:imageId - Deletar imagem
router.delete('/images/:imageId', protect, async (req, res) => {
    try {
        const { imageId } = req.params;
        const userId = getUserIdFromToken(req);
        
        if (!imageId) {
            return res.status(400).json({ 
                success: false, 
                error: 'ID da imagem é obrigatório' 
            });
        }

        // Verificar se a imagem existe e pertence ao usuário
        const image = await ProfilePhoto.findOne({ 
            id: imageId,
            userId 
        });

        if (!image) {
            return res.status(404).json({ 
                success: false, 
                error: 'Imagem não encontrada ou não pertence a você' 
            });
        }

        // Deletar arquivo físico do storage
        const filePath = path.join(__dirname, '../../uploads', image.photoType, path.basename(image.photoUrl));
        
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Arquivo deletado: ${filePath}`);
            }
        } catch (fileError) {
            console.warn(`⚠️ Não foi possível deletar arquivo: ${filePath}`, fileError);
        }

        // Deletar registro do banco
        await ProfilePhoto.deleteOne({ id: imageId });

        res.json({
            success: true,
            message: 'Imagem deletada com sucesso'
        });

    } catch (error: any) {
        console.error('❌ Erro ao deletar imagem:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao deletar imagem',
            details: error.message
        });
    }
});

export default router;
