import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IStreamSessionBasic {
    streamId: string;
    hostId: string;
    viewers: number;
    startTime: Date;
    endTime?: Date;
    totalDuration?: number;
    durationFormatted: string;
}

export interface IStreamSessionList {
    streamId: string;
    hostId: string;
    viewers: number;
    coins: number;
    startTime: Date;
    endTime?: Date;
    giftsReceived: number;
    messagesCount: number;
    peakViewers: number;
    totalDuration?: number;
    durationFormatted: string;
}

export interface IStreamSessionDetail {
    streamId: string;
    hostId: string;
    viewers: number;
    coins: number;
    isStreamMuted: boolean;
    isMicrophoneMuted: boolean;
    isAutoFollowEnabled: boolean;
    isAutoPrivateInviteEnabled: boolean;
    startTime: Date;
    endTime?: Date;
    giftsReceived: number;
    messagesCount: number;
    peakViewers: number;
    totalDuration?: number;
    durationFormatted: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IStreamSessionStats {
    streamId: string;
    hostId: string;
    viewers: number;
    coins: number;
    giftsReceived: number;
    messagesCount: number;
    peakViewers: number;
    totalDuration?: number;
    durationFormatted: string;
}

export interface IStreamSessionFull extends IStreamSession {
}

export interface IStreamSession {
    streamId: string;
    hostId: string;
    viewers: number;
    coins: number;
    isStreamMuted: boolean;
    isMicrophoneMuted: boolean;
    isAutoFollowEnabled: boolean;
    isAutoPrivateInviteEnabled: boolean;
    startTime: Date;
    endTime?: Date;
    giftsReceived: number;
    messagesCount: number;
    peakViewers: number;
    totalDuration?: number;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'streamsessions';

export async function findOrCreateSession(collection: Collection<any>, streamId: string, hostId: string) {
    const result = await collection.findOneAndUpdate(
        { streamId, endTime: { $exists: false } },
        {
            $setOnInsert: {
                streamId,
                hostId,
                startTime: new Date(),
                viewers: 0,
                coins: 0,
                giftsReceived: 0,
                messagesCount: 0,
                peakViewers: 0
            }
        },
        { upsert: true, returnDocument: 'after' }
    );
    return result.value;
}

export function findBasic(collection: Collection<any>, limit?: number) {
    const cursor = collection.find({}, {
        projection: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        sort: { startTime: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function findList(collection: Collection<any>, limit?: number, filters?: {
    hostId?: string;
    isStreamMuted?: boolean;
    minViewers?: number;
}) {
    const query: any = {};
    if (filters?.hostId) query.hostId = filters.hostId;
    if (filters?.isStreamMuted !== undefined) query.isStreamMuted = filters.isStreamMuted;
    if (filters?.minViewers) query.viewers = { $gte: filters.minViewers };
    const cursor = collection.find(query, {
        projection: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1 },
        sort: { startTime: -1 }
    });
    if (limit) cursor.limit(limit);
    return cursor.toArray();
}

export function findDetail(collection: Collection<any>, streamId?: string, hostId?: string) {
    const query: any = {};
    if (streamId) query.streamId = streamId;
    if (hostId) query.hostId = hostId;
    return collection.findOne(query, {
        projection: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    });
}

export function findStats(collection: Collection<any>, streamId?: string, hostId?: string) {
    const query: any = {};
    if (streamId) query.streamId = streamId;
    if (hostId) query.hostId = hostId;
    return collection.findOne(query, {
        projection: { streamId: 1, hostId: 1, viewers: 1, coins: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1 }
    });
}

export function findActiveSession(collection: Collection<any>, streamId: string, projection: 'basic' | 'list' | 'detail' = 'basic') {
    const projections: Record<string, any> = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1 },
        detail: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.findOne({ streamId, endTime: { $exists: false } }, { projection: projections[projection] });
}

export function findActiveSessionsByHost(collection: Collection<any>, hostId: string, limit: number = 10, projection: 'basic' | 'list' = 'basic') {
    const projections: Record<string, any> = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1 }
    };
    return collection.find({ hostId, endTime: { $exists: false } }, {
        projection: projections[projection],
        sort: { startTime: -1 }
    }).limit(limit).toArray();
}

export function findEndedSessions(collection: Collection<any>, hostId?: string, limit: number = 50, projection: 'basic' | 'list' = 'basic') {
    const query: any = { endTime: { $exists: true } };
    if (hostId) query.hostId = hostId;
    const projections: Record<string, any> = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { endTime: -1 }
    }).limit(limit).toArray();
}

