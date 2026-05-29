import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IZoomSettingsBasic {
    userId: string;
    zoomLevel: number;
    isDefault: boolean;
    formattedZoomLevel: string;
}

export interface IZoomSettingsList {
    userId: string;
    zoomLevel: number;
    isDefault: boolean;
    createdAt: Date;
    formattedZoomLevel: string;
    isCustom: boolean;
}

export interface IZoomSettingsDetail {
    userId: string;
    zoomLevel: number;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
    formattedZoomLevel: string;
    isCustom: boolean;
    zoomCategory: string;
}

export interface IZoomSettingsFull extends IZoomSettings {
}

export interface IZoomSettings {
    userId: string;
    zoomLevel: number;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'zoomsettings';

export function getFormattedZoomLevel(settings: Pick<IZoomSettings, 'zoomLevel'>): string {
    return `${settings.zoomLevel}%`;
}

export function isValidZoomLevel(level: number): boolean {
    return level >= 50 && level <= 150;
}

export function getZoomCategory(settings: Pick<IZoomSettings, 'zoomLevel' | 'isDefault'>): string {
    if (settings.isDefault) return 'default';
    if (settings.zoomLevel < 100) return 'reduced';
    if (settings.zoomLevel === 100) return 'standard';
    return 'increased';
}

export function isCustom(settings: Pick<IZoomSettings, 'isDefault'>): boolean {
    return !settings.isDefault;
}

export function validateZoomSettings(settings: Partial<IZoomSettings>): string | null {
    if (!settings.userId || settings.userId.trim().length === 0) {
        return 'userId é obrigatório';
    }
    if (settings.zoomLevel !== undefined && !isValidZoomLevel(settings.zoomLevel)) {
        return 'Nível de zoom deve estar entre 50 e 150';
    }
    return null;
}

export function computeZoomSettingsDerivedFields(settings: IZoomSettings): {
    formattedZoomLevel: string;
    isCustom: boolean;
    zoomCategory: string;
} {
    return {
        formattedZoomLevel: getFormattedZoomLevel(settings),
        isCustom: isCustom(settings),
        zoomCategory: getZoomCategory(settings)
    };
}

export async function createOrUpdateSettings(
    collection: Collection<IZoomSettings>,
    userId: string,
    settings: Partial<IZoomSettings> = {}
): Promise<IZoomSettings> {
    const defaultSettings = {
        zoomLevel: 100,
        isDefault: true
    };

    const updateData = { ...defaultSettings, ...settings, userId };

    const result = await collection.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { upsert: true, returnDocument: 'after' }
    );

    return result!;
}

export async function findBasic(
    collection: Collection<IZoomSettings>,
    userId?: string,
    limit?: number
): Promise<IZoomSettingsBasic[]> {
    const query: any = {};
    if (userId) query.userId = userId;

    const options: any = {
        projection: { userId: 1, zoomLevel: 1, isDefault: 1, _id: 0 },
        sort: { createdAt: -1 }
    };
    if (limit) options.limit = limit;

    const docs = await collection.find(query, options).toArray();
    return docs.map(d => ({
        ...d,
        formattedZoomLevel: getFormattedZoomLevel(d)
    }));
}

export async function findList(
    collection: Collection<IZoomSettings>,
    userId?: string,
    limit?: number
): Promise<IZoomSettingsList[]> {
    const query: any = {};
    if (userId) query.userId = userId;

    const options: any = {
        projection: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1, _id: 0 },
        sort: { createdAt: -1 }
    };
    if (limit) options.limit = limit;

    const docs = await collection.find(query, options).toArray();
    return docs.map(d => ({
        ...d,
        formattedZoomLevel: getFormattedZoomLevel(d),
        isCustom: isCustom(d)
    }));
}

export async function findDetail(
    collection: Collection<IZoomSettings>,
    userId: string
): Promise<IZoomSettingsDetail | null> {
    const doc = await collection.findOne(
        { userId },
        { projection: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1, updatedAt: 1, _id: 0 } }
    );
    if (!doc) return null;
    return {
        ...doc,
        formattedZoomLevel: getFormattedZoomLevel(doc),
        isCustom: isCustom(doc),
        zoomCategory: getZoomCategory(doc)
    };
}

export async function findByUserIdWithProjection(
    collection: Collection<IZoomSettings>,
    userId: string,
    projection: 'basic' | 'list' | 'detail' = 'basic'
): Promise<IZoomSettings | null> {
    const projections: Record<string, Record<string, number>> = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 },
        detail: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1, updatedAt: 1 }
    };

    return collection.findOne(
        { userId },
        { projection: { ...projections[projection], _id: 0 } }
    );
}

