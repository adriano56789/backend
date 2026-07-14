"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInventory = exports.COLLECTION = void 0;
exports.isInventoryItemExpired = isInventoryItemExpired;
exports.getInventoryDaysRemaining = getInventoryDaysRemaining;
exports.isInventoryItemValid = isInventoryItemValid;
exports.addInventoryItem = addInventoryItem;
exports.findInventoryBasic = findInventoryBasic;
exports.findInventoryList = findInventoryList;
exports.findInventoryDetail = findInventoryDetail;
exports.equipInventoryItem = equipInventoryItem;
exports.unequipInventoryItem = unequipInventoryItem;
exports.getEquippedItems = getEquippedItems;
exports.getUserInventory = getUserInventory;
exports.findInventoryByType = findInventoryByType;
exports.getExpiredInventoryItems = getExpiredInventoryItems;
exports.getInventoryItemsNearExpiration = getInventoryItemsNearExpiration;
exports.processExpiredInventoryItems = processExpiredInventoryItems;
exports.userHasInventoryItem = userHasInventoryItem;
exports.removeInventoryItem = removeInventoryItem;
exports.extendInventoryItem = extendInventoryItem;
exports.findInventoryPaginated = findInventoryPaginated;
exports.getUserInventoryStats = getUserInventoryStats;
exports.getInventoryGlobalStats = getInventoryGlobalStats;
exports.renewInventoryItem = renewInventoryItem;
const mongodb_1 = require("mongodb");
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'userinventories';
const PROJ_BASIC = { userId: 1, itemId: 1, itemType: 1, isActive: 1, isEquipped: 1, _id: 0 };
const PROJ_LIST = { userId: 1, itemId: 1, itemType: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isEquipped: 1, createdAt: 1, _id: 0 };
const PROJ_DETAIL = { userId: 1, itemId: 1, itemType: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isEquipped: 1, createdAt: 1, updatedAt: 1, _id: 0 };
function isInventoryItemExpired(item) {
    return item.expirationDate ? item.expirationDate < new Date() : false;
}
function getInventoryDaysRemaining(item) {
    if (!item.expirationDate)
        return 0;
    const now = new Date();
    const diffTime = item.expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}
function isInventoryItemValid(item) {
    return item.isActive && !isInventoryItemExpired(item);
}
function enrichBasicItem(frame) {
    return {
        ...frame,
        daysRemaining: getInventoryDaysRemaining(frame),
        isExpired: isInventoryItemExpired(frame),
    };
}
function enrichListItem(frame) {
    return {
        ...frame,
        daysRemaining: getInventoryDaysRemaining(frame),
        isExpired: isInventoryItemExpired(frame),
    };
}
async function addInventoryItem(collection, userId, itemId, itemType, days) {
    const doc = {
        userId,
        itemId,
        itemType,
        purchaseDate: new Date(),
        isActive: true,
        isEquipped: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    if (days) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + days);
        doc.expirationDate = expirationDate;
    }
    await collection.insertOne(doc);
    return doc;
}
async function findInventoryBasic(collection, userId, limit) {
    const query = {};
    if (userId)
        query.userId = userId;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ purchaseDate: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichBasicItem(doc));
}
async function findInventoryList(collection, userId, limit, filters) {
    const query = {};
    if (userId)
        query.userId = userId;
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    if (filters?.isEquipped !== undefined)
        query.isEquipped = filters.isEquipped;
    if (filters?.itemType)
        query.itemType = filters.itemType;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ purchaseDate: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListItem(doc));
}
async function findInventoryDetail(collection, inventoryId) {
    const doc = await collection.findOne({ _id: new mongodb_1.ObjectId(inventoryId) }, { projection: PROJ_DETAIL });
    return doc;
}
async function equipInventoryItem(collection, userId, inventoryId) {
    const item = await collection.findOne({ _id: new mongodb_1.ObjectId(inventoryId), userId });
    if (!item)
        return null;
    if (!isInventoryItemValid(item)) {
        throw new Error('N�o � poss�vel equipar item expirado');
    }
    const itemType = item.itemType;
    await collection.updateMany({ userId, itemType, _id: { $ne: new mongodb_1.ObjectId(inventoryId) }, isEquipped: true }, { $set: { isEquipped: false } });
    const result = await collection.findOneAndUpdate({ userId, _id: new mongodb_1.ObjectId(inventoryId), isActive: true }, { $set: { isEquipped: true } }, { returnDocument: 'after', projection: PROJ_LIST });
    return result ? enrichListItem(result) : null;
}
async function unequipInventoryItem(collection, userId, inventoryId) {
    const result = await collection.findOneAndUpdate({ userId, _id: new mongodb_1.ObjectId(inventoryId) }, { $set: { isEquipped: false } }, { returnDocument: 'after', projection: PROJ_LIST });
    return result ? enrichListItem(result) : null;
}
async function getEquippedItems(collection, userId) {
    const docs = await collection.find({ userId, isEquipped: true, isActive: true }, { projection: PROJ_BASIC }).sort({ itemType: 1, purchaseDate: -1 }).toArray();
    return docs.map(doc => enrichBasicItem(doc));
}
async function getUserInventory(collection, userId, limit, filters) {
    const query = { userId };
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    if (filters?.itemType)
        query.itemType = filters.itemType;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ itemType: 1, purchaseDate: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListItem(doc));
}
async function findInventoryByType(collection, itemType, limit) {
    let cursor = collection.find({ itemType }, { projection: PROJ_LIST }).sort({ purchaseDate: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListItem(doc));
}
async function getExpiredInventoryItems(collection, limit) {
    let cursor = collection.find({ isActive: true, expirationDate: { $lt: new Date() } }, { projection: PROJ_LIST }).sort({ expirationDate: 1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListItem(doc));
}
async function getInventoryItemsNearExpiration(collection, days = 7, limit) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    let cursor = collection.find({ isActive: true, expirationDate: { $lte: cutoff, $gte: new Date() } }, { projection: PROJ_LIST }).sort({ expirationDate: 1 });
    if (limit)
        cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListItem(doc));
}
async function processExpiredInventoryItems(collection) {
    const result = await collection.updateMany({ isActive: true, expirationDate: { $lt: new Date() } }, { $set: { isActive: false, isEquipped: false } });
    return result;
}
async function userHasInventoryItem(collection, userId, itemId) {
    const doc = await collection.findOne({ userId, itemId, isActive: true }, { projection: PROJ_BASIC });
    return doc ? enrichBasicItem(doc) : null;
}
async function removeInventoryItem(collection, userId, inventoryId) {
    const result = await collection.findOneAndDelete({ userId, _id: new mongodb_1.ObjectId(inventoryId) });
    return result;
}
async function extendInventoryItem(collection, inventoryId, days) {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    const result = await collection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(inventoryId) }, { $set: { expirationDate: newExpirationDate, isActive: true } }, { returnDocument: 'after', projection: PROJ_LIST });
    return result ? enrichListItem(result) : null;
}
async function findInventoryPaginated(collection, page = 1, limit = 20, filters) {
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.userId)
        query.userId = filters.userId;
    if (filters?.itemType)
        query.itemType = filters.itemType;
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
        data: data.map(doc => enrichBasicItem(doc)),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}
