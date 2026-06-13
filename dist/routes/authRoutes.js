"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const db_1 = require("../config/db");
const userResponse_1 = require("../utils/userResponse");
const router = express_1.default.Router();
if (!process.env.JWT_SECRET) {
    throw new Error('[AUTH] JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
// @route POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        // Garantir conexão com MongoDB
        await (0, db_1.connectDB)();
        const { name, email, password, country = "br", age = 25, gender = "male", bio = "", residence = "k", tags = "", profession = "", location = "", distance = "", birthday = "01/01/1990", emotional_status = "0", isVIP = false, isAvatarProtected = false, chatPermission = "all", pipEnabled = true, locationPermission = "granted", showActivityStatus = true, showLocation = true, withdrawal_method, avatarUrl, coverUrl, streamServerUrl
        // Removidos: rtmpIngestUrl, srtIngestUrl, streamKey, playbackUrl, roomId
        // Serão gerados automaticamente abaixo
         } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Por favor, forneça nome, email e senha' });
        }
        const userExists = await models_1.User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ error: 'Usuário já existe' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        // Gerar ID baseado no nome do usuário
        const sanitizeId = (raw) => {
            return raw.toLowerCase()
                .trim()
                .replace(/[^a-z0-9]/g, '')
                .replace(/\s+/g, '')
                .substring(0, 30) || 'user';
        };
        const baseId = sanitizeId(name);
        const existingUser = await models_1.User.findOne({ id: baseId });
        if (existingUser) {
            return res.status(200).json({
                success: true,
                message: 'Usuário já existe. Faça login.',
                user: (0, userResponse_1.standardizeUserResponse)(existingUser),
                token: jsonwebtoken_1.default.sign({ id: existingUser.id, email: existingUser.email }, JWT_SECRET, { expiresIn: '7d' })
            });
        }
        let newUserId = baseId;
        console.log(`[REGISTER] ID gerado: ${newUserId}`);
        // Função para normalizar tags
        const normalizeTags = (tags) => {
            if (!tags)
                return [];
            if (typeof tags === 'string') {
                return tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            }
            if (Array.isArray(tags)) {
                return tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0)
                    .map(tag => tag.trim());
            }
            return [];
        };
        // Filtrar campos para evitar sobrescrever valores padrão
        const userData = {
            // APENAS CAMPOS ESSENCIAIS NO CADASTRO
            id: newUserId, // ID real gerado automaticamente (não MongoDB _id)
            identification: "pending", // Será atualizado após criação
            name: name?.trim() || "",
            email: email?.trim().toLowerCase() || "",
            password: hashedPassword,
            // Campos básicos do usuário - normalizados
            country: country?.trim() || "br",
            age: age && !isNaN(age) ? Number(age) : 25,
            gender: ["male", "female", "not_specified"].includes(gender) ? gender : "not_specified",
            bio: (bio || "").trim(),
            residence: (residence || "").trim(),
            tags: normalizeTags(tags),
            profession: (profession || "").trim(),
            location: null, // Garantir que seja null para evitar erro no índice 2dsphere do MongoDB
            distance: (distance || "").trim(),
            birthday: (birthday || "01/01/1990").trim(),
            emotional_status: (emotional_status || "0").trim(),
            // Configurações de perfil - valores booleanos normalizados
            isVIP: Boolean(isVIP),
            isAvatarProtected: Boolean(isAvatarProtected),
            chatPermission: ["all", "followers", "none"].includes(chatPermission) ? chatPermission : "all",
            pipEnabled: pipEnabled !== undefined ? Boolean(pipEnabled) : true,
            locationPermission: ["granted", "denied", "prompt"].includes(locationPermission) ? locationPermission : "prompt",
            showActivityStatus: showActivityStatus !== undefined ? Boolean(showActivityStatus) : true,
            showLocation: showLocation !== undefined ? Boolean(showLocation) : true,
            // Campos de stream serão gerados após criação usando _id
            // Método de saque - validado
            withdrawal_method: withdrawal_method && typeof withdrawal_method === 'object' ? withdrawal_method : null,
            // Valores padrão mínimos - sem estados automáticos
            diamonds: 1000, // Valor inicial padrão
            createdAt: new Date(),
            updatedAt: new Date()
        };
        userData.avatarUrl = avatarUrl?.trim() ? avatarUrl.trim() : '';
        if (coverUrl && coverUrl.trim()) {
            userData.coverUrl = coverUrl.trim();
        }
        if (streamServerUrl && streamServerUrl.trim()) {
            userData.streamServerUrl = streamServerUrl.trim();
        }
        // Campos de stream são gerados automaticamente após criação - não verificar aqui
        const user = await models_1.User.create(userData);
        console.log(`[REGISTER] User created: id=${user.id} (${user.id.length} chars), identification=${user.identification} (${user.identification?.length} chars)`);
        // Gerar campos de stream usando o id manual
        const streamKey = `stream_${user.id}`;
        const roomId = `room_${user.id}`;
        const srsHost = process.env.SRS_HOST || 'srs';
        const rtmpIngestUrl = `rtmp://${srsHost}:1935/live`;
        const srtIngestUrl = `srt://${srsHost}:10000?streamid=${streamKey}`;
        const playbackUrl = `https://api.livego.store/api/video/http/live/${streamKey}.flv`;
        // Atualizar usuário com campos de stream, identification e status online + persistir atividade
        await models_1.User.updateOne({ id: user.id }, {
            $set: {
                identification: user.id, // Usar id manual como identification
                streamKey: streamKey,
                roomId: roomId,
                rtmpIngestUrl: rtmpIngestUrl,
                srtIngestUrl: srtIngestUrl,
                playbackUrl: playbackUrl,
                isOnline: true,
                lastSeen: new Date()
            },
            $push: {
                recentActivities: {
                    action: 'register',
                    resource: 'user_registration',
                    timestamp: new Date(),
                    endpoint: '/api/auth/register'
                }
            }
        });
        // Buscar usuário atualizado
        const updatedUser = await models_1.User.findOne({ id: user.id });
        const token = jsonwebtoken_1.default.sign({ id: updatedUser.id, _id: updatedUser.id }, JWT_SECRET, { expiresIn: '30d' });
        updatedUser.token = token;
        await updatedUser.save();
        // Enviar atualização em tempo real via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('user_token_updated', {
                userId: updatedUser.id,
                token: token,
                timestamp: new Date()
            });
            console.log(`🔄 [WEBSOCKET] Token atualizado em tempo real para usuário ${updatedUser.id}`);
        }
        res.status(201).json({
            success: true,
            token,
            user: (0, userResponse_1.standardizeUserResponse)(updatedUser)
        });
    }
    catch (error) {
        console.error('[REGISTER-ERROR] Erro detalhado:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            body: req.body,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ error: error.message });
    }
});
// @route POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        // Garantir conexão com MongoDB
        await (0, db_1.connectDB)();
        const { email, password } = req.body;
        const authHeader = req.headers.authorization;
        // Se tiver token Bearer, valida e retorna usuário
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                const user = await models_1.User.findOne({ id: decoded.id });
                if (!user) {
                    return res.status(401).json({ error: 'Usuário não encontrado' });
                }
                // Update online status
                user.isOnline = true;
                user.lastSeen = new Date();
                await user.save();
                return res.json({
                    success: true,
                    token,
                    user: (0, userResponse_1.standardizeUserResponse)(user)
                });
            }
            catch (tokenError) {
                return res.status(401).json({ error: 'Token inválido' });
            }
        }
        // Login tradicional com email e senha
        console.log('[LOGIN-DEBUG] Tentativa de login:', {
            passwordProvided: !!password,
            timestamp: new Date().toISOString()
        });
        if (!email || !password) {
            console.log('[LOGIN-DEBUG] Falha: campos ausentes');
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }
        const user = await models_1.User.findOne({ email });
        console.log('[LOGIN-DEBUG] Usuário encontrado:', {
            found: !!user,
            hasPassword: !!(user && user.password),
            userId: user?.id
        });
        if (!user || !user.password) {
            console.log('[LOGIN-DEBUG] Falha: usuário não encontrado ou sem senha');
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        console.log('[LOGIN-DEBUG] Senha corresponde:', { isMatch });
        if (!isMatch) {
            console.log('[LOGIN-DEBUG] Falha: senha incorreta');
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, _id: user._id }, JWT_SECRET, { expiresIn: '30d' });
        // Update status online and token + persistir atividade
        try {
            user.isOnline = true;
            user.lastSeen = new Date();
            user.token = token;
            user.loginCount = (user.loginCount || 0) + 1;
            user.lastLogin = new Date();
            user.recentActivities = user.recentActivities || [];
            user.recentActivities.push({
                action: 'login',
                resource: 'user_authentication',
                timestamp: new Date(),
                endpoint: '/api/auth/login'
            });
            // Manter apenas as últimas 50 atividades
            if (user.recentActivities.length > 50) {
                user.recentActivities = user.recentActivities.slice(-50);
            }
            await user.save();
            // Enviar atualização em tempo real via WebSocket
            const io = req.app.get('io');
            if (io) {
                io.emit('user_token_updated', {
                    userId: user.id,
                    token: token,
                    timestamp: new Date()
                });
                console.log(`🔄 [WEBSOCKET] Token atualizado em tempo real para usuário ${user.id} (login)`);
            }
        }
        catch (saveError) {
            if (saveError.name === 'VersionError') {
                // Se houver erro de versão, buscar o documento mais recente e tentar novamente
                const freshUser = await models_1.User.findById(user._id);
                if (freshUser) {
                    freshUser.isOnline = true;
                    freshUser.lastSeen = new Date();
                    freshUser.token = token;
                    freshUser.loginCount = (freshUser.loginCount || 0) + 1;
                    freshUser.lastLogin = new Date();
                    freshUser.recentActivities = freshUser.recentActivities || [];
                    freshUser.recentActivities.push({
                        action: 'login',
                        resource: 'user_authentication',
                        timestamp: new Date(),
                        endpoint: '/api/auth/login'
                    });
                    if (freshUser.recentActivities.length > 50) {
                        freshUser.recentActivities = freshUser.recentActivities.slice(-50);
                    }
                    await freshUser.save();
                    Object.assign(user, freshUser.toObject());
                }
            }
            else {
                throw saveError;
            }
        }
        res.json({
            success: true,
            token,
            user: (0, userResponse_1.standardizeUserResponse)(user)
        });
    }
    catch (error) {
        console.error('[LOGIN-ERROR] Erro detalhado:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            body: req.body,
            headers: req.headers,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ error: error.message });
    }
});
// @route POST /api/auth/logout
router.post('/logout', async (req, res) => {
    try {
        const { id } = req.body;
        if (id) {
            await models_1.User.findOneAndUpdate({ id }, {
                $set: {
                    isOnline: false,
                    lastSeen: new Date().toISOString()
                },
                $push: {
                    recentActivities: {
                        action: 'logout',
                        resource: 'user_session',
                        timestamp: new Date(),
                        endpoint: '/api/auth/logout'
                    }
                }
            });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// @route GET /api/accounts/google - Retorna todas as contas Google do usuário
// @route GET /api/accounts/google/connected - Alias para /api/accounts/google
router.get('/google/connected', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json([]); // Sem token = sem contas conectadas
        }
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        if (!process.env.JWT_SECRET) {
            throw new Error('[AUTH] JWT_SECRET environment variable is required');
        }
        const JWT_SECRET = process.env.JWT_SECRET;
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        }
        catch {
            return res.json([]);
        }
        const user = await models_1.User.findOne({ id: decoded.id });
        if (!user) {
            return res.json([]);
        }
        // O usuário está conectado com o próprio email cadastrado
        // Retorna no formato GoogleAccount esperado pelo frontend
        const connectedAccounts = [{
                id: user.id,
                name: user.name,
                avatarUrl: user.avatarUrl || '',
                isConnected: true,
                user: (0, userResponse_1.standardizeUserResponse)(user)
            }];
        res.json(connectedAccounts);
    }
    catch (error) {
        console.error('Error in /google/connected:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/google', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json([]);
        }
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        if (!process.env.JWT_SECRET) {
            throw new Error('[AUTH] JWT_SECRET environment variable is required');
        }
        const JWT_SECRET = process.env.JWT_SECRET;
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        }
        catch {
            return res.json([]);
        }
        const user = await models_1.User.findOne({ id: decoded.id });
        if (!user) {
            return res.json([]);
        }
        const accounts = [{
                id: user.id,
                name: user.name,
                avatarUrl: user.avatarUrl || '',
                isConnected: true,
                user: (0, userResponse_1.standardizeUserResponse)(user)
            }];
        res.json(accounts);
    }
    catch (error) {
        console.error('Error in /google:', error);
        res.status(500).json({ error: error.message });
    }
});
// @route POST /api/accounts/google/disconnect - Desconecta conta Google
router.post('/google/disconnect', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        if (!process.env.JWT_SECRET) {
            throw new Error('[AUTH] JWT_SECRET environment variable is required');
        }
        const JWT_SECRET = process.env.JWT_SECRET;
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        }
        catch {
            return res.status(401).json({ error: 'Invalid token' });
        }
        // Desconectar a conta (fazer logout)
        await models_1.User.findOneAndUpdate({ id: decoded.id }, { $set: { isOnline: false, lastSeen: new Date().toISOString() } });
        res.json({ success: true, message: 'Conta desconectada com sucesso' });
    }
    catch (error) {
        console.error('Error in /google/disconnect:', error);
        res.status(500).json({ error: error.message });
    }
});
// @route POST /api/auth/validate
router.post('/validate', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json({ valid: false });
        }
        const token = authHeader.substring(7);
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const user = await models_1.User.findOne({ id: decoded.id });
            if (!user) {
                return res.json({ valid: false });
            }
            res.json({ valid: true, user: (0, userResponse_1.standardizeUserResponse)(user) });
        }
        catch (tokenError) {
            return res.json({ valid: false });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
