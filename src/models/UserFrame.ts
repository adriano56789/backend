import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IUserFrameBasic {
    userId: string;
    frameId: string;
    isActive: boolean;
    isEquipped: boolean;
    daysRemaining: number;
    isExpired: boolean;
}

export interface IUserFrameList {
    userId: string;
    frameId: string;
    purchaseDate: Date;
    expirationDate: Date;
    isActive: boolean;
    isEquipped: boolean;
    daysRemaining: number;
    isExpired: boolean;
    createdAt: Date;
}

export interface IUserFrameDetail {
    userId: string;
    frameId: string;
    purchaseDate: Date;
    expirationDate: Date;
    isActive: boolean;
    isEquipped: boolean;
    daysRemaining: number;
    isExpired: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserFrameBasicMongo {
    userId: string;
    frameId: string;
    isActive: boolean;
    isEquipped: boolean;
}

export interface IUserFrameListMongo {
    userId: string;
    frameId: string;
    purchaseDate: Date;
    expirationDate: Date;
    isActive: boolean;
    isEquipped: boolean;
    createdAt: Date;
}

export interface IUserFrameDetailMongo {
    userId: string;
    frameId: string;
    purchaseDate: Date;
    expirationDate: Date;
    isActive: boolean;
    isEquipped: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserFrame {
    userId: string;
    frameId: string;
    purchaseDate: Date;
    expirationDate: Date;
    isActive: boolean;
    isEquipped: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'userframes';

const PROJ_BASIC = { userId: 1, frameId: 1, isActive: 1, isEquipped: 1, _id: 0 };
const PROJ_LIST = { userId: 1, frameId: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isEquipped: 1, createdAt: 1, _id: 0 };
const PROJ_DETAIL = { userId: 1, frameId: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isEquipped: 1, createdAt: 1, updatedAt: 1, _id: 0 };
const PROJ_STATS_BASIC = { userId: 1, frameId: 1, isActive: 1, isEquipped: 1 };

export function isFrameExpired(frame: Pick<IUserFrame, 'expirationDate'>): boolean {
    return frame.expirationDate < new Date();
}

export function getFrameDaysRemaining(frame: Pick<IUserFrame, 'expirationDate'>): number {
    const now = new Date();
    const diffTime = frame.expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

export function isFrameValid(frame: Pick<IUserFrame, 'isActive' | 'expirationDate'>): boolean {
    return frame.isActive && !isFrameExpired(frame);
}

export function enrichBasicFrame(frame: IUserFrameBasicMongo): IUserFrameBasic {
    return {
        ...frame,
        daysRemaining: getFrameDaysRemaining(frame as IUserFrame),
        isExpired: isFrameExpired(frame as IUserFrame),
    };
}

export function enrichListFrame(frame: IUserFrameListMongo): IUserFrameList {
    return {
        ...frame,
        daysRemaining: getFrameDaysRemaining(frame as IUserFrame),
        isExpired: isFrameExpired(frame as IUserFrame),
    };
}

export async function purchaseFrame(collection: Collection, userId: string, frameId: string, days: number = 30) {
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

export async function findFramesBasic(collection: Collection, userId?: string, limit?: number) {
    const query: any = {};
    if (userId) query.userId = userId;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ purchaseDate: -1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichBasicFrame(doc as unknown as IUserFrameBasicMongo));
}

export async function findFramesList(collection: Collection, userId?: string, limit?: number, filters?: {
    isActive?: boolean;
    isEquipped?: boolean;
    frameId?: string;
}) {
    const query: any = {};
    if (userId) query.userId = userId;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isEquipped !== undefined) query.isEquipped = filters.isEquipped;
    if (filters?.frameId) query.frameId = filters.frameId;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ purchaseDate: -1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListFrame(doc as unknown as IUserFrameListMongo));
}

export async function findFrameDetail(collection: Collection, userFrameId: string) {
    const doc = await collection.findOne(
        { _id: new ObjectId(userFrameId) },
        { projection: PROJ_DETAIL }
    );
    return doc as unknown as IUserFrameDetail | null;
}

export async function equipUserFrame(collection: Collection, userId: string, userFrameId: string) {
    const frame = await collection.findOne({ _id: new ObjectId(userFrameId), userId });
    if (!frame) return null;
    if (!isFrameValid(frame as any)) {
        throw new Error('N�o � poss�vel equipar frame expirado');
    }
    await collection.updateMany(
        { userId, _id: { $ne: new ObjectId(userFrameId) }, isEquipped: true },
        { $set: { isEquipped: false } }
    );
    const result = await collection.findOneAndUpdate(
        { userId, _id: new ObjectId(userFrameId), isActive: true },
        { $set: { isEquipped: true } },
        { returnDocument: 'after', projection: PROJ_LIST }
    );
    return result ? enrichListFrame(result as any) : null;
}

export async function unequipUserFrame(collection: Collection, userId: string, userFrameId: string) {
    const result = await collection.findOneAndUpdate(
        { userId, _id: new ObjectId(userFrameId) },
        { $set: { isEquipped: false } },
        { returnDocument: 'after', projection: PROJ_LIST }
    );
    return result ? enrichListFrame(result as any) : null;
}

export async function getEquippedFrame(collection: Collection, userId: string) {
    const doc = await collection.findOne(
        { userId, isEquipped: true, isActive: true },
        { projection: PROJ_BASIC }
    );
    return doc ? enrichBasicFrame(doc as any) : null;
}

export async function getActiveFrames(collection: Collection, userId: string, limit?: number) {
    let cursor = collection.find(
        { userId, isActive: true },
        { projection: PROJ_LIST }
    ).sort({ purchaseDate: -1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListFrame(doc as unknown as IUserFrameListMongo));
}

export async function getExpiredFrames(collection: Collection, limit?: number) {
    let cursor = collection.find(
        { isActive: true, expirationDate: { $lt: new Date() } },
        { projection: PROJ_LIST }
    ).sort({ expirationDate: 1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListFrame(doc as unknown as IUserFrameListMongo));
}

export async function getFramesNearExpiration(collection: Collection, days: number = 7, limit?: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    let cursor = collection.find(
        { isActive: true, expirationDate: { $lte: cutoff, $gte: new Date() } },
        { projection: PROJ_LIST }
    ).sort({ expirationDate: 1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListFrame(doc as unknown as IUserFrameListMongo));
}

export async function processExpiredFrames(collection: Collection) {
    const result = await collection.updateMany(
        { isActive: true, expirationDate: { $lt: new Date() } },
        { $set: { isActive: false, isEquipped: false } }
    );
    return result;
}

export async function userHasFrame(collection: Collection, userId: string, frameId: string) {
    const doc = await collection.findOne(
        { userId, frameId, isActive: true },
        { projection: PROJ_BASIC }
    );
    return doc ? enrichBasicFrame(doc as any) : null;
}

export async function removeUserFrame(collection: Collection, userId: string, userFrameId: string) {
    const result = await collection.findOneAndDelete({ userId, _id: new ObjectId(userFrameId) });
    return result;
}

export async function extendUserFrame(collection: Collection, userFrameId: string, days: number) {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(userFrameId) },
        { $set: { expirationDate: newExpirationDate, isActive: true } },
        { returnDocument: 'after', projection: PROJ_LIST }
    );
    return result ? enrichListFrame(result as any) : null;
}

export async function unequipAllUserFrames(collection: Collection, userId: string) {
    const result = await collection.updateMany(
        { userId },
        { $set: { isEquipped: false } }
    );
    return result;
}

export async function findFramesPaginated(collection: Collection, page: number = 1, limit: number = 20, filters?: {
    userId?: string;
    frameId?: string;
    isActive?: boolean;
    isEquipped?: boolean;
    minExpirationDate?: Date;
    maxExpirationDate?: Date;
}) {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.frameId) query.frameId = filters.frameId;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isEquipped !== undefined) query.isEquipped = filters.isEquipped;
    if (filters?.minExpirationDate || filters?.maxExpirationDate) {
        query.expirationDate = {};
        if (filters?.minExpirationDate) query.expirationDate.$gte = filters.minExpirationDate;
        if (filters?.maxExpirationDate) query.expirationDate.$lte = filters.maxExpirationDate;
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
        data: data.map(doc => enrichBasicFrame(doc as unknown as IUserFrameBasicMongo)),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

export async function getUserFrameStats(collection: Collection, userId: string) {
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

export async function getUserFrameGlobalStats(collection: Collection, days?: number) {
    const matchQuery: any = {};
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

export async function findFramesByFrameId(collection: Collection, frameId: string, limit?: number) {
    let cursor = collection.find({ frameId }, { projection: PROJ_LIST }).sort({ purchaseDate: -1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListFrame(doc as unknown as IUserFrameListMongo));
}

export async function renewUserFrame(collection: Collection, userFrameId: string, days: number) {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(userFrameId) },
        { $set: { expirationDate: newExpirationDate, isActive: true } },
        { returnDocument: 'after', projection: PROJ_LIST }
    );
    return result ? enrichListFrame(result as any) : null;
}
export class UserFrame extends BaseModel<IUserFrame> {
  static collectionName = 'userframes';
}
