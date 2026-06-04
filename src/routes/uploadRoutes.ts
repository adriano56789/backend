import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { User, ProfilePhoto, Streamer } from '../models';
import { protect, getUserIdFromToken } from '../middleware/auth';

const router = express.Router();

// Configuração do Multer para upload de arquivos de avatar
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/avatars');
        
        // Criar diretório se não existir
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Obter userId do token ou do param da URL
        const userId = req.params?.userId || (req as any).user?.id || getUserIdFromToken(req) || 'unknown';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `avatar_${userId}_${timestamp}${ext}`);
    }
});

// Configuração do Multer para upload de imagens de chat
const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/chat');
        
        // Criar diretório se não existir
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Gerar nome único: chat_timestamp.extensão
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `chat_${uniqueSuffix}${ext}`);
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max
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

const chatUpload = multer({
    storage: chatStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max para chat
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

// POST /api/upload/avatar - Upload de avatar (userId do token)
router.post('/avatar', protect, avatarUpload.single('avatar'), async (req, res) => {
    try {
        // Obter userId do token de autenticação
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

        // Construir URL da imagem dinamicamente a partir da requisição
        const proto = req.headers['x-forwarded-proto'] as string || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] as string || req.get('host') || 'api.livego.store';
        const baseUrl = `${proto}://${host}`;
        const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
        
        console.log(`📸 Upload de avatar para usuário ${userId}: ${avatarUrl}`);

        // Atualizar avatarUrl do usuário + persistir atividade
        await User.findOneAndUpdate(
            { id: userId },
            { 
                $set: { avatarUrl },
                $push: { 
                    recentActivities: {
                        action: 'avatar_change',
                        resource: 'user_profile',
                        timestamp: new Date(),
                        endpoint: '/api/upload/avatar'
                    }
                }
            },
            { new: true } // Forçar retorno do documento atualizado
        );

        // Verificar se já existe avatar principal para o usuário
        const existingAvatar = await ProfilePhoto.findOne({
            userId,
            photoType: 'avatar',
            isMain: true,
            isActive: true
        });

        let newPhoto;
        if (existingAvatar) {
            // Atualizar avatar existente
            newPhoto = await ProfilePhoto.findByIdAndUpdate(
                existingAvatar._id,
                {
                    photoUrl: avatarUrl,
                    metadata: {
                        originalName: req.file.originalname,
                        size: req.file.size,
                        mimeType: req.file.mimetype,
                        width: 0, // TODO: processar imagem para obter dimensões
                        height: 0,
                        uploadedAt: new Date()
                    }
                },
                { new: true }
            );
        } else {
            // Criar novo avatar
            newPhoto = await ProfilePhoto.create({
                userId,
                photoUrl: avatarUrl,
                photoType: 'avatar',
                isMain: true,
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
        }

        // Sincronizar avatar com streams ativas do usuário
        await Streamer.updateMany(
            { hostId: userId },
            { 
                $set: {
                avatar: avatarUrl,
                updatedAt: new Date()
                }
            }
        );

        console.log(`✅ Avatar sincronizado com streams do usuário: ${userId}`);

        // Emitir evento WebSocket para atualização em tempo real em todos os clientes
        const io = req.app.get('io');
        if (io) {
            io.emit('avatar_updated', { userId, avatarUrl, timestamp: new Date().toISOString() });
        }

        res.json({
            success: true,
            avatarUrl,
            message: 'Avatar atualizado com sucesso'
        });

    } catch (error: any) {
        console.error('❌ Erro ao fazer upload de avatar:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao fazer upload do avatar',
            details: error.message
        });
    }
});

// POST /api/upload/avatar/:userId - Upload de avatar específico para userId
router.post('/avatar/:userId', avatarUpload.single('avatar'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nenhum arquivo enviado' 
            });
        }

        // Validar formato do arquivo
        if (!req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Apenas arquivos de imagem são permitidos' 
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

        // Construir URL da imagem dinamicamente a partir da requisição
        const proto = req.headers['x-forwarded-proto'] as string || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] as string || req.get('host') || 'api.livego.store';
        const baseUrl = `${proto}://${host}`;
        const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
        
        console.log(`[UPLOAD] Avatar para usuário ${userId}: ${avatarUrl}`);

        // Atualizar avatarUrl do usuário
        await User.findOneAndUpdate(
            { id: userId },
            { $set: { avatarUrl } },
            { new: true }
        );

        // Criar registro em ProfilePhoto (obras) - como gallery para aparecer na galeria
        const obraId = `avatar_${Date.now()}_${userId}`;
        
        // Salvar como avatar principal
        await ProfilePhoto.findOneAndUpdate(
            { userId, photoType: 'avatar', isMain: true },
            {
                $set: {
                obraId,
                userId,
                photoType: 'avatar',
                photoUrl: avatarUrl,
                isMain: true,
                isActive: true,
                metadata: {
                    filename: req.file.filename,
                    uploadedAt: new Date(),
                    source: 'avatar_upload'
                }
                }
            },
            { upsert: true, new: true }
        );

        // Verificar se já existem fotos na galeria e incrementar order
        const existingGalleryCount = await ProfilePhoto.countDocuments({ 
            userId, 
            photoType: 'gallery', 
            isActive: true 
        });
        
        // Avatar sempre será order: 0 (primeiro), outras fotos incrementam
        await ProfilePhoto.create({
            obraId: `gallery_${Date.now()}_${userId}`,
            userId,
            photoType: 'gallery',
            photoUrl: avatarUrl,
            isMain: true, // Avatar da galeria
            isActive: true,
            order: 0, // SEMPRE primeiro na galeria
            metadata: {
                filename: req.file.filename,
                uploadedAt: new Date(),
                source: 'avatar_upload_gallery',
                isAvatar: true
            }
        });
        
        // Incrementar order das outras fotos existentes (exceto o avatar que acabou de ser criado)
        if (existingGalleryCount > 0) {
            await ProfilePhoto.updateMany(
                { 
                    userId, 
                    photoType: 'gallery', 
                    isActive: true,
                    order: { $gte: 0 },
                    obraId: { $ne: `gallery_${Date.now()}_${userId}` } // Excluir avatar recém-criado
                },
                { $inc: { order: 1 } }
            );
        }

        console.log(`[UPLOAD] Avatar salvo em ProfilePhoto: obraId=${obraId}`);

        res.json({
            success: true,
            avatarUrl,
            userId,
            filename: req.file.filename,
            obraId
        });

    } catch (error: any) {
        console.error('Erro ao fazer upload de avatar:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao fazer upload do avatar',
            details: error.message
        });
    }
});

