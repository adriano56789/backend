"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Like = exports.COLLECTION = void 0;
exports.userLikedPhoto = userLikedPhoto;
exports.countByPhoto = countByPhoto;
exports.findByUser = findByUser;
exports.createLike = createLike;
exports.findByPhoto = findByPhoto;
exports.findRecentLikes = findRecentLikes;
exports.countByUser = countByUser;
exports.findByPhotos = findByPhotos;
exports.removeLike = removeLike;
exports.userLikedPhotos = userLikedPhotos;
exports.getLikeStats = getLikeStats;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'likes';
function userLikedPhoto(collection, userId, photoId) {
    return collection.findOne({ userId, photoId }, { projection: { userId: 1, photoId: 1, createdAt: 1, updatedAt: 1 } });
}
function countByPhoto(collection, photoId) {
    return collection.countDocuments({ photoId });
}
function findByUser(collection, userId) {
    return collection.aggregate([
        { $match: { userId } },
        { $lookup: { from: 'photos', localField: 'photoId', foreignField: 'id', as: 'photoId' } },
        { $unwind: { path: '$photoId', preserveNullAndEmptyArrays: true } },
        { $project: { userId: 1, 'photoId.url': 1, 'photoId.caption': 1, createdAt: 1, updatedAt: 1 } },
        { $sort: { createdAt: -1 } }
    ]).toArray();
}
async function createLike(collection, userId, photoId) {
    if (!userId || !photoId) {
        throw new Error('userId e photoId s�o obrigat�rios');
    }
    const existingLike = await collection.findOne({ userId, photoId }, { projection: { userId: 1, photoId: 1 } });
    if (existingLike) {
        throw new Error('Usu�rio j� curtiu esta foto');
    }
    const { insertedId } = await collection.insertOne({ userId, photoId, createdAt: new Date(), updatedAt: new Date() });
    return collection.findOne({ _id: insertedId });
}
function findByPhoto(collection, photoId, limit = 50) {
    return collection.aggregate([
        { $match: { photoId } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: 'id', as: 'userId' } },
        { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
        { $project: { 'userId.username': 1, 'userId.avatar': 1, photoId: 1, createdAt: 1, updatedAt: 1 } },
        { $sort: { createdAt: -1 } },
        { $limit: limit }
    ]).toArray();
}
function findRecentLikes(collection, hours = 24, limit = 20) {
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
function countByUser(collection, userId) {
    return collection.countDocuments({ userId });
}
function findByPhotos(collection, photoIds) {
    return collection.aggregate([
        { $match: { photoId: { $in: photoIds } } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: 'id', as: 'userId' } },
        { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
        { $project: { 'userId.username': 1, 'userId.avatar': 1, photoId: 1, createdAt: 1, updatedAt: 1 } },
        { $sort: { createdAt: -1 } }
    ]).toArray();
}
async function removeLike(collection, userId, photoId) {
    const result = await collection.findOneAndDelete({ userId, photoId }, { projection: { userId: 1, photoId: 1, createdAt: 1, updatedAt: 1 } });
    return result;
}
async function userLikedPhotos(collection, userId, photoIds) {
    const results = await collection.find({ userId, photoId: { $in: photoIds } }, { projection: { userId: 1, photoId: 1 } }).toArray();
    return results.map(like => like.photoId);
}
function getLikeStats(collection, photoId) {
    const matchStage = photoId ? { photoId } : {};
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
class Like extends BaseModel_1.BaseModel {
}
exports.Like = Like;
Like.collectionName = 'likes';
