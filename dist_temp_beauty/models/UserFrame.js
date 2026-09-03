"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserFrame = exports.COLLECTION = void 0;
exports.isFrameExpired = isFrameExpired;
exports.getFrameDaysRemaining = getFrameDaysRemaining;
exports.isFrameValid = isFrameValid;
exports.enrichBasicFrame = enrichBasicFrame;
exports.enrichListFrame = enrichListFrame;
exports.purchaseFrame = purchaseFrame;
exports.findFramesBasic = findFramesBasic;
exports.findFramesList = findFramesList;
exports.findFrameDetail = findFrameDetail;
exports.equipUserFrame = equipUserFrame;
exports.unequipUserFrame = unequipUserFrame;
exports.getEquippedFrame = getEquippedFrame;
exports.getActiveFrames = getActiveFrames;
exports.getExpiredFrames = getExpiredFrames;
exports.getFramesNearExpiration = getFramesNearExpiration;
exports.processExpiredFrames = processExpiredFrames;
exports.userHasFrame = userHasFrame;
exports.removeUserFrame = removeUserFrame;
exports.extendUserFrame = extendUserFrame;
exports.unequipAllUserFrames = unequipAllUserFrames;
exports.findFramesPaginated = findFramesPaginated;
exports.getUserFrameStats = getUserFrameStats;
exports.getUserFrameGlobalStats = getUserFrameGlobalStats;
exports.findFramesByFrameId = findFramesByFrameId;
exports.renewUserFrame = renewUserFrame;
const mongodb_1 = require("mongodb");
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'userframes';
const PROJ_BASIC = { userId: 1, frameId: 1, isActive: 1, isEquipped: 1, _id: 0 };
const PROJ_LIST = { userId: 1, frameId: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isEquipped: 1, createdAt: 1, _id: 0 };
const PROJ_DETAIL = { userId: 1, frameId: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isEquipped: 1, createdAt: 1, updatedAt: 1, _id: 0 };
const PROJ_STATS_BASIC = { userId: 1, frameId: 1, isActive: 1, isEquipped: 1 };
function isFrameExpired(frame) {
    return frame.expirationDate < new Date();
}
function getFrameDaysRemaining(frame) {
    const now = new Date();
    const diffTime = frame.expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}
