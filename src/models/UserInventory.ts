import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export type ItemType = 'mochila' | 'quadro' | 'carro' | 'bolha' | 'anel' | 'avatar';

export interface IUserInventoryBasic {
    userId: string;
    itemId: string;
    itemType: ItemType;
    isActive: boolean;
    isEquipped: boolean;
    daysRemaining?: number;
    isExpired?: boolean;
}

export interface IUserInventoryList {
    userId: string;
    itemId: string;
    itemType: ItemType;
    purchaseDate: Date;
    expirationDate?: Date;
    isActive: boolean;
    isEquipped: boolean;
    daysRemaining?: number;
    isExpired?: boolean;
    createdAt: Date;
}

export interface IUserInventoryDetail {
    userId: string;
    itemId: string;
    itemType: ItemType;
    purchaseDate: Date;
    expirationDate?: Date;
    isActive: boolean;
    isEquipped: boolean;
    daysRemaining?: number;
    isExpired?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserInventoryBasicMongo {
    userId: string;
    itemId: string;
    itemType: ItemType;
    isActive: boolean;
    isEquipped: boolean;
}

export interface IUserInventoryListMongo {
    userId: string;
    itemId: string;
    itemType: ItemType;
    purchaseDate: Date;
    expirationDate?: Date;
    isActive: boolean;
    isEquipped: boolean;
    createdAt: Date;
}

export interface IUserInventoryDetailMongo {
    userId: string;
    itemId: string;
    itemType: ItemType;
    purchaseDate: Date;
    expirationDate?: Date;
    isActive: boolean;
    isEquipped: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserInventory {
    userId: string;
    itemId: string;
    itemType: ItemType;
    purchaseDate: Date;
    expirationDate?: Date;
    isActive: boolean;
    isEquipped: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'userinventories';

const PROJ_BASIC = { userId: 1, itemId: 1, itemType: 1, isActive: 1, isEquipped: 1, _id: 0 };
const PROJ_LIST = { userId: 1, itemId: 1, itemType: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isEquipped: 1, createdAt: 1, _id: 0 };
const PROJ_DETAIL = { userId: 1, itemId: 1, itemType: 1, purchaseDate: 1, expirationDate: 1, isActive: 1, isEquipped: 1, createdAt: 1, updatedAt: 1, _id: 0 };

export function isInventoryItemExpired(item: Pick<IUserInventory, 'expirationDate'>): boolean {
    return item.expirationDate ? item.expirationDate < new Date() : false;
}

export function getInventoryDaysRemaining(item: Pick<IUserInventory, 'expirationDate'>): number {
    if (!item.expirationDate) return 0;
    const now = new Date();
    const diffTime = item.expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

export function isInventoryItemValid(item: Pick<IUserInventory, 'isActive' | 'expirationDate'>): boolean {
    return item.isActive && !isInventoryItemExpired(item);
}

function enrichBasicItem(frame: IUserInventoryBasicMongo): IUserInventoryBasic {
    return {
        ...frame,
        daysRemaining: getInventoryDaysRemaining(frame as any),
        isExpired: isInventoryItemExpired(frame as any),
    };
}

function enrichListItem(frame: IUserInventoryListMongo): IUserInventoryList {
    return {
        ...frame,
        daysRemaining: getInventoryDaysRemaining(frame as any),
        isExpired: isInventoryItemExpired(frame as any),
    };
}

export async function addInventoryItem(collection: Collection, userId: string, itemId: string, itemType: string, days?: number) {
    const doc: any = {
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

export async function findInventoryBasic(collection: Collection, userId?: string, limit?: number) {
    const query: any = {};
    if (userId) query.userId = userId;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ purchaseDate: -1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichBasicItem(doc as unknown as IUserInventoryBasicMongo));
}

export async function findInventoryList(collection: Collection, userId?: string, limit?: number, filters?: {
    isActive?: boolean;
    isEquipped?: boolean;
    itemType?: string;
}) {
    const query: any = {};
    if (userId) query.userId = userId;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isEquipped !== undefined) query.isEquipped = filters.isEquipped;
    if (filters?.itemType) query.itemType = filters.itemType;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ purchaseDate: -1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListItem(doc as unknown as IUserInventoryListMongo));
}

export async function findInventoryDetail(collection: Collection, inventoryId: string) {
    const doc = await collection.findOne(
        { _id: new ObjectId(inventoryId) },
        { projection: PROJ_DETAIL }
    );
    return doc as IUserInventoryDetail | null;
}

export async function equipInventoryItem(collection: Collection, userId: string, inventoryId: string) {
    const item = await collection.findOne({ _id: new ObjectId(inventoryId), userId });
    if (!item) return null;
    if (!isInventoryItemValid(item as any)) {
        throw new Error('N�o � poss�vel equipar item expirado');
    }
    const itemType = (item as any).itemType;
    await collection.updateMany(
        { userId, itemType, _id: { $ne: new ObjectId(inventoryId) }, isEquipped: true },
        { $set: { isEquipped: false } }
    );
    const result = await collection.findOneAndUpdate(
        { userId, _id: new ObjectId(inventoryId), isActive: true },
        { $set: { isEquipped: true } },
        { returnDocument: 'after', projection: PROJ_LIST }
    );
    return result ? enrichListItem(result as any) : null;
}

export async function unequipInventoryItem(collection: Collection, userId: string, inventoryId: string) {
    const result = await collection.findOneAndUpdate(
        { userId, _id: new ObjectId(inventoryId) },
        { $set: { isEquipped: false } },
        { returnDocument: 'after', projection: PROJ_LIST }
    );
    return result ? enrichListItem(result as any) : null;
}

export async function getEquippedItems(collection: Collection, userId: string) {
    const docs = await collection.find(
        { userId, isEquipped: true, isActive: true },
        { projection: PROJ_BASIC }
    ).sort({ itemType: 1, purchaseDate: -1 }).toArray();
    return docs.map(doc => enrichBasicItem(doc as unknown as IUserInventoryBasicMongo));
}

export async function getUserInventory(collection: Collection, userId: string, limit?: number, filters?: {
    isActive?: boolean;
    itemType?: string;
}) {
    const query: any = { userId };
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.itemType) query.itemType = filters.itemType;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ itemType: 1, purchaseDate: -1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListItem(doc as unknown as IUserInventoryListMongo));
}

export async function findInventoryByType(collection: Collection, itemType: string, limit?: number) {
    let cursor = collection.find({ itemType }, { projection: PROJ_LIST }).sort({ purchaseDate: -1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListItem(doc as unknown as IUserInventoryListMongo));
}

export async function getExpiredInventoryItems(collection: Collection, limit?: number) {
    let cursor = collection.find(
        { isActive: true, expirationDate: { $lt: new Date() } },
        { projection: PROJ_LIST }
    ).sort({ expirationDate: 1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListItem(doc as unknown as IUserInventoryListMongo));
}

export async function getInventoryItemsNearExpiration(collection: Collection, days: number = 7, limit?: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    let cursor = collection.find(
        { isActive: true, expirationDate: { $lte: cutoff, $gte: new Date() } },
        { projection: PROJ_LIST }
    ).sort({ expirationDate: 1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(doc => enrichListItem(doc as unknown as IUserInventoryListMongo));
}

export async function processExpiredInventoryItems(collection: Collection) {
    const result = await collection.updateMany(
        { isActive: true, expirationDate: { $lt: new Date() } },
        { $set: { isActive: false, isEquipped: false } }
    );
    return result;
}

export async function userHasInventoryItem(collection: Collection, userId: string, itemId: string) {
    const doc = await collection.findOne(
        { userId, itemId, isActive: true },
        { projection: PROJ_BASIC }
    );
    return doc ? enrichBasicItem(doc as any) : null;
}

export async function removeInventoryItem(collection: Collection, userId: string, inventoryId: string) {
    const result = await collection.findOneAndDelete({ userId, _id: new ObjectId(inventoryId) });
    return result;
}

export async function extendInventoryItem(collection: Collection, inventoryId: string, days: number) {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(inventoryId) },
        { $set: { expirationDate: newExpirationDate, isActive: true } },
        { returnDocument: 'after', projection: PROJ_LIST }
    );
    return result ? enrichListItem(result as any) : null;
}

export async function findInventoryPaginated(collection: Collection, page: number = 1, limit: number = 20, filters?: {
    userId?: string;
    itemType?: string;
    isActive?: boolean;
    isEquipped?: boolean;
    minExpirationDate?: Date;
    maxExpirationDate?: Date;
}) {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.itemType) query.itemType = filters.itemType;
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
        data: data.map(doc => enrichBasicItem(doc as unknown as IUserInventoryBasicMongo)),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

export async function getUserInventoryStats(collection: Collection, userId: string) {
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

export async function getInventoryGlobalStats(collection: Collection, days?: number) {
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

export async function renewInventoryItem(collection: Collection, inventoryId: string, days: number) {
    const newExpirationDate = new Date();
    newExpirationDate.setDate(newExpirationDate.getDate() + days);
    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(inventoryId) },
        { $set: { expirationDate: newExpirationDate, isActive: true } },
        { returnDocument: 'after', projection: PROJ_LIST }
    );
    return result ? enrichListItem(result as any) : null;
}
export class UserInventory extends BaseModel<IUserInventory> {
  static collectionName = 'userinventories';
}
