import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IUserVideoBasic {
    id: string;
    userId: string;
    videoUrl: string;
    thumbnailUrl: string;
    title: string;
    duration: number;
    views: number;
    likes: number;
    comments: number;
    isPublic: boolean;
    postedAt: Date;
    formattedDuration: string;
    engagementRate: number;
}

export interface IUserVideoList {
    id: string;
    userId: string;
    videoUrl: string;
    thumbnailUrl: string;
    title: string;
    description?: string;
    duration: number;
    tags: string[];
    views: number;
    likes: number;
    comments: number;
    isPublic: boolean;
    postedAt: Date;
    createdAt: Date;
    formattedDuration: string;
    engagementRate: number;
}

export interface IUserVideoDetail {
    id: string;
    userId: string;
    videoUrl: string;
    thumbnailUrl: string;
    title: string;
    description?: string;
    duration: number;
    tags: string[];
    views: number;
    likes: number;
    comments: number;
    isPublic: boolean;
    postedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    formattedDuration: string;
    engagementRate: number;
}

export interface IUserVideo {
    id: string;
    userId: string;
    videoUrl: string;
    thumbnailUrl: string;
    title: string;
    description?: string;
    duration: number;
    tags: string[];
    views: number;
    likes: number;
    comments: number;
    isPublic: boolean;
    postedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'uservideos';

const PROJ_BASIC = { id: 1, userId: 1, videoUrl: 1, thumbnailUrl: 1, title: 1, duration: 1, views: 1, likes: 1, comments: 1, isPublic: 1, postedAt: 1, _id: 0 };
const PROJ_LIST = { id: 1, userId: 1, videoUrl: 1, thumbnailUrl: 1, title: 1, description: 1, duration: 1, tags: 1, views: 1, likes: 1, comments: 1, isPublic: 1, postedAt: 1, createdAt: 1, _id: 0 };
const PROJ_DETAIL = { id: 1, userId: 1, videoUrl: 1, thumbnailUrl: 1, title: 1, description: 1, duration: 1, tags: 1, views: 1, likes: 1, comments: 1, isPublic: 1, postedAt: 1, createdAt: 1, updatedAt: 1, _id: 0 };

export function formatVideoDuration(duration: number): string {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function getVideoEngagementRate(video: Pick<IUserVideo, 'views' | 'likes' | 'comments'>): number {
    const totalEngagement = video.views + video.likes + video.comments;
    return totalEngagement > 0 ? Math.round((totalEngagement / 1) * 100) / 100 : 0;
}

function sanitizeTags(tags: any[]): string[] {
    if (!Array.isArray(tags)) return [];
    return tags
        .filter(tag => tag && typeof tag === 'string')
        .map(tag => tag.trim())
        .filter((tag, index, arr) => arr.indexOf(tag) === index);
}

function enrichBasic(video: any): IUserVideoBasic {
    return {
        id: video.id,
        userId: video.userId,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        title: video.title,
        duration: video.duration || 0,
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        isPublic: video.isPublic,
        postedAt: video.postedAt,
        formattedDuration: formatVideoDuration(video.duration || 0),
        engagementRate: getVideoEngagementRate(video),
    };
}

function enrichList(video: any): IUserVideoList {
    return {
        id: video.id,
        userId: video.userId,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        title: video.title,
        description: video.description,
        duration: video.duration || 0,
        tags: video.tags || [],
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        isPublic: video.isPublic,
        postedAt: video.postedAt,
        createdAt: video.createdAt,
        formattedDuration: formatVideoDuration(video.duration || 0),
        engagementRate: getVideoEngagementRate(video),
    };
}

function enrichDetail(video: any): IUserVideoDetail {
    return {
        id: video.id,
        userId: video.userId,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        title: video.title,
        description: video.description,
        duration: video.duration || 0,
        tags: video.tags || [],
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        isPublic: video.isPublic,
        postedAt: video.postedAt,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        formattedDuration: formatVideoDuration(video.duration || 0),
        engagementRate: getVideoEngagementRate(video),
    };
}

export async function createVideo(collection: Collection, videoData: any) {
    const now = new Date();
    const finalData = {
        tags: [],
        views: 0,
        likes: 0,
        comments: 0,
        isPublic: true,
        postedAt: now,
        createdAt: now,
        updatedAt: now,
        ...videoData,
    };
    if (!finalData.postedAt) finalData.postedAt = now;
    await collection.insertOne(finalData);
    return finalData;
}

export async function findVideosBasic(collection: Collection, userId?: string, limit?: number) {
    const query: any = {};
    if (userId) query.userId = userId;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ postedAt: -1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(enrichBasic);
}

export async function findVideosList(collection: Collection, userId?: string, limit?: number) {
    const query: any = {};
    if (userId) query.userId = userId;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ postedAt: -1 });
    if (limit) cursor = cursor.limit(limit);
    const docs = await cursor.toArray();
    return docs.map(enrichList);
}

