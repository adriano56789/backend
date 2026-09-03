"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamKeyAssociation = exports.COLLECTION = void 0;
exports.createAssociation = createAssociation;
exports.findBasic = findBasic;
exports.findList = findList;
exports.findDetail = findDetail;
exports.findByStreamKey = findByStreamKey;
exports.findByUserId = findByUserId;
exports.findActive = findActive;
exports.findInactive = findInactive;
exports.findByUsername = findByUsername;
exports.toggleActive = toggleActive;
exports.removeAssociation = removeAssociation;
exports.countByUser = countByUser;
exports.findPaginated = findPaginated;
exports.getStats = getStats;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'streamKeyAssociations';
async function createAssociation(collection, associationData) {
    const result = await collection.findOneAndUpdate({ streamKey: associationData.streamKey }, { $set: { ...associationData, updatedAt: new Date() } }, { upsert: true, returnDocument: 'after' });
    return result.value;
}
function findBasic(collection, limit) {
    const cursor = collection.find({}, {
        projection: { streamKey: 1, userId: 1, username: 1, isActive: 1 },
        sort: { createdAt: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findList(collection, limit, filters) {
    const query = {};
    if (filters?.userId)
        query.userId = filters.userId;
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    const cursor = collection.find(query, {
        projection: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findDetail(collection, streamKey, userId) {
    const query = {};
    if (streamKey)
        query.streamKey = streamKey;
    if (userId)
        query.userId = userId;
    return collection.findOne(query, {
        projection: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
    });
}
function findByStreamKey(collection, streamKey, projection = 'basic') {
    const projections = {
        basic: { streamKey: 1, userId: 1, username: 1, isActive: 1 },
        list: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        detail: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.findOne({ streamKey }, { projection: projections[projection] });
}
function findByUserId(collection, userId, limit = 20, projection = 'basic', activeOnly = false) {
    const query = { userId };
    if (activeOnly)
        query.isActive = true;
    const projections = {
        basic: { streamKey: 1, userId: 1, username: 1, isActive: 1 },
        list: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        detail: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
    };
    const cursor = collection.find(query, {
        projection: projections[projection],
        sort: { createdAt: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findActive(collection, limit) {
    const cursor = collection.find({ isActive: true }, {
        projection: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findInactive(collection, limit) {
    const cursor = collection.find({ isActive: false }, {
        projection: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    });
    if (limit)
        cursor.limit(limit);
    return cursor.toArray();
}
function findByUsername(collection, username, limit = 20, projection = 'basic', activeOnly = true) {
    const query = { username: { $regex: username, $options: 'i' } };
    if (activeOnly)
        query.isActive = true;
    const projections = {
        basic: { streamKey: 1, userId: 1, username: 1, isActive: 1 },
        list: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { createdAt: -1 }
    }).limit(limit).toArray();
}
async function toggleActive(collection, streamKey, isActive) {
    return collection.updateOne({ streamKey }, { $set: { isActive, updatedAt: new Date() } });
}
async function removeAssociation(collection, streamKey) {
    return collection.deleteOne({ streamKey });
}
function countByUser(collection, userId, activeOnly = false) {
    const query = { userId };
    if (activeOnly)
        query.isActive = true;
    return collection.countDocuments(query);
}
async function findPaginated(collection, page = 1, limit = 20, filters, projection = 'basic') {
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.userId)
        query.userId = filters.userId;
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    if (filters?.username)
        query.username = { $regex: filters.username, $options: 'i' };
    const projections = {
        basic: { streamKey: 1, userId: 1, username: 1, isActive: 1 },
        list: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        detail: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
    };
    const [data, total] = await Promise.all([
        collection.find(query, {
            projection: projections[projection],
            sort: { createdAt: -1 },
            skip,
            limit
        }).toArray(),
        collection.countDocuments(query)
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
function getStats(collection, days) {
    const matchQuery = {};
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.createdAt = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalAssociations: { $sum: 1 },
                activeAssociations: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
                inactiveAssociations: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } },
                uniqueUsers: { $addToSet: '$userId' }
            }
        },
        {
            $project: {
                _id: 0,
                totalAssociations: 1,
                activeAssociations: 1,
                inactiveAssociations: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                activationRate: {
                    $multiply: [
                        { $divide: ['$activeAssociations', '$totalAssociations'] },
                        100
                    ]
                }
            }
        }
    ]).toArray();
}
class StreamKeyAssociation extends BaseModel_1.BaseModel {
}
exports.StreamKeyAssociation = StreamKeyAssociation;
StreamKeyAssociation.collectionName = 'streamKeyAssociations';
