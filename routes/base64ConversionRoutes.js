"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Configuração do Multer para upload temporário
const tempStorage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: tempStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    }
});
// Função para salvar arquivo e retornar URL
const saveUploadedFile = (buffer, originalName, mimeType, userId) => {
    // Determinar diretório baseado no tipo
    let uploadDir;
    let filenamePrefix;
    if (mimeType.startsWith('image/')) {
        uploadDir = path_1.default.join(__dirname, '../../uploads/photos');
        filenamePrefix = 'photo';
    }
    else if (mimeType.startsWith('video/')) {
        uploadDir = path_1.default.join(__dirname, '../../uploads/videos');
        filenamePrefix = 'video';
    }
    else {
        throw new Error('Tipo de arquivo não suportado');
    }
    // Criar diretório se não existir
    if (!fs_1.default.existsSync(uploadDir)) {
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
    }
    // Gerar nome único
    const ext = path_1.default.extname(originalName) ||
        (mimeType.includes('svg') ? '.svg' :
            mimeType.includes('avif') ? '.avif' : '.png');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `${filenamePrefix}_${userId}_${uniqueSuffix}${ext}`;
    const filePath = path_1.default.join(uploadDir, filename);
    // Salvar arquivo
    fs_1.default.writeFileSync(filePath, buffer);
    // Retornar URL pública
    const baseUrl = process.env.BASE_URL || 'https://api.livego.store';
    const relativePath = filePath.replace(path_1.default.join(__dirname, '../../'), '');
    return `${baseUrl}/${relativePath.replace(/\\/g, '/')}`;
};
// POST /api/convert/base64 - Converte Base64 para arquivo
router.post('/base64', auth_1.protect, upload.none(), async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        const { base64Data, filename, context } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }
        if (!base64Data) {
            return res.status(400).json({
                success: false,
                error: 'Dados Base64 são obrigatórios'
            });
        }
        console.log(`🔄 [BASE64] Iniciando conversão para usuário ${userId}`);
        // Validar e extrair dados do Base64
        const matches = base64Data.match(/^data:(.+?);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({
                success: false,
                error: 'Formato Base64 inválido'
            });
        }
        const mimeType = matches[1];
        const base64String = matches[2];
        // Validar tipos suportados
        const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif', 'video/mp4', 'video/webm'];
        if (!supportedTypes.includes(mimeType)) {
            return res.status(400).json({
                success: false,
                error: `Tipo ${mimeType} não é suportado`
            });
        }
        // Converter Base64 para Buffer
        const buffer = Buffer.from(base64String, 'base64');
        // Validar tamanho (máximo 10MB)
        if (buffer.length > 10 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                error: 'Arquivo muito grande (máximo 10MB)'
            });
        }
        // Salvar arquivo
        const finalFilename = filename || `converted_${Date.now()}`;
        const publicUrl = saveUploadedFile(buffer, finalFilename, mimeType, userId);
        console.log(`✅ [BASE64] Conversão concluída: ${publicUrl}`);
        res.json({
            success: true,
            url: publicUrl,
            originalSize: buffer.length,
            mimeType,
            context: context || 'general',
            message: 'Base64 convertido com sucesso'
        });
    }
    catch (error) {
        console.error('❌ [BASE64] Erro na conversão:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao converter Base64',
            details: error.message
        });
    }
});
// POST /api/convert/batch - Converte múltiplas imagens Base64
router.post('/batch', auth_1.protect, upload.none(), async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        const { images } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }
        if (!Array.isArray(images) || images.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Array de imagens é obrigatório'
            });
        }
        console.log(`🔄 [BASE64-BATCH] Iniciando conversão de ${images.length} imagens`);
        const results = [];
        for (const image of images) {
            try {
                const { base64Data, filename, path } = image;
                if (!base64Data) {
                    results.push({
                        path,
                        success: false,
                        error: 'Dados Base64 ausentes'
                    });
                    continue;
                }
                // Validar e extrair dados
                const matches = base64Data.match(/^data:(.+?);base64,(.+)$/);
                if (!matches || matches.length !== 3) {
                    results.push({
                        path,
                        success: false,
                        error: 'Formato Base64 inválido'
                    });
                    continue;
                }
                const mimeType = matches[1];
                const base64String = matches[2];
                const buffer = Buffer.from(base64String, 'base64');
                // Salvar arquivo
                const finalFilename = filename || `batch_${Date.now()}_${results.length}`;
                const publicUrl = saveUploadedFile(buffer, finalFilename, mimeType, userId);
                results.push({
                    path,
                    success: true,
                    url: publicUrl,
                    originalSize: buffer.length,
                    mimeType
                });
            }
            catch (error) {
                results.push({
                    path: image.path,
                    success: false,
                    error: error.message
                });
            }
        }
        const successCount = results.filter(r => r.success).length;
        console.log(`✅ [BASE64-BATCH] Concluído: ${successCount}/${images.length} convertidas`);
        res.json({
            success: true,
            results,
            totalProcessed: images.length,
            successCount,
            failedCount: images.length - successCount,
            message: `Processado ${successCount} de ${images.length} imagens`
        });
    }
    catch (error) {
        console.error('❌ [BASE64-BATCH] Erro na conversão:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao converter Base64 em lote',
            details: error.message
        });
    }
});
// POST /api/convert/detect - Detecta imagens Base64 em objeto
router.post('/detect', auth_1.protect, async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        const { data } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Não autorizado'
            });
        }
        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'Dados para análise são obrigatórios'
            });
        }
        // Função recursiva para detectar Base64
        const detectBase64 = (obj, path = '') => {
            const results = [];
            if (!obj || typeof obj !== 'object')
                return results;
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                if (typeof value === 'string') {
                    if (value.startsWith('data:image/') && value.includes('base64,')) {
                        const type = value.includes('svg+xml') ? 'svg' : 'image';
                        results.push({ path: currentPath, value, type });
                    }
                    else if (value.startsWith('data:video/') && value.includes('base64,')) {
                        results.push({ path: currentPath, value, type: 'video' });
                    }
                }
                else if (typeof value === 'object' && value !== null) {
                    results.push(...detectBase64(value, currentPath));
                }
            }
            return results;
        };
        const base64Images = detectBase64(data);
        console.log(`🔍 [BASE64-DETECT] Encontradas ${base64Images.length} imagens Base64`);
        res.json({
            success: true,
            count: base64Images.length,
            images: base64Images,
            message: `Detectadas ${base64Images.length} imagens Base64`
        });
    }
    catch (error) {
        console.error('❌ [BASE64-DETECT] Erro na detecção:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao detectar Base64',
            details: error.message
        });
    }
});
exports.default = router;
