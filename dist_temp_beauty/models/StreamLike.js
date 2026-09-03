"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamLike = exports.COLLECTION = void 0;
exports.likeStream = likeStream;
exports.unlikeStream = unlikeStream;
exports.hasUserLiked = hasUserLiked;
exports.countByStream = countByStream;
exports.countByUser = countByUser;
exports.findRecentByStream = findRecentByStream;
exports.findStreamsLikedByUser = findStreamsLikedByUser;
exports.findByPeriod = findByPeriod;
exports.getStreamStats = getStreamStats;
exports.getUserStats = getUserStats;
exports.findPaginated = findPaginated;
exports.getGlobalStats = getGlobalStats;
exports.isRecent = isRecent;
exports.getTimestampFormatted = getTimestampFormatted;
exports.getTimeAgo = getTimeAgo;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'streamlikes';
async function likeStream(collection, streamId, userId) {
    const result = await collection.findOneAndUpdate({ streamId, userId }, { $setOnInsert: { streamId, userId, timestamp: new Date() } }, { upsert: true, returnDocument: 'after' });
    return result.value;
}
async function unlikeStream(collection, streamId, userId) {
    return collection.findOneAndDelete({ streamId, userId });
}
function hasUserLiked(collection, streamId, userId) {
    return collection.findOne({ streamId, userId }, {
        projection: { streamId: 1, userId: 1, timestamp: 1 }
    });
}
function countByStream(collection, streamId) {
    return collection.countDocuments({ streamId });
}
function countByUser(collection, userId) {
    return collection.countDocuments({ userId });
}
function findRecentByStream(collection, streamId, limit = 50, projection = 'basic') {
    const projections = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    return collection.find({ streamId }, {
        projection: projections[projection],
        sort: { timestamp: -1 }
    }).limit(limit).toArray();
}
function findStreamsLikedByUser(collection, userId, limit = 50, projection = 'basic') {
    const projections = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    return collection.find({ userId }, {
        projection: projections[projection],
        sort: { timestamp: -1 }
    }).limit(limit).toArray();
}
function findByPeriod(collection, streamId, startDate, endDate, projection = 'basic') {
    const projections = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    return collection.find({ streamId, timestamp: { $gte: startDate, $lte: endDate } }, {
        projection: projections[projection],
        sort: { timestamp: -1 }
    }).toArray();
}
function getStreamStats(collection, streamId, days) {
    const matchQuery = { streamId };
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.timestamp = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$streamId',
                totalLikes: { $sum: 1 },
                firstLike: { $min: '$timestamp' },
                lastLike: { $max: '$timestamp' },
                recentLikes: {
                    $sum: {
                        $cond: {
                            if: { $gte: ['$timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
                            then: 1,
                            else: 0
                        }
                    }
                },
                uniqueUsers: { $addToSet: '$userId' }
            }
        },
        {
            $project: {
                _id: 0,
                streamId: '$_id',
                totalLikes: 1,
                firstLike: 1,
                lastLike: 1,
                recentLikes: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                avgLikesPerDay: {
                    $divide: [
                        '$totalLikes',
                        { $divide: [{ $subtract: [new Date(), '$firstLike'] }, 1000 * 60 * 60 * 24] }
                    ]
                }
            }
        }
    ]).toArray();
}
function getUserStats(collection, userId, days) {
    const matchQuery = { userId };
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.timestamp = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$userId',
                totalLikes: { $sum: 1 },
                firstLike: { $min: '$timestamp' },
                lastLike: { $max: '$timestamp' },
                uniqueStreams: { $addToSet: '$streamId' }
            }
        },
        {
            $project: {
                _id: 0,
                userId: '$_id',
                totalLikes: 1,
                firstLike: 1,
                lastLike: 1,
                uniqueStreamsCount: { $size: '$uniqueStreams' },
                avgLikesPerDay: {
                    $divide: [
                        '$totalLikes',
                        { $divide: [{ $subtract: [new Date(), '$firstLike'] }, 1000 * 60 * 60 * 24] }
                    ]
                }
            }
        }
    ]).toArray();
}
async function findPaginated(collection, page = 1, limit = 20, filters, projection = 'basic') {
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.streamId)
        query.streamId = filters.streamId;
    if (filters?.userId)
        query.userId = filters.userId;
    if (filters?.startDate || filters?.endDate) {
        query.timestamp = {};
        if (filters?.startDate)
            query.timestamp.$gte = filters.startDate;
        if (filters?.endDate)
            query.timestamp.$lte = filters.endDate;
    }
    const projections = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    const [data, total] = await Promise.all([
        collection.find(query, {
            projection: projections[projection],
            sort: { timestamp: -1 },
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
        matchQuery.timestamp = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalLikes: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueStreams: { $addToSet: '$streamId' },
                firstLike: { $min: '$timestamp' },
                lastLike: { $max: '$timestamp' }
            }
        },
        {
            $project: {
                _id: 0,
                totalLikes: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                uniqueStreamsCount: { $size: '$uniqueStreams' },
                firstLike: 1,
                lastLike: 1,
                avgLikesPerDay: {
                    $divide: [
                        '$totalLikes',
                        { $divide: [{ $subtract: [new Date(), '$firstLike'] }, 1000 * 60 * 60 * 24] }
                    ]
                }
            }
        }
    ]).toArray();
}
function isRecent(doc, hours = 24) {
    const now = new Date();
    const hoursDiff = (now.getTime() - doc.timestamp.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= hours;
}
function getTimestampFormatted(doc) {
    return doc.timestamp.toISOString();
}
function getTimeAgo(doc) {
    const now = new Date();
    const diff = now.getTime() - doc.timestamp.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0)
        return `${days}d atr�s`;
    if (hours > 0)
        return `${hours % 24}h atr�s`;
    if (minutes > 0)
        return `${minutes % 60}m atr�s`;
    return `${seconds % 60}s atr�s`;
}
class StreamLike extends BaseModel_1.BaseModel {
}
exports.StreamLike = StreamLike;
StreamLike.collectionName = 'streamlikes';
