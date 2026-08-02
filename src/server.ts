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
import base64ConversionRoutes from './routes/base64ConversionRoutes'; // NOVO - Sistema de Conversão Base64
import likesRoutes from './routes/likesRoutes'; // NOVO - Sistema de Likes
import callInvitationRoutes from './routes/callInvitationRoutes'; // NOVO - Sistema de convites de chamada na live
import activityRoutes from './routes/activityRoutes'; // NOVO - Sistema de Atividades
import videoStreamRoutes from './routes/videoStreamRoutes'; // NOVO - API de Streaming de Vídeo
import srsRoutes from './routes/srsRoutes';
import appVersionRoutes from './routes/appVersionRoutes'; // NOVO - Sistema de controle de versão
import debugRoutes from './routes/debugRoutes';
import crudRoutes from './routes/crudRoutes';
import liveInviteRoutes from './routes/liveInviteRoutes';
import identificationRoutes from './routes/identificationRoutes';
import userIdRoutes from './routes/userIdRoutes';
import turnRoutes from './routes/turnRoutes';
import stunRoutes from './routes/stunRoutes';
import streamAccessRoutes from './routes/streamAccessRoutes';

import UserStatusManager from './middleware/UserStatusManager';
import notificationRoutes from './routes/notificationRoutes';
import { initFirebase } from './services/firebaseService';
import { blockBase64Middleware } from './middleware/blockBase64';


// REMOVIDO: Módulos inexistentes
// import { initializeDatabase } from './scripts/initDatabase'; // NOVO - Inicialização automática
// import { withdrawalCronJob } from './scripts/withdrawalCronJob'; // NOVO - Cron job de saques

validateEnv();

// ─── Orphan Process Killer (FFmpeg) ─────────────────────────────────
import { killAllFfmpegProcesses } from './services/FfmpegService';
import { streamCleanupService } from './services/StreamCleanupService';
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

app.set('io', io);
(global as any).io = io;

