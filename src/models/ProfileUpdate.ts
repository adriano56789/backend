import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IProfileUpdateBasic {
    userId: string;
    updateType: string;
    createdAt: Date;
}

export interface IProfileUpdateWithValues {
    userId: string;
    updateType: string;
    oldValue?: string;
    newValue: string;
    createdAt: Date;
}

export interface IProfileUpdateFull extends IProfileUpdate {
}

export interface IProfileUpdate {
    userId: string;
    updateType: 'avatar' | 'cover' | 'info' | 'settings';
    oldValue?: string;
    newValue: string;
    updateReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'profileupdates';

export async function createUpdate(collection: Collection<IProfileUpdate>, updateData: any): Promise<IProfileUpdate> {
    const { insertedId } = await collection.insertOne(updateData);
    return { ...updateData, _id: insertedId } as unknown as IProfileUpdate;
}

export async function findBasicByUser(collection: Collection<IProfileUpdate>, userId: string, limit?: number): Promise<IProfileUpdateBasic[]> {
    const options: any = {
        projection: { userId: 1, updateType: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    };
    if (limit) options.limit = limit;
    return collection.find({ userId }, options).toArray();
}

export async function findWithValuesByUser(collection: Collection<IProfileUpdate>, userId: string, limit?: number): Promise<IProfileUpdateWithValues[]> {
    const options: any = {
        projection: { userId: 1, updateType: 1, oldValue: 1, newValue: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    };
    if (limit) options.limit = limit;
    return collection.find({ userId }, options).toArray();
}

export async function findByUser(collection: Collection<IProfileUpdate>, userId: string, limit?: number): Promise<IProfileUpdate[]> {
    const options: any = {
        sort: { createdAt: -1 }
    };
    if (limit) options.limit = limit;
    return collection.find({ userId }, options).toArray();
}

export async function findByType(collection: Collection<any>, userId: string, updateType: string, includeValues: boolean = false): Promise<any[]> {
    const projection = includeValues
        ? { userId: 1, updateType: 1, oldValue: 1, newValue: 1, createdAt: 1, updateReason: 1 }
        : { userId: 1, updateType: 1, createdAt: 1 };
    return collection.find(
        { userId, updateType },
        { projection, sort: { createdAt: -1 } }
    ).toArray();
}

export async function findLatestByUsers(collection: Collection<IProfileUpdate>, userIds: string[], limit: number = 10): Promise<any[]> {
    return collection.find(
        { userId: { $in: userIds } },
        {
            projection: { userId: 1, updateType: 1, createdAt: 1 },
            sort: { createdAt: -1 },
            limit
        }
    ).toArray();
}

export async function getStatsByType(collection: Collection<IProfileUpdate>, userId: string, days: number = 30): Promise<any[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return collection.aggregate([
        { $match: { userId, createdAt: { $gte: cutoff } } },
        { $group: { _id: '$updateType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]).toArray();
}

export async function countRecentUpdates(collection: Collection<IProfileUpdate>, userId: string, hours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return collection.countDocuments({
        userId,
        createdAt: { $gte: cutoff }
    });
}

export async function findRecentPaginated(
    collection: Collection<IProfileUpdate>,
    userId: string,
    page: number = 1,
    limit: number = 20,
    includeValues: boolean = false
): Promise<{ data: any[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
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

export async function findByPeriod(
    collection: Collection<IProfileUpdate>,
    userId: string,
    startDate: Date,
    endDate: Date,
    projection: 'basic' | 'values' | 'full' = 'basic'
): Promise<any[]> {
    const projections: Record<string, any> = {
        basic: { userId: 1, updateType: 1, createdAt: 1 },
        values: { userId: 1, updateType: 1, oldValue: 1, newValue: 1, createdAt: 1 },
        full: { userId: 1, updateType: 1, oldValue: 1, newValue: 1, updateReason: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.find(
        { userId, createdAt: { $gte: startDate, $lte: endDate } },
        { projection: projections[projection], sort: { createdAt: -1 } }
    ).toArray();
}

export function isRealChange(update: IProfileUpdate): boolean {
    return update.oldValue !== update.newValue;
}

export function getFormattedDescription(update: IProfileUpdate): string {
    const typeLabels: Record<string, string> = {
        avatar: 'Avatar',
        cover: 'Capa',
        info: 'Informa��es',
        settings: 'Configura��es'
    };
    const label = typeLabels[update.updateType] || update.updateType;
    const change = isRealChange(update) ? `de "${update.oldValue}" para "${update.newValue}"` : 'sem mudan�a';
    return `${label}: ${change}${update.updateReason ? ` (${update.updateReason})` : ''}`;
}
export class ProfileUpdate extends BaseModel<IProfileUpdate> {
  static collectionName = 'profileupdates';
}
