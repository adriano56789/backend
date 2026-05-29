import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IStreamKeyAssociationBasic {
    streamKey: string;
    userId: string;
    username: string;
    isActive: boolean;
}

export interface IStreamKeyAssociationList {
    streamKey: string;
    userId: string;
    username: string;
    avatar: string;
    title: string;
    isActive: boolean;
    createdAt: Date;
}

export interface IStreamKeyAssociationDetail {
    streamKey: string;
    userId: string;
    username: string;
    avatar: string;
    title: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IStreamKeyAssociationFull extends IStreamKeyAssociation {
}

export interface IStreamKeyAssociation {
    streamKey: string;
    userId: string;
    username: string;
    avatar: string;
    title: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'streamKeyAssociations';

export async function createAssociation(collection: Collection<any>, associationData: any) {
    const result = await collection.findOneAndUpdate(
        { streamKey: associationData.streamKey },
        { $set: { ...associationData, updatedAt: new Date() } },
        { upsert: true, returnDocument: 'after' }
    );
    return result.value;
}

export function findBasic(collection: Collection<any>, limit?: number) {
    const cursor = collection.find({}, {
        projection: { streamKey: 1, userId: 1, username: 1, isActive: 1 },
        sort: { createdAt: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function findList(collection: Collection<any>, limit?: number, filters?: {
    userId?: string;
    isActive?: boolean;
}) {
    const query: any = {};
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    const cursor = collection.find(query, {
        projection: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function findDetail(collection: Collection<any>, streamKey?: string, userId?: string) {
    const query: any = {};
    if (streamKey) query.streamKey = streamKey;
    if (userId) query.userId = userId;
    return collection.findOne(query, {
        projection: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
    });
}

export function findByStreamKey(collection: Collection<any>, streamKey: string, projection: 'basic' | 'list' | 'detail' = 'basic') {
    const projections: Record<string, any> = {
        basic: { streamKey: 1, userId: 1, username: 1, isActive: 1 },
        list: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        detail: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.findOne({ streamKey }, { projection: projections[projection] });
}

export function findByUserId(collection: Collection<any>, userId: string, limit: number = 20, projection: 'basic' | 'list' | 'detail' = 'basic', activeOnly: boolean = false) {
    const query: any = { userId };
    if (activeOnly) query.isActive = true;
    const projections: Record<string, any> = {
        basic: { streamKey: 1, userId: 1, username: 1, isActive: 1 },
        list: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        detail: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
    };
    const cursor = collection.find(query, {
        projection: projections[projection],
        sort: { createdAt: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function findActive(collection: Collection<any>, limit?: number) {
    const cursor = collection.find({ isActive: true }, {
        projection: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function findInactive(collection: Collection<any>, limit?: number) {
    const cursor = collection.find({ isActive: false }, {
        projection: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function findByUsername(collection: Collection<any>, username: string, limit: number = 20, projection: 'basic' | 'list' = 'basic', activeOnly: boolean = true) {
    const query: any = { username: { $regex: username, $options: 'i' } };
    if (activeOnly) query.isActive = true;
    const projections: Record<string, any> = {
        basic: { streamKey: 1, userId: 1, username: 1, isActive: 1 },
        list: { streamKey: 1, userId: 1, username: 1, avatar: 1, title: 1, isActive: 1, createdAt: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { createdAt: -1 }
    }).limit(limit).toArray();
}

export async function toggleActive(collection: Collection<any>, streamKey: string, isActive: boolean) {
    return collection.updateOne(
        { streamKey },
        { $set: { isActive, updatedAt: new Date() } }
    );
}

export async function removeAssociation(collection: Collection<any>, streamKey: string) {
    return collection.deleteOne({ streamKey });
}

export function countByUser(collection: Collection<any>, userId: string, activeOnly: boolean = false) {
    const query: any = { userId };
    if (activeOnly) query.isActive = true;
    return collection.countDocuments(query);
}

export async function findPaginated(collection: Collection<any>, page: number = 1, limit: number = 20, filters?: {
    userId?: string;
    isActive?: boolean;
    username?: string;
}, projection: 'basic' | 'list' | 'detail' = 'basic') {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.username) query.username = { $regex: filters.username, $options: 'i' };
    const projections: Record<string, any> = {
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

export function getStats(collection: Collection<any>, days?: number) {
    const matchQuery: any = {};
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
export class StreamKeyAssociation extends BaseModel<IStreamKeyAssociation> {
  static collectionName = 'streamKeyAssociations';
}