connectDB().then(async () => {
    await 
    initializeActivityHooks();
    activityEventService.initialize(io);

    // Migração única: copiar Streamers ativos para LiveCard
    try {
        const { LiveCard } = await import('./models/index');
        const activeStreamers = await Streamer.find({
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
        if (migrated > 0) console.log(`[MIGRATION] ${migrated} LiveCards criados a partir de Streamers ativos`);
    } catch (err) {
        console.warn('[MIGRATION] Erro ao migrar Streamers para LiveCards:', err);
    }

    server.listen(port, '0.0.0.0', () => {
        console.log(`🌍 API Server started on http://127.0.0.1:${port}`);
        initFirebase();
        streamCleanupService.start(io);
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

// Limpar marcações de online que ficaram presas no banco User (a cada 10 minutos)
setInterval(async () => {
    try {
        const { User, UserStatus } = await import('./models');
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const staleUsers = await User.find({
            isOnline: true,
            lastSeen: { $lt: fiveMinutesAgo }
        }).select('id name').limit(100).lean();
        for (const u of staleUsers) {
            const sid = (u as any).id;
            const status = await UserStatus.findOne({ userId: sid }).lean();
            if (!status || !(status as any).isOnline) {
                await User.findOneAndUpdate(
                    { id: sid },
                    { $set: { isOnline: false } }
                );
                console.log(`[CLEANUP] Stale online flag cleared for user ${sid} (${(u as any).name || ''})`);
            }
        }
    } catch (e: any) {
        console.error('[CLEANUP] Error clearing stale online flags:', e.message);
    }
}, 10 * 60 * 1000);

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
import { emptyResponseTracker } from './middleware/emptyResponseTracker';
app.use('/api', emptyResponseTracker);

app.use(express.json({
  limit: '50mb',
  type: ['application/json', 'application/webhook+json'],
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf-8');
  }
}));
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
app.use('/api/identification', identificationRoutes); // API de identificação de usuários
app.use('/api/user-id', userIdRoutes); // NOVO - API de gerenciamento de IDs únicos
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
app.use('/api/convert', base64ConversionRoutes); // NOVO - Sistema de Conversão Base64
app.use('/convert', base64ConversionRoutes); // COMPATIBILITY - Allow direct /convert access
app.use('/api/call-invitation', callInvitationRoutes); // NOVO - Sistema de convites de chamada na live
app.use('/api/version', appVersionRoutes); // NOVO - Sistema de controle de versão
app.use('/api/crud', crudRoutes); // NOVO - CRUD completo para MongoDB
// 🚨 VALIDAÇÃO ESTRITA para rotas com parâmetros ID
app.use('/api/settings/:id', validateAndConvertUserId('id'));
// app.use('/api/level/:userId', validateAndConvertUserId('userId')); // REMOVIDO - causa erro MONGODB_ID_EXPOSED
app.use('/api/zoom/user/:userId', validateAndConvertUserId('userId'));
app.use('/api/zoom', zoomRoutes);

app.use('/api', turnRoutes); // NOVO - Credenciais TURN
app.use('/api', stunRoutes); // STUN servers
app.use('/api/srs', srsRoutes); // Callbacks do SRS PRIMEIRO (evita conflito com routes genéricos)
app.use('/api', metadataRoutes); // handles /api/ranking, /api/gifts, /api/regions, /api/history
app.use('/api', liveRoutes); // handles /api/live, /api/streams, /api/rtc, /api/lives, /api/permissions
app.use('/api', likesRoutes); // handles stream likes
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
app.use('/api/streams', streamAccessRoutes); // Validação de acesso a transmissões
app.use('/api', notificationRoutes); // NOVO - Notificações Push Firebase
app.use('/api', debugRoutes); // Debug/monitoramento


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

// /uploads/ é servido diretamente pelo Nginx (volume persistente fora do container)
// O container NÃO deve servir nem armazenar arquivos de upload/avatar

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

    async function handleJoinStream(streamId: string) {
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
      socketToUser.set(socket.id, userId);
      let userEntry: any = onlineUsers.get(userId);
      const isFirstConnection = !userEntry;
      const isChangingStream = userEntry && userEntry.streamId !== streamId;
      if (!userEntry) {
        userEntry = { userId, streamId, socketIds: new Set([socket.id]), lastSeen: new Date(), firstConnectionTime: new Date() };
        onlineUsers.set(userId, userEntry);
      } else {
        if (!userEntry.socketIds.has(socket.id)) userEntry.socketIds.add(socket.id);
        if (isChangingStream) userEntry.streamId = streamId;
        userEntry.lastSeen = new Date();
      }
      socket.join(streamId);
      const models = await import('./models');
      await models.User.findOneAndUpdate(
        { id: userId },
        { $set: { isOnline: true, currentStreamId: streamId, lastSeen: new Date().toISOString() } },
        { upsert: true }
      );
      const { UserStatus } = await import('./models');
      await UserStatus.findOneAndUpdate(
        { userId },
        { $set: { isOnline: true, lastSeen: new Date() } },
        { upsert: true }
      ).catch(() => {});
      const onlineCount = Array.from(onlineUsers.values()).filter((u: any) => u.streamId === streamId).length;
      io.to(streamId).emit('online_users_updated', { streamId, count: onlineCount });
      // viewers_count_updated removido — redundante com online_users_updated.count
      let userName = 'Usuário', userAvatar = '', userLevel = 0;
      try {
        const userDoc = await models.User.findOne({ id: userId }).select('name avatarUrl level').lean();
        if (userDoc) { userName = (userDoc as any).name || 'Usuário'; userAvatar = (userDoc as any).avatarUrl || ''; userLevel = (userDoc as any).level || 0; }
      } catch (_) {}
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
        if (s) hostId = (s as any).hostId || '';
        else console.log('[FCM] Streamer não encontrado para streamId=' + streamId);
      } catch (_) {}
      const counts = await onlineTracker.userJoin(streamId, userId, hostId, userName, userAvatar);
      io.to(streamId).emit('user_joined_stream', { userId, userName, userAvatar, userLevel, streamId, timestamp: new Date().toISOString() });
      io.to(streamId).emit('user:join', { userId, userName, userAvatar, userLevel, streamId, role: userId === hostId ? 'host' : counts.role, fans: counts.fans, visitors: counts.visitors, total: counts.fans + counts.visitors, timestamp: new Date().toISOString() });
      io.to(streamId).emit('online_counts_updated', { streamId, fans: counts.fans, visitors: counts.visitors, total: counts.fans + counts.visitors });
      try {
        const { Streamer } = await import('./models/Streamer');
        await Streamer.findOneAndUpdate({ id: streamId }, { $set: { viewers: onlineCount } });
        // Sincronizar viewers no LiveCard para o card da transmissão
        // Usar o hostId da stream (já buscado acima) para encontrar o LiveCard correto
        if (hostId) {
          const { LiveCard } = await import('./models/index');
          await LiveCard.findOneAndUpdate(
            { hostId },
            { $set: { viewers: onlineCount, updatedAt: new Date() } }
          );
        }
      } catch (_) {}
      // Notificar o host via NotificationService centralizado
      if (hostId && hostId !== userId) {
        try {
          const { NotificationService } = await import('./services/NotificationService');
          await NotificationService.notifyViewerJoinedStream(io, hostId, userId, userName, streamId);
        } catch (notifErr: any) {
          console.error('[NOTIFICATION] Erro ao notificar join stream:', notifErr?.message || notifErr);
        }
      }

      // Auto-registro no chat da stream
      try {
        const { Chat } = await import('./models/index');
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
        } else {
          // Adicionar usuário como participante se não estiver
          // Usar $addToSet para evitar duplicatas em cenários de concorrência
          await Chat.findOneAndUpdate(
            { id: chatId },
            { $addToSet: { participants: userId }, $set: { updatedAt: new Date() } }
          );
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
      } catch (chatErr: any) {
        console.warn('[CHAT] Erro ao auto-registrar usuário no chat:', chatErr?.message || chatErr);
      }

      console.log(`✅ Usuário ${userId} conectado à stream ${streamId} (sockets: ${userEntry.socketIds.size})`);
    }

    socket.on('join_room_direct', async (data: { roomId: string }) => {
      if (!data?.roomId) return;
      await handleJoinStream(data.roomId);
    });


    socket.on('join_stream', async (data: { streamId: string }) => {
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

                    // Enviar apenas contagem (NÃO a lista completa de usuários)
                    const onlineCount = Array.from(onlineUsers.values())
                        .filter((u: any) => u.streamId === userEntry.streamId).length;

                    io.to(userEntry.streamId).emit('online_users_updated', {
                        streamId: userEntry.streamId,
                        count: onlineCount
                    });

                    // Persistir viewer count no banco
                    models.Streamer.findOneAndUpdate(
                        { id: userEntry.streamId },
                        { $set: { viewers: onlineCount } }
                    ).catch(() => {});

                    // Sincronizar viewers no LiveCard
                    try {
                        const { LiveCard } = await import('./models/index');
                        // Buscar todos os hosts da stream para atualizar LiveCards
                        const streamerDoc = await models.Streamer.findOne({ id: userEntry.streamId }).select('hostId').lean();
                        if (streamerDoc && streamerDoc.hostId) {
                            await LiveCard.findOneAndUpdate(
                                { hostId: streamerDoc.hostId },
                                { $set: { viewers: onlineCount, updatedAt: new Date() } }
                            );
                        }
                    } catch (_) {}

                    // Remover do chat da stream
                    try {
                        const { Chat } = await import('./models/index');
                        const chatId = `stream_chat_${userEntry.streamId}`;
                        await Chat.findOneAndUpdate(
                            { id: chatId },
                            { $pull: { participants: userId }, $set: { updatedAt: new Date() } }
                        );
                        console.log(`💬 [CHAT] Usuário ${userId} removido do chat ${chatId}`);

                        // Notificar outros participantes que o usuário saiu do chat
                        io.to(`chat_${chatId}`).emit('user_left_chat', {
                            userId,
                            chatId,
                            streamId: userEntry.streamId,
                            timestamp: new Date().toISOString()
                        });
                    } catch (chatErr: any) {
                        console.warn('[CHAT] Erro ao remover usuário do chat:', chatErr?.message || chatErr);
                    }
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
                messageType: messageType as 'text' | 'image' | 'gift' | 'system',
                isRead: false
            });

            // Atualizar última mensagem do chat
            await Chat.findOneAndUpdate(
                { id: chatId },
                { $set: {
                    lastMessage: {
                        content: message.content,
                        senderId: message.senderId,
                        timestamp: message.createdAt,
                        messageType: message.messageType
                    }
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
                sentAt: message.createdAt,
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

            // === NOTIFICAR DESTINATÁRIO via serviço centralizado (sininho + FCM) ===
            try {
                const { NotificationService } = await import('./services/NotificationService');
                const receiverIds = chat.participants.filter((p: string) => p !== senderId);
                const isImage = messageType === 'image';
                const preview = isImage ? '[Imagem]' : content;
                for (const receiverId of receiverIds) {
                    await NotificationService.notifyNewMessage(
                        io,
                        receiverId,
                        senderId,
                        sender.name || 'Alguém',
                        preview,
                        chatId
                    );
                }
            } catch (notifErr) {
                console.warn('[SOCKET-CHAT-NOTIFICATION] Erro:', notifErr);
            }

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

    // ── LIVE_STARTED: notificar TODOS os usuários via FCM push ──
    socket.on('live_started', async (data: any) => {
        console.log(`📡 [IO-LIVE] live_started recebido: stream=${data.streamId || data.id}, userId=${data.userId || data.hostId}`);
        try {
            const streamId = data.streamId || data.id;
            const hostId = data.userId || data.hostId;
            if (!streamId) { console.warn('⚠️ live_started sem streamId'); return; }

            // Notificar TODOS os usuários via FCM push (live_started)
            try {
                const { NotificationService } = await import('./services/NotificationService');
                const { User, Streamer } = await import('./models/index');

                // Buscar nome/avatar do streamer
                let hostName = data.userName || 'LiveGO';
                let hostAvatar = '';
                let streamTitle = '';

                if (hostId) {
                    const userDoc = await User.findOne({ id: hostId }).select('name avatarUrl').lean();
                    if (userDoc) {
                        hostName = (userDoc as any).name || hostName;
                        hostAvatar = (userDoc as any).avatarUrl || '';
                    }
                    const streamDoc = await Streamer.findOne({ id: streamId }).select('message').lean();
                    if (streamDoc) {
                        streamTitle = (streamDoc as any).message || '';
                    }
                }

                await NotificationService.notifyLiveStartedToAll(
                    hostId || streamId,
                    hostName,
                    hostAvatar,
                    streamId,
                    streamTitle,
                );
                console.log('[FCM] Notificação live_started enviada para todos os dispositivos');
            } catch (notifErr: any) {
                console.error('❌ [FCM] Erro ao enviar notificação live_started:', notifErr.message);
            }
        } catch (err: any) {
            console.error('❌ [IO-LIVE] Erro geral:', err.message);
        }
    });

    socket.on('live_ended', async (data: any) => {
        console.log(`📡 [IO-LIVE] live_ended recebido: stream=${data.streamId}, userId=${data.userId}`);
    });
    // ────────────────────────────────────────────────────────────

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
                { returnDocument: 'after' }
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

            // 🔔 Emitir evento de entrada do usuário no aplicativo
            (async () => {
                try {
                    const { User: UserModel } = await import('./models/index');
                    const user = await UserModel.findOne({ id: userId }).select('id name avatarUrl level').lean();
                    if (user) {
                        const u = user as any;
                        io.emit('user_entered_app', {
                            userId: u.id,
                            userName: u.name || 'Usuário',
                            avatarUrl: u.avatarUrl || '',
                            level: u.level || 1,
                            timestamp: new Date().toISOString()
                        });
                        console.log(`🟢 [ENTRY] ${u.name || u.id} entrou no aplicativo`);
                    }
                } catch (err) {
                    // Silencioso - não travar o fluxo por causa do evento
                }
            })();

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

            const messagePayload: any = {
                userId,
                userName,
                avatarUrl: (user as any).avatarUrl || '',
                level: (user as any).level || 1,
                activeFrameId: (user as any).activeFrameId || null,
                text,
                timestamp: new Date()
            };

            // 💾 Persistir no MongoDB (TTL de 24h via índice expireAfterSeconds) e obter o id
            // para que o broadcast inclua o id e o cliente faça dedupe com o sync inicial REST.
            try {
                const liveMessage = await LiveMessage.create({
                    streamId,
                    userId,
                    userName: messagePayload.userName,
                    avatarUrl: messagePayload.avatarUrl,
                    level: messagePayload.level,
                    activeFrameId: messagePayload.activeFrameId,
                    text,
                    timestamp: messagePayload.timestamp,
                });
                messagePayload.id = (liveMessage as any).id;
            } catch (persistErr) {
                console.error('❌ Erro ao persistir live_message:', persistErr);
            }

            // ⚡ Broadcast em tempo real via Socket.IO — sala da stream (join_stream → socket.join(streamId))
            // O frontend escuta o evento 'live_message'. Inclui o remetente (dedupe no client).
            try {
                io.to(streamId).emit('live_message', messagePayload);
            } catch (ioErr) {
                console.warn('[SOCKET-LIVE-MESSAGE] Erro ao emitir socket:', ioErr);
            }
        } catch (error) {
            console.error('❌ Erro ao processar send_live_message:', error);
        }
    });

    // toggle_mic — alternar microfone em tempo real
    socket.on('toggle_mic', async (data: { streamId: string; userId: string; microphoneEnabled: boolean }) => {
        try {
            const { streamId, userId, microphoneEnabled } = data;
            const { Streamer } = await import('./models/index');
            await Streamer.findOneAndUpdate(
                { id: streamId },
                { $set: { microphoneEnabled } }
            );
            io.to(streamId).emit('mic_toggled', {
                streamId, userId, microphoneEnabled,
                timestamp: new Date().toISOString()
            });
            console.log(`[SOCKET-MIC] Microfone ${microphoneEnabled ? 'ativado' : 'mutado'} por ${userId} na stream ${streamId}`);
        } catch (error) {
            console.error('[SOCKET-MIC] Erro:', error);
        }
    });

    // toggle_sound — alternar som em tempo real
    socket.on('toggle_sound', async (data: { streamId: string; userId: string; soundEnabled: boolean }) => {
        try {
            const { streamId, userId, soundEnabled } = data;
            const { Streamer } = await import('./models/index');
            await Streamer.findOneAndUpdate(
                { id: streamId },
                { $set: { soundEnabled } }
            );
            io.to(streamId).emit('sound_toggled', {
                streamId, userId, soundEnabled,
                timestamp: new Date().toISOString()
            });
            console.log(`[SOCKET-SOUND] Som ${soundEnabled ? 'ativado' : 'silenciado'} por ${userId} na stream ${streamId}`);
        } catch (error) {
            console.error('[SOCKET-SOUND] Erro:', error);
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
                { returnDocument: 'after' }
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
// ─── Orphan Process Signals ────────────────────────────────────────
['SIGINT', 'SIGTERM', 'exit'].forEach((signal) => {
  process.on(signal, () => {
    killAllFfmpegProcesses();
    if (signal !== 'exit') process.exit(0);
  });
});
// ────────────────────────────────────────────────────────────────────