export async function findVideoDetail(collection: Collection, videoId: string) {
    const doc = await collection.findOne({ id: videoId }, { projection: PROJ_DETAIL });
    return doc ? enrichDetail(doc) : null;
}

export async function findVideoByVideoId(collection: Collection, videoId: string) {
    const doc = await collection.findOne({ id: videoId }, { projection: PROJ_BASIC });
    return doc ? enrichBasic(doc) : null;
}

export async function findVideosByUserId(collection: Collection, userId: string, limit: number = 50) {
    const docs = await collection.find({ userId }, { projection: PROJ_BASIC })
        .sort({ postedAt: -1 })
        .limit(limit)
        .toArray();
    return docs.map(enrichBasic);
}

export async function findPublicVideos(collection: Collection, limit: number = 50) {
    const docs = await collection.find({ isPublic: true }, { projection: PROJ_BASIC })
        .sort({ postedAt: -1 })
        .limit(limit)
        .toArray();
    return docs.map(enrichBasic);
}

export async function findVideosByTags(collection: Collection, tags: string[], limit: number = 50) {
    const docs = await collection.find(
        { isPublic: true, tags: { $in: tags } },
        { projection: PROJ_BASIC }
    ).sort({ postedAt: -1 }).limit(limit).toArray();
    return docs.map(enrichBasic);
}

export async function getPopularVideos(collection: Collection, limit: number = 50) {
    const docs = await collection.find({ isPublic: true }, { projection: PROJ_BASIC })
        .sort({ views: -1, likes: -1 })
        .limit(limit)
        .toArray();
    return docs.map(enrichBasic);
}

export async function searchVideos(collection: Collection, query: string, limit: number = 50) {
    const docs = await collection.find(
        { isPublic: true, $text: { $search: query } },
        { projection: { ...PROJ_BASIC, score: { $meta: 'textScore' } } }
    ).sort({ score: { $meta: 'textScore' } }).limit(limit).toArray();
    return docs.map(enrichBasic);
}

export async function getRecentVideos(collection: Collection, limit: number = 50) {
    const docs = await collection.find({ isPublic: true }, { projection: PROJ_BASIC })
        .sort({ postedAt: -1 })
        .limit(limit)
        .toArray();
    return docs.map(enrichBasic);
}

export async function getTrendingVideos(collection: Collection, limit: number = 50) {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const docs = await collection.find(
        { isPublic: true, postedAt: { $gte: threeDaysAgo } },
        { projection: PROJ_BASIC }
    ).sort({ views: -1, likes: -1, postedAt: -1 }).limit(limit).toArray();
    return docs.map(enrichBasic);
}

