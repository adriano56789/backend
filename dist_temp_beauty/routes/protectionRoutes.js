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
const models_1 = require("../models");
const socket_1 = require("../socket");
const router = express_1.default.Router();
// 🔒 Anti-spam: 1 aviso por usuário+stream+tipo a cada 30s
const lastViolationAt = new Map();
const RATE_WINDOW_MS = 30000;
function ensureIndexes() {
    try {
        const banColl = models_1.StreamBan._coll();
        banColl.createIndex({ hostId: 1, bannedUserId: 1 }, { unique: true });
        const violColl = models_1.ContentViolation._coll();
        violColl.createIndex({ hostId: 1, timestamp: -1 });
        violColl.createIndex({ streamId: 1, timestamp: -1 });
    }
    catch (e) {
        console.warn('[PROTECTION] Índices já existentes/erro:', e);
    }
}
ensureIndexes();
/**
 * POST /api/protection/violation
 * Registra tentativa de print/gravação/captura. Persiste no banco E envia
 * em TEMPO REAL o aviso automático no chat da transmissão denunciando quem é.
 * Body: { userId, userName, streamId?, hostId?, type }
 */
router.post('/violation', async (req, res) => {
    try {
        const { userId, userName, streamId = '', hostId = '', type = 'capture' } = req.body || {};
        if (!userId)
            return res.status(400).json({ error: 'userId é obrigatório' });
        // Rate-limit por userId+streamId+type
        const key = `${userId}_${streamId}_${type}`;
        const now = Date.now();
        const last = lastViolationAt.get(key) || 0;
        if (now - last < RATE_WINDOW_MS) {
            return res.json({ ok: true, throttled: true });
        }
        lastViolationAt.set(key, now);
        // 1) Persiste a violação (dados reais para histórico/denúncia)
        await models_1.ContentViolation.create({
            id: `viol_${now}_${Math.random().toString(36).substr(2, 9)}`,
            userId: String(userId),
            userName: String(userName || userId),
            streamId: String(streamId),
            hostId: String(hostId),
            type,
            userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
            timestamp: new Date(),
        });
        // 2) Aviso automático no CHAT DA TRANSMISSÃO (persistido + broadcast)
        let emitted = false;
        if (streamId) {
            const text = `⚠️ Atenção! O usuário ${userName || userId} está tentando gravar ou tirar print da transmissão!`;
            const tsNow = new Date();
            try {
                await models_1.LiveMessage.create({
                    streamId: String(streamId),
                    userId: 'system_protection',
                    userName: 'Proteção de Conteúdo',
                    avatarUrl: '',
                    level: 1,
                    activeFrameId: null,
                    text,
                    type: 'system',
                    timestamp: tsNow,
                }).catch(() => { });
            }
            catch { /* persist best-effort */ }
            try {
                const io = (0, socket_1.getIO)();
                const payload = {
                    userId: 'system_protection',
                    violationUserId: String(userId),
                    violationUserName: String(userName || userId),
                    violationType: type,
                    hostId: String(hostId),
                    userName: 'Proteção de Conteúdo',
                    avatarUrl: '',
                    level: 1,
                    text,
                    timestamp: tsNow.toISOString(),
                };
                io.to(String(streamId)).emit('content_violation', payload);
                // Sala do HOST sempre recebe (mesmo se streamId ≠ sala)
                if (hostId)
                    io.to(`user_${hostId}`).emit('content_violation', payload);
                emitted = true;
            }
            catch (e) {
                console.warn('[PROTECTION] Socket indisponível:', e);
            }
        }
        // 3) Se o usuário JÁ ESTIVER banido deste host, informa na hora
        let banned = false;
        if (hostId) {
            const ban = await models_1.StreamBan.findOne({ hostId: String(hostId), bannedUserId: String(userId) });
            banned = !!(ban && ban.bannedUserId);
        }
        return res.json({ ok: true, emitted, banned });
    }
    catch (error) {
        console.error('[PROTECTION] Erro ao registrar violação:', error);
        return res.status(500).json({ error: 'Erro ao registrar violação' });
    }
});
/**
 * GET /api/protection/violations?hostId=&limit=100
 * Lista violações reais registradas no banco.
 */
router.get('/violations', async (req, res) => {
    try {
        const { hostId, streamId } = req.query;
        const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
        const filter = {};
        if (hostId)
            filter.hostId = String(hostId);
        if (streamId)
            filter.streamId = String(streamId);
        const coll = models_1.ContentViolation._coll();
        const docs = await coll.find(filter).sort({ timestamp: -1 }).limit(limit).project({ _id: 0, id: 1, userId: 1, userName: 1, streamId: 1, hostId: 1, type: 1, timestamp: 1 }).toArray();
        return res.json(docs);
    }
    catch (error) {
        console.error('[PROTECTION] Erro ao listar violações:', error);
        return res.status(500).json({ error: 'Erro ao listar violações' });
    }
});
/**
 * GET /api/protection/kick/check?streamId=&userId=
 * Verifica se o usuário foi EXPULSO da sessão atual desta transmissão.
 * A expulsão vale até a host encerrar a live e abrir uma nova.
 */
