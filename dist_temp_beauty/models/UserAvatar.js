"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAvatar = exports.COLLECTION = void 0;
exports.purchaseAvatar = purchaseAvatar;
exports.findBasic = findBasic;
exports.findList = findList;
exports.findDetail = findDetail;
exports.setCurrentAvatar = setCurrentAvatar;
exports.getCurrentAvatar = getCurrentAvatar;
exports.getActiveAvatars = getActiveAvatars;
exports.getExpiredAvatars = getExpiredAvatars;
exports.getAvatarsNearExpiration = getAvatarsNearExpiration;
exports.processExpiredAvatars = processExpiredAvatars;
exports.userHasAvatar = userHasAvatar;
exports.removeAvatar = removeAvatar;
exports.extendAvatar = extendAvatar;
exports.findPaginated = findPaginated;
exports.getUserAvatarStats = getUserAvatarStats;
exports.getGlobalStats = getGlobalStats;
exports.findByAvatarId = findByAvatarId;
exports.isExpired = isExpired;
exports.isValid = isValid;
exports.getDaysRemaining = getDaysRemaining;
exports.renew = renew;
exports.activate = activate;
exports.deactivate = deactivate;
const mongodb_1 = require("mongodb");
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'useravatars';
async function purchaseAvatar(collection, userId, avatarId, imageUrl, days = 7) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    const doc = {
        userId,
        avatarId,
        imageUrl,
        purchaseDate: new Date(),
        expirationDate,
        isActive: true,
        isCurrent: false,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
}
function findBasic(collection, userId, limit) {
    const query = {};
    if (userId)
        query.userId = userId;
    const cursor = collection.find(query, {
        projection: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        sort: { purchaseDate: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findList(collection, userId, limit, filters) {
    const query = {};
    if (userId)
        query.userId = userId;
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    if (filters?.isCurrent !== undefined)
        query.isCurrent = filters.isCurrent;
    if (filters?.avatarId)
        query.avatarId = filters.avatarId;
    const cursor = collection.find(query, {
        projection: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 },
        sort: { purchaseDate: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findDetail(collection, userAvatarId) {
    return collection.findOne({ _id: new mongodb_1.ObjectId(userAvatarId) }, {
        projection: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1, updatedAt: 1 }
    });
}
async function setCurrentAvatar(collection, userId, userAvatarId, projection = 'list') {
    const projections = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 },
        detail: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1, updatedAt: 1 }
    };
    const result = await collection.findOneAndUpdate({ userId, _id: new mongodb_1.ObjectId(userAvatarId), isActive: true }, { $set: { isCurrent: true } }, { returnDocument: 'after', projection: projections[projection] });
    return result.value;
}
function getCurrentAvatar(collection, userId, projection = 'basic') {
    const projections = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 },
        detail: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.findOne({ userId, isCurrent: true, isActive: true }, { projection: projections[projection] });
}
function getActiveAvatars(collection, userId, limit, projection = 'list') {
    const projections = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 }
    };
    const cursor = collection.find({ userId, isActive: true }, {
        projection: projections[projection],
        sort: { purchaseDate: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function getExpiredAvatars(collection, limit, projection = 'list') {
    const projections = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 }
    };
    const cursor = collection.find({ isActive: true, expirationDate: { $lt: new Date() } }, {
        projection: projections[projection],
        sort: { expirationDate: 1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function getAvatarsNearExpiration(collection, days = 7, limit, projection = 'list') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const projections = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 }
    };
    const cursor = collection.find({ isActive: true, expirationDate: { $lte: cutoff, $gte: new Date() } }, {
        projection: projections[projection],
        sort: { expirationDate: 1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
async function processExpiredAvatars(collection) {
    return collection.updateMany({ isActive: true, expirationDate: { $lt: new Date() } }, { $set: { isActive: false, isCurrent: false } });
}
function userHasAvatar(collection, userId, avatarId, projection = 'basic') {
    const projections = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 }
    };
    return collection.findOne({ userId, avatarId, isActive: true }, { projection: projections[projection] });
}
async function removeAvatar(collection, userId, userAvatarId) {
    return collection.findOneAndDelete({ userId, _id: new mongodb_1.ObjectId(userAvatarId) });
}
async function extendAvatar(collection, userAvatarId, days, projection = 'list') {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    const projections = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 },
        detail: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1, updatedAt: 1 }
    };
    const result = await collection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(userAvatarId) }, { $set: { expirationDate: newExpirationDate, isActive: true } }, { returnDocument: 'after', projection: projections[projection] });
    return result.value;
}
async function findPaginated(collection, page = 1, limit = 20, filters, projection = 'basic') {
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.userId)
        query.userId = filters.userId;
    if (filters?.avatarId)
        query.avatarId = filters.avatarId;
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    if (filters?.isCurrent !== undefined)
        query.isCurrent = filters.isCurrent;
    if (filters?.minExpirationDate || filters?.maxExpirationDate) {
        query.expirationDate = {};
        if (filters?.minExpirationDate)
            query.expirationDate.$gte = filters.minExpirationDate;
        if (filters?.maxExpirationDate)
            query.expirationDate.$lte = filters.maxExpirationDate;
    }
    const projections = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 },
        detail: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1, updatedAt: 1 }
    };
    const [data, total] = await Promise.all([
        collection.find(query, {
            projection: projections[projection],
            sort: { purchaseDate: -1 },
            skip,
            limit
        }).toArray(),
        collection.countDocuments(query)
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
function getUserAvatarStats(collection, userId) {
    return collection.aggregate([
        { $match: { userId } },
        {
            $group: {
                _id: '$userId',
                totalAvatars: { $sum: 1 },
                activeAvatars: { $sum: { $cond: ['$isActive', 1, 0] } },
                currentAvatar: { $sum: { $cond: ['$isCurrent', 1, 0] } },
                expiredAvatars: {
                    $sum: {
                        $cond: [{ $lt: ['$expirationDate', new Date()] }, 1, 0]
                    }
                },
                totalPurchases: { $sum: 1 },
                uniqueAvatarIds: { $addToSet: '$avatarId' },
                lastPurchase: { $max: '$purchaseDate' },
                nextExpiration: {
                    $min: {
                        $filter: {
                            input: '$expirationDate',
                            cond: { $gte: ['$$this', new Date()] }
                        }
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                userId: '$_id',
                totalAvatars: 1,
                activeAvatars: 1,
                currentAvatar: 1,
                expiredAvatars: 1,
                totalPurchases: 1,
                uniqueAvatarTypes: { $size: '$uniqueAvatarIds' },
                lastPurchase: 1,
                nextExpiration: 1,
                activeRate: {
                    $multiply: [{ $divide: ['$activeAvatars', '$totalAvatars'] }, 100]
                }
            }
        }
    ]).toArray();
}
function getGlobalStats(collection, days) {
    const matchQuery = {};
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.purchaseDate = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalAvatars: { $sum: 1 },
                activeAvatars: { $sum: { $cond: ['$isActive', 1, 0] } },
                currentAvatars: { $sum: { $cond: ['$isCurrent', 1, 0] } },
                expiredAvatars: {
                    $sum: {
                        $cond: [{ $lt: ['$expirationDate', new Date()] }, 1, 0]
                    }
                },
                totalPurchases: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueAvatarTypes: { $addToSet: '$avatarId' },
                lastPurchase: { $max: '$purchaseDate' }
            }
        },
        {
            $project: {
                _id: 0,
                totalAvatars: 1,
                activeAvatars: 1,
                currentAvatars: 1,
                expiredAvatars: 1,
                totalPurchases: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                uniqueAvatarTypesCount: { $size: '$uniqueAvatarTypes' },
                lastPurchase: 1,
                activeRate: {
                    $multiply: [{ $divide: ['$activeAvatars', '$totalAvatars'] }, 100]
                },
                currentRate: {
                    $multiply: [{ $divide: ['$currentAvatars', '$totalAvatars'] }, 100]
                }
            }
        }
    ]).toArray();
}
function findByAvatarId(collection, avatarId, limit, projection = 'list') {
    const projections = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 }
    };
    const cursor = collection.find({ avatarId }, {
        projection: projections[projection],
        sort: { purchaseDate: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function isExpired(doc) {
    return doc.expirationDate < new Date();
}
function isValid(doc) {
    return doc.isActive && !isExpired(doc);
}
function getDaysRemaining(doc) {
    const now = new Date();
    const diffTime = doc.expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}
async function renew(collection, doc, days) {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    return collection.updateOne({ _id: doc._id }, { $set: { expirationDate: newExpirationDate, isActive: true, updatedAt: new Date() } });
}
async function activate(collection, doc) {
    if (isExpired(doc)) {
        throw new Error('N�o � poss�vel ativar avatar expirado');
    }
    return collection.updateOne({ _id: doc._id }, { $set: { isActive: true, updatedAt: new Date() } });
}
async function deactivate(collection, doc) {
    return collection.updateOne({ _id: doc._id }, { $set: { isActive: false, isCurrent: false, updatedAt: new Date() } });
}
class UserAvatar extends BaseModel_1.BaseModel {
}
exports.UserAvatar = UserAvatar;
UserAvatar.collectionName = 'useravatars';
