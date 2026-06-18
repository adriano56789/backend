import express from 'express';
import helmet from 'helmet';


import http from 'http';
import https from 'https';
import fs from 'fs';
import { initSocket } from './socket';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV, isDev } from './config/env';
import path from 'path';
import { connectDB } from './config/db';
import { validateEnv } from './config/validateEnv';
import { User, Streamer, Message, Followers, Friendship, UserLevel, UserActivity, Battle, LiveMessage, StreamParticipant } from './models/index';
import { validateAndConvertUserId } from './middleware/idValidation';
import { BackendProtobufService } from './services/protobuf/ProtobufService';
import { activityEventService } from './services/ActivityEventService';
import { initializeActivityHooks } from './models/ActivityHooks';
import userRoutes from './routes/userRoutes';
import profileRoutes from './routes/profileRoutes';
import walletRoutes from './routes/walletRoutes';
import checkoutRoutes from './routes/checkoutRoutes';
import adminRoutes from './routes/adminRoutes';
import metadataRoutes from './routes/metadataRoutes';
import settingsRoutes from './routes/settingsRoutes';
import liveRoutes from './routes/liveRoutes';
import visitorRoutes from './routes/visitorRoutes';
import pkRoutes from './routes/pkRoutes';
import interactionRoutes from './routes/interactionRoutes';
import authRoutes from './routes/authRoutes';
import mediaRoutes from './routes/mediaRoutes';
import chatRoutes from './routes/chatRoutes';
import profilePhotoRoutes from './routes/profilePhotoRoutes';
import conversationRoutes from './routes/conversationRoutes';
import searchRoutes from './routes/searchRoutes';
import photoRoutes from './routes/photoRoutes';
import messageRoutes from './routes/messageRoutes';
import imageUploadRoutes from './routes/imageUploadRoutes';
import statusRoutes from './routes/statusRoutes';
import followersRoutes from './routes/followersRoutes';
import friendshipRoutes from './routes/friendshipRoutes';
import blockRoutes from './routes/blockRoutes';
import statsRoutes from './routes/statsRoutes';
import { onlineTracker } from './services/OnlineTracker';
import locationRoutes from './routes/locationRoutes';
import shopRoutes from './routes/shopRoutes';
import frameRoutes from './routes/frameRoutes';
import contributionRoutes from './routes/contributionRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import uploadRoutes from './routes/uploadRoutes';
import manualRoutes from './routes/manualRoutes';
import paymentRoutes from './routes/paymentRoutes';
import webhookRoutes from './routes/webhookRoutes';
import withdrawalRoutes from './routes/withdrawalRoutes';
import transactionProtectionRoutes from './routes/transactionProtectionRoutes';
import zoomRoutes from './routes/zoomRoutes';
import userStatusRoutes from './routes/userStatusRoutes';
import levelRoutes from './routes/levelRoutes'; // NOVO - Sistema de Nível
import virtualIPRoutes from './routes/virtualIPRoutes'; // NOVO - Sistema de IP Virtual
import base64ConversionRoutes from './routes/base64ConversionRoutes'; // NOVO - Sistema de Conversão Base64
import likesRoutes from './routes/likesRoutes'; // NOVO - Sistema de Likes
// livekitRoutes removido - usando apenas SRS WebRTC
import callInvitationRoutes from './routes/callInvitationRoutes'; // NOVO - Sistema de convites de chamada na live
import activityRoutes from './routes/activityRoutes'; // NOVO - Sistema de Atividades
import videoStreamRoutes from './routes/videoStreamRoutes'; // NOVO - API de Streaming de Vídeo
import srsRoutes from './routes/srsRoutes'; // Callbacks SRS
import appVersionRoutes from './routes/appVersionRoutes'; // NOVO - Sistema de controle de versão
import crudRoutes from './routes/crudRoutes';
import liveInviteRoutes from './routes/liveInviteRoutes';
import UserStatusManager from './middleware/UserStatusManager';
import { blockBase64Middleware } from './middleware/blockBase64';
import { mqttBridge } from './services/MqttBridge';

// REMOVIDO: Módulos inexistentes
// import { initializeDatabase } from './scripts/initDatabase'; // NOVO - Inicialização automática
// import { withdrawalCronJob } from './scripts/withdrawalCronJob'; // NOVO - Cron job de saques

validateEnv();

// ─── Orphan Process Killer (FFmpeg) ─────────────────────────────────
const activeProcesses = new Set<any>();

export function registerFfmpegProcess(proc: any) {
  activeProcesses.add(proc);
  proc.on('close', () => activeProcesses.delete(proc));
}

function killAllFfmpegProcesses() {
  console.warn(`[SYSTEM] Matando ${activeProcesses.size} processos FFmpeg ativos...`);
  for (const proc of activeProcesses) {
    try { proc.kill('SIGKILL'); } catch (_) {}
  }
  activeProcesses.clear();
}
// ────────────────────────────────────────────────────────────────────

const app = express();
app.set('trust proxy', 1);
app.set('etag', false);

// 🔒 Security headers (defense in depth)
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } })); // Desabilitar ETag para sempre retornar 200 em vez de 304