export async function endSession(collection: Collection<any>, streamId: string) {
    return collection.updateOne(
        { streamId, endTime: { $exists: false } },
        { $set: { endTime: new Date() } }
    );
}

export async function incrementViewers(collection: Collection<any>, streamId: string, delta: number = 1) {
    return collection.updateOne(
        { streamId, endTime: { $exists: false } },
        { $inc: { viewers: delta } }
    );
}

export async function incrementCoins(collection: Collection<any>, streamId: string, delta: number = 1) {
    return collection.updateOne(
        { streamId, endTime: { $exists: false } },
        { $inc: { coins: delta } }
    );
}

export async function incrementGifts(collection: Collection<any>, streamId: string, delta: number = 1) {
    return collection.updateOne(
        { streamId, endTime: { $exists: false } },
        { $inc: { giftsReceived: delta } }
    );
}

export async function incrementMessages(collection: Collection<any>, streamId: string, delta: number = 1) {
    return collection.updateOne(
        { streamId, endTime: { $exists: false } },
        { $inc: { messagesCount: delta } }
    );
}

export async function batchIncrement(collection: Collection<any>, streamId: string, updates: { viewers?: number; coins?: number; giftsReceived?: number; messagesCount?: number }) {
    const incrementOps: any = {};
    if (updates.viewers) incrementOps.viewers = updates.viewers;
    if (updates.coins) incrementOps.coins = updates.coins;
    if (updates.giftsReceived) incrementOps.giftsReceived = updates.giftsReceived;
    if (updates.messagesCount) incrementOps.messagesCount = updates.messagesCount;
    return collection.updateOne(
        { streamId, endTime: { $exists: false } },
        { $inc: incrementOps }
    );
}

export function findHostHistory(collection: Collection<any>, hostId: string, limit: number = 50, projection: 'basic' | 'list' | 'detail' = 'basic', activeOnly: boolean = false) {
    const query: any = { hostId };
    if (activeOnly) query.endTime = { $exists: false };
    const projections: Record<string, any> = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1 },
        detail: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { startTime: -1 }
    }).limit(limit).toArray();
}

export function findByPeriod(collection: Collection<any>, hostId: string, startDate: Date, endDate: Date, projection: 'basic' | 'list' = 'basic') {
    const projections: Record<string, any> = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1 }
    };
    return collection.find({ hostId, startTime: { $gte: startDate, $lte: endDate } }, {
        projection: projections[projection],
        sort: { startTime: -1 }
    }).toArray();
}

export function getHostStats(collection: Collection<any>, hostId: string, days?: number) {
    const matchQuery: any = { hostId };
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.startTime = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$hostId',
                totalSessions: { $sum: 1 },
                totalViewers: { $sum: '$viewers' },
                totalCoins: { $sum: '$coins' },
                totalGifts: { $sum: '$giftsReceived' },
                totalMessages: { $sum: '$messagesCount' },
                avgViewers: { $avg: '$viewers' },
                peakViewers: { $max: '$peakViewers' },
                totalDuration: { $sum: '$totalDuration' },
                lastSession: { $max: '$startTime' },
                firstSession: { $min: '$startTime' },
                activeSessions: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$endTime', null] }, null] }, 1, 0] } },
                endedSessions: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$endTime', null] }, null] }, 1, 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                hostId: '$_id',
                totalSessions: 1,
                totalViewers: 1,
                totalCoins: 1,
                totalGifts: 1,
                totalMessages: 1,
                avgViewers: 1,
                peakViewers: 1,
                totalDuration: 1,
                lastSession: 1,
                firstSession: 1,
                activeSessions: 1,
                endedSessions: 1,
                avgDuration: {
                    $divide: ['$totalDuration', { $subtract: ['$totalSessions', '$activeSessions'] }]
                },
                avgDurationFormatted: {
                    $function: {
                        body: function(duration: number) {
                            if (!duration) return '00:00:00';
                            const hours = Math.floor(duration / 3600);
                            const minutes = Math.floor((duration % 3600) / 60);
                            const seconds = Math.floor(duration % 60);
                            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        },
                        args: ['$avgDuration']
                    }
                }
            }
        }
    ]).toArray();
}

