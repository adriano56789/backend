"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPermissions = exports.COLLECTION = exports.MediaPermission = void 0;
exports.hasCameraPermission = hasCameraPermission;
exports.hasMicrophonePermission = hasMicrophonePermission;
exports.canAccessMedia = canAccessMedia;
exports.createOrUpdatePermissions = createOrUpdatePermissions;
exports.findPermissionsBasic = findPermissionsBasic;
exports.findPermissionsList = findPermissionsList;
exports.findPermissionsDetail = findPermissionsDetail;
exports.findPermissionsByUserId = findPermissionsByUserId;
exports.findPermissionsByPermission = findPermissionsByPermission;
exports.findPermissionsPaginated = findPermissionsPaginated;
exports.getPermissionsGlobalStats = getPermissionsGlobalStats;
exports.getPermissionStats = getPermissionStats;
exports.updateUserPermissions = updateUserPermissions;
exports.resetUserPermissions = resetUserPermissions;
const BaseModel_1 = require("../db/BaseModel");
var MediaPermission;
(function (MediaPermission) {
    MediaPermission["GRANTED"] = "granted";
    MediaPermission["DENIED"] = "denied";
    MediaPermission["PROMPT"] = "prompt";
})(MediaPermission || (exports.MediaPermission = MediaPermission = {}));
exports.COLLECTION = 'userpermissions';
const PROJ_BASIC = { userId: 1, camera: 1, microphone: 1, _id: 0 };
const PROJ_LIST = { userId: 1, camera: 1, microphone: 1, createdAt: 1, _id: 0 };
const PROJ_DETAIL = { userId: 1, camera: 1, microphone: 1, createdAt: 1, updatedAt: 1, _id: 0 };
function hasCameraPermission(permissions) {
    return permissions.camera === MediaPermission.GRANTED;
}
function hasMicrophonePermission(permissions) {
    return permissions.microphone === MediaPermission.GRANTED;
}
function canAccessMedia(permissions, mediaType) {
    return permissions[mediaType] === MediaPermission.GRANTED;
}
async function createOrUpdatePermissions(collection, userId, permissions = {}) {
    const defaultPermissions = {
        camera: MediaPermission.PROMPT,
        microphone: MediaPermission.PROMPT,
    };
    const updateData = { ...defaultPermissions, ...permissions };
    const result = await collection.findOneAndUpdate({ userId }, { $set: updateData, $setOnInsert: { createdAt: new Date() } }, { upsert: true, returnDocument: 'after', projection: PROJ_DETAIL });
    return result;
}
async function findPermissionsBasic(collection, userId, limit) {
    const query = {};
    if (userId)
        query.userId = userId;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ updatedAt: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    return cursor.toArray();
}
async function findPermissionsList(collection, userId, limit) {
    const query = {};
    if (userId)
        query.userId = userId;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ updatedAt: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    return cursor.toArray();
}
async function findPermissionsDetail(collection, userId) {
    return collection.findOne({ userId }, { projection: PROJ_DETAIL });
}
async function findPermissionsByUserId(collection, userId) {
    return collection.findOne({ userId }, { projection: PROJ_BASIC });
}
async function findPermissionsByPermission(collection, mediaType, permission, limit) {
    const query = {};
    query[mediaType] = permission;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ updatedAt: -1 });
    if (limit)
        cursor = cursor.limit(limit);
    return cursor.toArray();
}
async function findPermissionsPaginated(collection, page = 1, limit = 20, filters) {
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.camera)
        query.camera = filters.camera;
    if (filters?.microphone)
        query.microphone = filters.microphone;
    const [data, total] = await Promise.all([
        collection.find(query, { projection: PROJ_BASIC })
            .sort({ updatedAt: -1 })
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
async function getPermissionsGlobalStats(collection) {
    const results = await collection.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                cameraGranted: { $sum: { $cond: [{ $eq: ['$camera', MediaPermission.GRANTED] }, 1, 0] } },
                cameraDenied: { $sum: { $cond: [{ $eq: ['$camera', MediaPermission.DENIED] }, 1, 0] } },
                cameraPrompt: { $sum: { $cond: [{ $eq: ['$camera', MediaPermission.PROMPT] }, 1, 0] } },
                microphoneGranted: { $sum: { $cond: [{ $eq: ['$microphone', MediaPermission.GRANTED] }, 1, 0] } },
                microphoneDenied: { $sum: { $cond: [{ $eq: ['$microphone', MediaPermission.DENIED] }, 1, 0] } },
                microphonePrompt: { $sum: { $cond: [{ $eq: ['$microphone', MediaPermission.PROMPT] }, 1, 0] } },
                bothGranted: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ['$camera', MediaPermission.GRANTED] }, { $eq: ['$microphone', MediaPermission.GRANTED] }] },
                            1,
                            0,
                        ],
                    },
                },
                bothDenied: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ['$camera', MediaPermission.DENIED] }, { $eq: ['$microphone', MediaPermission.DENIED] }] },
                            1,
                            0,
                        ],
                    },
                },
                lastUpdated: { $max: '$updatedAt' },
            },
        },
        {
            $project: {
                _id: 0,
                totalUsers: 1,
                cameraGranted: 1,
                cameraDenied: 1,
                cameraPrompt: 1,
                microphoneGranted: 1,
                microphoneDenied: 1,
                microphonePrompt: 1,
                bothGranted: 1,
                bothDenied: 1,
                cameraGrantedRate: { $multiply: [{ $divide: ['$cameraGranted', '$totalUsers'] }, 100] },
                microphoneGrantedRate: { $multiply: [{ $divide: ['$microphoneGranted', '$totalUsers'] }, 100] },
                bothGrantedRate: { $multiply: [{ $divide: ['$bothGranted', '$totalUsers'] }, 100] },
                lastUpdated: 1,
            },
        },
    ]).toArray();
    return results;
}
async function getPermissionStats(collection) {
    const results = await collection.aggregate([
        {
            $group: {
                _id: null,
                cameraStats: { $push: { permission: '$camera', userId: '$userId' } },
                microphoneStats: { $push: { permission: '$microphone', userId: '$userId' } },
            },
        },
        {
            $project: {
                _id: 0,
                cameraBreakdown: {
                    $reduce: {
                        input: '$cameraStats',
                        initialValue: { granted: 0, denied: 0, prompt: 0 },
                        in: {
                            $mergeObjects: [
                                '$$value',
                                {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ['$$this.permission', MediaPermission.GRANTED] }, then: { granted: { $add: ['$$value.granted', 1] } } },
                                            { case: { $eq: ['$$this.permission', MediaPermission.DENIED] }, then: { denied: { $add: ['$$value.denied', 1] } } },
                                            { case: { $eq: ['$$this.permission', MediaPermission.PROMPT] }, then: { prompt: { $add: ['$$value.prompt', 1] } } },
                                        ],
                                        default: {},
                                    },
                                },
                            ],
                        },
                    },
                },
                microphoneBreakdown: {
                    $reduce: {
                        input: '$microphoneStats',
                        initialValue: { granted: 0, denied: 0, prompt: 0 },
                        in: {
                            $mergeObjects: [
                                '$$value',
                                {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ['$$this.permission', MediaPermission.GRANTED] }, then: { granted: { $add: ['$$value.granted', 1] } } },
                                            { case: { $eq: ['$$this.permission', MediaPermission.DENIED] }, then: { denied: { $add: ['$$value.denied', 1] } } },
                                            { case: { $eq: ['$$this.permission', MediaPermission.PROMPT] }, then: { prompt: { $add: ['$$value.prompt', 1] } } },
                                        ],
                                        default: {},
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        },
    ]).toArray();
    return results;
}
async function updateUserPermissions(collection, userId, permissions) {
    const update = {};
    if (permissions.camera)
        update.camera = permissions.camera;
    if (permissions.microphone)
        update.microphone = permissions.microphone;
    if (Object.keys(update).length === 0) {
        return collection.findOne({ userId }, { projection: PROJ_DETAIL });
    }
    const result = await collection.findOneAndUpdate({ userId }, { $set: update }, { returnDocument: 'after', projection: PROJ_DETAIL });
    return result;
}
async function resetUserPermissions(collection, userId) {
    const result = await collection.findOneAndUpdate({ userId }, { $set: { camera: MediaPermission.PROMPT, microphone: MediaPermission.PROMPT } }, { returnDocument: 'after', projection: PROJ_DETAIL });
    return result;
}
class UserPermissions extends BaseModel_1.BaseModel {
}
exports.UserPermissions = UserPermissions;
UserPermissions.collectionName = 'userpermissions';
