"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Follow = exports.COLLECTION = void 0;
exports.findFollow = findFollow;
exports.findFollowers = findFollowers;
exports.findFollowing = findFollowing;
exports.createFollow = createFollow;
exports.isFollowing = isFollowing;
exports.unfollowUser = unfollowUser;
exports.countFollowers = countFollowers;
exports.countFollowing = countFollowing;
exports.findRecentFollows = findRecentFollows;
exports.findMutualFollows = findMutualFollows;
exports.unfollow = unfollow;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'follows';
function findFollow(collection, followerId, followingId) {
    return collection.findOne({
        followerId,
        followingId,
        isActive: true
    }, {
        projection: {
            followerId: 1,
            followingId: 1,
            followedAt: 1,
            isActive: 1,
            createdAt: 1,
            updatedAt: 1
        }
    });
}
function findFollowers(collection, userId) {
    return collection.find({
        followingId: userId,
        isActive: true
    }, {
        projection: {
            followerId: 1,
            followingId: 1,
            followedAt: 1,
            isActive: 1,
            createdAt: 1
        }
    })
        .sort({ followedAt: -1 })
        .toArray();
}
function findFollowing(collection, userId) {
    return collection.find({
        followerId: userId,
        isActive: true
    }, {
        projection: {
            followerId: 1,
            followingId: 1,
            followedAt: 1,
            isActive: 1,
            createdAt: 1
        }
    })
        .sort({ followedAt: -1 })
        .toArray();
}
async function createFollow(collection, followerId, followingId) {
    if (!followerId || !followingId) {
        throw new Error('followerId e followingId s�o obrigat�rios');
    }
    if (followerId === followingId) {
        throw new Error('Usu�rio n�o pode seguir a si mesmo');
    }
    const existingFollow = await collection.findOne({
        followerId,
        followingId,
        isActive: true
    }, {
        projection: {
            followerId: 1,
            followingId: 1,
            isActive: 1
        }
    });
    if (existingFollow) {
        throw new Error('J� existe um relacionamento de follow entre estes usu�rios');
    }
    const doc = {
        followerId,
        followingId,
        followedAt: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
}
async function isFollowing(collection, followerId, followingId) {
    const result = await collection.findOne({
        followerId,
        followingId,
        isActive: true
    }, { projection: { followerId: 1, followingId: 1, isActive: 1 } });
    return !!result;
}
async function unfollowUser(collection, followerId, followingId) {
    return collection.findOneAndUpdate({
        followerId,
        followingId,
        isActive: true
    }, {
        $set: {
            isActive: false,
            unfollowedAt: new Date()
        }
    }, {
        returnDocument: 'after',
        projection: {
            followerId: 1,
            followingId: 1,
            isActive: 1,
            unfollowedAt: 1,
            updatedAt: 1
        }
    });
}
function countFollowers(collection, userId) {
    return collection.countDocuments({
        followingId: userId,
        isActive: true
    });
}
function countFollowing(collection, userId) {
    return collection.countDocuments({
        followerId: userId,
        isActive: true
    });
}
function findRecentFollows(collection, limit = 50) {
    return collection.find({
        isActive: true
    }, {
        projection: {
            followerId: 1,
            followingId: 1,
            followedAt: 1,
            createdAt: 1
        }
    })
        .sort({ followedAt: -1 })
        .limit(limit)
        .toArray();
}
function findMutualFollows(collection, userId, otherUserId) {
    return collection.find({
        $or: [
            { followerId: userId, followingId: otherUserId },
            { followerId: otherUserId, followingId: userId }
        ],
        isActive: true
    }, {
        projection: {
            followerId: 1,
            followingId: 1,
            followedAt: 1,
            isActive: 1
        }
    }).toArray();
}
async function unfollow(collection, follow) {
    return collection.findOneAndUpdate({ _id: follow._id }, {
        $set: {
            isActive: false,
            unfollowedAt: new Date()
        }
    }, {
        returnDocument: 'after',
        projection: {
            followerId: 1,
            followingId: 1,
            isActive: 1,
            unfollowedAt: 1,
            updatedAt: 1
        }
    });
}
class Follow extends BaseModel_1.BaseModel {
}
exports.Follow = Follow;
Follow.collectionName = 'follows';
