"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserIndex = exports.COLLECTION = void 0;
exports.createOrUpdateUserIndex = createOrUpdateUserIndex;
exports.findUserIndexesBasic = findUserIndexesBasic;
exports.findUserIndexesList = findUserIndexesList;
exports.findUserIndexDetail = findUserIndexDetail;
exports.searchUserIndexesByName = searchUserIndexesByName;
exports.searchUserIndexesAdvanced = searchUserIndexesAdvanced;
exports.findUserIndexByUserId = findUserIndexByUserId;
exports.findUserIndexById = findUserIndexById;
exports.deactivateUserIndex = deactivateUserIndex;
exports.activateUserIndex = activateUserIndex;
exports.findFriendIndexes = findFriendIndexes;
exports.findActiveUserIndexes = findActiveUserIndexes;
exports.findUserIndexesPaginated = findUserIndexesPaginated;
exports.getUserIndexGlobalStats = getUserIndexGlobalStats;
exports.findRecentlyUpdatedIndexes = findRecentlyUpdatedIndexes;
exports.updateUserIndexData = updateUserIndexData;
exports.toggleUserIndexFriend = toggleUserIndexFriend;
const mongodb_1 = require("mongodb");
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'userindexes';
const PROJ_BASIC = { id: 1, userId: 1, name: 1, displayName: 1, avatarUrl: 1, isActive: 1, _id: 0 };
const PROJ_LIST = { id: 1, userId: 1, identification: 1, name: 1, displayName: 1, avatarUrl: 1, isFriend: 1, isActive: 1, lastUpdated: 1, createdAt: 1, _id: 0 };
const PROJ_DETAIL = { id: 1, userId: 1, identification: 1, name: 1, displayName: 1, avatarUrl: 1, isFriend: 1, isActive: 1, lastUpdated: 1, createdAt: 1, updatedAt: 1, _id: 0 };
function buildSearchTerms(name, displayName) {
    const n = (name || '').toLowerCase();
    const dn = (displayName || '').toLowerCase();
    return [...new Set([
            n,
            dn,
            ...n.split(' '),
            ...dn.split(' '),
        ].filter(Boolean))];
}
async function createOrUpdateUserIndex(collection, userData) {
    const now = new Date();
    const searchTerms = buildSearchTerms(userData.name, userData.displayName);
    const result = await collection.findOneAndUpdate({ userId: userData.userId }, {
        $set: {
            id: userData.id,
            identification: userData.identification,
            name: userData.name,
            displayName: userData.displayName,
            avatarUrl: userData.avatarUrl,
            isFriend: userData.isFriend || false,
            isActive: userData.isActive !== false,
            searchTerms,
            lastUpdated: now,
        },
        $setOnInsert: { createdAt: now },
    }, { upsert: true, returnDocument: 'after', projection: PROJ_LIST });
    return result;
}
async function findUserIndexesBasic(collection, limit, filters) {
    const query = {};
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    if (filters?.isFriend !== undefined)
        query.isFriend = filters.isFriend;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ lastUpdated: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    return cursor.toArray();
}
async function findUserIndexesList(collection, limit, filters) {
    const query = {};
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    if (filters?.isFriend !== undefined)
        query.isFriend = filters.isFriend;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ lastUpdated: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    return cursor.toArray();
}
async function findUserIndexDetail(collection, userIndexId) {
    return collection.findOne({ _id: new mongodb_1.ObjectId(userIndexId) }, { projection: PROJ_DETAIL });
}
async function searchUserIndexesByName(collection, queryStr, limit = 20, filters) {
    const regex = new RegExp(queryStr.toLowerCase(), 'i');
    const andClauses = [
        { $or: [
                { name: regex },
                { displayName: regex },
                { searchTerms: regex },
            ] },
    ];
    if (filters?.isActive !== undefined)
        andClauses.push({ isActive: filters.isActive });
    if (filters?.isFriend !== undefined)
        andClauses.push({ isFriend: filters.isFriend });
    return collection.find({ $and: andClauses }, { projection: PROJ_BASIC }).sort({ lastUpdated: -1 }).limit(limit).toArray();
}
async function searchUserIndexesAdvanced(collection, searchText, limit = 20, filters) {
    const regex = new RegExp(searchText.toLowerCase(), 'i');
    const andClauses = [
        { $or: [
                { name: regex },
                { displayName: regex },
                { identification: regex },
                { searchTerms: regex },
            ] },
    ];
    if (filters?.isActive !== undefined)
        andClauses.push({ isActive: filters.isActive });
    if (filters?.isFriend !== undefined)
        andClauses.push({ isFriend: filters.isFriend });
    return collection.find({ $and: andClauses }, { projection: PROJ_LIST }).sort({ lastUpdated: -1 }).limit(limit).toArray();
}
async function findUserIndexByUserId(collection, userId) {
    return collection.findOne({ userId }, { projection: PROJ_BASIC });
}
async function findUserIndexById(collection, id) {
    return collection.findOne({ id }, { projection: PROJ_BASIC });
}
async function deactivateUserIndex(collection, userId) {
    const result = await collection.updateOne({ userId }, { $set: { isActive: false, lastUpdated: new Date() } });
    return result;
}
async function activateUserIndex(collection, userId) {
    const result = await collection.updateOne({ userId }, { $set: { isActive: true, lastUpdated: new Date() } });
    return result;
}
async function findFriendIndexes(collection, limit) {
    let cursor = collection.find({ isFriend: true, isActive: true }, { projection: PROJ_LIST }).sort({ lastUpdated: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    return cursor.toArray();
}
async function findActiveUserIndexes(collection, limit) {
    let cursor = collection.find({ isActive: true }, { projection: PROJ_LIST }).sort({ lastUpdated: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    return cursor.toArray();
}
async function findUserIndexesPaginated(collection, page = 1, limit = 20, filters) {
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.isActive !== undefined)
        query.isActive = filters.isActive;
    if (filters?.isFriend !== undefined)
        query.isFriend = filters.isFriend;
    const [data, total] = await Promise.all([
        collection.find(query, { projection: PROJ_BASIC })
            .sort({ lastUpdated: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        collection.countDocuments(query),
    ]);
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}
async function getUserIndexGlobalStats(collection) {
    const results = await collection.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
                inactiveUsers: { $sum: { $cond: ['$isActive', 0, 1] } },
                friendUsers: { $sum: { $cond: ['$isFriend', 1, 0] } },
                activeFriends: {
                    $sum: {
                        $cond: [{ $and: ['$isActive', '$isFriend'] }, 1, 0],
                    },
                },
                lastUpdated: { $max: '$lastUpdated' },
                createdAt: { $max: '$createdAt' },
            },
        },
        {
            $project: {
                _id: 0,
                totalUsers: 1,
                activeUsers: 1,
                inactiveUsers: 1,
                friendUsers: 1,
                activeFriends: 1,
                activeRate: { $multiply: [{ $divide: ['$activeUsers', '$totalUsers'] }, 100] },
                friendRate: { $multiply: [{ $divide: ['$friendUsers', '$totalUsers'] }, 100] },
                lastUpdated: 1,
                createdAt: 1,
            },
        },
    ]).toArray();
    return results;
}
async function findRecentlyUpdatedIndexes(collection, hours = 24, limit) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    let cursor = collection.find({ lastUpdated: { $gte: cutoff } }, { projection: PROJ_LIST }).sort({ lastUpdated: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    return cursor.toArray();
}
async function updateUserIndexData(collection, userId, userData) {
    const updates = {};
    if (userData.name)
        updates.name = userData.name;
    if (userData.displayName)
        updates.displayName = userData.displayName;
    if (userData.avatarUrl)
        updates.avatarUrl = userData.avatarUrl;
    if (userData.identification)
        updates.identification = userData.identification;
    if (userData.isFriend !== undefined)
        updates.isFriend = userData.isFriend;
    updates.lastUpdated = new Date();
    if (Object.keys(updates).length > 0) {
        await collection.updateOne({ userId }, { $set: updates });
    }
    return collection.findOne({ userId }, { projection: PROJ_LIST });
}
async function toggleUserIndexFriend(collection, userId) {
    const user = await collection.findOne({ userId });
    if (!user)
        return null;
    const newIsFriend = !user.isFriend;
    await collection.updateOne({ userId }, { $set: { isFriend: newIsFriend, lastUpdated: new Date() } });
    return collection.findOne({ userId }, { projection: PROJ_LIST });
}
class UserIndex extends BaseModel_1.BaseModel {
}
exports.UserIndex = UserIndex;
UserIndex.collectionName = 'userindexes';
