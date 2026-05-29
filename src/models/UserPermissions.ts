import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export enum MediaPermission {
    GRANTED = 'granted',
    DENIED = 'denied',
    PROMPT = 'prompt',
}

export interface IUserPermissionsBasic {
    userId: string;
    camera: MediaPermission;
    microphone: MediaPermission;
}

export interface IUserPermissionsList {
    userId: string;
    camera: MediaPermission;
    microphone: MediaPermission;
    createdAt: Date;
}

export interface IUserPermissionsDetail {
    userId: string;
    camera: MediaPermission;
    microphone: MediaPermission;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserPermissions {
    userId: string;
    camera: MediaPermission;
    microphone: MediaPermission;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'userpermissions';

const PROJ_BASIC = { userId: 1, camera: 1, microphone: 1, _id: 0 };
const PROJ_LIST = { userId: 1, camera: 1, microphone: 1, createdAt: 1, _id: 0 };
const PROJ_DETAIL = { userId: 1, camera: 1, microphone: 1, createdAt: 1, updatedAt: 1, _id: 0 };

export function hasCameraPermission(permissions: Pick<IUserPermissions, 'camera'>): boolean {
    return permissions.camera === MediaPermission.GRANTED;
}

export function hasMicrophonePermission(permissions: Pick<IUserPermissions, 'microphone'>): boolean {
    return permissions.microphone === MediaPermission.GRANTED;
}

export function canAccessMedia(permissions: Pick<IUserPermissions, 'camera' | 'microphone'>, mediaType: 'camera' | 'microphone'): boolean {
    return permissions[mediaType] === MediaPermission.GRANTED;
}

export async function createOrUpdatePermissions(collection: Collection, userId: string, permissions: any = {}) {
    const defaultPermissions = {
        camera: MediaPermission.PROMPT,
        microphone: MediaPermission.PROMPT,
    };
    const updateData = { ...defaultPermissions, ...permissions };
    const result = await collection.findOneAndUpdate(
        { userId },
        { $set: updateData, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, returnDocument: 'after', projection: PROJ_DETAIL }
    );
    return result;
}

export async function findPermissionsBasic(collection: Collection, userId?: string, limit?: number) {
    const query: any = {};
    if (userId) query.userId = userId;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ updatedAt: -1 });
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
}

export async function findPermissionsList(collection: Collection, userId?: string, limit?: number) {
    const query: any = {};
    if (userId) query.userId = userId;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ updatedAt: -1 });
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
}

export async function findPermissionsDetail(collection: Collection, userId: string) {
    return collection.findOne({ userId }, { projection: PROJ_DETAIL });
}

export async function findPermissionsByUserId(collection: Collection, userId: string) {
    return collection.findOne({ userId }, { projection: PROJ_BASIC });
}

export async function findPermissionsByPermission(collection: Collection, mediaType: 'camera' | 'microphone', permission: MediaPermission, limit?: number) {
    const query: any = {};
    query[mediaType] = permission;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ updatedAt: -1 });
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
}

export async function findPermissionsPaginated(collection: Collection, page: number = 1, limit: number = 20, filters?: {
    camera?: MediaPermission;
    microphone?: MediaPermission;
}) {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filters?.camera) query.camera = filters.camera;
    if (filters?.microphone) query.microphone = filters.microphone;
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

export async function getPermissionsGlobalStats(collection: Collection) {
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

export async function getPermissionStats(collection: Collection) {
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

export async function updateUserPermissions(collection: Collection, userId: string, permissions: { camera?: MediaPermission; microphone?: MediaPermission }) {
    const update: any = {};
    if (permissions.camera) update.camera = permissions.camera;
    if (permissions.microphone) update.microphone = permissions.microphone;
    if (Object.keys(update).length === 0) {
        return collection.findOne({ userId }, { projection: PROJ_DETAIL });
    }
    const result = await collection.findOneAndUpdate(
        { userId },
        { $set: update },
        { returnDocument: 'after', projection: PROJ_DETAIL }
    );
    return result;
}

export async function resetUserPermissions(collection: Collection, userId: string) {
    const result = await collection.findOneAndUpdate(
        { userId },
        { $set: { camera: MediaPermission.PROMPT, microphone: MediaPermission.PROMPT } },
        { returnDocument: 'after', projection: PROJ_DETAIL }
    );
    return result;
}
export class UserPermissions extends BaseModel<IUserPermissions> {
  static collectionName = 'userpermissions';
}