function isFrameValid(frame) {
    return frame.isActive && !isFrameExpired(frame);
}
function enrichBasicFrame(frame) {
    return {
        ...frame,
        daysRemaining: getFrameDaysRemaining(frame),
        isExpired: isFrameExpired(frame),
    };
}
function enrichListFrame(frame) {
    return {
        ...frame,
        daysRemaining: getFrameDaysRemaining(frame),
        isExpired: isFrameExpired(frame),
    };
}
async function purchaseFrame(collection, userId, frameId, days = 30) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    const doc = {
        userId,
        frameId,
        purchaseDate: new Date(),
        expirationDate,
        isActive: true,
        isEquipped: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    await collection.insertOne(doc);
    return doc;
}
async function findFramesBasic(collection, userId, limit) {
    const query = {};
    if (userId)
        query.userId = userId;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ purchaseDate: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichBasicFrame(doc));
}
async function findFramesList(collection, userId, limit, filters) {
    const query = {};
    if (userId)
        query.userId = userId;
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    if (filters?.isEquipped !== undefined)
        query.isEquipped = filters.isEquipped;
    if (filters?.frameId)
        query.frameId = filters.frameId;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ purchaseDate: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListFrame(doc));
}
async function findFrameDetail(collection, userFrameId) {
    const doc = await collection.findOne({ _id: new mongodb_1.ObjectId(userFrameId) }, { projection: PROJ_DETAIL });
    return doc;
}
async function equipUserFrame(collection, userId, userFrameId) {
    const frame = await collection.findOne({ _id: new mongodb_1.ObjectId(userFrameId), userId });
    if (!frame)
        return null;
    if (!isFrameValid(frame)) {
        throw new Error('N�o � poss�vel equipar frame expirado');
    }
    await collection.updateMany({ userId, _id: { $ne: new mongodb_1.ObjectId(userFrameId) }, isEquipped: true }, { $set: { isEquipped: false } });
    const result = await collection.findOneAndUpdate({ userId, _id: new mongodb_1.ObjectId(userFrameId), isActive: true }, { $set: { isEquipped: true } }, { returnDocument: 'after', projection: PROJ_LIST });
    return result ? enrichListFrame(result) : null;
}
async function unequipUserFrame(collection, userId, userFrameId) {
    const result = await collection.findOneAndUpdate({ userId, _id: new mongodb_1.ObjectId(userFrameId) }, { $set: { isEquipped: false } }, { returnDocument: 'after', projection: PROJ_LIST });
    return result ? enrichListFrame(result) : null;
}
async function getEquippedFrame(collection, userId) {
    const doc = await collection.findOne({ userId, isEquipped: true, isActive: true }, { projection: PROJ_BASIC });
    return doc ? enrichBasicFrame(doc) : null;
}
async function getActiveFrames(collection, userId, limit) {
    let cursor = collection.find({ userId, isActive: true }, { projection: PROJ_LIST }).sort({ purchaseDate: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListFrame(doc));
}
async function getExpiredFrames(collection, limit) {
    let cursor = collection.find({ isActive: true, expirationDate: { $lt: new Date() } }, { projection: PROJ_LIST }).sort({ expirationDate: 1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListFrame(doc));
}
async function getFramesNearExpiration(collection, days = 7, limit) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    let cursor = collection.find({ isActive: true, expirationDate: { $lte: cutoff, $gte: new Date() } }, { projection: PROJ_LIST }).sort({ expirationDate: 1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListFrame(doc));
}
async function processExpiredFrames(collection) {
    const result = await collection.updateMany({ isActive: true, expirationDate: { $lt: new Date() } }, { $set: { isActive: false, isEquipped: false } });
    return result;
}
async function userHasFrame(collection, userId, frameId) {
    const doc = await collection.findOne({ userId, frameId, isActive: true }, { projection: PROJ_BASIC });
    return doc ? enrichBasicFrame(doc) : null;
}
async function removeUserFrame(collection, userId, userFrameId) {
    const result = await collection.findOneAndDelete({ userId, _id: new mongodb_1.ObjectId(userFrameId) });
    return result;
}
async function extendUserFrame(collection, userFrameId, days) {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    const result = await collection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(userFrameId) }, { $set: { expirationDate: newExpirationDate, isActive: true } }, { returnDocument: 'after', projection: PROJ_LIST });
    return result ? enrichListFrame(result) : null;
}
async function unequipAllUserFrames(collection, userId) {
    const result = await collection.updateMany({ userId }, { $set: { isEquipped: false } });
    return result;
}
async function findFramesPaginated(collection, page = 1, limit = 20, filters) {
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.userId)
        query.userId = filters.userId;
    if (filters?.frameId)
        query.frameId = filters.frameId;
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    if (filters?.isEquipped !== undefined)
        query.isEquipped = filters.isEquipped;
    if (filters?.minExpirationDate || filters?.maxExpirationDate) {
        query.expirationDate = {};
        if (filters?.minExpirationDate)
            query.expirationDate.$gte = filters.minExpirationDate;
        if (filters?.maxExpirationDate)
            query.expirationDate.$lte = filters.maxExpirationDate;
    }
    const [data, total] = await Promise.all([
        collection.find(query, { projection: PROJ_BASIC })
            .sort({ purchaseDate: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        collection.countDocuments(query),
    ]);
    return {
        data: data.map(doc => enrichBasicFrame(doc)),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}
async function getUserFrameStats(collection, userId) {
    const pipeline = [
        { $match: { userId } },
        {
            $group: {
                _id: '$userId',
                totalFrames: { $sum: 1 },
                activeFrames: { $sum: { $cond: ['$isActive', 1, 0] } },
                equippedFrames: { $sum: { $cond: ['$isEquipped', 1, 0] } },
                expiredFrames: { $sum: { $cond: [{ $lt: ['$expirationDate', new Date()] }, 1, 0] } },
                totalPurchases: { $sum: 1 },
                uniqueFrameIds: { $addToSet: '$frameId' },
                lastPurchase: { $max: '$purchaseDate' },
                nextExpiration: {
                    $min: {
                        $filter: {
                            input: '$expirationDate',
                            cond: { $gte: ['$$this', new Date()] },
                        },
                    },
                },
            },
        },
        {
            $project: {
                _id: 0,
                userId: '$_id',
                totalFrames: 1,
                activeFrames: 1,
                equippedFrames: 1,
                expiredFrames: 1,
                totalPurchases: 1,
                uniqueFrameTypes: { $size: '$uniqueFrameIds' },
                lastPurchase: 1,
                nextExpiration: 1,
                activeRate: { $multiply: [{ $divide: ['$activeFrames', '$totalFrames'] }, 100] },
                equippedRate: { $multiply: [{ $divide: ['$equippedFrames', '$totalFrames'] }, 100] },
            },
        },
    ];
    const results = await collection.aggregate(pipeline).toArray();
    return results;
}
async function getUserFrameGlobalStats(collection, days) {
    const matchQuery = {};
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.purchaseDate = { $gte: cutoff };
    }
    const results = await collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalFrames: { $sum: 1 },
                activeFrames: { $sum: { $cond: ['$isActive', 1, 0] } },
                equippedFrames: { $sum: { $cond: ['$isEquipped', 1, 0] } },
                expiredFrames: { $sum: { $cond: [{ $lt: ['$expirationDate', new Date()] }, 1, 0] } },
                totalPurchases: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueFrameTypes: { $addToSet: '$frameId' },
                lastPurchase: { $max: '$purchaseDate' },
            },
        },
        {
            $project: {
                _id: 0,
                totalFrames: 1,
                activeFrames: 1,
                equippedFrames: 1,
                expiredFrames: 1,
                totalPurchases: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                uniqueFrameTypesCount: { $size: '$uniqueFrameTypes' },
                lastPurchase: 1,
                activeRate: { $multiply: [{ $divide: ['$activeFrames', '$totalFrames'] }, 100] },
                equippedRate: { $multiply: [{ $divide: ['$equippedFrames', '$totalFrames'] }, 100] },
            },
        },
    ]).toArray();
    return results;
}
async function findFramesByFrameId(collection, frameId, limit) {
    let cursor = collection.find({ frameId }, { projection: PROJ_LIST }).sort({ purchaseDate: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListFrame(doc));
}
async function renewUserFrame(collection, userFrameId, days) {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    const result = await collection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(userFrameId) }, { $set: { expirationDate: newExpirationDate, isActive: true } }, { returnDocument: 'after', projection: PROJ_LIST });
    return result ? enrichListFrame(result) : null;
}
class UserFrame extends BaseModel_1.BaseModel {
}
exports.UserFrame = UserFrame;
UserFrame.collectionName = 'userframes';
