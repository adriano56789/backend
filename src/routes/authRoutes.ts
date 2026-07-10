import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { connectDB } from '../config/db';
import { standardizeUserResponse } from '../utils/userResponse';
import { pushRecentActivity } from '../utils/activityHelpers';
import { activityLogger } from '../middleware/ActivityLogger';
import { ActivityType } from '../models/UserActivity';
import { getUserIdFromToken } from '../middleware/auth';

const router = express.Router();
if (!process.env.JWT_SECRET) { throw new Error('[AUTH] JWT_SECRET environment variable is required'); }
const JWT_SECRET = process.env.JWT_SECRET;

// @route POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        // Garantir conexão com MongoDB
        await connectDB();

        const {
            email,
            password,
            country = "br",
            age = 25,
            gender = "male",
            bio = "",
            residence = "k",
            tags = "",
            profession = "",
            location = "",
            distance = "",
            birthday = "01/01/1990",
            emotional_status = "0",
            isVIP = false,
            isAvatarProtected = false,
            chatPermission = "all",
            pipEnabled = true,
            locationPermission = "granted",
            showActivityStatus = true,
            showLocation = true,
            withdrawal_method,
            avatarUrl,
            coverUrl,
            streamServerUrl
            // Removidos: rtmpIngestUrl, srtIngestUrl, streamKey, playbackUrl, roomId
            // Serão gerados automaticamente abaixo
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Por favor, forneça email e senha' });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ error: 'Usuário já existe' });
        }

        // Verificar se o email é válido e existe (não bloqueante - apenas log)
        try {
            const { validateEmail } = await import('../utils/emailValidator');
            const emailCheck = await validateEmail(email);
            if (!emailCheck.valid) {
                console.warn('[REGISTER] Email validation warning:', emailCheck.reason);
            }
        } catch (err) {
            console.warn('[REGISTER] Erro ao verificar email (continuando):', err);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Gerar ID numérico único de 7 dígitos (ex: 4567845)
        const generateUniqueNumericId = async (): Promise<string> => {
            let uniqueId = '';
            let exists = true;
            while (exists) {
                const num = Math.floor(1000000 + Math.random() * 9000000);
                uniqueId = num.toString();
                const user = await User.findOne({ id: uniqueId });
                if (!user) {
                    exists = false;
                }
            }
            return uniqueId;
        };

        const newUserId = await generateUniqueNumericId();
        const permanentStreamId = crypto.randomUUID();
        console.log(`[REGISTER] ID numérico gerado: ${newUserId}, permanentStreamId: ${permanentStreamId}`);

        // Função para normalizar tags
        const normalizeTags = (tags: any): string[] => {
            if (!tags) return [];
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
        const userData: any = {
            // APENAS CAMPOS ESSENCIAIS NO CADASTRO
            id: newUserId, // ID real gerado automaticamente (não MongoDB _id)
            permanentStreamId: permanentStreamId,
            identification: "pending", // Será atualizado após criação
            name: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ') || 'Usuário',
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

        const user = await User.create(userData);
        console.log(`[REGISTER] User created: id=${user.id} (${user.id.length} chars), identification=${user.identification} (${user.identification?.length} chars)`);

        // Gerar campos de stream usando UUID único
        const streamKey = `stream_${crypto.randomUUID()}`;
        const roomId = `room_${user.id}`;
        const srsHost = process.env.SRS_HOST || 'srs';
        const rtmpIngestUrl = `rtmp://${srsHost}:1935/live/${streamKey}`;
        const srtIngestUrl = `srt://${srsHost}:10000?streamid=${streamKey}`;
        const playbackUrl = `https://api.livego.store/api/video/http/live/${streamKey}.flv`;

        // Atualizar usuário com campos de stream, identification e status online + persistir atividade
        await User.updateOne(
            { id: user.id },
            {
                $set: {
                identification: user.id,
                permanentStreamId: permanentStreamId,
                streamKey: streamKey,
                roomId: roomId,
                rtmpIngestUrl: rtmpIngestUrl,
                srtIngestUrl: srtIngestUrl,
                playbackUrl: playbackUrl,
                isOnline: true,
                lastSeen: new Date()
                }
            }
        );
        await pushRecentActivity(user.id, {
            action: 'register',
            resource: 'user_registration',
            endpoint: '/api/auth/register'
        });

        // Buscar usuário atualizado
        const updatedUser = await User.findOne({ id: user.id });

        const token = jwt.sign({ id: updatedUser!.id, _id: updatedUser!.id }, JWT_SECRET, { expiresIn: '30d' });

        updatedUser!.token = token;
        await updatedUser!.save();

        // Registrar atividade de criação de conta
        activityLogger.logManualActivity({
            userId: updatedUser!.id,
            activityType: ActivityType.REGISTER,
            targetType: 'system',
            metadata: { email: updatedUser!.email, name: updatedUser!.name },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        }).catch(err => console.error('[ACTIVITY] Erro ao registrar criação de conta:', err));

        // Enviar atualização em tempo real via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('user_token_updated', {
                userId: updatedUser!.id,
                token: token,
                timestamp: new Date()
            });
            console.log(`🔄 [WEBSOCKET] Token atualizado em tempo real para usuário ${updatedUser!.id}`);
        }

        // Forçar visibilidade imediata: marcar online e broadcast
        const io2 = req.app.get('io');
        if (io2) {
            io2.emit('user_status_changed', {
                userId: updatedUser!.id,
                isOnline: true,
                timestamp: new Date().toISOString()
            });
        }

        // Notificar novo usuário para todos os usuários online
        try {
            const { NewUserNotificationService } = await import('../services/NewUserNotificationService');
            await NewUserNotificationService.notifyNewUser(updatedUser!.id);
        } catch (notifErr) {
            console.warn('[REGISTER] Erro ao notificar novo usuário:', notifErr);
        }

        res.status(201).json({
            success: true,
            token,
            user: standardizeUserResponse(updatedUser!)
        });
    } catch (error: any) {
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
    const startTime = Date.now();
    const clientIp = String(req.ip || req.headers['x-forwarded-for'] || 'unknown');
    const userAgent = String(req.headers['user-agent'] || 'unknown');
    const origin = String(req.headers['origin'] || 'none');

    console.log(`[LOGIN] === INÍCIO DA TENTATIVA DE LOGIN ===`);
    console.log(`[LOGIN] IP: ${clientIp}`);
    console.log(`[LOGIN] User-Agent: ${userAgent}`);
    console.log(`[LOGIN] Origin: ${origin}`);
    console.log(`[LOGIN] Timestamp: ${new Date().toISOString()}`);

    try {
        await connectDB();
        console.log(`[LOGIN] MongoDB conectado com sucesso`);

        const { email, password } = req.body;
        const authHeader = req.headers.authorization;

        // Se tiver token Bearer, tenta validar — se falhar, continua para email+senha
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            console.log(`[LOGIN] Token Bearer presente — validando...`);
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                const user = await User.findOne({ id: decoded.id });

                if (user) {
                    console.log(`[LOGIN] Token válido para usuário ${user.id} — reautenticando via token`);

                    user.isOnline = true;
                    user.lastSeen = new Date();
                    user.loginCount = (user.loginCount || 0) + 1;
                    user.lastLogin = new Date();
                    await user.save();

                    pushRecentActivity(user.id, {
                        action: 'login',
                        resource: 'user_authentication',
                        endpoint: '/api/auth/login'
                    });

                    activityLogger.logManualActivity({
                        userId: user.id,
                        activityType: ActivityType.LOGIN,
                        targetType: 'system',
                        metadata: { loginMethod: 'bearer_token' },
                        ipAddress: clientIp,
                        userAgent
                    }).catch(() => {});

                    // 🔔 Emitir evento de entrada do usuário
                    try {
                        const io = req.app.get('io');
                        if (io) {
                            io.emit('user_entered_app', {
                                userId: user.id,
                                userName: user.name || 'Usuário',
                                avatarUrl: user.avatarUrl || '',
                                level: user.level || 1,
                                timestamp: new Date().toISOString()
                            });
                            console.log(`🟢 [ENTRY] ${user.name || user.id} entrou no aplicativo (login token)`);
                        }
                    } catch (_) {}

                    console.log(`[LOGIN] ✅ Login via token bem-sucedido para ${user.id} (${Date.now() - startTime}ms)`);
                    return res.json({
                        success: true,
                        token,
                        user: standardizeUserResponse(user)
                    });
                }
                console.log(`[LOGIN] Token válido mas usuário não encontrado — caindo para email+senha`);
            } catch (tokenError: any) {
                // Token inválido/expirado → NÃO BLOQUEAR, cair para email+senha
                console.log(`[LOGIN] Token inválido/expirado: ${tokenError.message} — continuando para email+senha`);
            }
        }

        // Login tradicional com email e senha
        console.log(`[LOGIN] Tentativa de login email+senha:`);
        console.log(`[LOGIN]   Email fornecido: ${email ? email.replace(/(?<=.{3}).(?=.*@)/g, '*') : 'NÃO'}`);
        console.log(`[LOGIN]   Senha fornecida: ${password ? 'SIM' : 'NÃO'}`);
        console.log(`[LOGIN]   IP: ${clientIp}`);
        console.log(`[LOGIN]   User-Agent: ${userAgent}`);

        if (!email || !password) {
            console.log(`[LOGIN] ❌ Falha: campos email/senha ausentes`);
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const user = await User.findOne({ email });
        console.log(`[LOGIN]   Usuário encontrado no banco: ${user ? 'SIM' : 'NÃO'}`);
        console.log(`[LOGIN]   ID do usuário: ${user?.id || 'N/A'}`);
        console.log(`[LOGIN]   Tem senha armazenada: ${(user && user.password) ? 'SIM' : 'NÃO'}`);

        if (!user || !user.password) {
            console.log(`[LOGIN] ❌ Falha: usuário não encontrado ou sem senha`);
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`[LOGIN]   Senha corresponde: ${isMatch ? 'SIM' : 'NÃO'}`);

        if (!isMatch) {
            console.log(`[LOGIN] ❌ Falha: senha incorreta`);
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        const token = jwt.sign({ id: user.id, _id: user.id }, JWT_SECRET, { expiresIn: '30d' });

        console.log(`[LOGIN] ✅ Senha OK — gerando token e salvando...`);

        activityLogger.logManualActivity({
            userId: user.id,
            activityType: ActivityType.LOGIN,
            targetType: 'system',
            metadata: { loginMethod: 'email_password' },
            ipAddress: clientIp,
            userAgent
        }).catch(() => {});

        // Update status online and token + persistir atividade
        try {
            user.isOnline = true;
            user.lastSeen = new Date();
            user.token = token;
            user.loginCount = (user.loginCount || 0) + 1;
            user.lastLogin = new Date();
            await user.save();

            pushRecentActivity(user.id, {
                action: 'login',
                resource: 'user_authentication',
                endpoint: '/api/auth/login'
            });

            // Enviar atualização em tempo real via WebSocket
            const io = req.app.get('io');
            if (io) {
                io.emit('user_token_updated', {
                    userId: user.id,
                    token: token,
                    timestamp: new Date()
                });
                console.log(`[LOGIN] 🔄 Token atualizado via WebSocket para usuário ${user.id}`);
            }
        } catch (saveError: any) {
            if (saveError.name === 'VersionError') {
                console.log(`[LOGIN] ⚠️ VersionError — tentando re-salvar com documento fresco...`);
                const freshUser = await User.findById(user._id);
                if (freshUser) {
                    freshUser.isOnline = true;
                    freshUser.lastSeen = new Date();
                    freshUser.token = token;
                    freshUser.loginCount = (freshUser.loginCount || 0) + 1;
                    freshUser.lastLogin = new Date();
                    await freshUser.save();

                    pushRecentActivity(freshUser.id, {
                        action: 'login',
                        resource: 'user_authentication',
                        endpoint: '/api/auth/login'
                    });

                    Object.assign(user, freshUser.toObject());
                    console.log(`[LOGIN] ✅ Re-salvo com sucesso após VersionError`);
                }
            } else {
                throw saveError;
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`[LOGIN] ✅ Login completo com sucesso para ${user.id} (${elapsed}ms)`);
        console.log(`[LOGIN]   IP: ${clientIp}, User-Agent: ${userAgent}`);

        // 🔔 Emitir evento de entrada do usuário
        try {
            const io = req.app.get('io');
            if (io) {
                io.emit('user_entered_app', {
                    userId: user.id,
                    userName: user.name || 'Usuário',
                    avatarUrl: user.avatarUrl || '',
                    level: user.level || 1,
                    timestamp: new Date().toISOString()
                });
                console.log(`🟢 [ENTRY] ${user.name || user.id} entrou no aplicativo (login)`);
            }
        } catch (_) {}

        res.json({
            success: true,
            token,
            user: standardizeUserResponse(user)
        });
    } catch (error: any) {
        console.error(`[LOGIN-ERROR] ❌ Erro não tratado no login:`, {
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 5).join('\n'),
            name: error.name,
            email: req.body?.email?.replace(/(?<=.{3}).(?=.*@)/g, '*'),
            ip: clientIp,
            userAgent,
            elapsed: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ error: error.message });
    }
});