export async function findPaginated(collection: Collection<any>, page: number = 1, limit: number = 20, filters?: {
    hostId?: string;
    isStreamMuted?: boolean;
    minViewers?: number;
    maxViewers?: number;
    startDate?: Date;
    endDate?: Date;
    activeOnly?: boolean;
}, projection: 'basic' | 'list' | 'detail' = 'basic') {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filters?.hostId) query.hostId = filters.hostId;
    if (filters?.isStreamMuted !== undefined) query.isStreamMuted = filters.isStreamMuted;
    if (filters?.minViewers !== undefined || filters?.maxViewers !== undefined) {
        query.viewers = {};
        if (filters?.minViewers !== undefined) query.viewers.$gte = filters.minViewers;
        if (filters?.maxViewers !== undefined) query.viewers.$lte = filters.maxViewers;
    }
    if (filters?.startDate || filters?.endDate) {
        query.startTime = {};
        if (filters?.startDate) query.startTime.$gte = filters.startDate;
        if (filters?.endDate) query.startTime.$lte = filters.endDate;
    }
    if (filters?.activeOnly) query.endTime = { $exists: false };
    const projections: Record<string, any> = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1 },
        detail: { streamId: 1, hostId: 1, viewers: 1, coins: 1, isStreamMuted: 1, isMicrophoneMuted: 1, isAutoFollowEnabled: 1, isAutoPrivateInviteEnabled: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1, createdAt: 1, updatedAt: 1 }
    };
    const [data, total] = await Promise.all([
        collection.find(query, {
            projection: projections[projection],
            sort: { startTime: -1 },
            skip,
            limit
        }).toArray(),
        collection.countDocuments(query)
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export function getGlobalStats(collection: Collection<any>, days?: number) {
    const matchQuery: any = {};
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.startTime = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                totalViewers: { $sum: '$viewers' },
                totalCoins: { $sum: '$coins' },
                totalGifts: { $sum: '$giftsReceived' },
                totalMessages: { $sum: '$messagesCount' },
                avgViewers: { $avg: '$viewers' },
                peakViewers: { $max: '$peakViewers' },
                totalDuration: { $sum: '$totalDuration' },
                uniqueHosts: { $addToSet: '$hostId' },
                activeSessions: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$endTime', null] }, null] }, 1, 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                totalSessions: 1,
                totalViewers: 1,
                totalCoins: 1,
                totalGifts: 1,
                totalMessages: 1,
                avgViewers: 1,
                peakViewers: 1,
                totalDuration: 1,
                uniqueHostsCount: { $size: '$uniqueHosts' },
                activeSessions: 1,
                avgDuration: {
                    $divide: ['$totalDuration', { $subtract: ['$totalSessions', '$activeSessions'] }]
                }
            }
        }
    ]).toArray();
}

export function findPopularSessions(collection: Collection<any>, limit: number = 20, projection: 'basic' | 'list' = 'basic', days?: number) {
    const query: any = {};
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        query.startTime = { $gte: cutoff };
    }
    const projections: Record<string, any> = {
        basic: { streamId: 1, hostId: 1, viewers: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { peakViewers: -1, viewers: -1, startTime: -1 }
    }).limit(limit).toArray();
}

export function findTopEarningSessions(collection: Collection<any>, limit: number = 20, projection: 'basic' | 'list' = 'list', days?: number) {
    const query: any = {};
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        query.startTime = { $gte: cutoff };
    }
    const projections: Record<string, any> = {
        basic: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, totalDuration: 1 },
        list: { streamId: 1, hostId: 1, viewers: 1, coins: 1, startTime: 1, endTime: 1, giftsReceived: 1, messagesCount: 1, peakViewers: 1, totalDuration: 1 }
    };
    return collection.find(query, {
        projection: projections[projection],
        sort: { coins: -1, giftsReceived: -1, startTime: -1 }
    }).limit(limit).toArray();
}

export function isActive(doc: IStreamSession): boolean {
    return !doc.endTime;
}

export function getDurationFormatted(doc: IStreamSession): string {
    if (!doc.totalDuration || doc.totalDuration <= 0) {
        return '00:00:00';
    }
    const hours = Math.floor(doc.totalDuration / 3600);
    const minutes = Math.floor((doc.totalDuration % 3600) / 60);
    const seconds = doc.totalDuration % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export async function end(collection: Collection<any>, streamId: string) {
    return collection.updateOne(
        { streamId, endTime: { $exists: false } },
        { $set: { endTime: new Date() } }
    );
}
export class StreamSession extends BaseModel<IStreamSession> {
  static collectionName = 'streamsessions';
}
