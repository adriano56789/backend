"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceService = void 0;
const socket_1 = require("../socket");
const LiveMessage_1 = require("../models/LiveMessage");
const models_1 = require("../models");
const LiveCard_1 = require("../models/LiveCard");
class PresenceService {
    static async userEnteredApp(userId, userName) {
        const io = (0, socket_1.getIO)();
        const now = new Date();
        await models_1.User.findOneAndUpdate({ id: userId }, { $set: { isOnline: true, lastSeen: now } }, { upsert: true }).catch(err => console.error('[PRESENCE] Error updating User on enter:', err.message));
        await models_1.UserStatus.findOneAndUpdate({ userId }, { $set: { isOnline: true, lastSeen: now } }, { upsert: true }).catch(err => console.error('[PRESENCE] Error updating UserStatus on enter:', err.message));
        io.emit('user_app_open', {
            userId,
            userName,
            timestamp: now.toISOString()
        });
        io.emit('user_status_changed', {
            userId,
            isOnline: true,
            timestamp: now.toISOString()
        });
        const activeStreams = await LiveCard_1.LiveCard.find({
            isLive: true,
            streamStatus: { $in: ['active', 'live'] }
        }).lean();
        for (const stream of activeStreams) {
            const systemMessage = {
                streamId: stream.streamKey || stream.hostId,
                userId: 'system',
                userName: 'Sistema',
                avatarUrl: '',
                level: 0,
                text: `${userName} entrou no aplicativo.`,
                type: 'system',
                timestamp: now
            };
            await LiveMessage_1.LiveMessage.create(systemMessage).catch(() => { });
            io.to(stream.streamKey || stream.hostId).emit('live_message', {
                ...systemMessage,
                timestamp: systemMessage.timestamp.toISOString()
            });
        }
    }
    static async userLeftApp(userId, userName) {
        const io = (0, socket_1.getIO)();
        const now = new Date();
        await models_1.User.findOneAndUpdate({ id: userId }, { $set: { isOnline: false, lastSeen: now } }).catch(err => console.error('[PRESENCE] Error updating User on leave:', err.message));
        await models_1.UserStatus.findOneAndUpdate({ userId }, { $set: { isOnline: false, lastSeen: now } }).catch(err => console.error('[PRESENCE] Error updating UserStatus on leave:', err.message));
        io.emit('user_left_app', {
            userId,
            timestamp: now.toISOString()
        });
        io.emit('user_status_changed', {
            userId,
            isOnline: false,
            timestamp: now.toISOString()
        });
        const activeStreams = await LiveCard_1.LiveCard.find({
            isLive: true,
            streamStatus: { $in: ['active', 'live'] }
        }).lean();
        for (const stream of activeStreams) {
            const systemMessage = {
                streamId: stream.streamKey || stream.hostId,
                userId: 'system',
                userName: 'Sistema',
                avatarUrl: '',
                level: 0,
                text: `${userName} saiu do aplicativo.`,
                type: 'system',
                timestamp: now
            };
            await LiveMessage_1.LiveMessage.create(systemMessage).catch(() => { });
            io.to(stream.streamKey || stream.hostId).emit('live_message', {
                ...systemMessage,
                timestamp: systemMessage.timestamp.toISOString()
            });
        }
    }
}
exports.PresenceService = PresenceService;