// Configuração do Multer para upload de capa de stream
const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/covers');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `cover_${uniqueSuffix}${ext}`);
    }
});

const coverUpload = multer({
    storage: coverStorage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem são permitidos'));
        }
    }
});

// POST /api/upload/cover/:id - Upload de capa de stream
router.post('/cover/:id', coverUpload.single('cover'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
        }

        const proto = req.headers['x-forwarded-proto'] as string || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] as string || req.get('host') || 'api.livego.store';
        const baseUrl = `${proto}://${host}`;
        const coverUrl = `${baseUrl}/uploads/covers/${req.file.filename}`;

        const stream = await Streamer.findOneAndUpdate(
            { id: req.params.id },
            { $set: { avatar: coverUrl } },
            { new: true }
        );

        if (!stream) {
            return res.status(404).json({ success: false, error: 'Stream not found' });
        }

        res.json({ success: true, stream, coverUrl });

    } catch (error: any) {
        console.error('Erro ao fazer upload de capa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/upload/chat - Upload de imagem para chat (userId do token)
router.post('/chat', protect, chatUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nenhum arquivo enviado' 
            });
        }

        const proto = req.headers['x-forwarded-proto'] as string || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] as string || req.get('host') || 'api.livego.store';
        const baseUrl = `${proto}://${host}`;
        const imageUrl = `${baseUrl}/uploads/chat/${req.file.filename}`;
        
        console.log(`📸 Upload de imagem para chat: ${imageUrl}`);

        res.json({
            success: true,
            imageUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype,
            message: 'Imagem enviada com sucesso'
        });

    } catch (error: any) {
        console.error('❌ Erro ao fazer upload de imagem para chat:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao fazer upload da imagem',
            details: error.message
        });
    }
});

export default router;
