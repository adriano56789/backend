"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Comment = exports.COLLECTION = void 0;
exports.createComment = createComment;
exports.findByUser = findByUser;
exports.findReplies = findReplies;
exports.findByTargetType = findByTargetType;
exports.countCommentsByTarget = countCommentsByTarget;
exports.deactivateComment = deactivateComment;
exports.findRecentComments = findRecentComments;
exports.updateLikes = updateLikes;
exports.editContent = editContent;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'comments';
async function createComment(collection, commentData) {
    const defaultData = {
        likes: 0,
        isActive: true,
        isEdited: false
    };
    const finalData = { ...defaultData, ...commentData };
    const result = await collection.insertOne(finalData);
    return { ...finalData, _id: result.insertedId };
}
function findByUser(collection, userId, limit = 50) {
    return collection.find({
        userId,
        isActive: true
    }, {
        projection: {
            userId: 1,
            targetId: 1,
            targetType: 1,
            content: 1,
            parentId: 1,
            likes: 1,
            isActive: 1,
            isEdited: 1,
            editedAt: 1,
            createdAt: 1,
            updatedAt: 1
        }
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
}
function findReplies(collection, parentId, limit = 20) {
    return collection.find({
        parentId,
        isActive: true
    }, {
        projection: {
            userId: 1,
            targetId: 1,
            targetType: 1,
            content: 1,
            parentId: 1,
            likes: 1,
            isActive: 1,
            isEdited: 1,
            editedAt: 1,
            createdAt: 1,
            updatedAt: 1
        }
    })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray();
}
function findByTargetType(collection, targetType, limit = 100) {
    return collection.find({
        targetType,
        isActive: true
    }, {
        projection: {
            userId: 1,
            targetId: 1,
            targetType: 1,
            content: 1,
            likes: 1,
            createdAt: 1
        }
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
}
function countCommentsByTarget(collection, targetId, targetType) {
    return collection.countDocuments({
        targetId,
        targetType,
        isActive: true
    });
}
async function deactivateComment(collection, commentId) {
    return collection.findOneAndUpdate({ _id: commentId }, { $set: { isActive: false } }, {
        returnDocument: 'after',
        projection: {
            userId: 1,
            targetId: 1,
            targetType: 1,
            isActive: 1,
            updatedAt: 1
        }
    });
}
function findRecentComments(collection, limit = 50) {
    return collection.find({
        isActive: true
    }, {
        projection: {
            userId: 1,
            targetId: 1,
            targetType: 1,
            content: 1,
            likes: 1,
            createdAt: 1
        }
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
}
async function updateLikes(collection, comment, increment) {
    return collection.findOneAndUpdate({ _id: comment._id }, {
        $set: {
            likes: Math.max(0, comment.likes + increment)
        }
    }, {
        returnDocument: 'after',
        projection: {
            userId: 1,
            targetId: 1,
            targetType: 1,
            content: 1,
            likes: 1,
            updatedAt: 1
        }
    });
}
async function editContent(collection, comment, newContent) {
    return collection.findOneAndUpdate({ _id: comment._id }, {
        $set: {
            content: newContent,
            isEdited: true,
            editedAt: new Date()
        }
    }, {
        returnDocument: 'after',
        projection: {
            userId: 1,
            targetId: 1,
            targetType: 1,
            content: 1,
            isEdited: 1,
            editedAt: 1,
            updatedAt: 1
        }
    });
}
class Comment extends BaseModel_1.BaseModel {
}
exports.Comment = Comment;
Comment.collectionName = 'comments';