export async function findByUserId(
    collection: Collection<IZoomSettings>,
    userId: string,
    projection: 'basic' | 'list' = 'basic'
): Promise<IZoomSettings | null> {
    const projections: Record<string, Record<string, number>> = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 }
    };

    return collection.findOne(
        { userId },
        { projection: { ...projections[projection], _id: 0 } }
    );
}

export async function getDefaultSettings(
    collection: Collection<IZoomSettings>,
    projection: 'basic' | 'list' = 'basic'
): Promise<IZoomSettings | null> {
    const projections: Record<string, Record<string, number>> = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 }
    };

    return collection.findOne(
        { isDefault: true },
        { projection: { ...projections[projection], _id: 0 } }
    );
}

export async function getUsersWithCustomZoom(
    collection: Collection<IZoomSettings>,
    projection: 'basic' | 'list' = 'basic'
): Promise<IZoomSettings[]> {
    const projections: Record<string, Record<string, number>> = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 }
    };

    return collection.find(
        { isDefault: false },
        { projection: { ...projections[projection], _id: 0 }, sort: { zoomLevel: 1 } }
    ).toArray();
}

export async function findPaginated(
    collection: Collection<IZoomSettings>,
    page: number = 1,
    limit: number = 20,
    filters?: {
        userId?: string;
        isDefault?: boolean;
        minZoomLevel?: number;
        maxZoomLevel?: number;
        minDate?: Date;
        maxDate?: Date;
    },
    projection: 'basic' | 'list' = 'basic'
): Promise<{
    data: IZoomSettingsBasic[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.userId) query.userId = filters.userId;
    if (filters?.isDefault !== undefined) query.isDefault = filters.isDefault;
    if (filters?.minZoomLevel !== undefined || filters?.maxZoomLevel !== undefined) {
        query.zoomLevel = {};
        if (filters?.minZoomLevel !== undefined) query.zoomLevel.$gte = filters.minZoomLevel;
        if (filters?.maxZoomLevel !== undefined) query.zoomLevel.$lte = filters.maxZoomLevel;
    }
    if (filters?.minDate || filters?.maxDate) {
        query.createdAt = {};
        if (filters?.minDate) query.createdAt.$gte = filters.minDate;
        if (filters?.maxDate) query.createdAt.$lte = filters.maxDate;
    }

    const projections: Record<string, Record<string, number>> = {
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

export async function getGlobalStats(
    collection: Collection<IZoomSettings>
): Promise<any[]> {
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

export async function getZoomDistribution(
    collection: Collection<IZoomSettings>
): Promise<any[]> {
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

export async function getCustomizationStats(
    collection: Collection<IZoomSettings>
): Promise<any[]> {
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

export async function getUsagePatterns(
    collection: Collection<IZoomSettings>
): Promise<any[]> {
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

export async function getRecentSettings(
    collection: Collection<IZoomSettings>,
    limit: number = 50,
    projection: 'basic' | 'list' = 'basic'
): Promise<IZoomSettingsBasic[]> {
    const projections: Record<string, Record<string, number>> = {
        basic: { userId: 1, zoomLevel: 1, isDefault: 1 },
        list: { userId: 1, zoomLevel: 1, isDefault: 1, createdAt: 1 }
    };

    const docs = await collection.find(
        {},
        { projection: { ...projections[projection], _id: 0 }, sort: { createdAt: -1 }, limit }
    ).toArray();

    return docs.map(d => ({
        ...d,
        formattedZoomLevel: getFormattedZoomLevel(d)
    }));
}

export async function getMostCommonZoomLevels(
    collection: Collection<IZoomSettings>,
    limit: number = 10
): Promise<any[]> {
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

export async function updateZoomLevel(
    collection: Collection<IZoomSettings>,
    doc: IZoomSettings,
    level: number
): Promise<IZoomSettings> {
    if (!isValidZoomLevel(level)) {
        throw new Error('Nível de zoom deve estar entre 50 e 150');
    }

    const updated = { ...doc, zoomLevel: level, isDefault: false };
    await collection.replaceOne({ userId: doc.userId }, updated);
    return updated;
}

export async function resetToDefault(
    collection: Collection<IZoomSettings>,
    doc: IZoomSettings
): Promise<IZoomSettings> {
    const updated = { ...doc, zoomLevel: 100, isDefault: true };
    await collection.replaceOne({ userId: doc.userId }, updated);
    return updated;
}
export class ZoomSettings extends BaseModel<IZoomSettings> {
  static collectionName = 'zoomsettings';
}
