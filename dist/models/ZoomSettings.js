"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZoomSettings = exports.COLLECTION = void 0;
exports.getFormattedZoomLevel = getFormattedZoomLevel;
exports.isValidZoomLevel = isValidZoomLevel;
exports.getZoomCategory = getZoomCategory;
exports.isCustom = isCustom;
exports.validateZoomSettings = validateZoomSettings;
exports.computeZoomSettingsDerivedFields = computeZoomSettingsDerivedFields;
exports.createOrUpdateSettings = createOrUpdateSettings;
exports.findBasic = findBasic;
exports.findList = findList;
exports.findDetail = findDetail;
exports.findByUserIdWithProjection = findByUserIdWithProjection;
exports.findByUserId = findByUserId;
exports.getDefaultSettings = getDefaultSettings;
exports.getUsersWithCustomZoom = getUsersWithCustomZoom;
exports.findPaginated = findPaginated;
exports.getGlobalStats = getGlobalStats;
exports.getZoomDistribution = getZoomDistribution;
exports.getCustomizationStats = getCustomizationStats;
exports.getUsagePatterns = getUsagePatterns;
exports.getRecentSettings = getRecentSettings;
exports.getMostCommonZoomLevels = getMostCommonZoomLevels;
exports.updateZoomLevel = updateZoomLevel;
exports.resetToDefault = resetToDefault;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'zoomsettings';
function getFormattedZoomLevel(settings) {
    return `${settings.zoomLevel}%`;
}
function isValidZoomLevel(level) {
    return level >= 50 && level <= 150;
}
function getZoomCategory(settings) {
    if (settings.isDefault)
        return 'default';
    if (settings.zoomLevel < 100)
        return 'reduced';
    if (settings.zoomLevel === 100)
        return 'standard';
    return 'increased';
}
function isCustom(settings) {
    return !settings.isDefault;
}
function validateZoomSettings(settings) {
    if (!settings.userId || settings.userId.trim().length === 0) {
        return 'userId � obrigat�rio';
    }
    if (settings.zoomLevel !== undefined && !isValidZoomLevel(settings.zoomLevel)) {
        return 'N�vel de zoom deve estar entre 50 e 150';
    }
    return null;
}
function computeZoomSettingsDerivedFields(settings) {
    return {
        formattedZoomLevel: getFormattedZoomLevel(settings),
        isCustom: isCustom(settings),
        zoomCategory: getZoomCategory(settings)
    };
}
async function createOrUpdateSettings(collection, userId, settings = {}) {
    const defaultSettings = {
        zoomLevel: 100,
        isDefault: true
    };
    const updateData = { ...defaultSettings, ...settings, userId };
    const result = await collection.findOneAndUpdate({ userId }, { $set: updateData }, { upsert: true, returnDocument: 'after' });
    return result;
}
async function findBasic(collection, userId, limit) {
    const query = {};
    if (userId)
        query.userId = userId;
    const options = {
        projection: { userId: 1, zoomLevel: 1, isDefault: 1, _id: 0 },
        sort: { createdAt: -1 }
    };
    if (limit)
        options.limit = limit;
    const docs = await collection.find(query, options).toArray();
    return docs.map(d => ({
        ...d,
        formattedZoomLevel: getFormattedZoomLevel(d)
    }));
}
async function findList(collection, userId, limit) {
    const query = {};
    if (userId)
        query.userId = userId;
    const options = {
        projection: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1, _id: 0 },
        sort: { createdAt: -1 }
    };
    if (limit)
        options.limit = limit;
    const docs = await collection.find(query, options).toArray();
    return docs.map(d => ({
        ...d,
        formattedZoomLevel: getFormattedZoomLevel(d),
        isCustom: isCustom(d)
    }));
}
async function findDetail(collection, userId) {
    const doc = await collection.findOne({ userId }, { projection: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1, updatedAt: 1, _id: 0 } });
    if (!doc)
        return null;
    return {
        ...doc,
        formattedZoomLevel: getFormattedZoomLevel(doc),
        isCustom: isCustom(doc),
        zoomCategory: getZoomCategory(doc)
    };
}
async function findByUserIdWithProjection(collection, userId, projection = 'basic') {
    const projections = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 },
        detail: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.findOne({ userId }, { projection: { ...projections[projection], _id: 0 } });
}
async function findByUserId(collection, userId, projection = 'basic') {
    const projections = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 }
    };
    return collection.findOne({ userId }, { projection: { ...projections[projection], _id: 0 } });
}
async function getDefaultSettings(collection, projection = 'basic') {
    const projections = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 }
    };
    return collection.findOne({ isDefault: true }, { projection: { ...projections[projection], _id: 0 } });
}
async function getUsersWithCustomZoom(collection, projection = 'basic') {
    const projections = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 }
    };
    return collection.find({ isDefault: false }, { projection: { ...projections[projection], _id: 0 }, sort: { zoomLevel: 1 } }).toArray();
}
async function findPaginated(collection, page = 1, limit = 20, filters, projection = 'basic') {
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.userId)
        query.userId = filters.userId;
    if (filters?.isDefault !== undefined)
        query.isDefault = filters.isDefault;
    if (filters?.minZoomLevel !== undefined || filters?.maxZoomLevel !== undefined) {
        query.zoomLevel = {};
        if (filters?.minZoomLevel !== undefined)
            query.zoomLevel.$gte = filters.minZoomLevel;
        if (filters?.maxZoomLevel !== undefined)
            query.zoomLevel.$lte = filters.maxZoomLevel;
    }
    if (filters?.minDate || filters?.maxDate) {
        query.createdAt = {};
        if (filters?.minDate)
            query.createdAt.$gte = filters.minDate;
        if (filters?.maxDate)
            query.createdAt.$lte = filters.maxDate;
    }
    const projections = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 }
    };
    const [data, total] = await Promise.all([
        collection.find(query, {
            projection: { ...projections[projection], _id: 0 },
            sort: { createdAt: -1 },
            skip,
            limit
        }).toArray(),
        collection.countDocuments(query)
    ]);
    return {
        data: data.map(d => ({
            ...d,
            formattedZoomLevel: getFormattedZoomLevel(d)
        })),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
}
async function getGlobalStats(collection) {
    return collection.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                defaultUsers: { $sum: { $cond: ['$isDefault', 1, 0] } },
                customUsers: { $sum: { $cond: ['$isDefault', 0, 1] } },
                avgZoomLevel: { $avg: '$zoomLevel' },
                minZoomLevel: { $min: '$zoomLevel' },
                maxZoomLevel: { $max: '$zoomLevel' },
                zoomLevels: { $addToSet: '$zoomLevel' },
                lastUpdated: { $max: '$updatedAt' },
                firstCreated: { $min: '$createdAt' }
            }
        },
        {
            $project: {
                _id: 0,
                totalUsers: 1,
                defaultUsers: 1,
                customUsers: 1,
                avgZoomLevel: { $round: ['$avgZoomLevel', 2] },
                minZoomLevel: 1,
                maxZoomLevel: 1,
                uniqueZoomLevels: { $size: '$zoomLevels' },
                customizationRate: {
                    $multiply: [
                        { $divide: ['$customUsers', '$totalUsers'] },
                        100
                    ]
                },
                lastUpdated: 1,
                firstCreated: 1
            }
        }
    ]).toArray();
}
async function getZoomDistribution(collection) {
    return collection.aggregate([
        {
            $group: {
                _id: '$zoomLevel',
                count: { $sum: 1 },
                defaultUsers: { $sum: { $cond: ['$isDefault', 1, 0] } },
                customUsers: { $sum: { $cond: ['$isDefault', 0, 1] } }
            }
        },
        {
            $project: {
                zoomLevel: '$_id',
                count: 1,
                defaultUsers: 1,
                customUsers: 1,
                percentage: {
                    $multiply: [
                        { $divide: ['$count', { $sum: '$count' }] },
                        100
                    ]
                },
                _id: 0
            }
        },
        { $sort: { zoomLevel: 1 } }
    ]).toArray();
}
async function getCustomizationStats(collection) {
    return collection.aggregate([
        {
            $group: {
                _id: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$isDefault', true] }, then: 'default' },
                            { case: { $lt: ['$zoomLevel', 100] }, then: 'reduced' },
                            { case: { $eq: ['$zoomLevel', 100] }, then: 'standard' },
                            { case: { $gt: ['$zoomLevel', 100] }, then: 'increased' }
                        ],
                        default: 'unknown'
                    }
                },
                count: { $sum: 1 },
                avgZoomLevel: { $avg: '$zoomLevel' },
                minZoomLevel: { $min: '$zoomLevel' },
                maxZoomLevel: { $max: '$zoomLevel' }
            }
        },
        {
            $project: {
                category: '$_id',
                count: 1,
                avgZoomLevel: { $round: ['$avgZoomLevel', 2] },
                minZoomLevel: 1,
                maxZoomLevel: 1,
                percentage: {
                    $multiply: [
                        { $divide: ['$count', { $sum: '$count' }] },
                        100
                    ]
                },
                _id: 0
            }
        },
        { $sort: { count: -1 } }
    ]).toArray();
}
async function getUsagePatterns(collection) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return collection.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                recentUsers: {
                    $sum: {
                        $cond: [
                            { $gte: ['$createdAt', oneDayAgo] },
                            1,
                            0
                        ]
                    }
                },
                weeklyUsers: {
                    $sum: {
                        $cond: [
                            { $gte: ['$createdAt', oneWeekAgo] },
                            1,
                            0
                        ]
                    }
                },
                monthlyUsers: {
                    $sum: {
                        $cond: [
                            { $gte: ['$createdAt', oneMonthAgo] },
                            1,
                            0
                        ]
                    }
                },
                customUsers: { $sum: { $cond: ['$isDefault', 0, 1] } },
                avgZoomLevel: { $avg: '$zoomLevel' }
            }
        },
        {
            $project: {
                _id: 0,
                totalUsers: 1,
                recentUsers: 1,
                weeklyUsers: 1,
                monthlyUsers: 1,
                customUsers: 1,
                avgZoomLevel: { $round: ['$avgZoomLevel', 2] },
                dailyGrowthRate: {
                    $multiply: [
                        { $divide: ['$recentUsers', '$totalUsers'] },
                        100
                    ]
                },
                weeklyGrowthRate: {
                    $multiply: [
                        { $divide: ['$weeklyUsers', '$totalUsers'] },
                        100
                    ]
                },
                monthlyGrowthRate: {
                    $multiply: [
                        { $divide: ['$monthlyUsers', '$totalUsers'] },
                        100
                    ]
                },
                customizationRate: {
                    $multiply: [
                        { $divide: ['$customUsers', '$totalUsers'] },
                        100
                    ]
                }
            }
        }
    ]).toArray();
}
async function getRecentSettings(collection, limit = 50, projection = 'basic') {
    const projections = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 }
    };
    const docs = await collection.find({}, { projection: { ...projections[projection], _id: 0 }, sort: { createdAt: -1 }, limit }).toArray();
    return docs.map(d => ({
        ...d,
        formattedZoomLevel: getFormattedZoomLevel(d)
    }));
}
async function getMostCommonZoomLevels(collection, limit = 10) {
    return collection.aggregate([
        {
            $group: {
                _id: '$zoomLevel',
                count: { $sum: 1 },
                defaultUsers: { $sum: { $cond: ['$isDefault', 1, 0] } },
                customUsers: { $sum: { $cond: ['$isDefault', 0, 1] } }
            }
        },
        {
            $project: {
                zoomLevel: '$_id',
                count: 1,
                defaultUsers: 1,
                customUsers: 1,
                percentage: {
                    $multiply: [
                        { $divide: ['$count', { $sum: '$count' }] },
                        100
                    ]
                },
                _id: 0
            }
        },
        { $sort: { count: -1 } },
        { $limit: limit }
    ]).toArray();
}
async function updateZoomLevel(collection, doc, level) {
    if (!isValidZoomLevel(level)) {
        throw new Error('N�vel de zoom deve estar entre 50 e 150');
    }
    const updated = { ...doc, zoomLevel: level, isDefault: false };
    await collection.replaceOne({ userId: doc.userId }, updated);
    return updated;
}
async function resetToDefault(collection, doc) {
    const updated = { ...doc, zoomLevel: 100, isDefault: true };
    await collection.replaceOne({ userId: doc.userId }, updated);
    return updated;
}
class ZoomSettings extends BaseModel_1.BaseModel {
}
exports.ZoomSettings = ZoomSettings;
ZoomSettings.collectionName = 'zoomsettings';
