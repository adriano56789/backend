"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const router = express_1.default.Router();
// GET /api/voice-rooms — listar salas de voz ativas
router.get('/', async (req, res) => {
    try {
        const { category, cursor, limit: limitStr } = req.query;
        const limit = Math.min(parseInt(limitStr) || 20, 50);
        const query = { isLive: true };
        if (category && category !== 'all') {
            query.category = category;
        }
        if (cursor) {
            query._id = { $lt: cursor };
        }
        const rooms = await models_1.VoiceRoom.find(query)
            .sort({ viewers: -1, createdAt: -1 })
            .limit(limit)
            .lean();
        const enriched = rooms.map(room => ({
            id: room.roomId,
            roomId: room.roomId,
            hostId: room.hostId,
            hostName: room.hostName,
            hostAvatar: room.hostAvatar,
            name: room.name,
            category: room.category,
            slots: room.slots,
            maxSlots: room.maxSlots,
            minLevelToSpeak: room.minLevelToSpeak,
            isLive: room.isLive,
            viewers: room.viewers,
            startTime: room.startTime,
            tags: [room.category],
            avatar: room.hostAvatar,
            location: '',
            time: 'Ao Vivo',
            message: room.name,
        }));
        res.json({ code: 0, data: { rooms: enriched, hasMore: rooms.length === limit } });
    }
    catch (error) {
        console.error('[VOICE_ROOMS] Erro ao listar:', error);
        res.json({ code: 0, data: { rooms: [], hasMore: false } });
    }
});
// POST /api/voice-rooms — criar sala de voz
router.post('/', async (req, res) => {
    try {
        const { hostId, name, category, minLevelToSpeak } = req.body;
        if (!hostId) {
            res.status(400).json({ error: 'hostId é obrigatório' });
            return;
        }
        const user = await models_1.User.findOne({ id: hostId }).lean();
        const roomId = `voice_${hostId}_${Date.now()}`;
        const slots = [];
        // Slot 0 = host (apresentador)
        slots.push({
            index: 0,
            userId: hostId,
            userName: user?.name || hostId,
            avatar: user?.avatarUrl || user?.avatar || '',
            level: user?.level || 1,
            isSpeaking: false,
            isMuted: false,
            joinedAt: new Date(),
        });
        // Slots 1-6 vazios
        for (let i = 1; i <= 6; i++) {
            slots.push({
                index: i,
                userId: null,
                userName: '',
                avatar: '',
                level: 1,
                isSpeaking: false,
                isMuted: false,
                joinedAt: null,
            });
        }
        const room = await models_1.VoiceRoom.create({
            roomId,
            hostId,
            hostName: user?.name || hostId,
            hostAvatar: user?.avatarUrl || user?.avatar || '',
            name: name || `Sala de ${user?.name || hostId}`,
            category: category || 'voice_chat',
            slots,
            maxSlots: 6,
            minLevelToSpeak: minLevelToSpeak || 1,
            isLive: true,
            viewers: 1,
            viewerIds: [hostId],
            startTime: new Date(),
        });
        res.json({ success: true, room: {
                id: room.roomId,
                roomId: room.roomId,
                hostId: room.hostId,
                hostName: room.hostName,
                hostAvatar: room.hostAvatar,
                name: room.name,
                category: room.category,
                slots: room.slots,
                maxSlots: room.maxSlots,
                minLevelToSpeak: room.minLevelToSpeak,
                isLive: room.isLive,
                viewers: room.viewers,
                startTime: room.startTime,
                tags: [room.category],
                avatar: room.hostAvatar,
                location: '',
                time: 'Ao Vivo',
                message: room.name,
            } });
    }
    catch (error) {
        console.error('[VOICE_ROOMS] Erro ao criar:', error);
        res.status(500).json({ error: 'Erro interno ao criar sala de voz' });
    }
});
// GET /api/voice-rooms/:roomId — detalhes de uma sala
router.get('/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await models_1.VoiceRoom.findOne({ roomId }).lean();
        if (!room) {
            res.status(404).json({ error: 'Sala de voz não encontrada' });
            return;
        }
        res.json({ success: true, room: {
                id: room.roomId,
                roomId: room.roomId,
                hostId: room.hostId,
                hostName: room.hostName,
                hostAvatar: room.hostAvatar,
                name: room.name,
                category: room.category,
                slots: room.slots,
                maxSlots: room.maxSlots,
                minLevelToSpeak: room.minLevelToSpeak,
                isLive: room.isLive,
                viewers: room.viewers,
                startTime: room.startTime,
                tags: [room.category],
                avatar: room.hostAvatar,
                location: '',
                time: 'Ao Vivo',
                message: room.name,
            } });
    }
    catch (error) {
        console.error('[VOICE_ROOMS] Erro ao buscar:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});
// POST /api/voice-rooms/:roomId/join — entrar na sala
router.post('/:roomId/join', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId é obrigatório' });
            return;
        }
        const room = await models_1.VoiceRoom.findOne({ roomId });
        if (!room) {
            res.status(404).json({ error: 'Sala de voz não encontrada' });
            return;
        }
        if (!room.isLive) {
            res.status(400).json({ error: 'Sala de voz não está ativa' });
            return;
        }
        // Adicionar aos viewers se não estiver já
        if (!room.viewerIds.includes(userId)) {
            room.viewerIds.push(userId);
            room.viewers = room.viewerIds.length;
        }
        await room.save();
        res.json({ success: true, room: {
                id: room.roomId,
                roomId: room.roomId,
                hostId: room.hostId,
                hostName: room.hostName,
                hostAvatar: room.hostAvatar,
                name: room.name,
                category: room.category,
                slots: room.slots,
                maxSlots: room.maxSlots,
                minLevelToSpeak: room.minLevelToSpeak,
                isLive: room.isLive,
                viewers: room.viewers,
                startTime: room.startTime,
            } });
    }
    catch (error) {
        console.error('[VOICE_ROOMS] Erro ao entrar:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});
// POST /api/voice-rooms/:roomId/leave — sair da sala
router.post('/:roomId/leave', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { userId } = req.body;
        const room = await models_1.VoiceRoom.findOne({ roomId });
        if (!room) {
            res.status(404).json({ error: 'Sala de voz não encontrada' });
            return;
        }
        // Remover dos viewers
        room.viewerIds = room.viewerIds.filter((id) => id !== userId);
        room.viewers = room.viewerIds.length;
        // Se o host saiu, encerrar a sala
        if (room.hostId === userId) {
            room.isLive = false;
            // Limpar todos os slots
            room.slots.forEach((slot, i) => {
                if (i === 0) {
                    slot.userId = null;
                    slot.joinedAt = null;
                }
            });
        }
        else {
            // Remover dos slots (se estiver em um)
            const slotIndex = room.slots.findIndex((s) => s.userId === userId);
            if (slotIndex >= 0) {
                room.slots[slotIndex].userId = null;
                room.slots[slotIndex].userName = '';
                room.slots[slotIndex].avatar = '';
                room.slots[slotIndex].level = 1;
                room.slots[slotIndex].isSpeaking = false;
                room.slots[slotIndex].isMuted = false;
                room.slots[slotIndex].joinedAt = null;
            }
        }
        await room.save();
        // Se não sobrou ninguém, encerrar
        if (room.viewers <= 0) {
            room.isLive = false;
            await room.save();
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('[VOICE_ROOMS] Erro ao sair:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});
// POST /api/voice-rooms/:roomId/slot — subir no palco (pegar slot)
router.post('/:roomId/slot', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { userId, slotIndex } = req.body;
        if (!userId || slotIndex === undefined) {
            res.status(400).json({ error: 'userId e slotIndex são obrigatórios' });
            return;
        }
        if (slotIndex < 1 || slotIndex > 6) {
            res.status(400).json({ error: 'slotIndex deve ser entre 1 e 6 (0 é do host)' });
            return;
        }
        const room = await models_1.VoiceRoom.findOne({ roomId });
        if (!room) {
            res.status(404).json({ error: 'Sala de voz não encontrada' });
            return;
        }
        // Verificar se já está em algum slot
        const existingSlot = room.slots.findIndex((s) => s.userId === userId);
        if (existingSlot >= 0) {
            res.status(400).json({ error: 'Usuário já está em um slot' });
            return;
        }
        // Verificar se o slot está vazio
        if (room.slots[slotIndex].userId !== null) {
            res.status(400).json({ error: 'Slot já está ocupado' });
            return;
        }
        // Verificar nível mínimo
        const user = await models_1.User.findOne({ id: userId }).lean();
        const userLevel = user?.level || 1;
        if (userLevel < room.minLevelToSpeak) {
            res.status(400).json({ error: `Nível mínimo para falar: ${room.minLevelToSpeak}` });
            return;
        }
        // Ocupar o slot
        room.slots[slotIndex] = {
            index: slotIndex,
            userId,
            userName: user?.name || userId,
            avatar: user?.avatarUrl || user?.avatar || '',
            level: userLevel,
            isSpeaking: false,
            isMuted: false,
            joinedAt: new Date(),
        };
        await room.save();
        // Emitir evento via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.to(roomId).emit('voice_slot_update', {
                roomId,
                slots: room.slots,
                action: 'user_joined_slot',
                userId,
                slotIndex,
            });
        }
        res.json({ success: true, slots: room.slots });
    }
    catch (error) {
        console.error('[VOICE_ROOMS] Erro ao pegar slot:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});
// DELETE /api/voice-rooms/:roomId/slot — descer do palco (liberar slot)
router.delete('/:roomId/slot', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId é obrigatório' });
            return;
        }
        const room = await models_1.VoiceRoom.findOne({ roomId });
        if (!room) {
            res.status(404).json({ error: 'Sala de voz não encontrada' });
            return;
        }
        const slotIndex = room.slots.findIndex((s) => s.userId === userId);
        if (slotIndex < 0) {
            res.status(400).json({ error: 'Usuário não está em nenhum slot' });
            return;
        }
        // Host não pode descer do slot 0
        if (slotIndex === 0) {
            res.status(400).json({ error: 'O host não pode descer do palco' });
            return;
        }
        room.slots[slotIndex] = {
            index: slotIndex,
            userId: null,
            userName: '',
            avatar: '',
            level: 1,
            isSpeaking: false,
            isMuted: false,
            joinedAt: null,
        };
        await room.save();
        // Emitir evento via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.to(roomId).emit('voice_slot_update', {
                roomId,
                slots: room.slots,
                action: 'user_left_slot',
                userId,
                slotIndex,
            });
        }
        res.json({ success: true, slots: room.slots });
    }
    catch (error) {
        console.error('[VOICE_ROOMS] Erro ao liberar slot:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});
// POST /api/voice-rooms/:roomId/speaking — toggle speaking indicator
router.post('/:roomId/speaking', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { userId, isSpeaking } = req.body;
        const room = await models_1.VoiceRoom.findOne({ roomId });
        if (!room) {
            res.status(404).json({ error: 'Sala de voz não encontrada' });
            return;
        }
        const slotIndex = room.slots.findIndex((s) => s.userId === userId);
        if (slotIndex >= 0) {
            room.slots[slotIndex].isSpeaking = isSpeaking;
            await room.save();
        }
        const io = req.app.get('io');
        if (io) {
            io.to(roomId).emit('voice_speaking', {
                roomId,
                userId,
                isSpeaking,
                slotIndex,
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});
// POST /api/voice-rooms/:roomId/mute — toggle mute
router.post('/:roomId/mute', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { userId, isMuted } = req.body;
        const room = await models_1.VoiceRoom.findOne({ roomId });
        if (!room) {
            res.status(404).json({ error: 'Sala de voz não encontrada' });
            return;
        }
        const slotIndex = room.slots.findIndex((s) => s.userId === userId);
        if (slotIndex >= 0) {
            room.slots[slotIndex].isMuted = isMuted;
            await room.save();
        }
        const io = req.app.get('io');
        if (io) {
            io.to(roomId).emit('voice_mute_update', {
                roomId,
                userId,
                isMuted,
                slotIndex,
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});
// POST /api/voice-rooms/:roomId/end — encerrar sala (host)
router.post('/:roomId/end', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { userId } = req.body;
        const room = await models_1.VoiceRoom.findOne({ roomId });
        if (!room) {
            res.status(404).json({ error: 'Sala de voz não encontrada' });
            return;
        }
        if (room.hostId !== userId) {
            res.status(403).json({ error: 'Apenas o host pode encerrar a sala' });
            return;
        }
        room.isLive = false;
        room.viewers = 0;
        room.viewerIds = [];
        room.slots.forEach((slot) => {
            slot.userId = null;
            slot.joinedAt = null;
        });
        await room.save();
        const io = req.app.get('io');
        if (io) {
            io.to(roomId).emit('voice_room_ended', { roomId });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Erro interno' });
    }
});
exports.default = router;