router.get('/kick/check', async (req, res) => {
    try {
        const { streamId, userId } = req.query;
        if (!streamId || !userId)
            return res.status(400).json({ error: 'streamId e userId são obrigatórios' });
        const { Streamer } = await Promise.resolve().then(() => __importStar(require('../models')));
        const stream = await Streamer.findOne({
            $or: [{ id: String(streamId) }, { streamKey: String(streamId) }]
        }).select('kickedUsers').lean();
        const kicked = !!stream?.kickedUsers?.includes(String(userId));
        return res.json({ kicked });
    }
    catch (error) {
        console.error('[PROTECTION] Erro ao verificar kick:', error);
        return res.status(500).json({ error: 'Erro ao verificar expulsão' });
    }
});
/**
 * POST /api/protection/ban
 * Bloqueia o usuário PRA SEMPRE das transmissões do host.
 * ⚠️ REGRA: PERMITIDO APENAS por violação de proteção de conteúdo —
 * print, gravação de tela ou tentativa de vazar conteúdo +18.
 * Nenhum outro motivo gera banimento permanente.
 * Body: { hostId, userId, userName?, violationType }
 */
router.post('/ban', async (req, res) => {
    try {
        const { hostId, userId, userName = '', violationType } = req.body || {};
        if (!hostId || !userId)
            return res.status(400).json({ error: 'hostId e userId são obrigatórios' });
        if (String(hostId) === String(userId))
            return res.status(400).json({ error: 'O dono não pode bloquear a si mesmo' });
        // 🔒 Regra do banimento permanente: exclusivo para captura/vazamento
        const ALLOWED_TYPES = ['print', 'record', 'capture', 'contextmenu'];
        if (!violationType || !ALLOWED_TYPES.includes(String(violationType))) {
            return res.status(403).json({
                error: 'Ban permanente é permitido apenas por violação de proteção de conteúdo (print, gravação ou vazamento +18).'
            });
        }
        const existing = await models_1.StreamBan.findOne({ hostId: String(hostId), bannedUserId: String(userId) });
        if (!existing) {
            await models_1.StreamBan.create({
                id: `sban_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                hostId: String(hostId),
                bannedUserId: String(userId),
                bannedUserName: String(userName || userId),
                reason: `Violação de proteção de conteúdo (${violationType})`,
                createdAt: new Date(),
            });
        }
        else {
            await models_1.StreamBan.updateOne({ hostId: String(hostId), bannedUserId: String(userId) }, { $set: { bannedUserName: String(userName || userId) } });
        }
        // 👤 BAN POR CONTA: o perfil do host some dos CONTATOS do usuário
        // bloqueado — remove follow/seguimento/amizade nos dois sentidos.
        try {
            const { Followers, Friendship } = await Promise.resolve().then(() => __importStar(require('../models')));
            // Follow/seguimento — modelo 'Followers' persiste na coleção 'follows'
            await Followers.deleteMany({
                $or: [
                    { followerId: String(hostId), followingId: String(userId) },
                    { followerId: String(userId), followingId: String(hostId) },
                ]
            });
            // Amizade (par em qualquer ordem)
            await Friendship.deleteMany({
                $or: [
                    { userId1: String(hostId), userId2: String(userId) },
                    { userId1: String(userId), userId2: String(hostId) },
                ]
            });
        }
        catch (e) {
            console.warn('[PROTECTION] Falha ao remover vínculos sociais:', e);
        }
        return res.json({ ok: true, banned: true, message: `Usuário ${userName || userId} bloqueado das suas lives nesta conta.` });
    }
    catch (error) {
        console.error('[PROTECTION] Erro ao banir usuário:', error);
        return res.status(500).json({ error: 'Erro ao banir usuário' });
    }
});
/**
 * POST /api/protection/unban
 * Body: { hostId, userId }
 */
router.post('/unban', async (req, res) => {
    try {
        const { hostId, userId } = req.body || {};
        if (!hostId || !userId)
            return res.status(400).json({ error: 'hostId e userId são obrigatórios' });
        await models_1.StreamBan.deleteOne({ hostId: String(hostId), bannedUserId: String(userId) });
        return res.json({ ok: true, banned: false });
    }
    catch (error) {
        return res.status(500).json({ error: 'Erro ao desbanir' });
    }
});
/**
 * GET /api/protection/ban/check?hostId=&userId=
 * Usado na ENTRADA da sala: usuário banido não entra.
 */
router.get('/ban/check', async (req, res) => {
    try {
        const { hostId, userId } = req.query;
        if (!hostId || !userId)
            return res.status(400).json({ error: 'hostId e userId são obrigatórios' });
        const ban = await models_1.StreamBan.findOne({ hostId: String(hostId), bannedUserId: String(userId) });
        const doc = ban ? ban.bannedUserId ? ban : null : null;
        return res.json({ banned: !!doc, bannedUserName: doc?.bannedUserName || '', reason: doc?.reason || '' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Erro ao verificar ban' });
    }
});
/**
 * GET /api/protection/bans/:hostId
 */
router.get('/bans/:hostId', async (req, res) => {
    try {
        const coll = models_1.StreamBan._coll();
        const docs = await coll.find({ hostId: String(req.params.hostId) }).sort({ createdAt: -1 }).limit(500).project({ _id: 0 }).toArray();
        return res.json(docs);
    }
    catch (error) {
        return res.status(500).json({ error: 'Erro ao listar bans' });
    }
});
exports.default = router;
