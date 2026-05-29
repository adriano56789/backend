import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IUserAvatarBasic {
    userId: string;
    avatarId: string;
    imageUrl: string;
    isActive: boolean;
    isCurrent: boolean;
    daysRemaining: number;
    isExpired: boolean;
}

export interface IUserAvatarList {
    userId: string;
    avatarId: string;
    imageUrl: string;
    purchaseDate: Date;
    expirationDate: Date;
    isActive: boolean;
    isCurrent: boolean;
    daysRemaining: number;
    isExpired: boolean;
    createdAt: Date;
}

export interface IUserAvatarDetail {
    userId: string;
    avatarId: string;
    imageUrl: string;
    purchaseDate: Date;
    expirationDate: Date;
    isActive: boolean;
    isCurrent: boolean;
    daysRemaining: number;
    isExpired: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserAvatarFull extends IUserAvatar {
}

export interface IUserAvatar {
    userId: string;
    avatarId: string;
    imageUrl: string;
    purchaseDate: Date;
    expirationDate: Date;
    isActive: boolean;
    isCurrent: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'useravatars';

export async function purchaseAvatar(collection: Collection<any>, userId: string, avatarId: string, imageUrl: string, days: number = 7) {
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

export function findBasic(collection: Collection<any>, userId?: string, limit?: number) {
    const query: any = {};
    if (userId) query.userId = userId;
    const cursor = collection.find(query, {
        projection: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        sort: { purchaseDate: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function findList(collection: Collection<any>, userId?: string, limit?: number, filters?: {
    isActive?: boolean;
    isCurrent?: boolean;
    avatarId?: string;
}) {
    const query: any = {};
    if (userId) query.userId = userId;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isCurrent !== undefined) query.isCurrent = filters.isCurrent;
    if (filters?.avatarId) query.avatarId = filters.avatarId;
    const cursor = collection.find(query, {
        projection: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 },
        sort: { purchaseDate: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function findDetail(collection: Collection<any>, userAvatarId: string) {
    return collection.findOne({ _id: new ObjectId(userAvatarId) }, {
        projection: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1, updatedAt: 1 }
    });
}

export async function setCurrentAvatar(collection: Collection<any>, userId: string, userAvatarId: string, projection: 'basic' | 'list' | 'detail' = 'list') {
    const projections: Record<string, any> = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 },
        detail: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1, updatedAt: 1 }
    };
    const result = await collection.findOneAndUpdate(
        { userId, _id: new ObjectId(userAvatarId), isActive: true },
        { $set: { isCurrent: true } },
        { returnDocument: 'after', projection: projections[projection] }
    );
    return result.value;
}

export function getCurrentAvatar(collection: Collection<any>, userId: string, projection: 'basic' | 'list' | 'detail' = 'basic') {
    const projections: Record<string, any> = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 },
        detail: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.findOne({ userId, isCurrent: true, isActive: true }, { projection: projections[projection] });
}

export function getActiveAvatars(collection: Collection<any>, userId: string, limit?: number, projection: 'basic' | 'list' = 'list') {
    const projections: Record<string, any> = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 }
    };
    const cursor = collection.find({ userId, isActive: true }, {
        projection: projections[projection],
        sort: { purchaseDate: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function getExpiredAvatars(collection: Collection<any>, limit?: number, projection: 'basic' | 'list' = 'list') {
    const projections: Record<string, any> = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 }
    };
    const cursor = collection.find({ isActive: true, expirationDate: { $lt: new Date() } }, {
        projection: projections[projection],
        sort: { expirationDate: 1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function getAvatarsNearExpiration(collection: Collection<any>, days: number = 7, limit?: number, projection: 'basic' | 'list' = 'list') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const projections: Record<string, any> = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 }
    };
    const cursor = collection.find({ isActive: true, expirationDate: { $lte: cutoff, $gte: new Date() } }, {
        projection: projections[projection],
        sort: { expirationDate: 1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export async function processExpiredAvatars(collection: Collection<any>) {
    return collection.updateMany(
        { isActive: true, expirationDate: { $lt: new Date() } },
        { $set: { isActive: false, isCurrent: false } }
    );
}

export function userHasAvatar(collection: Collection<any>, userId: string, avatarId: string, projection: 'basic' | 'list' = 'basic') {
    const projections: Record<string, any> = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 }
    };
    return collection.findOne({ userId, avatarId, isActive: true }, { projection: projections[projection] });
}

export async function removeAvatar(collection: Collection<any>, userId: string, userAvatarId: string) {
    return collection.findOneAndDelete({ userId, _id: new ObjectId(userAvatarId) });
}

export async function extendAvatar(collection: Collection<any>, userAvatarId: string, days: number, projection: 'basic' | 'list' | 'detail' = 'list') {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    const projections: Record<string, any> = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 },
        detail: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1, updatedAt: 1 }
    };
    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(userAvatarId) },
        { $set: { expirationDate: newExpirationDate, isActive: true } },
        { returnDocument: 'after', projection: projections[projection] }
    );
    return result.value;
}

export async function findPaginated(collection: Collection<any>, page: number = 1, limit: number = 20, filters?: {
    userId?: string;
    avatarId?: string;
    isActive?: boolean;
    isCurrent?: boolean;
    minExpirationDate?: Date;
    maxExpirationDate?: Date;
}, projection: 'basic' | 'list' | 'detail' = 'basic') {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.avatarId) query.avatarId = filters.avatarId;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isCurrent !== undefined) query.isCurrent = filters.isCurrent;
    if (filters?.minExpirationDate || filters?.maxExpirationDate) {
        query.expirationDate = {};
        if (filters?.minExpirationDate) query.expirationDate.$gte = filters.minExpirationDate;
        if (filters?.maxExpirationDate) query.expirationDate.$lte = filters.maxExpirationDate;
    }
    const projections: Record<string, any> = {
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

export function getUserAvatarStats(collection: Collection<any>, userId: string) {
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

export function getGlobalStats(collection: Collection<any>, days?: number) {
    const matchQuery: any = {};
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

export function findByAvatarId(collection: Collection<any>, avatarId: string, limit?: number, projection: 'basic' | 'list' = 'list') {
    const projections: Record<string, any> = {
        basic: { userId: 1, avatarId: 1, imageUrl: 1, isActive: 1, isCurrent: 1 },
        list: { userId: 1, avatarId: 1, imageUrl: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isCurrent: 1, createdAt: 1 }
    };
    const cursor = collection.find({ avatarId }, {
        projection: projections[projection],
        sort: { purchaseDate: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function isExpired(doc: IUserAvatar): boolean {
    return doc.expirationDate < new Date();
}

export function isValid(doc: IUserAvatar): boolean {
    return doc.isActive && !isExpired(doc);
}

export function getDaysRemaining(doc: IUserAvatar): number {
    const now = new Date();
    const diffTime = doc.expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

export async function renew(collection: Collection<any>, doc: IUserAvatar, days: number) {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    return collection.updateOne(
        { _id: (doc as any)._id },
        { $set: { expirationDate: newExpirationDate, isActive: true, updatedAt: new Date() } }
    );
}

export async function activate(collection: Collection<any>, doc: IUserAvatar) {
    if (isExpired(doc)) {
        throw new Error('Não é possível ativar avatar expirado');
    }
    return collection.updateOne(
        { _id: (doc as any)._id },
        { $set: { isActive: true, updatedAt: new Date() } }
    );
}

export async function deactivate(collection: Collection<any>, doc: IUserAvatar) {
    return collection.updateOne(
        { _id: (doc as any)._id },
        { $set: { isActive: false, isCurrent: false, updatedAt: new Date() } }
    );
}
export class UserAvatar extends BaseModel<IUserAvatar> {
  static collectionName = 'useravatars';
}
