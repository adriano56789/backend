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
var BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'streamlikes';
function likeStream(collection, streamId, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, collection.findOneAndUpdate({ streamId: streamId, userId: userId }, { $setOnInsert: { streamId: streamId, userId: userId, timestamp: new Date() } }, { upsert: true, returnDocument: 'after' })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.value];
            }
        });
    });
}
function unlikeStream(collection, streamId, userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.findOneAndDelete({ streamId: streamId, userId: userId })];
        });
    });
}
function hasUserLiked(collection, streamId, userId) {
    return collection.findOne({ streamId: streamId, userId: userId }, {
        projection: { streamId: 1, userId: 1, timestamp: 1 }
    });
}
function countByStream(collection, streamId) {
    return collection.countDocuments({ streamId: streamId });
}
function countByUser(collection, userId) {
    return collection.countDocuments({ userId: userId });
}
function findRecentByStream(collection, streamId, limit, projection) {
    if (limit === void 0) { limit = 50; }
    if (projection === void 0) { projection = 'basic'; }
    var projections = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    return collection.find({ streamId: streamId }, {
        projection: projections[projection],
        sort: { timestamp: -1 }
    }).limit(limit).toArray();
}
function findStreamsLikedByUser(collection, userId, limit, projection) {
    if (limit === void 0) { limit = 50; }
    if (projection === void 0) { projection = 'basic'; }
    var projections = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    return collection.find({ userId: userId }, {
        projection: projections[projection],
        sort: { timestamp: -1 }
    }).limit(limit).toArray();
}
function findByPeriod(collection, streamId, startDate, endDate, projection) {
    if (projection === void 0) { projection = 'basic'; }
    var projections = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    return collection.find({ streamId: streamId, timestamp: { $gte: startDate, $lte: endDate } }, {
        projection: projections[projection],
        sort: { timestamp: -1 }
    }).toArray();
}
function getStreamStats(collection, streamId, days) {
    var matchQuery = { streamId: streamId };
    if (days) {
        var cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
    var matchQuery = { userId: userId };
    if (days) {
        var cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
                    if (filters === null || filters === void 0 ? void 0 : filters.streamId)
                        query.streamId = filters.streamId;
                    if (filters === null || filters === void 0 ? void 0 : filters.userId)
                        query.userId = filters.userId;
                    if ((filters === null || filters === void 0 ? void 0 : filters.startDate) || (filters === null || filters === void 0 ? void 0 : filters.endDate)) {
                        query.timestamp = {};
                        if (filters === null || filters === void 0 ? void 0 : filters.startDate)
                            query.timestamp.$gte = filters.startDate;
                        if (filters === null || filters === void 0 ? void 0 : filters.endDate)
                            query.timestamp.$lte = filters.endDate;
                    }
                    projections = {
                        basic: { streamId: 1, userId: 1, timestamp: 1 },
                        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
                    };
                    return [4 /*yield*/, Promise.all([
                            collection.find(query, {
                                projection: projections[projection],
                                sort: { timestamp: -1 },
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
function isRecent(doc, hours) {
    if (hours === void 0) { hours = 24; }
    var now = new Date();
    var hoursDiff = (now.getTime() - doc.timestamp.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= hours;
}
function getTimestampFormatted(doc) {
    return doc.timestamp.toISOString();
}
function getTimeAgo(doc) {
    var now = new Date();
    var diff = now.getTime() - doc.timestamp.getTime();
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    if (days > 0)
        return "".concat(days, "d atr\uFFFDs");
    if (hours > 0)
        return "".concat(hours % 24, "h atr\uFFFDs");
    if (minutes > 0)
        return "".concat(minutes % 60, "m atr\uFFFDs");
    return "".concat(seconds % 60, "s atr\uFFFDs");
}
var StreamLike = /** @class */ (function (_super) {
    __extends(StreamLike, _super);
    function StreamLike() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    StreamLike.collectionName = 'streamlikes';
    return StreamLike;
}(BaseModel_1.BaseModel));
exports.StreamLike = StreamLike;
