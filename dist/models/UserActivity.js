"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserActivity = exports.ActivityType = void 0;
exports.logActivity = logActivity;
exports.findBasic = findBasic;
exports.findList = findList;
exports.findDetail = findDetail;
exports.findByActivityId = findByActivityId;
exports.findPaginated = findPaginated;
exports.getUserActivityStats = getUserActivityStats;
exports.getGlobalActivityStats = getGlobalActivityStats;
exports.getActivityTypesStats = getActivityTypesStats;
exports.getMostActiveUsers = getMostActiveUsers;
exports.getRecentActivities = getRecentActivities;
exports.getActivitiesByType = getActivitiesByType;
exports.getTargetActivities = getTargetActivities;
exports.cleanupOldActivities = cleanupOldActivities;
exports.getFormattedActivity = getFormattedActivity;
exports.isRecentActivity = isRecentActivity;
exports.getActivityCategory = getActivityCategory;
const BaseModel_1 = require("../db/BaseModel");
const db_1 = require("../config/db");
var ActivityType;
(function (ActivityType) {
    ActivityType["JOIN_LIVE"] = "join_live";
    ActivityType["LEAVE_LIVE"] = "leave_live";
    ActivityType["START_LIVE"] = "start_live";
    ActivityType["END_LIVE"] = "end_live";
    ActivityType["FOLLOW_USER"] = "follow_user";
    ActivityType["UNFOLLOW_USER"] = "unfollow_user";
    ActivityType["BLOCK_USER"] = "block_user";
    ActivityType["UNBLOCK_USER"] = "unblock_user";
    ActivityType["SEND_FRIEND_REQUEST"] = "send_friend_request";
    ActivityType["ACCEPT_FRIEND_REQUEST"] = "accept_friend_request";
    ActivityType["REJECT_FRIEND_REQUEST"] = "reject_friend_request";
    ActivityType["SEND_GIFT"] = "send_gift";
    ActivityType["RECEIVE_GIFT"] = "receive_gift";
    ActivityType["PURCHASE_ITEM"] = "purchase_item";
    ActivityType["WITHDRAW_FUNDS"] = "withdraw_funds";
    ActivityType["UPLOAD_PHOTO"] = "upload_photo";
    ActivityType["UPLOAD_VIDEO"] = "upload_video";
    ActivityType["DELETE_PHOTO"] = "delete_photo";
    ActivityType["DELETE_VIDEO"] = "delete_video";
    ActivityType["LIKE_CONTENT"] = "like_content";
    ActivityType["UNLIKE_CONTENT"] = "unlike_content";
    ActivityType["COMMENT_CONTENT"] = "comment_content";
    ActivityType["SEND_MESSAGE"] = "send_message";
    ActivityType["READ_MESSAGE"] = "read_message";
    ActivityType["DELETE_MESSAGE"] = "delete_message";
    ActivityType["UPDATE_PROFILE"] = "update_profile";
    ActivityType["CHANGE_AVATAR"] = "change_avatar";
    ActivityType["UPDATE_STATUS"] = "update_status";
    ActivityType["REGISTER"] = "register";
    ActivityType["LOGIN"] = "login";
    ActivityType["LOGOUT"] = "logout";
    ActivityType["CHANGE_SETTINGS"] = "change_settings";
    ActivityType["REPORT_CONTENT"] = "report_content";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
const COLLECTION_NAME = 'useractivities';
function getColl(db) {
    if (db)
        return db.collection(COLLECTION_NAME);
    return (0, db_1.getCollection)(COLLECTION_NAME);
}
async function logActivity(data, db) {
    const coll = getColl(db);
    const activityData = {
        id: `ACT${Date.now()}${Math.floor(Math.random() * 1000)}`,
        userId: data.userId,
        activityType: data.activityType,
        targetId: data.targetId,
        targetType: data.targetType,
        timestamp: new Date(),
        metadata: data.metadata || {},
        ...data.context,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await coll.insertOne(activityData);
    return { _id: result.insertedId, ...activityData };
}
function findBasic(userId, limit, db) {
    const coll = getColl(db);
    const query = {};
    if (userId)
        query.userId = userId;
    const cursor = coll.find(query, {
        projection: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
        sort: { timestamp: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findList(userId, limit, db) {
    const coll = getColl(db);
    const query = {};
    if (userId)
        query.userId = userId;
    const cursor = coll.find(query, {
        projection: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 },
        sort: { timestamp: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findDetail(activityId, db) {
    const coll = getColl(db);
    return coll.findOne({ id: activityId }, {
        projection: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, location: 1, deviceInfo: 1, createdAt: 1, updatedAt: 1, _id: 0 }
    });
}
function findByActivityId(activityId, projection = 'basic', db) {
    const coll = getColl(db);
    const projections = {
        basic: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
        list: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 },
        detail: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, location: 1, deviceInfo: 1, createdAt: 1, updatedAt: 1, _id: 0 }
    };
    return coll.findOne({ id: activityId }, { projection: projections[projection] });
}
async function findPaginated(page = 1, limit = 20, filters, projection = 'basic', db) {
    const coll = getColl(db);
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.userId)
        query.userId = filters.userId;
    if (filters?.activityType)
        query.activityType = filters.activityType;
    if (filters?.targetType)
        query.targetType = filters.targetType;
    if (filters?.targetId)
        query.targetId = filters.targetId;
    if (filters?.minDate || filters?.maxDate) {
        query.timestamp = {};
        if (filters?.minDate)
            query.timestamp.$gte = filters.minDate;
        if (filters?.maxDate)
            query.timestamp.$lte = filters.maxDate;
    }
    if (filters?.hasTarget !== undefined) {
        query.targetId = filters.hasTarget ? { $exists: true, $ne: null } : { $exists: false };
    }
    const projections = {
        basic: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
        list: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 }
    };
    const [data, total] = await Promise.all([
        coll.find(query, { projection: projections[projection], sort: { timestamp: -1 }, skip, limit }).toArray(),
        coll.countDocuments(query)
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
function getUserActivityStats(userId, days = 30, db) {
    const coll = getColl(db);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    return coll.aggregate([
        { $match: { userId, timestamp: { $gte: threshold } } },
        {
            $group: {
                _id: '$activityType',
                count: { $sum: 1 },
                lastActivity: { $max: '$timestamp' },
                firstActivity: { $min: '$timestamp' }
            }
        },
        {
            $project: {
                activityType: '$_id',
                count: 1,
                lastActivity: 1,
                firstActivity: 1,
                _id: 0
            }
        },
        { $sort: { count: -1 } }
    ]).toArray();
}
function getGlobalActivityStats(days = 30, db) {
    const coll = getColl(db);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    return coll.aggregate([
        { $match: { timestamp: { $gte: threshold } } },
        {
            $group: {
                _id: '$activityType',
                count: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                lastActivity: { $max: '$timestamp' }
            }
        },
        {
            $project: {
                activityType: '$_id',
                count: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                lastActivity: 1,
                _id: 0
            }
        },
        { $sort: { count: -1 } }
    ]).toArray();
}
function getActivityTypesStats(days = 30, db) {
    const coll = getColl(db);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    return coll.aggregate([
        { $match: { timestamp: { $gte: threshold } } },
        {
            $group: {
                _id: '$activityType',
                count: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                avgPerUser: { $avg: 1 }
            }
        },
        {
            $project: {
                activityType: '$_id',
                count: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                avgPerUser: { $round: ['$avgPerUser', 2] },
                percentage: { $multiply: [{ $divide: ['$count', { $sum: '$count' }] }, 100] },
                _id: 0
            }
        },
        { $sort: { count: -1 } }
    ]).toArray();
}
function getMostActiveUsers(limit = 50, days = 30, db) {
    const coll = getColl(db);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    return coll.aggregate([
        { $match: { timestamp: { $gte: threshold } } },
        {
            $group: {
                _id: '$userId',
                totalActivities: { $sum: 1 },
                uniqueActivityTypes: { $addToSet: '$activityType' },
                lastActivity: { $max: '$timestamp' },
                firstActivity: { $min: '$timestamp' }
            }
        },
        {
            $project: {
                userId: '$_id',
                totalActivities: 1,
                uniqueActivityTypesCount: { $size: '$uniqueActivityTypes' },
                lastActivity: 1,
                firstActivity: 1,
                _id: 0
            }
        },
        { $sort: { totalActivities: -1 } },
        { $limit: limit }
    ]).toArray();
}
function getRecentActivities(limit = 50, projection = 'basic', db) {
    const coll = getColl(db);
    const projections = {
        basic: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
        list: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 }
    };
    return coll.find({}, { projection: projections[projection], sort: { timestamp: -1 }, limit }).toArray();
}
function getActivitiesByType(activityType, limit = 50, projection = 'basic', db) {
    const coll = getColl(db);
    const projections = {
        basic: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
        list: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 }
    };
    return coll.find({ activityType }, { projection: projections[projection], sort: { timestamp: -1 }, limit }).toArray();
}
function getTargetActivities(targetId, targetType, limit = 50, projection = 'basic', db) {
    const coll = getColl(db);
    const projections = {
        basic: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
        list: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 }
    };
    return coll.find({ targetId, targetType }, { projection: projections[projection], sort: { timestamp: -1 }, limit }).toArray();
}
function cleanupOldActivities(daysOld = 90, db) {
    const coll = getColl(db);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysOld);
    return coll.deleteMany({ timestamp: { $lt: threshold } });
}
const typeLabels = {
    [ActivityType.JOIN_LIVE]: 'Entrou na live',
    [ActivityType.LEAVE_LIVE]: 'Saiu da live',
    [ActivityType.START_LIVE]: 'Iniciou live',
    [ActivityType.END_LIVE]: 'Encerrou live',
    [ActivityType.FOLLOW_USER]: 'Seguiu usuário',
    [ActivityType.UNFOLLOW_USER]: 'Deixou de seguir',
    [ActivityType.BLOCK_USER]: 'Bloqueou usuário',
    [ActivityType.UNBLOCK_USER]: 'Desbloqueou usuário',
    [ActivityType.SEND_FRIEND_REQUEST]: 'Enviou solicitação de amizade',
    [ActivityType.ACCEPT_FRIEND_REQUEST]: 'Aceitou solicitação de amizade',
    [ActivityType.REJECT_FRIEND_REQUEST]: 'Rejeitou solicitação de amizade',
    [ActivityType.SEND_GIFT]: 'Enviou presente',
    [ActivityType.RECEIVE_GIFT]: 'Recebeu presente',
    [ActivityType.PURCHASE_ITEM]: 'Comprou item',
    [ActivityType.WITHDRAW_FUNDS]: 'Sacou fundos',
    [ActivityType.UPLOAD_PHOTO]: 'Enviou foto',
    [ActivityType.UPLOAD_VIDEO]: 'Enviou vídeo',
    [ActivityType.DELETE_PHOTO]: 'Apagou foto',
    [ActivityType.DELETE_VIDEO]: 'Apagou vídeo',
    [ActivityType.LIKE_CONTENT]: 'Curtiu conteúdo',
    [ActivityType.UNLIKE_CONTENT]: 'Descurtiu conteúdo',
    [ActivityType.COMMENT_CONTENT]: 'Comentou',
    [ActivityType.SEND_MESSAGE]: 'Enviou mensagem',
    [ActivityType.READ_MESSAGE]: 'Leu mensagem',
    [ActivityType.DELETE_MESSAGE]: 'Apagou mensagem',
    [ActivityType.UPDATE_PROFILE]: 'Atualizou perfil',
    [ActivityType.CHANGE_AVATAR]: 'Mudou avatar',
    [ActivityType.UPDATE_STATUS]: 'Atualizou status',
    [ActivityType.REGISTER]: 'Criou conta',
    [ActivityType.LOGIN]: 'Entrou no sistema',
    [ActivityType.LOGOUT]: 'Saiu do sistema',
    [ActivityType.CHANGE_SETTINGS]: 'Alterou configurações',
    [ActivityType.REPORT_CONTENT]: 'Denunciou conteúdo'
};
function getFormattedActivity(doc) {
    return typeLabels[doc.activityType] || doc.activityType;
}
function isRecentActivity(doc, hours = 24) {
    const now = new Date();
    const hoursSinceActivity = Math.floor((now.getTime() - doc.timestamp.getTime()) / (1000 * 60 * 60));
    return hoursSinceActivity <= hours;
}
const categories = {
    [ActivityType.JOIN_LIVE]: 'live',
    [ActivityType.LEAVE_LIVE]: 'live',
    [ActivityType.START_LIVE]: 'live',
    [ActivityType.END_LIVE]: 'live',
    [ActivityType.FOLLOW_USER]: 'social',
    [ActivityType.UNFOLLOW_USER]: 'social',
    [ActivityType.BLOCK_USER]: 'social',
    [ActivityType.UNBLOCK_USER]: 'social',
    [ActivityType.SEND_FRIEND_REQUEST]: 'social',
    [ActivityType.ACCEPT_FRIEND_REQUEST]: 'social',
    [ActivityType.REJECT_FRIEND_REQUEST]: 'social',
    [ActivityType.SEND_GIFT]: 'economy',
    [ActivityType.RECEIVE_GIFT]: 'economy',
    [ActivityType.PURCHASE_ITEM]: 'economy',
    [ActivityType.WITHDRAW_FUNDS]: 'economy',
    [ActivityType.UPLOAD_PHOTO]: 'content',
    [ActivityType.UPLOAD_VIDEO]: 'content',
    [ActivityType.DELETE_PHOTO]: 'content',
    [ActivityType.DELETE_VIDEO]: 'content',
    [ActivityType.LIKE_CONTENT]: 'content',
    [ActivityType.UNLIKE_CONTENT]: 'content',
    [ActivityType.COMMENT_CONTENT]: 'content',
    [ActivityType.SEND_MESSAGE]: 'communication',
    [ActivityType.READ_MESSAGE]: 'communication',
    [ActivityType.DELETE_MESSAGE]: 'communication',
    [ActivityType.UPDATE_PROFILE]: 'profile',
    [ActivityType.CHANGE_AVATAR]: 'profile',
    [ActivityType.UPDATE_STATUS]: 'profile',
    [ActivityType.REGISTER]: 'system',
    [ActivityType.LOGIN]: 'system',
    [ActivityType.LOGOUT]: 'system',
    [ActivityType.CHANGE_SETTINGS]: 'system',
    [ActivityType.REPORT_CONTENT]: 'system'
};
function getActivityCategory(doc) {
    return categories[doc.activityType] || 'other';
}
class UserActivity extends BaseModel_1.BaseModel {
}
exports.UserActivity = UserActivity;
UserActivity.collectionName = COLLECTION_NAME;
UserActivity.getColl = getColl;
