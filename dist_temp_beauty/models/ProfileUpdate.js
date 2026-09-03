"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileUpdate = exports.COLLECTION = void 0;
exports.createUpdate = createUpdate;
exports.findBasicByUser = findBasicByUser;
exports.findWithValuesByUser = findWithValuesByUser;
exports.findByUser = findByUser;
exports.findByType = findByType;
exports.findLatestByUsers = findLatestByUsers;
exports.getStatsByType = getStatsByType;
exports.countRecentUpdates = countRecentUpdates;
exports.findRecentPaginated = findRecentPaginated;
exports.findByPeriod = findByPeriod;
exports.isRealChange = isRealChange;
exports.getFormattedDescription = getFormattedDescription;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'profileupdates';
async function createUpdate(collection, updateData) {
    const { insertedId } = await collection.insertOne(updateData);
    return { ...updateData, _id: insertedId };
}
async function findBasicByUser(collection, userId, limit) {
    const options = {
        projection: { userId: 1, updateType: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    };
    if (limit)
        options.limit = limit;
    return collection.find({ userId }, options).toArray();
}
async function findWithValuesByUser(collection, userId, limit) {
    const options = {
        projection: { userId: 1, updateType: 1, oldValue: 1, newValue: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    };
    if (limit)
        options.limit = limit;
    return collection.find({ userId }, options).toArray();
}
async function findByUser(collection, userId, limit) {
    const options = {
        sort: { createdAt: -1 }
    };
    if (limit)
        options.limit = limit;
    return collection.find({ userId }, options).toArray();
}
async function findByType(collection, userId, updateType, includeValues = false) {
    const projection = includeValues
        ? { userId: 1, updateType: 1, oldValue: 1, newValue: 1, createdAt: 1, updateReason: 1 }
        : { userId: 1, updateType: 1, createdAt: 1 };
    return collection.find({ userId, updateType }, { projection, sort: { createdAt: -1 } }).toArray();
}
async function findLatestByUsers(collection, userIds, limit = 10) {
    return collection.find({ userId: { $in: userIds } }, {
        projection: { userId: 1, updateType: 1, createdAt: 1 },
        sort: { createdAt: -1 },
        limit
    }).toArray();
}
async function getStatsByType(collection, userId, days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return collection.aggregate([
        { $match: { userId, createdAt: { $gte: cutoff } } },
        { $group: { _id: '$updateType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]).toArray();
}
async function countRecentUpdates(collection, userId, hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return collection.countDocuments({
        userId,
        createdAt: { $gte: cutoff }
    });
}
async function findRecentPaginated(collection, userId, page = 1, limit = 20, includeValues = false) {
    const skip = (page - 1) * limit;
    const projection = includeValues
        ? { userId: 1, updateType: 1, oldValue: 1, newValue: 1, createdAt: 1, updateReason: 1 }
        : { userId: 1, updateType: 1, createdAt: 1 };
    const [data, total] = await Promise.all([
        collection.find({ userId }, { projection, sort: { createdAt: -1 }, skip, limit }).toArray(),
        collection.countDocuments({ userId })
    ]);
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
}
async function findByPeriod(collection, userId, startDate, endDate, projection = 'basic') {
    const projections = {
        basic: { userId: 1, updateType: 1, createdAt: 1 },
        values: { userId: 1, updateType: 1, oldValue: 1, newValue: 1, createdAt: 1 },
        full: { userId: 1, updateType: 1, oldValue: 1, newValue: 1, updateReason: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.find({ userId, createdAt: { $gte: startDate, $lte: endDate } }, { projection: projections[projection], sort: { createdAt: -1 } }).toArray();
}
function isRealChange(update) {
    return update.oldValue !== update.newValue;
}
function getFormattedDescription(update) {
    const typeLabels = {
        avatar: 'Avatar',
        cover: 'Capa',
        info: 'Informa��es',
        settings: 'Configura��es'
    };
    const label = typeLabels[update.updateType] || update.updateType;
    const change = isRealChange(update) ? `de "${update.oldValue}" para "${update.newValue}"` : 'sem mudan�a';
    return `${label}: ${change}${update.updateReason ? ` (${update.updateReason})` : ''}`;
}
class ProfileUpdate extends BaseModel_1.BaseModel {
}
exports.ProfileUpdate = ProfileUpdate;
ProfileUpdate.collectionName = 'profileupdates';