async function getUserInventoryStats(collection, userId) {
    const results = await collection.aggregate([
        { $match: { userId } },
        {
            $group: {
                _id: '$userId',
                totalItems: { $sum: 1 },
                activeItems: { $sum: { $cond: ['$isActive', 1, 0] } },
                equippedItems: { $sum: { $cond: ['$isEquipped', 1, 0] } },
                expiredItems: { $sum: { $cond: [{ $lt: ['$expirationDate', new Date()] }, 1, 0] } },
                totalPurchases: { $sum: 1 },
                uniqueItemIds: { $addToSet: '$itemId' },
                lastPurchase: { $max: '$purchaseDate' },
                nextExpiration: {
                    $min: {
                        $filter: {
                            input: '$expirationDate',
                            cond: { $gte: ['$$this', new Date()] },
                        },
                    },
                },
                itemTypeStats: { $push: { itemType: '$itemType', count: 1 } },
            },
        },
        {
            $project: {
                _id: 0,
                userId: '$_id',
                totalItems: 1,
                activeItems: 1,
                equippedItems: 1,
                expiredItems: 1,
                totalPurchases: 1,
                uniqueItemTypes: { $size: '$uniqueItemIds' },
                lastPurchase: 1,
                nextExpiration: 1,
                activeRate: { $multiply: [{ $divide: ['$activeItems', '$totalItems'] }, 100] },
                equippedRate: { $multiply: [{ $divide: ['$equippedItems', '$totalItems'] }, 100] },
            },
        },
    ]).toArray();
    return results;
}
async function getInventoryGlobalStats(collection, days) {
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
                totalItems: { $sum: 1 },
                activeItems: { $sum: { $cond: ['$isActive', 1, 0] } },
                equippedItems: { $sum: { $cond: ['$isEquipped', 1, 0] } },
                expiredItems: { $sum: { $cond: [{ $lt: ['$expirationDate', new Date()] }, 1, 0] } },
                totalPurchases: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueItemTypes: { $addToSet: '$itemType' },
                lastPurchase: { $max: '$purchaseDate' },
            },
        },
        {
            $project: {
                _id: 0,
                totalItems: 1,
                activeItems: 1,
                equippedItems: 1,
                expiredItems: 1,
                totalPurchases: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                uniqueItemTypesCount: { $size: '$uniqueItemTypes' },
                lastPurchase: 1,
                activeRate: { $multiply: [{ $divide: ['$activeItems', '$totalItems'] }, 100] },
                equippedRate: { $multiply: [{ $divide: ['$equippedItems', '$totalItems'] }, 100] },
            },
        },
    ]).toArray();
    return results;
}
async function renewInventoryItem(collection, inventoryId, days) {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    const result = await collection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(inventoryId) }, { $set: { expirationDate: newExpirationDate, isActive: true } }, { returnDocument: 'after', projection: PROJ_LIST });
    return result ? enrichListItem(result) : null;
}
class UserInventory extends BaseModel_1.BaseModel {
}
exports.UserInventory = UserInventory;
UserInventory.collectionName = 'userinventories';
