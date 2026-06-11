"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamSession = exports.COLLECTION = void 0;
exports.findOrCreateSession = findOrCreateSession;
exports.findBasic = findBasic;
exports.findList = findList;
exports.findDetail = findDetail;
exports.findStats = findStats;
exports.findActiveSession = findActiveSession;
exports.findActiveSessionsByHost = findActiveSessionsByHost;
exports.findEndedSessions = findEndedSessions;
exports.endSession = endSession;
exports.incrementViewers = incrementViewers;
exports.incrementCoins = incrementCoins;
exports.incrementGifts = incrementGifts;
exports.incrementMessages = incrementMessages;
exports.incrementFollowers = incrementFollowers;
exports.batchIncrement = batchIncrement;
exports.findHostHistory = findHostHistory;
exports.findByPeriod = findByPeriod;
exports.getHostStats = getHostStats;
exports.findPaginated = findPaginated;
exports.getGlobalStats = getGlobalStats;
exports.findPopularSessions = findPopularSessions;
exports.findTopEarningSessions = findTopEarningSessions;
exports.isActive = isActive;
exports.getDurationFormatted = getDurationFormatted;
exports.end = end;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'streamsessions';
async function findOrCreateSession(collection, streamId, hostId) {
    const result = await collection.findOneAndUpdate({ streamId, endTime: { $exists: false } }, {
        $setOnInsert: {
            streamId,
            hostId,
            startTime: new Date(),
            viewers: 0,
            coins: 0,
            giftsReceived: 0,
            messagesCount: 0,
            peakViewers: 0,
            followers: 0,
            members: 0,
            fans: 0
        }
    }, { upsert: true, returnDocument: 'after' });
    return result.value;
}
function findBasic(collection, limit) {
    const cursor = collection.find({}, {
        projection: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        sort: { startTime: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findList(collection, limit, filters) {
    const query = {};
    if (filters?.hostId)
        query.hostId = filters.hostId;
    if (filters?.isStreamMuted !== undefined)
        query.isStreamMuted = filters.isStreamMuted;
    if (filters?.minViewers)
        query.viewers = { $gte: filters.minViewers };
    const cursor = collection.find(query, {
        projection: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 },
        sort: { startTime: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findDetail(collection, streamId, hostId) {
    const query = {};
    if (streamId)
        query.streamId = streamId;
    if (hostId)
        query.hostId = hostId;
    return collection.findOne(query, {
        projection: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    });
}
function findStats(collection, streamId, hostId) {
    const query = {};
    if (streamId)
        query.streamId = streamId;
    if (hostId)
        query.hostId = hostId;
    return collection.findOne(query, {
        projection: { streamId: 1, hostId: 1, viewers: 1, coins: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    });
}
function findActiveSession(collection, streamId, projection = 'basic') {
    const projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 },
        detail: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.findOne({ streamId, endTime: { $exists: false } }, { projection: projections[projection] });
}
function findActiveSessionsByHost(collection, hostId, limit = 10, projection = 'basic') {
    const projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    };
    return collection.find({ hostId, endTime: { $exists: false } }, {
        projection: projections[projection],
        sort: { startTime: -1 }
    }).limit(limit).toArray();
}
function findEndedSessions(collection, hostId, limit = 50, projection = 'basic') {
    const query = { endTime: { $exists: true } };
    if (hostId)
        query.hostId = hostId;
    const projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { endTime: -1 }
    }).limit(limit).toArray();
}
async function endSession(collection, streamId) {
    return collection.updateOne({ streamId, endTime: { $exists: false } }, { $set: { endTime: new Date() } });
}
async function incrementViewers(collection, streamId, delta = 1) {
    return collection.updateOne({ streamId, endTime: { $exists: false } }, { $inc: { viewers: delta } });
}
async function incrementCoins(collection, streamId, delta = 1) {
    return collection.updateOne({ streamId, endTime: { $exists: false } }, { $inc: { coins: delta } });
}
async function incrementGifts(collection, streamId, delta = 1) {
    return collection.updateOne({ streamId, endTime: { $exists: false } }, { $inc: { giftsReceived: delta } });
}
async function incrementMessages(collection, streamId, delta = 1) {
    return collection.updateOne({ streamId, endTime: { $exists: false } }, { $inc: { messagesCount: delta } });
}
async function incrementFollowers(collection, streamId, delta = 1) {
    return collection.updateOne({ streamId, endTime: { $exists: false } }, { $inc: { followers: delta } });
}
async function batchIncrement(collection, streamId, updates) {
    const incrementOps = {};
    if (updates.viewers)
        incrementOps.viewers = updates.viewers;
    if (updates.coins)
        incrementOps.coins = updates.coins;
    if (updates.giftsReceived)
        incrementOps.giftsReceived = updates.giftsReceived;
    if (updates.messagesCount)
        incrementOps.messagesCount = updates.messagesCount;
    if (updates.followers)
        incrementOps.followers = updates.followers;
    if (updates.members)
        incrementOps.members = updates.members;
    if (updates.fans)
        incrementOps.fans = updates.fans;
    return collection.updateOne({ streamId, endTime: { $exists: false } }, { $inc: incrementOps });
}
function findHostHistory(collection, hostId, limit = 50, projection = 'basic', activeOnly = false) {
    const query = { hostId };
    if (activeOnly)
        query.endTime = { $exists: false };
    const projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 },
        detail: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { startTime: -1 }
    }).limit(limit).toArray();
}
function findByPeriod(collection, hostId, startDate, endDate, projection = 'basic') {
    const projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    };
    return collection.find({ hostId, startTime: { $gte: startDate, $lte: endDate } }, {
        projection: projections[projection],
        sort: { startTime: -1 }
    }).toArray();
}
function getHostStats(collection, hostId, days) {
    const matchQuery = { hostId };
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.startTime = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$hostId',
                totalSessions: { $sum: 1 },
                totalViewers: { $sum: '$viewers' },
                totalCoins: { $sum: '$coins' },
                totalGifts: { $sum: '$giftsReceived' },
                totalMessages: { $sum: '$messagesCount' },
                avgViewers: { $avg: '$viewers' },
                peakViewers: { $max: '$peakViewers' },
                totalDuration: { $sum: '$totalDuration' },
                lastSession: { $max: '$startTime' },
                firstSession: { $min: '$startTime' },
                activeSessions: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$endTime', null] }, null] }, 1, 0] } },
                endedSessions: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$endTime', null] }, null] }, 1, 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                hostId: '$_id',
                totalSessions: 1,
                totalViewers: 1,
                totalCoins: 1,
                totalGifts: 1,
                totalMessages: 1,
                avgViewers: 1,
                peakViewers: 1,
                totalDuration: 1,
                lastSession: 1,
                firstSession: 1,
                activeSessions: 1,
                endedSessions: 1,
                avgDuration: {
                    $divide: ['$totalDuration', { $subtract: ['$totalSessions', '$activeSessions'] }]
                },
                avgDurationFormatted: {
                    $function: {
                        body: function (duration) {
                            if (!duration)
                                return '00:00:00';
                            const hours = Math.floor(duration / 3600);
                            const minutes = Math.floor((duration % 3600) / 60);
                            const seconds = Math.floor(duration % 60);
                            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        },
                        args: ['$avgDuration']
                    }
                }
            }
        }
    ]).toArray();
}
async function findPaginated(collection, page = 1, limit = 20, filters, projection = 'basic') {
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.hostId)
        query.hostId = filters.hostId;
    if (filters?.isStreamMuted !== undefined)
        query.isStreamMuted = filters.isStreamMuted;
    if (filters?.minViewers !== undefined || filters?.maxViewers !== undefined) {
        query.viewers = {};
        if (filters?.minViewers !== undefined)
            query.viewers.$gte = filters.minViewers;
        if (filters?.maxViewers !== undefined)
            query.viewers.$lte = filters.maxViewers;
    }
    if (filters?.startDate || filters?.endDate) {
        query.startTime = {};
        if (filters?.startDate)
            query.startTime.$gte = filters.startDate;
        if (filters?.endDate)
            query.startTime.$lte = filters.endDate;
    }
    if (filters?.activeOnly)
        query.endTime = { $exists: false };
    const projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 },
        detail: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    };
    const [data, total] = await Promise.all([
        collection.find(query, {
            projection: projections[projection],
            sort: { startTime: -1 },
            skip,
            limit
        }).toArray(),
        collection.countDocuments(query)
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
function getGlobalStats(collection, days) {
    const matchQuery = {};
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.startTime = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                totalViewers: { $sum: '$viewers' },
                totalCoins: { $sum: '$coins' },
                totalGifts: { $sum: '$giftsReceived' },
                totalMessages: { $sum: '$messagesCount' },
                avgViewers: { $avg: '$viewers' },
                peakViewers: { $max: '$peakViewers' },
                totalDuration: { $sum: '$totalDuration' },
                uniqueHosts: { $addToSet: '$hostId' },
                activeSessions: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$endTime', null] }, null] }, 1, 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                totalSessions: 1,
                totalViewers: 1,
                totalCoins: 1,
                totalGifts: 1,
                totalMessages: 1,
                avgViewers: 1,
                peakViewers: 1,
                totalDuration: 1,
                uniqueHostsCount: { $size: '$uniqueHosts' },
                activeSessions: 1,
                avgDuration: {
                    $divide: ['$totalDuration', { $subtract: ['$totalSessions', '$activeSessions'] }]
                }
            }
        }
    ]).toArray();
}
function findPopularSessions(collection, limit = 20, projection = 'basic', days) {
    const query = {};
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        query.startTime = { $gte: cutoff };
    }
    const projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { peakViewers: -1, viewers: -1, startTime: -1 }
    }).limit(limit).toArray();
}
function findTopEarningSessions(collection, limit = 20, projection = 'list', days) {
    const query = {};
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        query.startTime = { $gte: cutoff };
    }
    const projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { coins: -1, giftsReceived: -1, startTime: -1 }
    }).limit(limit).toArray();
}
function isActive(doc) {
    return !doc.endTime;
}
function getDurationFormatted(doc) {
    if (!doc.totalDuration || doc.totalDuration <= 0) {
        return '00:00:00';
    }
    const hours = Math.floor(doc.totalDuration / 3600);
    const minutes = Math.floor((doc.totalDuration % 3600) / 60);
    const seconds = doc.totalDuration % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
async function end(collection, streamId) {
    return collection.updateOne({ streamId, endTime: { $exists: false } }, { $set: { endTime: new Date() } });
}
class StreamSession extends BaseModel_1.BaseModel {
}
exports.StreamSession = StreamSession;
StreamSession.collectionName = 'streamsessions';