export async function findVideosPaginated(collection: Collection, page: number = 1, limit: number = 20, filters?: {
    userId?: string;
    isPublic?: boolean;
    tags?: string[];
    minViews?: number;
    minLikes?: number;
    durationRange?: { min: number; max: number };
    dateRange?: { start: Date; end: Date };
}) {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.isPublic !== undefined) query.isPublic = filters.isPublic;
    if (filters?.tags && filters.tags.length > 0) query.tags = { $in: filters.tags };
    if (filters?.minViews !== undefined) query.views = { $gte: filters.minViews };
    if (filters?.minLikes !== undefined) query.likes = { $gte: filters.minLikes };
    if (filters?.durationRange) {
        query.duration = { $gte: filters.durationRange.min, $lte: filters.durationRange.max };
    }
    if (filters?.dateRange) {
        query.postedAt = { $gte: filters.dateRange.start, $lte: filters.dateRange.end };
    }
    const [data, total] = await Promise.all([
        collection.find(query, { projection: PROJ_BASIC })
            .sort({ postedAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        collection.countDocuments(query),
    ]);
    return {
        data: data.map(enrichBasic),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

export async function getVideoGlobalStats(collection: Collection) {
    const results = await collection.aggregate([
        {
            $group: {
                _id: null,
                totalVideos: { $sum: 1 },
                publicVideos: { $sum: { $cond: ['$isPublic', 1, 0] } },
                privateVideos: { $sum: { $cond: ['$isPublic', 0, 1] } },
                totalViews: { $sum: '$views' },
                totalLikes: { $sum: '$likes' },
                totalComments: { $sum: '$comments' },
                avgViewsPerVideo: { $avg: '$views' },
                avgLikesPerVideo: { $avg: '$likes' },
                avgCommentsPerVideo: { $avg: '$comments' },
                avgDuration: { $avg: '$duration' },
                maxViews: { $max: '$views' },
                maxLikes: { $max: '$likes' },
                maxComments: { $max: '$comments' },
                maxDuration: { $max: '$duration' },
                uniqueUsers: { $addToSet: '$userId' },
                lastPosted: { $max: '$postedAt' },
            },
        },
        {
            $project: {
                _id: 0,
                totalVideos: 1,
                publicVideos: 1,
                privateVideos: 1,
                totalViews: 1,
                totalLikes: 1,
                totalComments: 1,
                avgViewsPerVideo: { $round: ['$avgViewsPerVideo', 2] },
                avgLikesPerVideo: { $round: ['$avgLikesPerVideo', 2] },
                avgCommentsPerVideo: { $round: ['$avgCommentsPerVideo', 2] },
                avgDuration: { $round: ['$avgDuration', 2] },
                maxViews: 1,
                maxLikes: 1,
                maxComments: 1,
                maxDuration: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                publicRate: { $multiply: [{ $divide: ['$publicVideos', '$totalVideos'] }, 100] },
                lastPosted: 1,
            },
        },
    ]).toArray();
    return results;
}

export async function getUserVideoStats(collection: Collection, userId: string) {
    const results = await collection.aggregate([
        { $match: { userId } },
        {
            $group: {
                _id: '$userId',
                totalVideos: { $sum: 1 },
                publicVideos: { $sum: { $cond: ['$isPublic', 1, 0] } },
                privateVideos: { $sum: { $cond: ['$isPublic', 0, 1] } },
                totalViews: { $sum: '$views' },
                totalLikes: { $sum: '$likes' },
                totalComments: { $sum: '$comments' },
                avgViewsPerVideo: { $avg: '$views' },
                avgLikesPerVideo: { $avg: '$likes' },
                avgCommentsPerVideo: { $avg: '$comments' },
                avgDuration: { $avg: '$duration' },
                maxViews: { $max: '$views' },
                maxLikes: { $max: '$likes' },
                maxComments: { $max: '$comments' },
                totalTags: { $sum: { $size: { $ifNull: ['$tags', []] } } },
                uniqueTags: { $addToSet: '$tags' },
                lastPosted: { $max: '$postedAt' },
            },
        },
        {
            $project: {
                _id: 0,
                userId: '$_id',
                totalVideos: 1,
                publicVideos: 1,
                privateVideos: 1,
                totalViews: 1,
                totalLikes: 1,
                totalComments: 1,
                avgViewsPerVideo: { $round: ['$avgViewsPerVideo', 2] },
                avgLikesPerVideo: { $round: ['$avgLikesPerVideo', 2] },
                avgCommentsPerVideo: { $round: ['$avgCommentsPerVideo', 2] },
                avgDuration: { $round: ['$avgDuration', 2] },
                maxViews: 1,
                maxLikes: 1,
                maxComments: 1,
                avgTagsPerVideo: { $round: [{ $divide: ['$totalTags', '$totalVideos'] }, 2] },
                uniqueTagsCount: {
                    $size: {
                        $reduce: {
                            input: { $ifNull: ['$uniqueTags', []] },
                            initialValue: [],
                            in: { $concatArrays: ['$$value', '$$this'] },
                        },
                    },
                },
                lastPosted: 1,
            },
        },
    ]).toArray();
    return results;
}

export async function getVideoTagStats(collection: Collection) {
    const results = await collection.aggregate([
        { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
        { $match: { $and: [{ tags: { $ne: null } }, { tags: { $ne: '' } }] } },
        {
            $group: {
                _id: '$tags',
                count: { $sum: 1 },
                totalViews: { $sum: '$views' },
                totalLikes: { $sum: '$likes' },
                totalComments: { $sum: '$comments' },
                avgViews: { $avg: '$views' },
                avgLikes: { $avg: '$likes' },
                avgComments: { $avg: '$comments' },
                avgDuration: { $avg: '$duration' },
            },
        },
        { $sort: { count: -1 } },
        { $limit: 50 },
        {
            $project: {
                tag: '$_id',
                count: 1,
                totalViews: 1,
                totalLikes: 1,
                totalComments: 1,
                avgViews: { $round: ['$avgViews', 2] },
                avgLikes: { $round: ['$avgLikes', 2] },
                avgComments: { $round: ['$avgComments', 2] },
                avgDuration: { $round: ['$avgDuration', 2] },
                _id: 0,
            },
        },
    ]).toArray();
    return results;
}

export async function getVideoDurationStats(collection: Collection) {
    const results = await collection.aggregate([
        {
            $group: {
                _id: {
                    $switch: {
                        branches: [
                            { case: { $lte: ['$duration', 60] }, then: 'short' },
                            { case: { $lte: ['$duration', 300] }, then: 'medium' },
                            { case: { $lte: ['$duration', 600] }, then: 'long' },
                            { case: { $lte: ['$duration', 1800] }, then: 'veryLong' },
                            { case: { $lte: ['$duration', 3600] }, then: 'extended' },
                        ],
                        default: 'extendedPlus',
                    },
                },
                count: { $sum: 1 },
                totalViews: { $sum: '$views' },
                totalLikes: { $sum: '$likes' },
                totalComments: { $sum: '$comments' },
                avgViews: { $avg: '$views' },
                avgLikes: { $avg: '$likes' },
                avgComments: { $avg: '$comments' },
                avgDuration: { $avg: '$duration' },
            },
        },
        {
            $project: {
                durationCategory: '$_id',
                count: 1,
                totalViews: 1,
                totalLikes: 1,
                totalComments: 1,
                avgViews: { $round: ['$avgViews', 2] },
                avgLikes: { $round: ['$avgLikes', 2] },
                avgComments: { $round: ['$avgComments', 2] },
                avgDuration: { $round: ['$avgDuration', 2] },
                _id: 0,
            },
        },
        { $sort: { count: -1 } },
    ]).toArray();
    return results;
}

export async function addVideoView(collection: Collection, videoId: string) {
    const result = await collection.findOneAndUpdate(
        { id: videoId },
        { $inc: { views: 1 } },
        { returnDocument: 'after', projection: PROJ_BASIC }
    );
    return result ? enrichBasic(result) : null;
}

export async function addVideoLike(collection: Collection, videoId: string) {
    const result = await collection.findOneAndUpdate(
        { id: videoId },
        { $inc: { likes: 1 } },
        { returnDocument: 'after', projection: PROJ_BASIC }
    );
    return result ? enrichBasic(result) : null;
}

export async function removeVideoLike(collection: Collection, videoId: string) {
    const result = await collection.findOneAndUpdate(
        { id: videoId, likes: { $gt: 0 } },
        { $inc: { likes: -1 } },
        { returnDocument: 'after', projection: PROJ_BASIC }
    );
    return result ? enrichBasic(result) : null;
}

export async function addVideoComment(collection: Collection, videoId: string) {
    const result = await collection.findOneAndUpdate(
        { id: videoId },
        { $inc: { comments: 1 } },
        { returnDocument: 'after', projection: PROJ_BASIC }
    );
    return result ? enrichBasic(result) : null;
}

export async function removeVideoComment(collection: Collection, videoId: string) {
    const result = await collection.findOneAndUpdate(
        { id: videoId, comments: { $gt: 0 } },
        { $inc: { comments: -1 } },
        { returnDocument: 'after', projection: PROJ_BASIC }
    );
    return result ? enrichBasic(result) : null;
}

export async function updateVideoTags(collection: Collection, videoId: string, newTags: string[]) {
    const cleanTags = sanitizeTags(newTags);
    const result = await collection.findOneAndUpdate(
        { id: videoId },
        { $set: { tags: cleanTags } },
        { returnDocument: 'after', projection: PROJ_DETAIL }
    );
    return result ? enrichDetail(result) : null;
}

export async function toggleVideoPublic(collection: Collection, videoId: string) {
    const video = await collection.findOne({ id: videoId }, { projection: { isPublic: 1 } });
    if (!video) return null;
    const result = await collection.findOneAndUpdate(
        { id: videoId },
        { $set: { isPublic: !video.isPublic } },
        { returnDocument: 'after', projection: PROJ_BASIC }
    );
    return result ? enrichBasic(result) : null;
}
export class UserVideo extends BaseModel<IUserVideo> {
  static collectionName = 'uservideos';
}