// @route POST /api/auth/logout
router.post('/logout', async (req, res) => {
    try {
        const userId = req.body.id || (await getUserIdFromToken(req));
        if (userId) {
            await User.findOneAndUpdate(
                { id: userId }, 
                { 
                    $set: {
                    isOnline: false, 
                    lastSeen: new Date().toISOString()
                    }
                }
            );

            pushRecentActivity(userId, {
                action: 'logout',
                resource: 'user_session',
                endpoint: '/api/auth/logout'
            });

            activityLogger.logManualActivity({
                userId: userId,
                activityType: ActivityType.LOGOUT,
                targetType: 'system',
                metadata: { logoutReason: 'user_action' },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            }).catch(() => {});
        }
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error: any) {
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
        if (!process.env.JWT_SECRET) { throw new Error('[AUTH] JWT_SECRET environment variable is required'); }
const JWT_SECRET = process.env.JWT_SECRET;

        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            return res.json([]);
        }

        const user = await User.findOne({ id: decoded.id });
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
            user: standardizeUserResponse(user)
        }];

        res.json(connectedAccounts);
    } catch (error: any) {
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
        if (!process.env.JWT_SECRET) { throw new Error('[AUTH] JWT_SECRET environment variable is required'); }
const JWT_SECRET = process.env.JWT_SECRET;

        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            return res.json([]);
        }

        const user = await User.findOne({ id: decoded.id });
        if (!user) {
            return res.json([]);
        }

        const accounts = [{
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl || '',
            isConnected: true,
            user: standardizeUserResponse(user)
        }];

        res.json(accounts);
    } catch (error: any) {
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
        if (!process.env.JWT_SECRET) { throw new Error('[AUTH] JWT_SECRET environment variable is required'); }
const JWT_SECRET = process.env.JWT_SECRET;

        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Desconectar a conta (fazer logout)
        await User.findOneAndUpdate(
            { id: decoded.id },
            { $set: { isOnline: false, lastSeen: new Date().toISOString() } }
        );

        res.json({ success: true, message: 'Conta desconectada com sucesso' });
    } catch (error: any) {
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
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            const user = await User.findOne({ id: decoded.id });

            if (!user) {
                return res.json({ valid: false });
            }

            res.json({ valid: true, user: standardizeUserResponse(user) });
        } catch (tokenError) {
            return res.json({ valid: false });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
