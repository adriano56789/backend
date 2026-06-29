"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
var BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'streamsessions';
function findOrCreateSession(collection, streamId, hostId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, collection.findOneAndUpdate({ streamId: streamId, endTime: { $exists: false } }, {
                        $setOnInsert: {
                            streamId: streamId,
                            hostId: hostId,
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
                    }, { upsert: true, returnDocument: 'after' })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.value];
            }
        });
    });
}
function findBasic(collection, limit) {
    var cursor = collection.find({}, {
        projection: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        sort: { startTime: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findList(collection, limit, filters) {
    var query = {};
    if (filters === null || filters === void 0 ? void 0 : filters.hostId)
        query.hostId = filters.hostId;
    if ((filters === null || filters === void 0 ? void 0 : filters.isStreamMuted) !== undefined)
        query.isStreamMuted = filters.isStreamMuted;
    if (filters === null || filters === void 0 ? void 0 : filters.minViewers)
        query.viewers = { $gte: filters.minViewers };
    var cursor = collection.find(query, {
        projection: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 },
        sort: { startTime: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findDetail(collection, streamId, hostId) {
    var query = {};
    if (streamId)
        query.streamId = streamId;
    if (hostId)
        query.hostId = hostId;
    return collection.findOne(query, {
        projection: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    });
}
function findStats(collection, streamId, hostId) {
    var query = {};
    if (streamId)
        query.streamId = streamId;
    if (hostId)
        query.hostId = hostId;
    return collection.findOne(query, {
        projection: { streamId: 1, hostId: 1, viewers: 1, coins: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    });
}
function findActiveSession(collection, streamId, projection) {
    if (projection === void 0) { projection = 'basic'; }
    var projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 },
        detail: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.findOne({ streamId: streamId, endTime: { $exists: false } }, { projection: projections[projection] });
}
function findActiveSessionsByHost(collection, hostId, limit, projection) {
    if (limit === void 0) { limit = 10; }
    if (projection === void 0) { projection = 'basic'; }
    var projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    };
    return collection.find({ hostId: hostId, endTime: { $exists: false } }, {
        projection: projections[projection],
        sort: { startTime: -1 }
    }).limit(limit).toArray();
}
function findEndedSessions(collection, hostId, limit, projection) {
    if (limit === void 0) { limit = 50; }
    if (projection === void 0) { projection = 'basic'; }
    var query = { endTime: { $exists: true } };
    if (hostId)
        query.hostId = hostId;
    var projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { endTime: -1 }
    }).limit(limit).toArray();
}
function endSession(collection, streamId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.updateOne({ streamId: streamId, endTime: { $exists: false } }, { $set: { endTime: new Date() } })];
        });
    });
}
function incrementViewers(collection_1, streamId_1) {
    return __awaiter(this, arguments, void 0, function (collection, streamId, delta) {
        if (delta === void 0) { delta = 1; }
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.updateOne({ streamId: streamId, endTime: { $exists: false } }, { $inc: { viewers: delta } })];
        });
    });
}
function incrementCoins(collection_1, streamId_1) {
    return __awaiter(this, arguments, void 0, function (collection, streamId, delta) {
        if (delta === void 0) { delta = 1; }
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.updateOne({ streamId: streamId, endTime: { $exists: false } }, { $inc: { coins: delta } })];
        });
    });
}
function incrementGifts(collection_1, streamId_1) {
    return __awaiter(this, arguments, void 0, function (collection, streamId, delta) {
        if (delta === void 0) { delta = 1; }
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.updateOne({ streamId: streamId, endTime: { $exists: false } }, { $inc: { giftsReceived: delta } })];
        });
    });
}
function incrementMessages(collection_1, streamId_1) {
    return __awaiter(this, arguments, void 0, function (collection, streamId, delta) {
        if (delta === void 0) { delta = 1; }
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.updateOne({ streamId: streamId, endTime: { $exists: false } }, { $inc: { messagesCount: delta } })];
        });
    });
}
function incrementFollowers(collection_1, streamId_1) {
    return __awaiter(this, arguments, void 0, function (collection, streamId, delta) {
        if (delta === void 0) { delta = 1; }
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.updateOne({ streamId: streamId, endTime: { $exists: false } }, { $inc: { followers: delta } })];
        });
    });
}
function batchIncrement(collection, streamId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var incrementOps;
        return __generator(this, function (_a) {
            incrementOps = {};
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
            return [2 /*return*/, collection.updateOne({ streamId: streamId, endTime: { $exists: false } }, { $inc: incrementOps })];
        });
    });
}
function findHostHistory(collection, hostId, limit, projection, activeOnly) {
    if (limit === void 0) { limit = 50; }
    if (projection === void 0) { projection = 'basic'; }
    if (activeOnly === void 0) { activeOnly = false; }
    var query = { hostId: hostId };
    if (activeOnly)
        query.endTime = { $exists: false };
    var projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 },
        detail: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { startTime: -1 }
    }).limit(limit).toArray();
}
function findByPeriod(collection, hostId, startDate, endDate, projection) {
    if (projection === void 0) { projection = 'basic'; }
    var projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    };
    return collection.find({ hostId: hostId, startTime: { $gte: startDate, $lte: endDate } }, {
        projection: projections[projection],
        sort: { startTime: -1 }
    }).toArray();
}
function getHostStats(collection, hostId, days) {
    var matchQuery = { hostId: hostId };
    if (days) {
        var cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
                            var hours = Math.floor(duration / 3600);
                            var minutes = Math.floor((duration % 3600) / 60);
                            var seconds = Math.floor(duration % 60);
                            return "".concat(hours.toString().padStart(2, '0'), ":").concat(minutes.toString().padStart(2, '0'), ":").concat(seconds.toString().padStart(2, '0'));
                        },
                        args: ['$avgDuration']
                    }
                }
            }
        }
    ]).toArray();
}
function findPaginated(collection_1) {
    return __awaiter(this, arguments, void 0, function (collection, page, limit, filters, projection) {
        var skip, query, projections, _a, data, total;
        if (page === void 0) { page = 1; }
        if (limit === void 0) { limit = 20; }
        if (projection === void 0) { projection = 'basic'; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    skip = (page - 1) * limit;
                    query = {};
                    if (filters === null || filters === void 0 ? void 0 : filters.hostId)
                        query.hostId = filters.hostId;
                    if ((filters === null || filters === void 0 ? void 0 : filters.isStreamMuted) !== undefined)
                        query.isStreamMuted = filters.isStreamMuted;
                    if ((filters === null || filters === void 0 ? void 0 : filters.minViewers) !== undefined || (filters === null || filters === void 0 ? void 0 : filters.maxViewers) !== undefined) {
                        query.viewers = {};
                        if ((filters === null || filters === void 0 ? void 0 : filters.minViewers) !== undefined)
                            query.viewers.$gte = filters.minViewers;
                        if ((filters === null || filters === void 0 ? void 0 : filters.maxViewers) !== undefined)
                            query.viewers.$lte = filters.maxViewers;
                    }
                    if ((filters === null || filters === void 0 ? void 0 : filters.startDate) || (filters === null || filters === void 0 ? void 0 : filters.endDate)) {
                        query.startTime = {};
                        if (filters === null || filters === void 0 ? void 0 : filters.startDate)
                            query.startTime.$gte = filters.startDate;
                        if (filters === null || filters === void 0 ? void 0 : filters.endDate)
                            query.startTime.$lte = filters.endDate;
                    }
                    if (filters === null || filters === void 0 ? void 0 : filters.activeOnly)
                        query.endTime = { $exists: false };
                    projections = {
                        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
                        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 },
                        detail: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
                    };
                    return [4 /*yield*/, Promise.all([
                            collection.find(query, {
                                projection: projections[projection],
                                sort: { startTime: -1 },
                                skip: skip,
                                limit: limit
                            }).toArray(),
                            collection.countDocuments(query)
                        ])];
                case 1:
                    _a = _b.sent(), data = _a[0], total = _a[1];
                    return [2 /*return*/, { data: data, pagination: { page: page, limit: limit, total: total, pages: Math.ceil(total / limit) } }];
            }
        });
    });
}
function getGlobalStats(collection, days) {
    var matchQuery = {};
    if (days) {
        var cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
function findPopularSessions(collection, limit, projection, days) {
    if (limit === void 0) { limit = 20; }
    if (projection === void 0) { projection = 'basic'; }
    var query = {};
    if (days) {
        var cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        query.startTime = { $gte: cutoff };
    }
    var projections = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, followers: 1, members: 1, fans: 1, totalDuration: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { peakViewers: -1, viewers: -1, startTime: -1 }
    }).limit(limit).toArray();
}
function findTopEarningSessions(collection, limit, projection, days) {
    if (limit === void 0) { limit = 20; }
    if (projection === void 0) { projection = 'list'; }
    var query = {};
    if (days) {
        var cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        query.startTime = { $gte: cutoff };
    }
    var projections = {
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
    var hours = Math.floor(doc.totalDuration / 3600);
    var minutes = Math.floor((doc.totalDuration % 3600) / 60);
    var seconds = doc.totalDuration % 60;
    return "".concat(hours.toString().padStart(2, '0'), ":").concat(minutes.toString().padStart(2, '0'), ":").concat(seconds.toString().padStart(2, '0'));
}
function end(collection, streamId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.updateOne({ streamId: streamId, endTime: { $exists: false } }, { $set: { endTime: new Date() } })];
        });
    });
}
var StreamSession = /** @class */ (function (_super) {
    __extends(StreamSession, _super);
    function StreamSession() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    StreamSession.collectionName = 'streamsessions';
    return StreamSession;
}(BaseModel_1.BaseModel));
exports.StreamSession = StreamSession;
