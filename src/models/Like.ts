import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface ILike {
    userId: string;
    photoId: string;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'likes';

export function userLikedPhoto(collection: Collection<ILike>, userId: string, photoId: string) {
    return collection.findOne(
        { userId, photoId },
        { projection: { userId: 1, photoId: 1, createdAt: 1, updatedAt: 1 } }
    );
}

export function countByPhoto(collection: Collection<ILike>, photoId: string) {
    return collection.countDocuments({ photoId });
}

export function findByUser(collection: Collection<ILike>, userId: string) {
    return collection.aggregate([
        { $match: { userId } },
        { $lookup: { from: 'photos', localField: 'photoId', foreignField: 'id', as: 'photoId' } },
        { $unwind: { path: '$photoId', preserveNullAndEmptyArrays: true } },
        { $project: { userId: 1, 'photoId.url': 1, 'photoId.caption': 1, createdAt: 1, updatedAt: 1 } },
        { $sort: { createdAt: -1 } }
    ]).toArray();
}

export async function createLike(collection: Collection<ILike>, userId: string, photoId: string) {
    if (!userId || !photoId) {
        throw new Error('userId e photoId s�o obrigat�rios');
    }

    const existingLike = await collection.findOne(
        { userId, photoId },
        { projection: { userId: 1, photoId: 1 } }
    );
    if (existingLike) {
        throw new Error('Usu�rio j� curtiu esta foto');
    }

    const { insertedId } = await collection.insertOne({ userId, photoId, createdAt: new Date(), updatedAt: new Date() });
    return collection.findOne({ _id: insertedId });
}

export function findByPhoto(collection: Collection<ILike>, photoId: string, limit = 50) {
    return collection.aggregate([
        { $match: { photoId } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: 'id', as: 'userId' } },
        { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
        { $project: { 'userId.username': 1, 'userId.avatar': 1, photoId: 1, createdAt: 1, updatedAt: 1 } },
        { $sort: { createdAt: -1 } },
        { $limit: limit }
    ]).toArray();
}

export function findRecentLikes(collection: Collection<ILike>, hours = 24, limit = 20) {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    return collection.aggregate([
        { $match: { createdAt: { $gte: cutoffDate } } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: 'id', as: 'userId' } },
        { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'photos', localField: 'photoId', foreignField: 'id', as: 'photoId' } },
        { $unwind: { path: '$photoId', preserveNullAndEmptyArrays: true } },
        { $project: { 'userId.username': 1, 'userId.avatar': 1, 'photoId.url': 1, 'photoId.caption': 1, createdAt: 1, updatedAt: 1 } },
        { $sort: { createdAt: -1 } },
        { $limit: limit }
    ]).toArray();
}

export function countByUser(collection: Collection<ILike>, userId: string) {
    return collection.countDocuments({ userId });
}

export function findByPhotos(collection: Collection<ILike>, photoIds: string[]) {
    return collection.aggregate([
        { $match: { photoId: { $in: photoIds } } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: 'id', as: 'userId' } },
        { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
        { $project: { 'userId.username': 1, 'userId.avatar': 1, photoId: 1, createdAt: 1, updatedAt: 1 } },
        { $sort: { createdAt: -1 } }
    ]).toArray();
}

export async function removeLike(collection: Collection<ILike>, userId: string, photoId: string) {
    const result = await collection.findOneAndDelete(
        { userId, photoId },
        { projection: { userId: 1, photoId: 1, createdAt: 1, updatedAt: 1 } }
    );
    return result;
}

export async function userLikedPhotos(collection: Collection<ILike>, userId: string, photoIds: string[]) {
    const results = await collection.find(
        { userId, photoId: { $in: photoIds } },
        { projection: { userId: 1, photoId: 1 } }
    ).toArray();
    return results.map(like => like.photoId);
}

export function getLikeStats(collection: Collection<ILike>, photoId?: string) {
    const matchStage: any = photoId ? { photoId } : {};

    return collection.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: photoId ? '$photoId' : null,
                totalLikes: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                firstLike: { $min: '$createdAt' },
                lastLike: { $max: '$createdAt' }
            }
        },
        {
            $addFields: {
                uniqueUsersCount: { $size: '$uniqueUsers' }
            }
        },
        {
            $project: {
                uniqueUsers: 0
            }
        }
    ]).toArray();
}
export class Like extends BaseModel<ILike> {
  static collectionName = 'likes';
}
