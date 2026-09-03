"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftRankingService = void 0;
const db_1 = require("../config/db");
const COLLECTION = 'gifterankings';
class GiftRankingService {
    static _pin(top3) {
        return top3.slice(0, 3).map(r => `${r.user.userId}:${r.coinCount}`).join('|');
    }
    static async record(streamId, userId, userName, avatarUrl, totalValue, io) {
        if (!streamId || streamId === 'unknown')
            return;
        const db = (0, db_1.getDb)();
        const coll = db.collection(COLLECTION);
        const now = new Date();
        await coll.findOneAndUpdate({ streamId, userId }, {
            $inc: { totalValue, giftCount: 1 },
            $set: { userName, avatarUrl, lastGiftAt: now },
            $setOnInsert: { streamId, userId },
        }, { upsert: true, returnDocument: 'after' });
        const topDocs = await coll
            .find({ streamId })
            .project({
            userId: 1, userName: 1, avatarUrl: 1, totalValue: 1, giftCount: 1, lastGiftAt: 1,
        })
            .sort({ totalValue: -1 })
            .limit(3)
            .toArray();
        const topViewers = topDocs.map(d => ({
            user: {
                userId: d.userId,
                uniqueId: d.userName,
                nickname: d.userName,
                profilePictureUrl: d.avatarUrl,
            },
            coinCount: d.totalValue,
        }));
        const newPin = this._pin(topViewers);
        const cached = this.cache.get(streamId);
        if (!cached || cached.pin !== newPin) {
            this.cache.set(streamId, { top3: topViewers, pin: newPin });
            io.to(streamId).emit('ranking_update', {
                roomId: streamId,
                topViewers,
                timestamp: now.toISOString(),
            });
        }
    }
    static async getTop(streamId, limit = 10) {
        const db = (0, db_1.getDb)();
        const coll = db.collection(COLLECTION);
        const docs = await coll
            .find({ streamId })
            .project({
            userId: 1, userName: 1, avatarUrl: 1, totalValue: 1, giftCount: 1, lastGiftAt: 1,
        })
            .sort({ totalValue: -1 })
            .limit(limit)
            .toArray();
        return docs.map(d => ({
            user: {
                userId: d.userId,
                uniqueId: d.userName,
                nickname: d.userName,
                profilePictureUrl: d.avatarUrl,
            },
            coinCount: d.totalValue,
        }));
    }
    static async clearStream(streamId) {
        const db = (0, db_1.getDb)();
        const coll = db.collection(COLLECTION);
        await coll.deleteMany({ streamId });
        this.cache.delete(streamId);
    }
}
exports.GiftRankingService = GiftRankingService;
GiftRankingService.cache = new Map();