// Log de depuração para todas as requisições
app.use((req, res, next) => {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

const certPath = ENV.HTTPS_CERT_PATH;
const keyPath = ENV.HTTPS_KEY_PATH;

let server: http.Server | https.Server;
let isHttps = false;

// Só tenta HTTPS se não estiver em dev ou se os arquivos existirem e forem arquivos (não diretórios)
const certExists = fs.existsSync(certPath) && fs.lstatSync(certPath).isFile();
const keyExists = fs.existsSync(keyPath) && fs.lstatSync(keyPath).isFile();

if (!isDev && certExists && keyExists) {
  const httpsOptions = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
  server = https.createServer(httpsOptions, app);
  isHttps = true;
  console.log(`🔐 Backend HTTPS nativo habilitado (${certPath})`);
} else {
  server = http.createServer(app);
  if (isDev) {
    console.log('🚀 Iniciando em modo HTTP (Desenvolvimento).');
  } else if (!certExists || !keyExists) {
    console.warn(`⚠️ Certificados não encontrados ou inválidos: ${certPath} / ${keyPath}`);
    console.warn('⚠️ Iniciando em modo HTTP como fallback.');
  }
}

const io = initSocket(server);
const port = ENV.PORT;
const wsPort = ENV.WS_PORT;

// Monkey-patch io.emit e io.to (SÍNCRONO — aplicado imediatamente)
const origEmit = io.emit.bind(io);
io.emit = ((event: string, ...args: any[]) => {
  if (mqttBridge.isConnected()) {
    mqttBridge.publish('livego/global', { event, data: args }).catch(() => {});
  }
  return origEmit(event, ...args);
}) as typeof io.emit;

const origTo = io.to.bind(io);
io.to = ((room: string | string[]) => {
  const broadcastOp = origTo(room);
  const origBroadcastEmit = broadcastOp.emit.bind(broadcastOp);
  broadcastOp.emit = ((event: string, ...args: any[]) => {
    if (mqttBridge.isConnected()) {
      if (event === 'binary_data' && args[0] instanceof ArrayBuffer) {
        const b64 = Buffer.from(new Uint8Array(args[0])).toString('base64');
        mqttBridge.publish(`livego/room/${room}`, { event, binaryBase64: b64, _room: room }).catch(() => {});
      } else {
        mqttBridge.publish(`livego/room/${room}`, { event, data: args, _room: room }).catch(() => {});
      }
    }
    return origBroadcastEmit(event, ...args);
  }) as typeof broadcastOp.emit;
  return broadcastOp;
}) as typeof io.to;

app.set('io', io);
console.log('🔁 [MQTT] Proxy configurado (monkey-patch io.emit/io.to)');

// Conectar ao EMQX (apenas se habilitado e não bloquear o startup)
if (ENV.MQTT_ENABLED) {
  mqttBridge.connect().then(() => {
    console.log('🔌 [MQTT] Conectado ao EMQX');

    // Só inscrever depois de conectado
    // NOTA: usar origEmit/origTo (métodos ORIGINAIS antes do monkey-patch)
    // para evitar loop infinito (re-publicação no MQTT ao re-emitir localmente)
    mqttBridge.subscribe('livego/room/+', (msg) => {
      if (msg.instanceId === mqttBridge.instanceId) return;
      const payload = msg.payload;
      const room = payload._room || msg.topic.split('/')[2];
      if (payload.binaryBase64) {
        const buf = Buffer.from(payload.binaryBase64, 'base64');
        origTo(room).emit(payload.event, buf);
      } else {
        origTo(room).emit(payload.event, ...(payload.data || []));
      }
    });

    mqttBridge.subscribe('livego/global', (msg) => {
      if (msg.instanceId === mqttBridge.instanceId) return;
      origEmit(msg.payload.event, ...(msg.payload.data || []));
    });

    console.log('🔁 [MQTT] Subscribes configurados');
  }).catch((err: any) => {
    console.error('❌ [MQTT] Falha ao conectar ao EMQX:', err.message);
    console.warn('⚠️ [MQTT] Backend continuará sem distribuição MQTT');
  });
} else {
  console.log('ℹ️ [MQTT] Distribuição MQTT desativada (MQTT_ENABLED=false)');
}

connectDB().then(async () => {
    await BackendProtobufService.init();
    initializeActivityHooks();
    activityEventService.initialize(io);

    server.listen(port, '127.0.0.1', () => {
        console.log(`🌍 API Server started on http://127.0.0.1:${port}`);
    });
}).catch(error => {
    console.error('❌ [DB] Falha na conexão com MongoDB:', error.message);
    process.exit(1);
});

// Inicializar UserStatusManager para gerenciar status online
const userStatusManager = new UserStatusManager(io);

// Limpar usuários inativos periodicamente (a cada 5 minutos)
setInterval(() => {
    userStatusManager.cleanupInactiveUsers();
}, 5 * 60 * 1000);

// Middleware CORS - configurado antes de tudo
const allowedOrigins = ENV.CORS_ORIGIN.split(',').map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
        const isAllowed = isLocal || allowedOrigins.includes(origin) || isDev;

        if (isAllowed) {
            callback(null, true);
        } else {
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

// Middleware para headers adicionais (Fallback e Preflight manual)
app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept, Cache-Control, Pragma, cache-control, pragma, x-acesso-exclusivo-app');
        res.header('Access-Control-Max-Age', '1728000');
        return res.status(204).end();
    }

    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Middleware global para bloquear URLs Base64 e validação de IDs - COM EXCEÇÃO SRS
app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/srs/')) {
        return next();
    }

    // Aplicar middlewares normais para outras rotas
    blockBase64Middleware(req, res, (err) => {
        if (err) return next(err);
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
app.use('/api', likesRoutes); // NOVO - Sistema de Likes - MOVIDO PARA O INÍCIO
app.use('/api/auth', authRoutes);
app.use('/api/accounts', authRoutes);
// app.use('/api/accounts', authRoutes); // REMOVIDO - duplicação de rotas causando conflito
// 🚨 VALIDAÇÃO ESTRITA para rotas com parâmetros ID
app.use('/api/users/:id', validateAndConvertUserId('id'));
app.use('/api/users/:userId', validateAndConvertUserId('userId')); // Para rotas com userId
app.use('/api/users', userRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/perfil', profileRoutes);
app.use('/api/wallet', walletRoutes); // handles /api/wallet/earnings, /api/wallet/purchases
// Aliases compatíveis com o spec do ambiente simulado
app.get('/api/earnings/get/:userId', async (req, res) => {
  try {
    const { User } = await import('./models');
    const { calculateBRLFromDiamonds } = await import('./utils/diamondConversion');
    const user = await User.findOne({ id: req.params.userId });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const available_diamonds = Math.floor(user.earnings || 0);
    const grossBRL = calculateBRLFromDiamonds(available_diamonds);
    const platformFeeBRL = grossBRL * 0.30;
    const netBRL = grossBRL - platformFeeBRL;
    res.json({ available_diamonds, gross_brl: grossBRL, platform_fee_brl: platformFeeBRL, net_brl: netBRL });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
app.post('/api/earnings/withdraw/:userId', async (req, res) => {
  // Redirecionar para a rota real do wallet
  try {
    const { User } = await import('./models');
    const user = await User.findOne({ id: req.params.userId });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount inválido' });
    if ((user.earnings || 0) < amount) return res.status(400).json({ error: 'Saldo insuficiente' });
    await User.findOneAndUpdate({ id: req.params.userId }, {
      $inc: { earnings: -amount, earnings_withdrawn: amount }
    });
    res.json({ success: true, amount, message: 'Saque registrado com sucesso' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
app.use('/api/checkout', checkoutRoutes);
app.use('/api/payment', checkoutRoutes); // groups pix/credit-card
app.use('/api/purchase', purchaseRoutes); // dedicated purchase routes
app.use('/api/admin', adminRoutes);
app.use('/api/chats', chatRoutes); // Rotas de chat
app.use('/api/users/:userId/photos', validateAndConvertUserId('userId'));
app.use('/api/users', profilePhotoRoutes); // Rotas de fotos de perfil
app.use('/api/conversations', conversationRoutes); // Rotas de conversas
app.use('/api/search', searchRoutes); // Rotas de busca de usuários
app.use('/api/messages/chats/:userId', validateAndConvertUserId('userId'));
app.use('/api/messages', messageRoutes); // Rotas de mensagens
app.use('/api/status', statusRoutes); // Rotas de status online/offline
app.use('/api/followers', followersRoutes); // Rotas de seguidores
app.use('/api/friends/:userId', validateAndConvertUserId('userId'));
app.use('/api/friends/check/:userId1/:userId2', validateAndConvertUserId('userId1'));
app.use('/api/friends/check/:userId1/:userId2', validateAndConvertUserId('userId2'));
app.use('/api/friends/mutual/:userId1/:userId2', validateAndConvertUserId('userId1'));
app.use('/api/friends/mutual/:userId1/:userId2', validateAndConvertUserId('userId2'));
app.use('/api/friends', friendshipRoutes); // Rotas de amizades
app.use('/api/blocks', blockRoutes); // Rotas de bloqueios
app.use('/api/location', locationRoutes); // Rotas de localização
app.use('/api/shop', shopRoutes); // Rotas da loja
app.use('/api', frameRoutes); // Rotas de frames (quadros de avatar)
app.use('/api', contributionRoutes); // Rotas de ranking de contribuição
app.use('/api/upload', uploadRoutes); // Rotas de upload de arquivos
app.use('/api/upload', imageUploadRoutes); // Novas rotas completas de upload
app.use('/api', manualRoutes); // Rotas do manual de transmissão
app.use('/api/payments', paymentRoutes); // Rotas do Mercado Pago
app.use('/api/webhooks', webhookRoutes); // Rotas de webhooks
app.use('/api/withdrawals', withdrawalRoutes); // Rotas de saques via Pix
app.use('/api/transaction-protection', transactionProtectionRoutes); // Rotas de proteção contra bloqueios abusivos
app.use('/api/level', levelRoutes); // NOVO - Sistema de Nível
app.use('/api', userStatusRoutes); // Rotas de status online do usuário
app.use('/api/virtual-ip', virtualIPRoutes); // NOVO - Sistema de IP Virtual
app.use('/api/convert', base64ConversionRoutes); // NOVO - Sistema de Conversão Base64
app.use('/convert', base64ConversionRoutes); // COMPATIBILITY - Allow direct /convert access
app.use('/api/virtual-room', virtualIPRoutes); // NOVO - Sistema de Salas Virtuais
app.use('/api/call-invitation', callInvitationRoutes); // NOVO - Sistema de convites de chamada na live
app.use('/api/version', appVersionRoutes); // NOVO - Sistema de controle de versão
app.use('/api/crud', crudRoutes); // NOVO - CRUD completo para MongoDB
// 🚨 VALIDAÇÃO ESTRITA para rotas com parâmetros ID
app.use('/api/settings/:id', validateAndConvertUserId('id'));
// app.use('/api/level/:userId', validateAndConvertUserId('userId')); // REMOVIDO - causa erro MONGODB_ID_EXPOSED
app.use('/api/zoom/user/:userId', validateAndConvertUserId('userId'));
app.use('/api/zoom', zoomRoutes);

app.use('/api/srs', srsRoutes); // Callbacks do SRS PRIMEIRO (evita conflito com routes genéricos)
app.use('/api', metadataRoutes); // handles /api/ranking, /api/gifts, /api/regions, /api/history
app.use('/api', liveRoutes); // handles /api/live, /api/streams, /api/rtc, /api/lives, /api/permissions
app.use('/api', settingsRoutes); // handles /api/settings, /api/notifications/settings
app.use('/api/pk', pkRoutes);
app.use('/api/live', liveInviteRoutes); // NOVO - Convites Co-Host/PK com SRS SFU WebRTC
app.use('/api/interactions', interactionRoutes); // handles /api/interactions/presents, /api/interactions/streams
app.use('/api/visitors', visitorRoutes); // NOVO - Registro de visitas por nome
app.use('/api/photos', photoRoutes); // handles /api/photos/:id/like
app.use('/api', activityRoutes); // NOVO - Sistema de Atividades
app.use('/api/video', videoStreamRoutes); // NOVO - API de Streaming de Vídeo
app.use('/api', videoStreamRoutes); // RTC routes (/api/rtc/v1/publish, /api/rtc/v1/stop)
app.use('/api/stats', statsRoutes); // NOVO - Estatísticas em tempo real


// Rota para analytics - receber eventos via sendBeacon
app.post('/api/analytics', (req, res) => {
    try {
        console.log('[ANALYTICS] Evento recebido:', req.body);
        // Aqui você pode salvar no banco de dados ou enviar para serviço de analytics
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[ANALYTICS] Erro ao processar evento:', error);
        res.status(500).json({ error: 'Erro ao processar evento' });
    }
});

// Fallback para API - retornar 404 para endpoints não encontrados
// Servir avatares enviados ANTES das rotas da API com CORS headers
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, '../uploads')));

app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

// Middleware centralizado de tratamento de erros (LOGS 500)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
import { virtualIPManager } from './services/VirtualIPManager';

// Map baseado em userId para evitar duplicatas e controlar múltiplas conexões
const onlineUsers = new Map<string, {
    userId: string;
    streamId: string;
    socketIds: Set<string>;
    lastSeen: Date;
    firstConnectionTime: Date;
}>();
// Map para rastrear qual socket pertence a qual usuário
const socketToUser = new Map<string, string>();

io.on('connection', (socket) => {
    console.log(`🔌 New WebSocket connection: ${socket.id}`);

    // Obter IP real do cliente
    const realIP = socket.handshake.address ||
        socket.handshake.headers['x-forwarded-for'] ||
        socket.handshake.headers['x-real-ip'] ||
        'unknown';

    socket.on('join_stream', async (data: { streamId: string }) => {
        try {
            const userId = socket.data.userId;
            const { streamId } = data;

            // VALIDAÇÃO CRÍTICA: Evitar processamento duplicado
            if (!userId || !streamId) {
                console.warn('⚠️ join_stream: dados inválidos', { userId, streamId });
                return;
            }

            // Verificar se este socket já está associado a este usuário nesta stream
            const currentUserId = socketToUser.get(socket.id);
            if (currentUserId === userId) {
                const userEntry = onlineUsers.get(userId);
                if (userEntry && userEntry.streamId === streamId && userEntry.socketIds.has(socket.id)) {
                    console.warn(`🛑 Socket ${socket.id} já está na stream ${streamId} como usuário ${userId} - IGNORANDO`);
                    return;
                }
            }

            console.log(`👤 Usuário ${userId} entrando na stream ${streamId} via WebSocket (socket: ${socket.id})`);

            // 🔥 NOVO: Registrar usuário com IP virtual
            const virtualUser = virtualIPManager.registerUser(userId, realIP as string, socket.id);
            console.log(`🌐 IP Virtual atribuído: ${virtualUser.virtualIP} (IP real: ${realIP})`);

            // Verificar se existe sala virtual para esta stream
            let virtualRoom = virtualIPManager.getRoomByStreamId(streamId);
            if (!virtualRoom) {
                // Criar sala virtual se não existir
                virtualRoom = virtualIPManager.createRoom(streamId, userId);
                console.log(`🏠 Sala virtual criada: ${virtualRoom.roomCode} para stream ${streamId}`);
            }

            // Entrar na sala virtual
            virtualIPManager.joinRoom(userId, virtualRoom.roomId);

            // Mapear socket para usuário (sistema legado)
            socketToUser.set(socket.id, userId);

            // Verificar se usuário já está online (sistema legado)
            let userEntry: any = onlineUsers.get(userId);
            const isFirstConnection = !userEntry;
            const isChangingStream = userEntry && userEntry.streamId !== streamId;

            if (!userEntry) {
                // Novo usuário online
                userEntry = {
                    userId,
                    streamId,
                    socketIds: new Set([socket.id]),
                    lastSeen: new Date(),
                    firstConnectionTime: new Date()
                };
                onlineUsers.set(userId, userEntry);
            } else {
                // Usuário já online, adicionar socket e atualizar stream se necessário
                if (!userEntry.socketIds.has(socket.id)) {
                    userEntry.socketIds.add(socket.id);
                }
                if (isChangingStream) {
                    console.log(`🔄 Usuário ${userId} mudando da stream ${userEntry.streamId} para ${streamId}`);
                    userEntry.streamId = streamId;
                }
                userEntry.lastSeen = new Date();
            }

            // Entrar na sala do Socket.IO (legado)
            socket.join(streamId);

            // Atualizar status no banco (sempre atualizar o currentStreamId)
            const models = await import('./models');
            if (isFirstConnection || isChangingStream) {
                console.log(`📤 [JOIN_STREAM] Enviando update de status para o banco (User ${userId})...`);
                const updateResult = await models.User.findOneAndUpdate(
                    { id: userId },
                    { $set: { isOnline: true, currentStreamId: streamId, lastSeen: new Date().toISOString() } },
                    { new: true }
                );
                console.log(`✅ [JOIN_STREAM] Resposta MongoDB recebida. Status atualizado: ${updateResult?.isOnline}, streamId: ${updateResult?.currentStreamId}`);
            }

            const onlineUsersInStream = Array.from(onlineUsers.values())
                .filter((user: any) => user.streamId === streamId)
                .map((user: any) => ({ userId: user.userId, lastSeen: user.lastSeen }));

            io.to(streamId).emit('online_users_updated', {
                streamId,
                users: onlineUsersInStream,
                count: onlineUsersInStream.length
            });
            io.to(streamId).emit('viewers_count_updated', {
                streamId,
                count: onlineUsersInStream.length
            });
            // Buscar dados do usuário para emitir evento individual
            let userName = 'Usuário';
            let userAvatar = '';
            let userLevel = 0;
            try {
                const userDoc = await models.User.findOne({ id: userId }).select('name avatarUrl level').lean();
                if (userDoc) {
                    userName = (userDoc as any).name || 'Usuário';
                    userAvatar = (userDoc as any).avatarUrl || '';
                    userLevel = (userDoc as any).level || 0;
                }
            } catch (_) {}

            // Obter hostId da stream para classificar fã vs visitante
            let hostId = '';
            try {
                const streamDoc = await models.Streamer.findOne({ id: streamId }).select('hostId').lean();
                if (streamDoc) hostId = (streamDoc as any).hostId || '';
            } catch (_) {}

            // Registrar no OnlineTracker e obter contagens atualizadas
            const counts = await onlineTracker.userJoin(streamId, userId, hostId, userName, userAvatar);

            // Emitir evento de join para toda a sala
            io.to(streamId).emit('user_joined_stream', {
                userId,
                userName,
                userAvatar,
                userLevel,
                streamId,
                timestamp: new Date().toISOString()
            });

            // Emitir evento de presença para todos na stream
            io.to(streamId).emit('user:join', {
                userId,
                userName,
                userAvatar,
                userLevel,
                streamId,
                role: userId === hostId ? 'host' : counts.role,
                fans: counts.fans,
                visitors: counts.visitors,
                total: counts.fans + counts.visitors,
                timestamp: new Date().toISOString()
            });

            // Broadcast atualização de contagem para todos na stream
            io.to(streamId).emit('online_counts_updated', {
                streamId,
                fans: counts.fans,
                visitors: counts.visitors,
                total: counts.fans + counts.visitors
            });

            // Persistir viewer count no banco
            const viewerCount = onlineUsersInStream.length;
            try {
                const { Streamer } = await import('./models/Streamer');
                await Streamer.findOneAndUpdate(
                    { id: streamId },
                    { $set: { viewers: viewerCount } }
                );
            } catch (e) {
                // Falha silenciosa — não travar o join por causa do DB
            }

            console.log(`✅ Usuário ${userId} conectado à stream ${streamId} (sockets: ${userEntry.socketIds.size}) - IP Virtual: ${virtualUser.virtualIP}`);
        } catch (error) {
            console.error('❌ Erro ao entrar na stream via WebSocket:', error);
        }
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
                const virtualUser = virtualIPManager.getUser(userId);
                if (virtualUser) {
                    // Remover da sala virtual se estiver em alguma
                    if (virtualUser.currentRoom) {
                        const virtualRoom = virtualIPManager.getRoom(virtualUser.currentRoom);
                        if (virtualRoom) {
                            virtualIPManager.leaveRoom(userId, virtualRoom.roomId);

                            // Notificar sobre saída da sala virtual
                            const participants = virtualIPManager.getRoomParticipants(virtualRoom.roomId);
                            io.to(virtualRoom.streamId).emit('virtual_participants_updated', {
                                streamId: virtualRoom.streamId,
                                roomCode: virtualRoom.roomCode,
                                participants,
                                count: participants.length
                            });
                        }
                    }

                    // Remover socket do usuário virtual
                    const userRemoved = virtualIPManager.removeSocket(userId, socket.id);
                    if (userRemoved) {
                        console.log(`🗑️ Usuário ${userId} removido completamente do sistema virtual`);
                    }
                }

                const { User } = await import('./models/index');
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
                import('./models').then(({ User }) => {
                    User.findOneAndUpdate(
                        { id: userId },
                        { $set: { isOnline: false, lastSeen: new Date().toISOString() } }
                    ).catch(() => {});
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
            const models = await import('./models');
            const activeStreams = await models.Streamer.find({
                hostId: userId,
                isLive: true
            });

            if (!activeStreams || activeStreams.length === 0) {
                // Notificar outros usuários na stream sobre saída (antes do DB)
                if (userEntry.streamId) {
                    // Atualizar OnlineTracker e emitir user:leave
                    const leaveCounts = await onlineTracker.userLeave(userEntry.streamId, userId);
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

                    // Enviar lista atualizada de usuários online
                    const onlineUsersInStream = Array.from(onlineUsers.values())
                        .filter(user => user.streamId === userEntry.streamId)
                        .map(user => ({ userId: user.userId, lastSeen: user.lastSeen }));

                    io.to(userEntry.streamId).emit('online_users_updated', {
                        streamId: userEntry.streamId,
                        users: onlineUsersInStream,
                        count: onlineUsersInStream.length
                    });
                    io.to(userEntry.streamId).emit('viewers_count_updated', {
                        streamId: userEntry.streamId,
                        count: onlineUsersInStream.length
                    });

                    // Persistir viewer count no banco
                    const count = onlineUsersInStream.length;
                    models.Streamer.findOneAndUpdate(
                        { id: userEntry.streamId },
                        { $set: { viewers: count } }
                    ).catch(() => {});
                }

                // Marcar como offline no banco (assíncrono, não bloqueia os eventos)
                models.User.findOneAndUpdate(
                    { id: userId },
                    { $set: { isOnline: false, currentStreamId: null, lastSeen: new Date().toISOString() } }
                ).catch(err => console.error('❌ Erro ao persistir offline:', err));
            }

            // Limpar mapeamento de socket
            socketToUser.delete(socket.id);

        } catch (error) {
            console.error('❌ Erro ao processar disconnect:', error);
        }
    });

    // Eventos para status online/offline
    socket.on('user_status_update', async (data: { userId: string; isOnline: boolean }) => {
        try {
            await User.findOneAndUpdate(
                { id: data.userId },
                { $set: { isOnline: data.isOnline, lastSeen: data.isOnline ? undefined : new Date().toISOString() } }
            );

            // Broadcast para todos os usuários
            io.emit('user_status_changed', {
                userId: data.userId,
                isOnline: data.isOnline,
                lastSeen: data.isOnline ? undefined : new Date().toISOString()
            });

            console.log(`🔔 Status atualizado: ${data.userId} -> ${data.isOnline ? 'online' : 'offline'}`);
        } catch (error) {
            console.error('❌ Erro ao atualizar status:', error);
        }
    });

    // Eventos para mensagens de chat (atualizado para novas coleções)
    socket.on('send_chat_message', async (data: { chatId: string; senderId: string; receiverId: string; content: string; messageType?: string }) => {
        try {
            const { chatId, senderId, receiverId, content, messageType = 'text' } = data;

            // Verificar se o usuário tem acesso ao chat
            const { Chat, ChatMessage, User } = await import('./models/index');
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
                messageType,
                isRead: false,
                sentAt: new Date()
            });

            // Atualizar última mensagem do chat
            await Chat.findOneAndUpdate(
                { id: chatId },
                { $set: {
                    lastMessage: {
                        content: message.content,
                        senderId: message.senderId,
                        timestamp: message.sentAt,
                        messageType: message.messageType
                    },
                    updatedAt: new Date()
                } }
            );

            // Buscar detalhes do remetente
            const sender = await User.findOne({ id: senderId }).select('id name avatarUrl');
            if (!sender) return;

            // Formatar mensagem para envio
            const formattedMessage = {
                id: message.id,
                conversationId: message.conversationId,
                senderId: message.senderId,
                receiverId: message.receiverId,
                content: message.content,
                messageType: message.messageType,
                isRead: message.isRead,
                sentAt: message.sentAt,
                sender: { id: sender.id, name: sender.name, avatarUrl: sender.avatarUrl || '' }
            };

            // Enviar para todos os participantes do chat
            chat.participants.forEach((participantId: string) => {
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

            console.log(`💬 Mensagem enviada via WebSocket: ${senderId} -> chat ${chatId}`);
        } catch (error) {
            console.error('❌ Erro ao enviar mensagem via WebSocket:', error);
            socket.emit('error', { message: 'Erro ao enviar mensagem' });
        }
    });

    // Evento para marcar mensagem como lida
    socket.on('mark_message_read', async (data: { messageId: string; userId: string }) => {
        try {
            const { messageId, userId } = data;

            const { ChatMessage, Chat } = await import('./models/index');
            const message = await ChatMessage.findOne({
                id: messageId,
                receiverId: userId
            });

            if (!message) {
                socket.emit('error', { message: 'Mensagem não encontrada' });
                return;
            }

            // Marcar como lida
            await ChatMessage.findOneAndUpdate(
                { id: messageId },
                { $set: { isRead: true, readAt: new Date() } }
            );

            // Notificar outros participantes
            const chat = await Chat.findOne({ id: message.conversationId });
            if (chat) {
                chat.participants.forEach((participantId: string) => {
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
        } catch (error) {
            console.error('❌ Erro ao marcar mensagem como lida:', error);
            socket.emit('error', { message: 'Erro ao marcar mensagem como lida' });
        }
    });

    // Evento para usuário entrar em um chat
    socket.on('join_chat', async (data: { userId: string; chatId: string }) => {
        try {
            const { userId, chatId } = data;

            // Verificar se usuário tem acesso ao chat
            const models = await import('./models');
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
        } catch (error) {
            console.error('❌ Erro ao entrar no chat:', error);
            socket.emit('error', { message: 'Erro ao entrar no chat' });
        }
    });

    // Evento para usuário sair de um chat
    socket.on('leave_chat', async (data: { userId: string; chatId: string }) => {
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
        } catch (error) {
            console.error('❌ Erro ao sair do chat:', error);
        }
    });

    // Evento para usuário está digitando
    socket.on('typing', async (data: { userId: string; chatId: string; isTyping: boolean }) => {
        try {
            const { userId, chatId, isTyping } = data;

            // Verificar se usuário tem acesso ao chat
            const models = await import('./models');
            const chat = await models.Chat.findOne({
                id: chatId,
                participants: userId,
                isActive: true
            });

            if (!chat) return;

            // Notificar outros participantes
            chat.participants.forEach((participantId: string) => {
                if (participantId !== userId) {
                    io.to(`user_${participantId}`).emit('user_typing', {
                        userId,
                        chatId,
                        isTyping,
                        timestamp: new Date()
                    });
                }
            });

        } catch (error) {
            console.error('❌ Erro ao notificar digitação:', error);
        }
    });

    // Eventos para follow/unfollow
    socket.on('user_followed', async (data: { followerId: string; followingId: string }) => {
        try {
            // Broadcast para todos os usuários sobre o novo follow
            io.emit('user_followed_notification', {
                followerId: data.followerId,
                followingId: data.followingId,
                timestamp: new Date().toISOString()
            });

            console.log(`🔔 Novo follow: ${data.followerId} -> ${data.followingId}`);
        } catch (error) {
            console.error('❌ Erro ao notificar follow:', error);
        }
    });

    socket.on('user_unfollowed', async (data: { followerId: string; followingId: string }) => {
        try {
            // Broadcast para todos os usuários sobre o unfollow
            io.emit('user_unfollowed_notification', {
                followerId: data.followerId,
                followingId: data.followingId,
                timestamp: new Date().toISOString()
            });

            console.log(`🔔 Unfollow: ${data.followerId} -> ${data.followingId}`);
        } catch (error) {
            console.error('❌ Erro ao notificar unfollow:', error);
        }
    });

    // Eventos para amizades
    socket.on('friendship_created', async (data: { userId1: string; userId2: string; initiatedBy: string }) => {
        try {
            // Broadcast para ambos os usuários sobre a nova amizade
            io.emit('friendship_notification', {
                userId1: data.userId1,
                userId2: data.userId2,
                initiatedBy: data.initiatedBy,
                timestamp: new Date().toISOString()
            });

            console.log(`🤝 Nova amizade: ${data.userId1} <-> ${data.userId2} (iniciado por ${data.initiatedBy})`);
        } catch (error) {
            console.error('❌ Erro ao notificar amizade:', error);
        }
    });

    // 🔥 NOVO: Evento para encerrar sala virtual quando transmissão termina
    socket.on('end_virtual_room', async (data: { streamId: string }) => {
        try {
            const { streamId } = data;

            if (!streamId) {
                console.warn('⚠️ end_virtual_room: streamId não fornecido');
                return;
            }

            // Encontrar sala virtual pelo streamId
            const virtualRoom = virtualIPManager.getRoomByStreamId(streamId);
            if (virtualRoom) {
                console.log(`🏁 Encerrando sala virtual ${virtualRoom.roomCode} para stream ${streamId}`);

                // Notificar todos os participantes sobre encerramento
                io.to(streamId).emit('virtual_room_ended', {
                    streamId,
                    roomCode: virtualRoom.roomCode,
                    message: 'Transmissão encerrada'
                });

                // Encerrar sala virtual
                virtualIPManager.endRoom(virtualRoom.roomId);
            }
        } catch (error) {
            console.error('❌ Erro ao encerrar sala virtual:', error);
        }
    });

    // Legados - manter para compatibilidade
    socket.on('join_room', (roomId: string) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on('leave_room', (roomId: string) => {
        socket.leave(roomId);
        console.log(`User ${socket.id} left room ${roomId}`);
    });

    socket.on('send_message', (data: { roomId: string, message: any }) => {
        socket.to(data.roomId).emit('receive_message', data.message);
    });

    socket.on('send_gift', (data: any) => {
        if (data.streamId) {
            io.to(data.streamId).emit('gift_received', data);
        }
    });

    // Eventos para atualizações em tempo real
    socket.on('update_user_stats', async (data: { userId: string; stats: any }) => {
        try {
            const { User } = await import('./models/index');
            await User.findOneAndUpdate({ id: data.userId }, { $set: data.stats });

            // Notificar todos os clientes sobre a atualização
            io.emit('user_stats_updated', {
                userId: data.userId,
                stats: data.stats,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('❌ Erro ao atualizar estatísticas do usuário:', error);
        }
    });

    socket.on('follow_user', async (data: { followerId: string; followedId: string; streamId?: string }) => {
        try {
            const { User, Followers, Friendship } = await import('./models/index');

            // Atualizar contadores
            const follower = await User.findOne({ id: data.followerId });
            const followed = await User.findOne({ id: data.followedId });

            if (follower && followed) {
                // Verificar se já são amigos (seguimento mútuo)
                const isAlreadyFollowing = await Followers.findOne({
                    followerId: data.followerId,
                    followedId: data.followedId
                });

                const isFollowedBack = await Followers.findOne({
                    followerId: data.followedId,
                    followedId: data.followerId
                });

                if (!isAlreadyFollowing) {
                    // Criar relação de follow
                    await Followers.create({
                        id: `follow_${data.followerId}_${data.followedId}_${Date.now()}`,
                        followerId: data.followerId,
                        followedId: data.followedId,
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
                        id: `friend_${data.followerId}_${data.followedId}_${Date.now()}`,
                        userId1: data.followerId,
                        userId2: data.followedId,
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
        } catch (error) {
            console.error('❌ Erro ao processar follow:', error);
        }
    });

    socket.on('update_diamonds', async (data: { userId: string; diamonds: number; change: number }) => {
        try {
            const { User } = await import('./models/index');
            const user = await User.findOneAndUpdate(
                { id: data.userId },
                { $inc: { diamonds: data.change } },
                { new: true }
            );

            if (user) {
                io.emit('diamonds_updated', {
                    userId: data.userId,
                    diamonds: user.diamonds,
                    change: data.change,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar diamantes:', error);
        }
    });

    // --- Chat e Status Events ---
    socket.on('set_user_online', async () => {
        try {
            const userId = socket.data.userId;
            if (!userId) return;
            socketToUser.set(socket.id, userId);
            socket.join(`user_${userId}`);

            // Notificar todos sobre mudança de status em tempo real (antes do DB)
            io.emit('user_status_changed', {
                userId,
                isOnline: true,
                lastSeen: new Date().toISOString()
            });

            // Atualizar status no banco (assíncrono, não bloqueia o evento)
            const { User } = await import('./models/index');
            User.findOneAndUpdate(
                { id: userId },
                { $set: { isOnline: true, lastSeen: new Date().toISOString() } }
            ).catch(err => console.error('❌ Erro ao persistir status online:', err));

            console.log(`🟢 Usuário ${userId} online (socket: ${socket.id})`);
        } catch (error) {
            console.error('❌ Erro ao setar usuário online:', error);
        }
    });

    socket.on('join_conversation', (data: { conversationId: string }) => {
        try {
            const { conversationId } = data;
            if (!conversationId) return;

            socket.join(`conversation_${conversationId}`);
            console.log(`💬 Socket ${socket.id} entrou na conversa ${conversationId}`);
        } catch (error) {
            console.error('❌ Erro ao entrar na conversa:', error);
        }
    });

    socket.on('leave_conversation', (data: { conversationId: string }) => {
        try {
            const { conversationId } = data;
            if (!conversationId) return;

            socket.leave(`conversation_${conversationId}`);
            console.log(`💬 Socket ${socket.id} saiu da conversa ${conversationId}`);
        } catch (error) {
            console.error('❌ Erro ao sair da conversa:', error);
        }
    });

    // Removidos eventos duplicados de join/leave stream para evitar conflitos
    // A lógica principal está no início do arquivo com controle adequado de múltiplas conexões

    socket.on('send_notification', async (data: { userId: string; type: string; message: string; data?: any }) => {
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

        } catch (error) {
            console.error('❌ Erro ao enviar notificação:', error);
        }
    });

    socket.on('mark_notification_read', async (data: { notificationId: string; userId: string }) => {
        try {
            // Notificar sobre notificação lida
            io.to(`user_${data.userId}`).emit('notification_read', {
                notificationId: data.notificationId,
                userId: data.userId,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('❌ Erro ao marcar notificação como lida:', error);
        }
    });

    // send_live_message — broadcast de mensagem enriquecida + persistência no MongoDB
    socket.on('send_live_message', async (data: { streamId: string; userId: string; text: string }) => {
        try {
            const { streamId, userId, text } = data;
            const user = await User.findOne({ id: userId }).select('name displayName avatarUrl level activeFrameId').lean();
            const userName = (user as any)?.name || (user as any)?.displayName;
            if (!user || !userName) return;

            const messagePayload = {
                userId,
                userName,
                avatarUrl: (user as any).avatarUrl || '',
                level: (user as any).level || 1,
                activeFrameId: (user as any).activeFrameId || null,
                text,
                timestamp: new Date()
            };

            socket.to(streamId).emit('live_message', messagePayload);
            io.to(streamId).emit('live_message', messagePayload);

            // Persistir no MongoDB (TTL de 24h via índice expireAfterSeconds)
            LiveMessage.create({
                streamId,
                userId,
                userName: messagePayload.userName,
                avatarUrl: messagePayload.avatarUrl,
                level: messagePayload.level,
                activeFrameId: messagePayload.activeFrameId,
                text,
                timestamp: messagePayload.timestamp
            }).catch(err => console.error('❌ Erro ao persistir live_message:', err));
        } catch (error) {
            console.error('❌ Erro ao processar send_live_message:', error);
        }
    });

    // cohost_invite — direciona convite de co-host para o guest
    socket.on('cohost_invite', async (data: { inviteeId: string; streamId: string; hostId: string; hostName?: string }) => {
        try {
            const { inviteeId, streamId, hostId, hostName } = data;
            io.to(`user_${inviteeId}`).emit('cohost_invitation', {
                hostId,
                hostName: hostName || '',
                streamId,
                timestamp: new Date()
            });
            console.log(`📞 [Cohost Invite] ${hostId} convidou ${inviteeId} para co-host na stream ${streamId}`);
        } catch (error) {
            console.error('❌ Erro ao processar cohost_invite:', error);
        }
    });

    // pk_started — sincroniza espectadores sobre início da PK
    socket.on('pk_started', async (data: { roomId: string; opponentStreamId: string; durationSeconds?: number }) => {
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
        } catch (error) {
            console.error('❌ Erro ao processar pk_started:', error);
        }
    });

    // pk_heart_add — incrementa corações da PK
    socket.on('pk_heart_add', async (data: { battleId: string; team: 'A' | 'B' }) => {
        try {
            const { battleId, team } = data;
            const field = team === 'A' ? 'heartsA' : 'heartsB';
            const updated = await Battle.findOneAndUpdate(
                { _id: battleId as any },
                { $inc: { [field]: 1 } },
                { new: true }
            );
            if (updated) {
                io.to(`battle_${battleId}`).emit('pk_heart_update', {
                    battleId,
                    heartsA: (updated as any).heartsA || 0,
                    heartsB: (updated as any).heartsB || 0,
                    team
                });
            }
        } catch (error) {
            console.error('❌ Erro ao processar pk_heart_add:', error);
        }
    });
});

// REMOVIDO: getIO duplicado (já existe em socket.ts e server.ts)
// export const getIO = () => io;

// Iniciar servidor WebSocket na porta 3001 separadamente
let wsServer: http.Server | https.Server;
if (isHttps) {
    const httpsOptions = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
    };
    wsServer = https.createServer(httpsOptions);
} else {
    wsServer = http.createServer();
}
const wsIo = initSocket(wsServer);

// Eventos WebSocket como LiveGo
wsIo.on('connection', (socket) => {
    console.log(`🔌 [LIVEGO-WEBSOCKET] Client connected: ${socket.id}`);

    // Evento de informações básicas (como binfo do LiveGo) - Resposta BINÁRIA
    socket.on('binfo', (data) => {
        console.log(`📊 [LIVEGO-BINFO] Received:`, data);

        const buffer = BackendProtobufService.encodeStreamInfoEvent(
            data.sdkappid || 'system',
            'LiveGo Stream',
            'Binary WebSocket System',
            'system',
            'LiveGo',
            'https://via.placeholder.com/40',
            0, 0,
            'live'
        );

        if (buffer) {
            wsIo.emit('binary_data', buffer);
            console.log(`📦 [LIVEGO-BINFO] Binary response sent:`, buffer.length, 'bytes');
        }
    });

    // Evento de join de sala (stream)
    socket.on('join_stream', (streamId) => {
        console.log(`🎥 [STREAM] Client ${socket.id} joined stream: ${streamId}`);
        socket.join(streamId);

        // Enviar informações do stream para o cliente
        wsIo.to(streamId).emit('stream_joined', {
            streamId,
            clientId: socket.id,
            timestamp: Date.now()
        });
    });

    // Evento de leave de sala
    socket.on('leave_stream', (streamId) => {
        console.log(`🎥 [STREAM] Client ${socket.id} left stream: ${streamId}`);
        socket.leave(streamId);

        wsIo.to(streamId).emit('stream_left', {
            streamId,
            clientId: socket.id,
            timestamp: Date.now()
        });
    });

    // Heartbeat como Buzzcast
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });

    // Tratamento de mensagens binárias
    socket.on('binary_data', (data) => {
        console.log(`📦 [BINARY] Received binary data from ${socket.id}:`, data.length);
        // Broadcast do dado binário para a sala
        socket.rooms.forEach(room => {
            if (room !== socket.id) {
                wsIo.to(room).emit('binary_data', data);
            }
        });
    });

    // Eventos de chat em tempo real (integrado com banco)
    socket.on('send_chat_message', async (data) => {
        console.log(`💬 [CHAT] Message from ${socket.id}:`, data);

        try {
            // Importar helpers de ID
            const { getRealUserId, validateRealId } = require('../utils/idHelper');

            // Validar e converter para ID real
            const realUserId = validateRealId(data.userId);

            // Salvar no banco de dados
            const Chat = require('../models/Chat');
            const chatMessage = new Chat({
                streamId: data.streamId,
                userId: realUserId, // Usar ID real da API
                userName: data.userName,
                userAvatar: data.userAvatar,
                message: data.message,
                timestamp: new Date()
            });
            await chatMessage.save();

            const chatData = {
                id: chatMessage._id,
                userId: realUserId, // ID real da API no evento
                userName: data.userName,
                userAvatar: data.userAvatar,
                message: data.message,
                timestamp: chatMessage.timestamp.getTime()
            };

            // Broadcast para todos na sala do stream
            wsIo.to(data.streamId).emit('new_chat_message', chatData);
            console.log(`💬 [CHAT] Real message saved and broadcasted: ${data.message}`);
        } catch (error) {
            console.error(`❌ [CHAT] Error saving message:`, error);
        }
    });

    // Eventos de presentes/gifts em tempo real (integrado com banco)
    socket.on('send_gift', async (data) => {
        console.log(`🎁 [GIFT] Gift from ${socket.id}:`, data);

        try {
            // Importar helpers de ID
            const { getRealUserId, validateRealId } = require('../utils/idHelper');

            // Validar e converter para IDs reais
            const realFromUserId = validateRealId(data.fromUserId);
            const realToUserId = validateRealId(data.toUserId);

            // Salvar no banco de dados
            const Gift = require('../models/Gift');
            const User = require('../models/User');

            // Atualizar diamantes do usuário (usando ID real)
            await User.findOneAndUpdate({ identification: realFromUserId }, {
                $inc: { diamonds: -(data.giftPrice * data.quantity) }
            });

            // Atualizar ganhos do streamer (usando ID real)
            await User.findOneAndUpdate({ identification: realToUserId }, {
                $inc: { totalGifts: data.giftPrice * data.quantity }
            });

            const giftRecord = new Gift({
                streamId: data.streamId,
                fromUserId: realFromUserId, // ID real da API
                fromUserName: data.fromUserName,
                fromUserAvatar: data.fromUserAvatar,
                toUserId: realToUserId, // ID real da API
                toUserName: data.toUserName,
                giftId: data.giftId,
                giftName: data.giftName,
                giftIcon: data.giftIcon,
                giftPrice: data.giftPrice,
                quantity: data.quantity,
                totalValue: data.giftPrice * data.quantity,
                timestamp: new Date()
            });
            await giftRecord.save();

            const giftData = {
                id: giftRecord._id,
                fromUserId: realFromUserId, // ID real da API no evento
                fromUserName: data.fromUserName,
                fromUserAvatar: data.fromUserAvatar,
                toUserId: realToUserId, // ID real da API no evento
                toUserName: data.toUserName,
                giftId: data.giftId,
                giftName: data.giftName,
                giftIcon: data.giftIcon,
                giftPrice: data.giftPrice,
                quantity: data.quantity,
                totalValue: data.giftPrice * data.quantity,
                timestamp: giftRecord.timestamp.getTime()
            };

            // Broadcast para todos na sala do stream
            wsIo.to(data.streamId).emit('new_gift', giftData);
            wsIo.to(data.streamId).emit('live_gift_received', {
                from: {
                    id: data.fromUserId,
                    name: data.fromUserName,
                    avatarUrl: data.fromUserAvatar,
                    level: data.fromUserLevel || 1
                },
                toUser: {
                    id: data.toUserId,
                    name: data.toUserName
                },
                gift: {
                    name: data.giftName,
                    price: data.giftPrice,
                    icon: data.giftIcon || '🎁',
                    category: data.giftCategory || 'Popular'
                },
                quantity: data.quantity,
                totalValue: data.giftPrice * data.quantity,
                roomId: data.streamId,
                streamId: data.streamId,
                timestamp: new Date().toISOString()
            });
            console.log(`🎁 [GIFT] Real gift processed: ${data.giftName} x${data.quantity} (${data.totalValue} diamonds)`);
        } catch (error) {
            console.error(`❌ [GIFT] Error processing gift:`, error);
        }
    });

    // Eventos de status da transmissão (integrado com banco)
    socket.on('stream_status_update', async (data) => {
        console.log(`📡 [STREAM] Status update from ${socket.id}:`, data);

        try {
            // Atualizar no banco de dados
            const Stream = require('../models/Stream');
            await Stream.findOneAndUpdate(
                { _id: data.streamId },
                { $set: { status: data.status, viewers: data.viewers, lastActivity: new Date() } }
            );

            const statusData = {
                streamId: data.streamId,
                status: data.status,
                viewers: data.viewers,
                timestamp: Date.now()
            };

            // Broadcast para todos na sala do stream
            wsIo.to(data.streamId).emit('stream_status', statusData);
            console.log(`📡 [STREAM] Real status updated: ${data.status} for stream ${data.streamId}`);
        } catch (error) {
            console.error(`❌ [STREAM] Error updating status:`, error);
        }
    });

    // Eventos de entrada/saída de usuários na live
    socket.on('user_joined_live', (data) => {
        console.log(`👤 [USER] User joined live:`, data);
        const userData = {
            userId: data.userId,
            userName: data.userName,
            userAvatar: data.userAvatar,
            userLevel: data.userLevel || 1,
            streamId: data.streamId,
            timestamp: Date.now()
        };

        // Broadcast para todos na sala do stream (exceto o próprio)
        socket.to(data.streamId).emit('user_joined', userData);
        console.log(`👤 [USER] ${userData.userName} joined stream ${userData.streamId}`);
    });

    socket.on('disconnect', (reason) => {
        console.log(`🔌 [WEBSOCKET] Client disconnected: ${socket.id} - Reason: ${reason}`);
    });
});

// ─── Orphan Process Signals ────────────────────────────────────────
['SIGINT', 'SIGTERM', 'exit'].forEach((signal) => {
  process.on(signal, () => {
    killAllFfmpegProcesses();
    if (signal !== 'exit') process.exit(0);
  });
});
// ────────────────────────────────────────────────────────────────────

wsServer.listen(wsPort, '127.0.0.1', () => {
    const protocol = isHttps ? 'https' : 'http';
    console.log(`🔌 WebSocket server (Socket.IO) started on ${protocol}://127.0.0.1:${wsPort}`);
    console.log(`🔐 Ready for ${isHttps ? 'secure ' : ''}WebSocket connections`);
    console.log(`📡 Following LiveGo pattern with real-time events`);
});
