import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IStreamLikeBasic {
    streamId: string;
    userId: string;
    timestamp: Date;
}

export interface IStreamLikeList {
    streamId: string;
    userId: string;
    timestamp: Date;
    createdAt: Date;
}

export interface IStreamLikeDetail {
    streamId: string;
    userId: string;
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IStreamLikeFull extends IStreamLike {
}

export interface IStreamLike {
    streamId: string;
    userId: string;
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'streamlikes';

export async function likeStream(collection: Collection<any>, streamId: string, userId: string) {
    const result = await collection.findOneAndUpdate(
        { streamId, userId },
        { $setOnInsert: { streamId, userId, timestamp: new Date() } },
        { upsert: true, returnDocument: 'after' }
    );
    return result.value;
}

export async function unlikeStream(collection: Collection<any>, streamId: string, userId: string) {
    return collection.findOneAndDelete({ streamId, userId });
}

export function hasUserLiked(collection: Collection<any>, streamId: string, userId: string) {
    return collection.findOne({ streamId, userId }, {
        projection: { streamId: 1, userId: 1, timestamp: 1 }
    });
}

export function countByStream(collection: Collection<any>, streamId: string) {
    return collection.countDocuments({ streamId });
}

export function countByUser(collection: Collection<any>, userId: string) {
    return collection.countDocuments({ userId });
}

export function findRecentByStream(collection: Collection<any>, streamId: string, limit: number = 50, projection: 'basic' | 'list' = 'basic') {
    const projections: Record<string, any> = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    return collection.find({ streamId }, {
        projection: projections[projection],
        sort: { timestamp: -1 }
    }).limit(limit).toArray();
}

export function findStreamsLikedByUser(collection: Collection<any>, userId: string, limit: number = 50, projection: 'basic' | 'list' = 'basic') {
    const projections: Record<string, any> = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    return collection.find({ userId }, {
        projection: projections[projection],
        sort: { timestamp: -1 }
    }).limit(limit).toArray();
}

export function findByPeriod(collection: Collection<any>, streamId: string, startDate: Date, endDate: Date, projection: 'basic' | 'list' = 'basic') {
    const projections: Record<string, any> = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    return collection.find({ streamId, timestamp: { $gte: startDate, $lte: endDate } }, {
        projection: projections[projection],
        sort: { timestamp: -1 }
    }).toArray();
}

export function getStreamStats(collection: Collection<any>, streamId: string, days?: number) {
    const matchQuery: any = { streamId };
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.timestamp = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$streamId',
                totalLikes: { $sum: 1 },
                firstLike: { $min: '$timestamp' },
                lastLike: { $max: '$timestamp' },
                recentLikes: {
                    $sum: {
                        $cond: {
                            if: { $gte: ['$timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
                            then: 1,
                            else: 0
                        }
                    }
                },
                uniqueUsers: { $addToSet: '$userId' }
            }
        },
        {
            $project: {
                _id: 0,
                streamId: '$_id',
                totalLikes: 1,
                firstLike: 1,
                lastLike: 1,
                recentLikes: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                avgLikesPerDay: {
                    $divide: [
                        '$totalLikes',
                        { $divide: [{ $subtract: [new Date(), '$firstLike'] }, 1000 * 60 * 60 * 24] }
                    ]
                }
            }
        }
    ]).toArray();
}

export function getUserStats(collection: Collection<any>, userId: string, days?: number) {
    const matchQuery: any = { userId };
    if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        matchQuery.timestamp = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$userId',
                totalLikes: { $sum: 1 },
                firstLike: { $min: '$timestamp' },
                lastLike: { $max: '$timestamp' },
                uniqueStreams: { $addToSet: '$streamId' }
            }
        },
        {
            $project: {
                _id: 0,
                userId: '$_id',
                totalLikes: 1,
                firstLike: 1,
                lastLike: 1,
                uniqueStreamsCount: { $size: '$uniqueStreams' },
                avgLikesPerDay: {
                    $divide: [
                        '$totalLikes',
                        { $divide: [{ $subtract: [new Date(), '$firstLike'] }, 1000 * 60 * 60 * 24] }
                    ]
                }
            }
        }
    ]).toArray();
}

export async function findPaginated(collection: Collection<any>, page: number = 1, limit: number = 20, filters?: {
    streamId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
}, projection: 'basic' | 'list' = 'basic') {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filters?.streamId) query.streamId = filters.streamId;
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.startDate || filters?.endDate) {
        query.timestamp = {};
        if (filters?.startDate) query.timestamp.$gte = filters.startDate;
        if (filters?.endDate) query.timestamp.$lte = filters.endDate;
    }
    const projections: Record<string, any> = {
        basic: { streamId: 1, userId: 1, timestamp: 1 },
        list: { streamId: 1, userId: 1, timestamp: 1, createdAt: 1 }
    };
    const [data, total] = await Promise.all([
        collection.find(query, {
            projection: projections[projection],
            sort: { timestamp: -1 },
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
        matchQuery.timestamp = { $gte: cutoff };
    }
    return collection.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalLikes: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueStreams: { $addToSet: '$streamId' },
                firstLike: { $min: '$timestamp' },
                lastLike: { $max: '$timestamp' }
            }
        },
        {
            $project: {
                _id: 0,
                totalLikes: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                uniqueStreamsCount: { $size: '$uniqueStreams' },
                firstLike: 1,
                lastLike: 1,
                avgLikesPerDay: {
                    $divide: [
                        '$totalLikes',
                        { $divide: [{ $subtract: [new Date(), '$firstLike'] }, 1000 * 60 * 60 * 24] }
                    ]
                }
            }
        }
    ]).toArray();
}

export function isRecent(doc: IStreamLike, hours: number = 24): boolean {
    const now = new Date();
    const hoursDiff = (now.getTime() - doc.timestamp.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= hours;
}

export function getTimestampFormatted(doc: IStreamLike): string {
    return doc.timestamp.toISOString();
}

export function getTimeAgo(doc: IStreamLike): string {
    const now = new Date();
    const diff = now.getTime() - doc.timestamp.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d atrás`;
    if (hours > 0) return `${hours % 24}h atrás`;
    if (minutes > 0) return `${minutes % 60}m atrás`;
    return `${seconds % 60}s atrás`;
}
export class StreamLike extends BaseModel<IStreamLike> {
  static collectionName = 'streamlikes';
}
