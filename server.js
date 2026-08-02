"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const socket_1 = require("./socket");
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./config/env");
const path_1 = __importDefault(require("path"));
const db_1 = require("./config/db");
const validateEnv_1 = require("./config/validateEnv");
const index_1 = require("./models/index");
const idValidation_1 = require("./middleware/idValidation");
const ProtobufService_1 = require("./services/protobuf/ProtobufService");
const ActivityEventService_1 = require("./services/ActivityEventService");
const ActivityHooks_1 = require("./models/ActivityHooks");
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const profileRoutes_1 = __importDefault(require("./routes/profileRoutes"));
const walletRoutes_1 = __importDefault(require("./routes/walletRoutes"));
const checkoutRoutes_1 = __importDefault(require("./routes/checkoutRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const metadataRoutes_1 = __importDefault(require("./routes/metadataRoutes"));
const settingsRoutes_1 = __importDefault(require("./routes/settingsRoutes"));
const liveRoutes_1 = __importDefault(require("./routes/liveRoutes"));
const visitorRoutes_1 = __importDefault(require("./routes/visitorRoutes"));
const pkRoutes_1 = __importDefault(require("./routes/pkRoutes"));
const interactionRoutes_1 = __importDefault(require("./routes/interactionRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const mediaRoutes_1 = __importDefault(require("./routes/mediaRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const profilePhotoRoutes_1 = __importDefault(require("./routes/profilePhotoRoutes"));
const conversationRoutes_1 = __importDefault(require("./routes/conversationRoutes"));
const searchRoutes_1 = __importDefault(require("./routes/searchRoutes"));
const photoRoutes_1 = __importDefault(require("./routes/photoRoutes"));
const messageRoutes_1 = __importDefault(require("./routes/messageRoutes"));
const imageUploadRoutes_1 = __importDefault(require("./routes/imageUploadRoutes"));
const statusRoutes_1 = __importDefault(require("./routes/statusRoutes"));
const followersRoutes_1 = __importDefault(require("./routes/followersRoutes"));
const friendshipRoutes_1 = __importDefault(require("./routes/friendshipRoutes"));
const blockRoutes_1 = __importDefault(require("./routes/blockRoutes"));
const statsRoutes_1 = __importDefault(require("./routes/statsRoutes"));
const OnlineTracker_1 = require("./services/OnlineTracker");
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const shopRoutes_1 = __importDefault(require("./routes/shopRoutes"));
const frameRoutes_1 = __importDefault(require("./routes/frameRoutes"));
const contributionRoutes_1 = __importDefault(require("./routes/contributionRoutes"));
const purchaseRoutes_1 = __importDefault(require("./routes/purchaseRoutes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const manualRoutes_1 = __importDefault(require("./routes/manualRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const webhookRoutes_1 = __importDefault(require("./routes/webhookRoutes"));
const withdrawalRoutes_1 = __importDefault(require("./routes/withdrawalRoutes"));
const transactionProtectionRoutes_1 = __importDefault(require("./routes/transactionProtectionRoutes"));
const zoomRoutes_1 = __importDefault(require("./routes/zoomRoutes"));
const userStatusRoutes_1 = __importDefault(require("./routes/userStatusRoutes"));
const levelRoutes_1 = __importDefault(require("./routes/levelRoutes")); // NOVO - Sistema de Nível
const virtualIPRoutes_1 = __importDefault(require("./routes/virtualIPRoutes")); // NOVO - Sistema de IP Virtual
const base64ConversionRoutes_1 = __importDefault(require("./routes/base64ConversionRoutes")); // NOVO - Sistema de Conversão Base64
const likesRoutes_1 = __importDefault(require("./routes/likesRoutes")); // NOVO - Sistema de Likes
// Transmissão pública usa SRS + FFmpeg (WHIP/WHEP/RTMP/HLS)
const callInvitationRoutes_1 = __importDefault(require("./routes/callInvitationRoutes")); // NOVO - Sistema de convites de chamada na live
const activityRoutes_1 = __importDefault(require("./routes/activityRoutes")); // NOVO - Sistema de Atividades
const videoStreamRoutes_1 = __importDefault(require("./routes/videoStreamRoutes")); // NOVO - API de Streaming de Vídeo
const srsRoutes_1 = __importDefault(require("./routes/srsRoutes"));
const appVersionRoutes_1 = __importDefault(require("./routes/appVersionRoutes")); // NOVO - Sistema de controle de versão
const debugRoutes_1 = __importDefault(require("./routes/debugRoutes"));
const crudRoutes_1 = __importDefault(require("./routes/crudRoutes"));
const liveInviteRoutes_1 = __importDefault(require("./routes/liveInviteRoutes"));
const identificationRoutes_1 = __importDefault(require("./routes/identificationRoutes"));
const userIdRoutes_1 = __importDefault(require("./routes/userIdRoutes"));
const turnRoutes_1 = __importDefault(require("./routes/turnRoutes"));
const stunRoutes_1 = __importDefault(require("./routes/stunRoutes"));
const streamAccessRoutes_1 = __importDefault(require("./routes/streamAccessRoutes"));
const protobufRoutes_1 = __importDefault(require("./routes/protobufRoutes"));
const UserStatusManager_1 = __importDefault(require("./middleware/UserStatusManager"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const firebaseService_1 = require("./services/firebaseService");
const blockBase64_1 = require("./middleware/blockBase64");
const MqttBridge_1 = require("./services/MqttBridge");
// REMOVIDO: Módulos inexistentes
// import { initializeDatabase } from './scripts/initDatabase'; // NOVO - Inicialização automática
// import { withdrawalCronJob } from './scripts/withdrawalCronJob'; // NOVO - Cron job de saques
(0, validateEnv_1.validateEnv)();
// ─── Orphan Process Killer (FFmpeg) ─────────────────────────────────
const FfmpegService_1 = require("./services/FfmpegService");
const StreamCleanupService_1 = require("./services/StreamCleanupService");
// ────────────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
app.set('trust proxy', 1);
app.set('etag', false);
// 🔒 Security headers (defense in depth)
app.use((0, helmet_1.default)({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } })); // Desabilitar ETag para sempre retornar 200 em vez de 304
// Log de depuração para todas as requisições
app.use((req, res, next) => {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
const certPath = env_1.ENV.HTTPS_CERT_PATH;
const keyPath = env_1.ENV.HTTPS_KEY_PATH;
let server;
let isHttps = false;
// Só tenta HTTPS se não estiver em dev ou se os arquivos existirem e forem arquivos (não diretórios)
const certExists = fs_1.default.existsSync(certPath) && fs_1.default.lstatSync(certPath).isFile();
const keyExists = fs_1.default.existsSync(keyPath) && fs_1.default.lstatSync(keyPath).isFile();
if (!env_1.isDev && certExists && keyExists) {
    const httpsOptions = {
        cert: fs_1.default.readFileSync(certPath),
        key: fs_1.default.readFileSync(keyPath),
    };
    server = https_1.default.createServer(httpsOptions, app);
    isHttps = true;
    console.log(`🔐 Backend HTTPS nativo habilitado (${certPath})`);
}
else {
    server = http_1.default.createServer(app);
    if (env_1.isDev) {
        console.log('🚀 Iniciando em modo HTTP (Desenvolvimento).');
    }
    else if (!certExists || !keyExists) {
        console.warn(`⚠️ Certificados não encontrados ou inválidos: ${certPath} / ${keyPath}`);
        console.warn('⚠️ Iniciando em modo HTTP como fallback.');
    }
}
const io = (0, socket_1.initSocket)(server);
const port = env_1.ENV.PORT;
// Monkey-patch io.emit e io.to (SÍNCRONO — aplicado imediatamente)
const origEmit = io.emit.bind(io);
io.emit = ((event, ...args) => {
    if (MqttBridge_1.mqttBridge.isConnected()) {
        MqttBridge_1.mqttBridge.publish('livego/global', { event, data: args }).catch(() => { });
    }
    return origEmit(event, ...args);
});
const origTo = io.to.bind(io);
io.to = ((room) => {
    const broadcastOp = origTo(room);
    const origBroadcastEmit = broadcastOp.emit.bind(broadcastOp);
    broadcastOp.emit = ((event, ...args) => {
        if (MqttBridge_1.mqttBridge.isConnected()) {
            if (event === 'binary_data' && args[0] instanceof ArrayBuffer) {
                const b64 = Buffer.from(new Uint8Array(args[0])).toString('base64');
                MqttBridge_1.mqttBridge.publish(`livego/room/${room}`, { event, binaryBase64: b64, _room: room }).catch(() => { });
            }
            else {
                MqttBridge_1.mqttBridge.publish(`livego/room/${room}`, { event, data: args, _room: room }).catch(() => { });
            }
        }
        return origBroadcastEmit(event, ...args);
    });
    return broadcastOp;
});
app.set('io', io);
console.log('🔁 [MQTT] Proxy configurado (monkey-patch io.emit/io.to)');
// Conectar ao EMQX (apenas se habilitado e não bloquear o startup)
if (env_1.ENV.MQTT_ENABLED) {
    MqttBridge_1.mqttBridge.connect().then(() => {
        console.log('🔌 [MQTT] Conectado ao EMQX');
        // Só inscrever depois de conectado
        // NOTA: usar origEmit/origTo (métodos ORIGINAIS antes do monkey-patch)
        // para evitar loop infinito (re-publicação no MQTT ao re-emitir localmente)
        MqttBridge_1.mqttBridge.subscribe('livego/room/+', (msg) => {
            if (msg.instanceId === MqttBridge_1.mqttBridge.instanceId)
                return;
            const payload = msg.payload;
            const room = payload._room || msg.topic.split('/')[2];
            if (payload.binaryBase64) {
                const buf = Buffer.from(payload.binaryBase64, 'base64');
                origTo(room).emit(payload.event, buf);
            }
            else {
                origTo(room).emit(payload.event, ...(payload.data || []));
            }
        });
        MqttBridge_1.mqttBridge.subscribe('livego/global', (msg) => {
            if (msg.instanceId === MqttBridge_1.mqttBridge.instanceId)
                return;
            origEmit(msg.payload.event, ...(msg.payload.data || []));
        });
        console.log('🔁 [MQTT] Subscribes configurados');
    }).catch((err) => {
        console.error('❌ [MQTT] Falha ao conectar ao EMQX:', err.message);
        console.warn('⚠️ [MQTT] Backend continuará sem distribuição MQTT');
    });
}
else {
    console.log('ℹ️ [MQTT] Distribuição MQTT desativada (MQTT_ENABLED=false)');
}
(0, db_1.connectDB)().then(async () => {
    await ProtobufService_1.BackendProtobufService.init();
    (0, ActivityHooks_1.initializeActivityHooks)();
    ActivityEventService_1.activityEventService.initialize(io);
    // Migração única: copiar Streamers ativos para LiveCard
    try {
        const { LiveCard } = await Promise.resolve().then(() => __importStar(require('./models/index')));
        const activeStreamers = await index_1.Streamer.find({
            isLive: true,
            streamStatus: { $ne: 'ended' }
        }).lean();
        let migrated = 0;
        for (const s of activeStreamers) {
            const exists = await LiveCard.findOne({ hostId: s.hostId });
            if (!exists) {
                await LiveCard.create({
                    hostId: s.hostId,
                    name: s.name || '',
                    avatar: s.avatar || '',
                    title: s.title || s.name || '',
                    streamKey: s.streamKey || s.id || s.hostId,
                    playbackUrl: s.playbackUrl || '',
                    hlsUrl: s.hlsUrl || '',
                    country: (s.country || 'BR').toLowerCase(),
                    isLive: true,
                    streamStatus: (s.streamStatus === 'preparing' || s.streamStatus === 'paused' ? 'active' : s.streamStatus) || 'active',
                    category: s.category || 'popular',
                    isPrivate: s.isPrivate || false,
                    viewers: s.viewers || 0,
                    startTime: s.startTime || new Date(),
                });
                migrated++;
            }
        }
        if (migrated > 0)
            console.log(`[MIGRATION] ${migrated} LiveCards criados a partir de Streamers ativos`);
    }
    catch (err) {
        console.warn('[MIGRATION] Erro ao migrar Streamers para LiveCards:', err);
    }
    server.listen(port, '0.0.0.0', () => {
        console.log(`🌍 API Server started on http://127.0.0.1:${port}`);
        (0, firebaseService_1.initFirebase)();
        StreamCleanupService_1.streamCleanupService.start(io);
    });
}).catch(error => {
    console.error('❌ [DB] Falha na conexão com MongoDB:', error.message);
    process.exit(1);
});
// Inicializar UserStatusManager para gerenciar status online
const userStatusManager = new UserStatusManager_1.default(io);
// Limpar usuários inativos periodicamente (a cada 5 minutos)
setInterval(() => {
    userStatusManager.cleanupInactiveUsers();
}, 5 * 60 * 1000);
// Limpar marcações de online que ficaram presas no banco User (a cada 10 minutos)
setInterval(async () => {
    try {
        const { User, UserStatus } = await Promise.resolve().then(() => __importStar(require('./models')));
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const staleUsers = await User.find({
            isOnline: true,
            lastSeen: { $lt: fiveMinutesAgo }
        }).select('id name').limit(100).lean();
        for (const u of staleUsers) {
            const sid = u.id;
            const status = await UserStatus.findOne({ userId: sid }).lean();
            if (!status || !status.isOnline) {
                await User.findOneAndUpdate({ id: sid }, { $set: { isOnline: false } });
                console.log(`[CLEANUP] Stale online flag cleared for user ${sid} (${u.name || ''})`);
            }
        }
    }
    catch (e) {
        console.error('[CLEANUP] Error clearing stale online flags:', e.message);
    }
}, 10 * 60 * 1000);
// Middleware CORS - configurado antes de tudo
const allowedOrigins = env_1.ENV.CORS_ORIGIN.split(',').map(o => o.trim());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
        const isAllowed = isLocal || allowedOrigins.includes(origin) || env_1.isDev;
        if (isAllowed) {
            callback(null, true);
        }
        else {
            console.warn(`🚫 [CORS] Origem bloqueada: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Origin', 'Accept', 'cache-control', 'pragma', 'x-acesso-exclusivo-app'],
    credentials: true,
    optionsSuccessStatus: 200,
    preflightContinue: false
}));
// Removido middleware manual de CORS - o cors() middleware acima já gerencia corretamente
// Headers adicionais para OPTIONS (preflight) - só age quando o cors() não respondeu
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Max-Age', '1728000');
        return res.status(204).end();
    }
    next();
});
// Monitor de respostas vazias — intercepta res.json e res.send
const emptyResponseTracker_1 = require("./middleware/emptyResponseTracker");
app.use('/api', emptyResponseTracker_1.emptyResponseTracker);
app.use(express_1.default.json({
    limit: '50mb',
    type: ['application/json', 'application/webhook+json'],
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf-8');
    }
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use((0, cookie_parser_1.default)());
// Middleware global para bloquear URLs Base64 e validação de IDs - COM EXCEÇÃO SRS
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/srs/')) {
        return next();
    }
    // Aplicar middlewares normais para outras rotas
    (0, blockBase64_1.blockBase64Middleware)(req, res, (err) => {
        if (err)
            return next(err);
        // validateIdsStrictly desabilitado globalmente - causa erro MONGODB_ID_EXPOSED
        // validateIdsStrictly[0](req, res, (err) => {
        //     if (err) return next(err);
        //     validateIdsStrictly[1](req, res, next);
        // });
        next();
    });
});
// Health check endpoint - MOVIDO PARA O INÍCIO PARA EVITAR CONFLITOS
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});
// Rotas da API PRIMEIRO (antes dos arquivos estáticos)
app.use('/api', likesRoutes_1.default); // NOVO - Sistema de Likes - MOVIDO PARA O INÍCIO
app.use('/api/auth', authRoutes_1.default);
app.use('/api/accounts', authRoutes_1.default);
// app.use('/api/accounts', authRoutes); // REMOVIDO - duplicação de rotas causando conflito
// 🚨 VALIDAÇÃO ESTRITA para rotas com parâmetros ID
app.use('/api/users/:id', (0, idValidation_1.validateAndConvertUserId)('id'));
app.use('/api/users/:userId', (0, idValidation_1.validateAndConvertUserId)('userId')); // Para rotas com userId
app.use('/api/users', userRoutes_1.default);
app.use('/api/media', mediaRoutes_1.default);
app.use('/api/perfil', profileRoutes_1.default);
app.use('/api/wallet', walletRoutes_1.default); // handles /api/wallet/earnings, /api/wallet/purchases
// Aliases compatíveis com o spec do ambiente simulado
app.get('/api/earnings/get/:userId', async (req, res) => {
    try {
        const { User } = await Promise.resolve().then(() => __importStar(require('./models')));
        const { calculateBRLFromDiamonds } = await Promise.resolve().then(() => __importStar(require('./utils/diamondConversion')));
        const user = await User.findOne({ id: req.params.userId });
        if (!user)
            return res.status(404).json({ error: 'Usuário não encontrado' });
        const available_diamonds = Math.floor(user.earnings || 0);
        const grossBRL = calculateBRLFromDiamonds(available_diamonds);
        const platformFeeBRL = grossBRL * 0.30;
        const netBRL = grossBRL - platformFeeBRL;
        res.json({ available_diamonds, gross_brl: grossBRL, platform_fee_brl: platformFeeBRL, net_brl: netBRL });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/earnings/withdraw/:userId', async (req, res) => {
    // Redirecionar para a rota real do wallet
    try {
        const { User } = await Promise.resolve().then(() => __importStar(require('./models')));
        const user = await User.findOne({ id: req.params.userId });
        if (!user)
            return res.status(404).json({ error: 'Usuário não encontrado' });
        const { amount } = req.body;
        if (!amount || amount <= 0)
            return res.status(400).json({ error: 'Amount inválido' });
        if ((user.earnings || 0) < amount)
            return res.status(400).json({ error: 'Saldo insuficiente' });
        await User.findOneAndUpdate({ id: req.params.userId }, {
            $inc: { earnings: -amount, earnings_withdrawn: amount }
        });
        res.json({ success: true, amount, message: 'Saque registrado com sucesso' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.use('/api/checkout', checkoutRoutes_1.default);
app.use('/api/payment', checkoutRoutes_1.default); // groups pix/credit-card
app.use('/api/identification', identificationRoutes_1.default); // API de identificação de usuários
app.use('/api/user-id', userIdRoutes_1.default); // NOVO - API de gerenciamento de IDs únicos
app.use('/api/purchase', purchaseRoutes_1.default); // dedicated purchase routes
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/chats', chatRoutes_1.default); // Rotas de chat
app.use('/api/users/:userId/photos', (0, idValidation_1.validateAndConvertUserId)('userId'));
app.use('/api/users', profilePhotoRoutes_1.default); // Rotas de fotos de perfil
app.use('/api/conversations', conversationRoutes_1.default); // Rotas de conversas
app.use('/api/search', searchRoutes_1.default); // Rotas de busca de usuários
app.use('/api/messages/chats/:userId', (0, idValidation_1.validateAndConvertUserId)('userId'));
app.use('/api/messages', messageRoutes_1.default); // Rotas de mensagens
app.use('/api/status', statusRoutes_1.default); // Rotas de status online/offline
app.use('/api/followers', followersRoutes_1.default); // Rotas de seguidores
app.use('/api/friends/:userId', (0, idValidation_1.validateAndConvertUserId)('userId'));
app.use('/api/friends/check/:userId1/:userId2', (0, idValidation_1.validateAndConvertUserId)('userId1'));
app.use('/api/friends/check/:userId1/:userId2', (0, idValidation_1.validateAndConvertUserId)('userId2'));
app.use('/api/friends/mutual/:userId1/:userId2', (0, idValidation_1.validateAndConvertUserId)('userId1'));
app.use('/api/friends/mutual/:userId1/:userId2', (0, idValidation_1.validateAndConvertUserId)('userId2'));
app.use('/api/friends', friendshipRoutes_1.default); // Rotas de amizades
app.use('/api/blocks', blockRoutes_1.default); // Rotas de bloqueios
app.use('/api/location', locationRoutes_1.default); // Rotas de localização
app.use('/api/shop', shopRoutes_1.default); // Rotas da loja
app.use('/api', frameRoutes_1.default); // Rotas de frames (quadros de avatar)
app.use('/api', contributionRoutes_1.default); // Rotas de ranking de contribuição
app.use('/api/upload', uploadRoutes_1.default); // Rotas de upload de arquivos
app.use('/api/upload', imageUploadRoutes_1.default); // Novas rotas completas de upload
app.use('/api', manualRoutes_1.default); // Rotas do manual de transmissão
app.use('/api/payments', paymentRoutes_1.default); // Rotas do Mercado Pago
app.use('/api/webhooks', webhookRoutes_1.default); // Rotas de webhooks
app.use('/api/withdrawals', withdrawalRoutes_1.default); // Rotas de saques via Pix
app.use('/api/transaction-protection', transactionProtectionRoutes_1.default); // Rotas de proteção contra bloqueios abusivos
app.use('/api/level', levelRoutes_1.default); // NOVO - Sistema de Nível
app.use('/api', userStatusRoutes_1.default); // Rotas de status online do usuário
app.use('/api/virtual-ip', virtualIPRoutes_1.default); // NOVO - Sistema de IP Virtual
app.use('/api/convert', base64ConversionRoutes_1.default); // NOVO - Sistema de Conversão Base64
app.use('/convert', base64ConversionRoutes_1.default); // COMPATIBILITY - Allow direct /convert access
app.use('/api/virtual-room', virtualIPRoutes_1.default); // NOVO - Sistema de Salas Virtuais
app.use('/api/call-invitation', callInvitationRoutes_1.default); // NOVO - Sistema de convites de chamada na live
app.use('/api/version', appVersionRoutes_1.default); // NOVO - Sistema de controle de versão
app.use('/api/crud', crudRoutes_1.default); // NOVO - CRUD completo para MongoDB
// 🚨 VALIDAÇÃO ESTRITA para rotas com parâmetros ID
app.use('/api/settings/:id', (0, idValidation_1.validateAndConvertUserId)('id'));
// app.use('/api/level/:userId', validateAndConvertUserId('userId')); // REMOVIDO - causa erro MONGODB_ID_EXPOSED
app.use('/api/zoom/user/:userId', (0, idValidation_1.validateAndConvertUserId)('userId'));
app.use('/api/zoom', zoomRoutes_1.default);
app.use('/api', turnRoutes_1.default); // NOVO - Credenciais TURN
app.use('/api', stunRoutes_1.default); // STUN servers
app.use('/api/srs', srsRoutes_1.default); // Callbacks do SRS PRIMEIRO (evita conflito com routes genéricos)
app.use('/api', metadataRoutes_1.default); // handles /api/ranking, /api/gifts, /api/regions, /api/history
app.use('/api', liveRoutes_1.default); // handles /api/live, /api/streams, /api/rtc, /api/lives, /api/permissions
app.use('/api', likesRoutes_1.default); // handles stream likes
app.use('/api', settingsRoutes_1.default); // handles /api/settings, /api/notifications/settings
app.use('/api/pk', pkRoutes_1.default);
app.use('/api/protobuf', protobufRoutes_1.default);
app.use('/api/live', liveInviteRoutes_1.default); // NOVO - Convites Co-Host/PK com SRS SFU WebRTC
app.use('/api/interactions', interactionRoutes_1.default); // handles /api/interactions/presents, /api/interactions/streams
app.use('/api/visitors', visitorRoutes_1.default); // NOVO - Registro de visitas por nome
app.use('/api/photos', photoRoutes_1.default); // handles /api/photos/:id/like
app.use('/api', activityRoutes_1.default); // NOVO - Sistema de Atividades
app.use('/api/video', videoStreamRoutes_1.default); // NOVO - API de Streaming de Vídeo
app.use('/api', videoStreamRoutes_1.default); // RTC routes (/api/rtc/v1/publish, /api/rtc/v1/stop)
app.use('/api/stats', statsRoutes_1.default); // NOVO - Estatísticas em tempo real
app.use('/api/streams', streamAccessRoutes_1.default); // Validação de acesso a transmissões
app.use('/api', notificationRoutes_1.default); // NOVO - Notificações Push Firebase
app.use('/api', debugRoutes_1.default); // Debug/monitoramento
// Rota para analytics - receber eventos via sendBeacon
app.post('/api/analytics', (req, res) => {
    try {
        console.log('[ANALYTICS] Evento recebido:', req.body);
        // Aqui você pode salvar no banco de dados ou enviar para serviço de analytics
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[ANALYTICS] Erro ao processar evento:', error);
        res.status(500).json({ error: 'Erro ao processar evento' });
    }
});
// Fallback para API - retornar 404 para endpoints não encontrados
// Servir avatares enviados ANTES das rotas da API com CORS headers
app.use('/uploads', (req, res, next) => {
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});
// Middleware centralizado de tratamento de erros (LOGS 500)
app.use((err, req, res, next) => {
    console.error('🔥 [SERVER-ERROR] Erro interno detectado:');
    console.error(`   URL: ${req.method} ${req.url}`);
    console.error(`   Stack: ${err.stack || err.message || err}`);
    res.status(500).json({
        error: 'Erro interno no servidor',
        message: err.message,
        path: req.url
    });
});
// Servir arquivos estáticos do frontend DEPOIS das rotas da API
// app.use(express.static('../dist')); // DESATIVADO - Backend só deve servir API
// Rota raiz para SRS - ANTES do fallback
app.get('/', (req, res) => {
    res.json({
        code: 0,
        msg: 'LiveGo API Ready',
        timestamp: new Date().toISOString()
    });
});
// --- WebSocket Logic ---
// Importar o gerenciador de IPs virtuais
const VirtualIPManager_1 = require("./services/VirtualIPManager");
// Map baseado em userId para evitar duplicatas e controlar múltiplas conexões
const onlineUsers = new Map();
// Map para rastrear qual socket pertence a qual usuário
const socketToUser = new Map();
io.on('connection', (socket) => {
    console.log(`🔌 New WebSocket connection: ${socket.id}`);
    // Obter IP real do cliente
    const realIP = socket.handshake.address ||
        socket.handshake.headers['x-forwarded-for'] ||
        socket.handshake.headers['x-real-ip'] ||
        'unknown';
    async function handleJoinStream(streamId) {
        const userId = socket.data.userId;
        if (!userId || !streamId) {
            console.warn('⚠️ join_stream: dados inválidos', { userId, streamId });
            return;
        }
        const currentUserId = socketToUser.get(socket.id);
        if (currentUserId === userId) {
            const userEntry = onlineUsers.get(userId);
            if (userEntry && userEntry.streamId === streamId && userEntry.socketIds.has(socket.id)) {
                console.warn(`🛑 Socket ${socket.id} já está na stream ${streamId} como usuário ${userId}`);
                return;
            }
        }
        console.log(`👤 Usuário ${userId} entrando na stream ${streamId} (socket: ${socket.id})`);
        const virtualUser = VirtualIPManager_1.virtualIPManager.registerUser(userId, realIP, socket.id);
        let virtualRoom = VirtualIPManager_1.virtualIPManager.getRoomByStreamId(streamId);
        if (!virtualRoom) {
            virtualRoom = VirtualIPManager_1.virtualIPManager.createRoom(streamId, userId);
        }
        VirtualIPManager_1.virtualIPManager.joinRoom(userId, virtualRoom.roomId);
        socketToUser.set(socket.id, userId);
        let userEntry = onlineUsers.get(userId);
        const isFirstConnection = !userEntry;
        const isChangingStream = userEntry && userEntry.streamId !== streamId;
        if (!userEntry) {
            userEntry = { userId, streamId, socketIds: new Set([socket.id]), lastSeen: new Date(), firstConnectionTime: new Date() };
            onlineUsers.set(userId, userEntry);
        }
        else {
            if (!userEntry.socketIds.has(socket.id))
                userEntry.socketIds.add(socket.id);
            if (isChangingStream)
                userEntry.streamId = streamId;
            userEntry.lastSeen = new Date();
        }
        socket.join(streamId);
        const models = await Promise.resolve().then(() => __importStar(require('./models')));
        await models.User.findOneAndUpdate({ id: userId }, { $set: { isOnline: true, currentStreamId: streamId, lastSeen: new Date().toISOString() } }, { upsert: true });
        const { UserStatus } = await Promise.resolve().then(() => __importStar(require('./models')));
        await UserStatus.findOneAndUpdate({ userId }, { $set: { isOnline: true, lastSeen: new Date() } }, { upsert: true }).catch(() => { });
        const onlineCount = Array.from(onlineUsers.values()).filter((u) => u.streamId === streamId).length;
        io.to(streamId).emit('online_users_updated', { streamId, count: onlineCount });
        // viewers_count_updated removido — redundante com online_users_updated.count
        let userName = 'Usuário', userAvatar = '', userLevel = 0;
        try {
            const userDoc = await models.User.findOne({ id: userId }).select('name avatarUrl level').lean();
            if (userDoc) {
                userName = userDoc.name || 'Usuário';
                userAvatar = userDoc.avatarUrl || '';
                userLevel = userDoc.level || 0;
            }
        }
        catch (_) { }
        let hostId = '';
        try {
            let s = await models.Streamer.findOne({ id: streamId }).select('hostId').lean();
            if (!s) {
                // Fallback: tentar buscar pelo streamKey ou normalizedId
                const normalizedId = streamId.startsWith('stream_') ? streamId.replace('stream_', '') : streamId;
                s = await models.Streamer.findOne({
                    $or: [
                        { streamKey: streamId },
                        { streamKey: 'stream_' + normalizedId },
                        { id: normalizedId }
                    ]
                }).select('hostId').lean();
            }
            if (s)
                hostId = s.hostId || '';
            else
                console.log('[FCM] Streamer não encontrado para streamId=' + streamId);
        }
        catch (_) { }
        const counts = await OnlineTracker_1.onlineTracker.userJoin(streamId, userId, hostId, userName, userAvatar);
        io.to(streamId).emit('user_joined_stream', { userId, userName, userAvatar, userLevel, streamId, timestamp: new Date().toISOString() });
        io.to(streamId).emit('user:join', { userId, userName, userAvatar, userLevel, streamId, role: userId === hostId ? 'host' : counts.role, fans: counts.fans, visitors: counts.visitors, total: counts.fans + counts.visitors, timestamp: new Date().toISOString() });
        io.to(streamId).emit('online_counts_updated', { streamId, fans: counts.fans, visitors: counts.visitors, total: counts.fans + counts.visitors });
        try {
            const { Streamer } = await Promise.resolve().then(() => __importStar(require('./models/Streamer')));
            await Streamer.findOneAndUpdate({ id: streamId }, { $set: { viewers: onlineCount } });
            // Sincronizar viewers no LiveCard para o card da transmissão
            // Usar o hostId da stream (já buscado acima) para encontrar o LiveCard correto
            if (hostId) {
                const { LiveCard } = await Promise.resolve().then(() => __importStar(require('./models/index')));
                await LiveCard.findOneAndUpdate({ hostId }, { $set: { viewers: onlineCount, updatedAt: new Date() } });
            }
        }
        catch (_) { }
        // Notificar o host via NotificationService centralizado
        if (hostId && hostId !== userId) {
            try {
                const { NotificationService } = await Promise.resolve().then(() => __importStar(require('./services/NotificationService')));
                await NotificationService.notifyViewerJoinedStream(io, hostId, userId, userName, streamId);
            }
            catch (notifErr) {
                console.error('[NOTIFICATION] Erro ao notificar join stream:', notifErr?.message || notifErr);
            }
        }
        // Auto-registro no chat da stream
        try {
            const { Chat } = await Promise.resolve().then(() => __importStar(require('./models/index')));
            const chatId = `stream_chat_${streamId}`;
            // Buscar ou criar chat da stream
            let streamChat = await Chat.findOne({ id: chatId });
            if (!streamChat) {
                streamChat = await Chat.create({
                    id: chatId,
                    participants: [userId],
                    type: 'stream',
                    title: `Chat da transmissão ${streamId}`,
                    isActive: true,
                    metadata: { streamId },
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                console.log(`📝 [CHAT] Chat da stream criado: ${chatId}`);
            }
            else {
                // Adicionar usuário como participante se não estiver
                // Usar $addToSet para evitar duplicatas em cenários de concorrência
                await Chat.findOneAndUpdate({ id: chatId }, { $addToSet: { participants: userId }, $set: { updatedAt: new Date() } });
                console.log(`👤 [CHAT] Usuário ${userId} registrado no chat da stream ${chatId}`);
            }
            // Juntar socket à sala do chat
            socket.join(`chat_${chatId}`);
            // Notificar outros participantes que um novo usuário entrou no chat
            socket.to(`chat_${chatId}`).emit('user_joined_chat', {
                userId,
                userName,
                userAvatar,
                chatId,
                streamId,
                timestamp: new Date()
            });
            // Notificar o próprio usuário para conectar ao chat
            io.to(`user_${userId}`).emit('auto_join_chat', {
                chatId,
                streamId,
                userName,
                userAvatar,
                participants: streamChat?.participants ? [...streamChat.participants, userId] : [userId],
                timestamp: new Date().toISOString()
            });
            console.log(`💬 [CHAT] Usuário ${userId} auto-registrado no chat da stream ${streamId}`);
        }
        catch (chatErr) {
            console.warn('[CHAT] Erro ao auto-registrar usuário no chat:', chatErr?.message || chatErr);
        }
        console.log(`✅ Usuário ${userId} conectado à stream ${streamId} (sockets: ${userEntry.socketIds.size})`);
    }
    socket.on('join_room_direct', async (data) => {
        if (!data?.roomId)
            return;
        await handleJoinStream(data.roomId);
    });
    socket.on('binary_data', async (data) => {
        try {
            const decoded = ProtobufService_1.BackendProtobufService.decodeEvent(new Uint8Array(data));
            if (decoded?.join_stream) {
                const streamId = decoded.join_stream.base?.stream_id || decoded.join_stream.stream_id;
                if (streamId)
                    await handleJoinStream(streamId);
            }
        }
        catch (_) { }
    });
    socket.on('join_stream', async (data) => {
        await handleJoinStream(data?.streamId);
    });
    // REMOVIDO: leave_stream - lógica movida para disconnect para evitar duplicação
    // socket.on('leave_stream', async (data: { userId: string; streamId: string }) => {
    //     // Lógica movida para evento disconnect
    // });
    // Heartbeat para manter conexão ativa
    socket.on('heartbeat', () => {
        const userId = socketToUser.get(socket.id);
        if (userId) {
            const userEntry = onlineUsers.get(userId);
            if (userEntry) {
                userEntry.lastSeen = new Date();
            }
        }
    });
    socket.on('disconnect', async () => {
        try {
            const userId = socketToUser.get(socket.id);
            if (userId) {
                // 🔥 NOVO: Remover do sistema virtual
                const virtualUser = VirtualIPManager_1.virtualIPManager.getUser(userId);
                if (virtualUser) {
                    // Remover da sala virtual se estiver em alguma
                    if (virtualUser.currentRoom) {
                        const virtualRoom = VirtualIPManager_1.virtualIPManager.getRoom(virtualUser.currentRoom);
                        if (virtualRoom) {
                            VirtualIPManager_1.virtualIPManager.leaveRoom(userId, virtualRoom.roomId);
                            // Notificar sobre saída da sala virtual
                            const participants = VirtualIPManager_1.virtualIPManager.getRoomParticipants(virtualRoom.roomId);
                            io.to(virtualRoom.streamId).emit('virtual_participants_updated', {
                                streamId: virtualRoom.streamId,
                                roomCode: virtualRoom.roomCode,
                                participants,
                                count: participants.length
                            });
                        }
                    }
                    // Remover socket do usuário virtual
                    const userRemoved = VirtualIPManager_1.virtualIPManager.removeSocket(userId, socket.id);
                    if (userRemoved) {
                        console.log(`🗑️ Usuário ${userId} removido completamente do sistema virtual`);
                    }
                }
                const { User } = await Promise.resolve().then(() => __importStar(require('./models/index')));
            }
            // VALIDAÇÃO CRÍTICA: Se não há usuário associado, apenas limpar
            if (!userId) {
                socketToUser.delete(socket.id);
                return;
            }
            const userEntry = onlineUsers.get(userId);
            // VALIDAÇÃO: Se não há entrada para este usuário, apenas limpar e marcar offline
            if (!userEntry) {
                socketToUser.delete(socket.id);
                Promise.resolve().then(() => __importStar(require('./models'))).then(({ User }) => {
                    User.findOneAndUpdate({ id: userId }, { $set: { isOnline: false, lastSeen: new Date().toISOString() } }).catch(() => { });
                });
                return;
            }
            // VALIDAÇÃO: Se este socket não está na lista do usuário, apenas limpar
            if (!userEntry.socketIds.has(socket.id)) {
                console.log(`🔌 Socket ${socket.id} desconectado (não encontrado na lista do usuário ${userId})`);
                socketToUser.delete(socket.id);
                return;
            }
            // Remover este socket da lista
            userEntry.socketIds.delete(socket.id);
            // Se ainda tiver sockets ativos, não marcar como offline
            if (userEntry.socketIds.size > 0) {
                socketToUser.delete(socket.id);
                return;
            }
            onlineUsers.delete(userId);
            // Marcar como offline no banco se não estiver em live
            const models = await Promise.resolve().then(() => __importStar(require('./models')));
            const activeStreams = await models.Streamer.find({
                hostId: userId,
                isLive: true
            });
            if (!activeStreams || activeStreams.length === 0) {
                // Notificar outros usuários na stream sobre saída (antes do DB)
                if (userEntry.streamId) {
                    // Atualizar OnlineTracker e emitir user:leave
                    const leaveCounts = await OnlineTracker_1.onlineTracker.userLeave(userEntry.streamId, userId);
                    if (leaveCounts) {
                        io.to(userEntry.streamId).emit('user:leave', {
                            userId,
                            streamId: userEntry.streamId,
                            fans: leaveCounts.fans,
                            visitors: leaveCounts.visitors,
                            total: leaveCounts.fans + leaveCounts.visitors,
                            timestamp: new Date().toISOString()
                        });
                        io.to(userEntry.streamId).emit('online_counts_updated', {
                            streamId: userEntry.streamId,
                            fans: leaveCounts.fans,
                            visitors: leaveCounts.visitors,
                            total: leaveCounts.fans + leaveCounts.visitors
                        });
                    }
                    io.to(userEntry.streamId).emit('user_left', {
                        userId: userId,
                        streamId: userEntry.streamId
                    });
                    io.to(userEntry.streamId).emit('user_left_stream', {
                        userId: userId,
                        streamId: userEntry.streamId,
                        timestamp: new Date().toISOString()
                    });
                    // Enviar apenas contagem (NÃO a lista completa de usuários)
                    const onlineCount = Array.from(onlineUsers.values())
                        .filter((u) => u.streamId === userEntry.streamId).length;
                    io.to(userEntry.streamId).emit('online_users_updated', {
                        streamId: userEntry.streamId,
                        count: onlineCount
                    });
                    // Persistir viewer count no banco
                    models.Streamer.findOneAndUpdate({ id: userEntry.streamId }, { $set: { viewers: onlineCount } }).catch(() => { });
                    // Sincronizar viewers no LiveCard
                    try {
                        const { LiveCard } = await Promise.resolve().then(() => __importStar(require('./models/index')));
                        // Buscar todos os hosts da stream para atualizar LiveCards
                        const streamerDoc = await models.Streamer.findOne({ id: userEntry.streamId }).select('hostId').lean();
                        if (streamerDoc && streamerDoc.hostId) {
                            await LiveCard.findOneAndUpdate({ hostId: streamerDoc.hostId }, { $set: { viewers: onlineCount, updatedAt: new Date() } });
                        }
                    }
                    catch (_) { }
                    // Remover do chat da stream
                    try {
                        const { Chat } = await Promise.resolve().then(() => __importStar(require('./models/index')));
                        const chatId = `stream_chat_${userEntry.streamId}`;
                        await Chat.findOneAndUpdate({ id: chatId }, { $pull: { participants: userId }, $set: { updatedAt: new Date() } });
                        console.log(`💬 [CHAT] Usuário ${userId} removido do chat ${chatId}`);
                        // Notificar outros participantes que o usuário saiu do chat
                        io.to(`chat_${chatId}`).emit('user_left_chat', {
                            userId,
                            chatId,
                            streamId: userEntry.streamId,
                            timestamp: new Date().toISOString()
                        });
                    }
                    catch (chatErr) {
                        console.warn('[CHAT] Erro ao remover usuário do chat:', chatErr?.message || chatErr);
                    }
                }
                // Marcar como offline no banco (assíncrono, não bloqueia os eventos)
                models.User.findOneAndUpdate({ id: userId }, { $set: { isOnline: false, currentStreamId: null, lastSeen: new Date().toISOString() } }).catch(err => console.error('❌ Erro ao persistir offline:', err));
            }
            // Limpar mapeamento de socket
            socketToUser.delete(socket.id);
        }
        catch (error) {
            console.error('❌ Erro ao processar disconnect:', error);
        }
    });
    // Eventos para status online/offline
    socket.on('user_status_update', async (data) => {
        try {
            await index_1.User.findOneAndUpdate({ id: data.userId }, { $set: { isOnline: data.isOnline, lastSeen: data.isOnline ? undefined : new Date().toISOString() } });
            // Broadcast para todos os usuários
            io.emit('user_status_changed', {
                userId: data.userId,
                isOnline: data.isOnline,
                lastSeen: data.isOnline ? undefined : new Date().toISOString()
            });
            console.log(`🔔 Status atualizado: ${data.userId} -> ${data.isOnline ? 'online' : 'offline'}`);
        }
        catch (error) {
            console.error('❌ Erro ao atualizar status:', error);
        }
    });
    // Eventos para mensagens de chat (atualizado para novas coleções)
    socket.on('send_chat_message', async (data) => {
        try {
            const { chatId, senderId, receiverId, content, messageType = 'text' } = data;
            // Verificar se o usuário tem acesso ao chat
            const { Chat, ChatMessage, User } = await Promise.resolve().then(() => __importStar(require('./models/index')));
            const chat = await Chat.findOne({
                id: chatId,
                participants: senderId,
                isActive: true
            });
            if (!chat) {
                socket.emit('error', { message: 'Chat não encontrado ou sem permissão' });
                return;
            }
            // Criar mensagem na nova coleção
            const message = await ChatMessage.create({
                id: `msg_${chatId}_${senderId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                conversationId: chatId,
                senderId,
                receiverId: receiverId || senderId,
                content,
                messageType: messageType,
                isRead: false
            });
            // Atualizar última mensagem do chat
            await Chat.findOneAndUpdate({ id: chatId }, { $set: {
                    lastMessage: {
                        content: message.content,
                        senderId: message.senderId,
                        timestamp: message.createdAt,
                        messageType: message.messageType
                    }
                } });
            // Buscar detalhes do remetente
            const sender = await User.findOne({ id: senderId }).select('id name avatarUrl');
            if (!sender)
                return;
            // Formatar mensagem para envio
            const formattedMessage = {
                id: message.id,
                conversationId: message.conversationId,
                senderId: message.senderId,
                receiverId: message.receiverId,
                content: message.content,
                messageType: message.messageType,
                isRead: message.isRead,
                sentAt: message.createdAt,
                sender: { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl || '' }
            };
            // Enviar para todos os participantes do chat
            chat.participants.forEach((participantId) => {
                io.to(`user_${participantId}`).emit('new_chat_message', formattedMessage);
                // Enviar notificação se não for o remetente
                if (participantId !== senderId) {
                    io.to(`user_${participantId}`).emit('chat_notification', {
                        type: 'new_message',
                        chatId,
                        message: formattedMessage,
                        sender: sender,
                        timestamp: new Date()
                    });
                }
            });
            // === NOTIFICAR DESTINATÁRIO via serviço centralizado (sininho + FCM) ===
            try {
                const { NotificationService } = await Promise.resolve().then(() => __importStar(require('./services/NotificationService')));
                const receiverIds = chat.participants.filter((p) => p !== senderId);
                const isImage = messageType === 'image';
                const preview = isImage ? '[Imagem]' : content;
                for (const receiverId of receiverIds) {
                    await NotificationService.notifyNewMessage(io, receiverId, senderId, sender.name || 'Alguém', preview, chatId);
                }
            }
            catch (notifErr) {
                console.warn('[SOCKET-CHAT-NOTIFICATION] Erro:', notifErr);
            }
            console.log(`💬 Mensagem enviada via WebSocket: ${senderId} -> chat ${chatId}`);
        }
        catch (error) {
            console.error('❌ Erro ao enviar mensagem via WebSocket:', error);
            socket.emit('error', { message: 'Erro ao enviar mensagem' });
        }
    });
    // Evento para marcar mensagem como lida
    socket.on('mark_message_read', async (data) => {
        try {
            const { messageId, userId } = data;
            const { ChatMessage, Chat } = await Promise.resolve().then(() => __importStar(require('./models/index')));
            const message = await ChatMessage.findOne({
                id: messageId,
                receiverId: userId
            });
            if (!message) {
                socket.emit('error', { message: 'Mensagem não encontrada' });
                return;
            }
            // Marcar como lida
            await ChatMessage.findOneAndUpdate({ id: messageId }, { $set: { isRead: true, readAt: new Date() } });
            // Notificar outros participantes
            const chat = await Chat.findOne({ id: message.conversationId });
            if (chat) {
                chat.participants.forEach((participantId) => {
                    if (participantId !== userId) {
                        io.to(`user_${participantId}`).emit('message_read', {
                            messageId,
                            userId,
                            timestamp: new Date()
                        });
                    }
                });
            }
            console.log(`✅ Mensagem ${messageId} marcada como lida por ${userId}`);
        }
        catch (error) {
            console.error('❌ Erro ao marcar mensagem como lida:', error);
            socket.emit('error', { message: 'Erro ao marcar mensagem como lida' });
        }
    });
    // Evento para usuário entrar em um chat
    socket.on('join_chat', async (data) => {
        try {
            const { userId, chatId } = data;
            // Verificar se usuário tem acesso ao chat
            const models = await Promise.resolve().then(() => __importStar(require('./models')));
            const chat = await models.Chat.findOne({
                id: chatId,
                participants: userId,
                isActive: true
            });
            if (!chat) {
                socket.emit('error', { message: 'Chat não encontrado ou sem permissão' });
                return;
            }
            // Entrar na sala do usuário
            socket.join(`user_${userId}`);
            socket.join(`chat_${chatId}`);
            // Atualizar status online no chat
            socket.to(`chat_${chatId}`).emit('user_joined_chat', {
                userId,
                chatId,
                timestamp: new Date()
            });
            console.log(`👤 Usuário ${userId} entrou no chat ${chatId}`);
        }
        catch (error) {
            console.error('❌ Erro ao entrar no chat:', error);
            socket.emit('error', { message: 'Erro ao entrar no chat' });
        }
    });
    // Evento para usuário sair de um chat
    socket.on('leave_chat', async (data) => {
        try {
            const { userId, chatId } = data;
            socket.leave(`chat_${chatId}`);
            // Notificar outros participantes
            socket.to(`chat_${chatId}`).emit('user_left_chat', {
                userId,
                chatId,
                timestamp: new Date()
            });
            console.log(`� Usuário ${userId} saiu do chat ${chatId}`);
        }
        catch (error) {
            console.error('❌ Erro ao sair do chat:', error);
        }
    });
    // Evento para usuário está digitando
    socket.on('typing', async (data) => {
        try {
            const { userId, chatId, isTyping } = data;
            // Verificar se usuário tem acesso ao chat
            const models = await Promise.resolve().then(() => __importStar(require('./models')));
            const chat = await models.Chat.findOne({
                id: chatId,
                participants: userId,
                isActive: true
            });
            if (!chat)
                return;
            // Notificar outros participantes
            chat.participants.forEach((participantId) => {
                if (participantId !== userId) {
                    io.to(`user_${participantId}`).emit('user_typing', {
                        userId,
                        chatId,
                        isTyping,
                        timestamp: new Date()
                    });
                }
            });
        }
        catch (error) {
            console.error('❌ Erro ao notificar digitação:', error);
        }
    });
    // Eventos para follow/unfollow
    socket.on('user_followed', async (data) => {
        try {
            // Broadcast para todos os usuários sobre o novo follow
            io.emit('user_followed_notification', {
                followerId: data.followerId,
                followingId: data.followingId,
                timestamp: new Date().toISOString()
            });
            console.log(`🔔 Novo follow: ${data.followerId} -> ${data.followingId}`);
        }
        catch (error) {
            console.error('❌ Erro ao notificar follow:', error);
        }
    });
    socket.on('user_unfollowed', async (data) => {
        try {
            // Broadcast para todos os usuários sobre o unfollow
            io.emit('user_unfollowed_notification', {
                followerId: data.followerId,
                followingId: data.followingId,
                timestamp: new Date().toISOString()
            });
            console.log(`🔔 Unfollow: ${data.followerId} -> ${data.followingId}`);
        }
        catch (error) {
            console.error('❌ Erro ao notificar unfollow:', error);
        }
    });
    // Eventos para amizades
    socket.on('friendship_created', async (data) => {
        try {
            // Broadcast para ambos os usuários sobre a nova amizade
            io.emit('friendship_notification', {
                userId1: data.userId1,
                userId2: data.userId2,
                initiatedBy: data.initiatedBy,
                timestamp: new Date().toISOString()
            });
            console.log(`🤝 Nova amizade: ${data.userId1} <-> ${data.userId2} (iniciado por ${data.initiatedBy})`);
        }
        catch (error) {
            console.error('❌ Erro ao notificar amizade:', error);
        }
    });
    // 🔥 NOVO: Evento para encerrar sala virtual quando transmissão termina
    socket.on('end_virtual_room', async (data) => {
        try {
            const { streamId } = data;
            if (!streamId) {
                console.warn('⚠️ end_virtual_room: streamId não fornecido');
                return;
            }
            // Encontrar sala virtual pelo streamId
            const virtualRoom = VirtualIPManager_1.virtualIPManager.getRoomByStreamId(streamId);
            if (virtualRoom) {
                console.log(`🏁 Encerrando sala virtual ${virtualRoom.roomCode} para stream ${streamId}`);
                // Notificar todos os participantes sobre encerramento
                io.to(streamId).emit('virtual_room_ended', {
                    streamId,
                    roomCode: virtualRoom.roomCode,
                    message: 'Transmissão encerrada'
                });
                // Encerrar sala virtual
                VirtualIPManager_1.virtualIPManager.endRoom(virtualRoom.roomId);
            }
        }
        catch (error) {
            console.error('❌ Erro ao encerrar sala virtual:', error);
        }
    });
    // Legados - manter para compatibilidade
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });
    socket.on('leave_room', (roomId) => {
        socket.leave(roomId);
        console.log(`User ${socket.id} left room ${roomId}`);
    });
    socket.on('send_message', (data) => {
        socket.to(data.roomId).emit('receive_message', data.message);
    });    // Eventos para atualizações em tempo real
    socket.on('update_user_stats', async (data) => {
        try {
            const { User } = await Promise.resolve().then(() => __importStar(require('./models/index')));
            await User.findOneAndUpdate({ id: data.userId }, { $set: data.stats });
            // Notificar todos os clientes sobre a atualização
            io.emit('user_stats_updated', {
                userId: data.userId,
                stats: data.stats,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('❌ Erro ao atualizar estatísticas do usuário:', error);
        }
    });
    socket.on('follow_user', async (data) => {
        try {
            const { User, Followers, Friendship } = await Promise.resolve().then(() => __importStar(require('./models/index')));
            // Atualizar contadores
            const follower = await User.findOne({ id: data.followerId });
            const followed = await User.findOne({ id: data.followedId });
            if (follower && followed) {
                // Verificar se já são amigos (seguimento mútuo)
                const isAlreadyFollowing = await Followers.findOne({
                    followerId: data.followerId,
                    followingId: data.followedId
                });
                const isFollowedBack = await Followers.findOne({
                    followerId: data.followedId,
                    followingId: data.followerId
                });
                if (!isAlreadyFollowing) {
                    // Criar relação de follow
                    await Followers.create({
                        id: `follow_${data.followerId}_${data.followedId}_${Date.now()}`,
                        followerId: data.followerId,
                        followingId: data.followedId,
                        createdAt: new Date()
                    });
                    // Atualizar contadores
                    follower.following += 1;
                    followed.fans += 1;
                    await follower.save();
                    await followed.save();
                }
                // Se for follow mútuo, criar amizade
                if (isFollowedBack && !isAlreadyFollowing) {
                    await Friendship.create({
                        userId1: data.followerId,
                        userId2: data.followedId,
                        initiatedBy: data.followerId,
                        createdAt: new Date()
                    });
                    // Atualizar listas de amigos
                    follower.friendsList = [...(follower.friendsList || []), data.followedId];
                    followed.friendsList = [...(followed.friendsList || []), data.followerId];
                    await follower.save();
                    await followed.save();
                    // Notificar sobre nova amizade
                    io.emit('friendship_created', {
                        userId1: data.followerId,
                        userId2: data.followedId,
                        user1: follower,
                        user2: followed,
                        timestamp: new Date()
                    });
                }
                // Notificar sobre novo follow
                io.emit('user_followed', {
                    followerId: data.followerId,
                    followedId: data.followedId,
                    follower: follower,
                    followed: followed,
                    timestamp: new Date()
                });
                // Atualizar estatísticas em tempo real
                io.emit('user_stats_updated', {
                    userId: data.followerId,
                    stats: { following: follower.following, friendsList: follower.friendsList }
                });
                io.emit('user_stats_updated', {
                    userId: data.followedId,
                    stats: { fans: followed.fans, friendsList: followed.friendsList }
                });
            }
        }
        catch (error) {
            console.error('❌ Erro ao processar follow:', error);
        }
    });
    socket.on('update_diamonds', async (data) => {
        try {
            const { User } = await Promise.resolve().then(() => __importStar(require('./models/index')));
            const user = await User.findOneAndUpdate({ id: data.userId }, { $inc: { diamonds: data.change } }, { returnDocument: 'after' });
            if (user) {
                io.emit('diamonds_updated', {
                    userId: data.userId,
                    diamonds: user.diamonds,
                    change: data.change,
                    timestamp: new Date()
                });
            }
        }
        catch (error) {
            console.error('❌ Erro ao atualizar diamantes:', error);
        }
    });
    // --- Chat e Status Events ---
    socket.on('set_user_online', async () => {
        try {
            const userId = socket.data.userId;
            if (!userId)
                return;
            socketToUser.set(socket.id, userId);
            socket.join(`user_${userId}`);
            // Notificar todos sobre mudança de status em tempo real (antes do DB)
            io.emit('user_status_changed', {
                userId,
                isOnline: true,
                lastSeen: new Date().toISOString()
            });
            // Atualizar status no banco (assíncrono, não bloqueia o evento)
            const { User } = await Promise.resolve().then(() => __importStar(require('./models/index')));
            User.findOneAndUpdate({ id: userId }, { $set: { isOnline: true, lastSeen: new Date().toISOString() } }).catch(err => console.error('❌ Erro ao persistir status online:', err));
            console.log(`🟢 Usuário ${userId} online (socket: ${socket.id})`);
        }
        catch (error) {
            console.error('❌ Erro ao setar usuário online:', error);
        }
    });
    socket.on('join_conversation', (data) => {
        try {
            const { conversationId } = data;
            if (!conversationId)
                return;
            socket.join(`conversation_${conversationId}`);
            console.log(`💬 Socket ${socket.id} entrou na conversa ${conversationId}`);
        }
        catch (error) {
            console.error('❌ Erro ao entrar na conversa:', error);
        }
    });
    socket.on('leave_conversation', (data) => {
        try {
            const { conversationId } = data;
            if (!conversationId)
                return;
            socket.leave(`conversation_${conversationId}`);
            console.log(`💬 Socket ${socket.id} saiu da conversa ${conversationId}`);
        }
        catch (error) {
            console.error('❌ Erro ao sair da conversa:', error);
        }
    });
    // Removidos eventos duplicados de join/leave stream para evitar conflitos
    // A lógica principal está no início do arquivo com controle adequado de múltiplas conexões
    socket.on('send_notification', async (data) => {
        try {
            // Enviar notificação para usuário específico
            io.to(`user_${data.userId}`).emit('notification', {
                id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId: data.userId,
                type: data.type,
                message: data.message,
                data: data.data,
                timestamp: new Date(),
                read: false
            });
            // Notificar sobre notificação não lida
            io.to(`user_${data.userId}`).emit('unread_notification', {
                userId: data.userId,
                count: 1, // Aqui poderia buscar do banco o total
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('❌ Erro ao enviar notificação:', error);
        }
    });
    socket.on('mark_notification_read', async (data) => {
        try {
            // Notificar sobre notificação lida
            io.to(`user_${data.userId}`).emit('notification_read', {
                notificationId: data.notificationId,
                userId: data.userId,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('❌ Erro ao marcar notificação como lida:', error);
        }
    });
    // send_live_message — broadcast de mensagem enriquecida + persistência no MongoDB
    socket.on('send_live_message', async (data) => {
        try {
            const { streamId, userId, text } = data;
            const user = await index_1.User.findOne({ id: userId }).select('name displayName avatarUrl level activeFrameId').lean();
            const userName = user?.name || user?.displayName;
            if (!user || !userName)
                return;
            const messagePayload = {
                userId,
                userName,
                avatarUrl: user.avatarUrl || '',
                level: user.level || 1,
                activeFrameId: user.activeFrameId || null,
                text,
                timestamp: new Date()
            };
            // Broadcast para TODOS na stream (io.to inclui o remetente)
            io.to(streamId).emit('live_message', messagePayload);
            // Persistir no MongoDB (TTL de 24h via índice expireAfterSeconds)
            index_1.LiveMessage.create({
                streamId,
                userId,
                userName: messagePayload.userName,
                avatarUrl: messagePayload.avatarUrl,
                level: messagePayload.level,
                activeFrameId: messagePayload.activeFrameId,
                text,
                timestamp: messagePayload.timestamp
            }).catch(err => console.error('❌ Erro ao persistir live_message:', err));
        }
        catch (error) {
            console.error('❌ Erro ao processar send_live_message:', error);
        }
    });
    // toggle_mic — alternar microfone em tempo real
    socket.on('toggle_mic', async (data) => {
        try {
            const { streamId, userId, microphoneEnabled } = data;
            const { Streamer } = await Promise.resolve().then(() => __importStar(require('./models/index')));
            await Streamer.findOneAndUpdate({ id: streamId }, { $set: { microphoneEnabled } });
            io.to(streamId).emit('mic_toggled', {
                streamId, userId, microphoneEnabled,
                timestamp: new Date().toISOString()
            });
            console.log(`[SOCKET-MIC] Microfone ${microphoneEnabled ? 'ativado' : 'mutado'} por ${userId} na stream ${streamId}`);
        }
        catch (error) {
            console.error('[SOCKET-MIC] Erro:', error);
        }
    });
    // toggle_sound — alternar som em tempo real
    socket.on('toggle_sound', async (data) => {
        try {
            const { streamId, userId, soundEnabled } = data;
            const { Streamer } = await Promise.resolve().then(() => __importStar(require('./models/index')));
            await Streamer.findOneAndUpdate({ id: streamId }, { $set: { soundEnabled } });
            io.to(streamId).emit('sound_toggled', {
                streamId, userId, soundEnabled,
                timestamp: new Date().toISOString()
            });
            console.log(`[SOCKET-SOUND] Som ${soundEnabled ? 'ativado' : 'silenciado'} por ${userId} na stream ${streamId}`);
        }
        catch (error) {
            console.error('[SOCKET-SOUND] Erro:', error);
        }
    });
    // cohost_invite — direciona convite de co-host para o guest
    socket.on('cohost_invite', async (data) => {
        try {
            const { inviteeId, streamId, hostId, hostName } = data;
            io.to(`user_${inviteeId}`).emit('cohost_invitation', {
                hostId,
                hostName: hostName || '',
                streamId,
                timestamp: new Date()
            });
            console.log(`📞 [Cohost Invite] ${hostId} convidou ${inviteeId} para co-host na stream ${streamId}`);
        }
        catch (error) {
            console.error('❌ Erro ao processar cohost_invite:', error);
        }
    });
    // pk_started — sincroniza espectadores sobre início da PK
    socket.on('pk_started', async (data) => {
        try {
            const { roomId, opponentStreamId, durationSeconds } = data;
            // Broadcast para a sala do host
            io.to(roomId).emit('pk_battle_start', {
                battleId: roomId,
                opponentId: opponentStreamId,
                durationSeconds: durationSeconds || 300,
                startedAt: new Date()
            });
            // Broadcast para a sala do oponente
            io.to(opponentStreamId).emit('pk_battle_start', {
                battleId: roomId,
                opponentId: roomId,
                durationSeconds: durationSeconds || 300,
                startedAt: new Date()
            });
            console.log(`🏆 [PK Started] PK iniciada: ${roomId} vs ${opponentStreamId}`);
        }
        catch (error) {
            console.error('❌ Erro ao processar pk_started:', error);
        }
    });
    // pk_heart_add — incrementa corações da PK
    socket.on('pk_heart_add', async (data) => {
        try {
            const { battleId, team } = data;
            const field = team === 'A' ? 'heartsA' : 'heartsB';
            const updated = await index_1.Battle.findOneAndUpdate({ _id: battleId }, { $inc: { [field]: 1 } }, { returnDocument: 'after' });
            if (updated) {
                io.to(`battle_${battleId}`).emit('pk_heart_update', {
                    battleId,
                    heartsA: updated.heartsA || 0,
                    heartsB: updated.heartsB || 0,
                    team
                });
            }
        }
        catch (error) {
            console.error('❌ Erro ao processar pk_heart_add:', error);
        }
    });
});
// REMOVIDO: getIO duplicado (já existe em socket.ts e server.ts)
// export const getIO = () => io;

// ─── Orphan Process Signals ────────────────────────────────────────
['SIGINT', 'SIGTERM', 'exit'].forEach((signal) => {
  process.on(signal, () => {
    killAllFfmpegProcesses();
    if (signal !== 'exit') process.exit(0);
  });
});
// ────────────────────────────────────────────────────────────────────
