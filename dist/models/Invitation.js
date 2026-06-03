"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Invitation = exports.COLLECTION = void 0;
exports.findByUser = findByUser;
exports.findPending = findPending;
exports.createInvitation = createInvitation;
exports.findByType = findByType;
exports.findExpired = findExpired;
exports.findByStatus = findByStatus;
exports.acceptInvitation = acceptInvitation;
exports.rejectInvitation = rejectInvitation;
exports.countByStatus = countByStatus;
exports.findRecentInvitations = findRecentInvitations;
exports.hasActiveInvitation = hasActiveInvitation;
exports.acceptInvitationById = acceptInvitationById;
exports.rejectInvitationById = rejectInvitationById;
exports.isInvitationExpired = isInvitationExpired;
const mongodb_1 = require("mongodb");
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'invitations';
function findByUser(collection, userId, type = 'received') {
    const query = type === 'sent'
        ? { fromUserId: userId }
        : { toUserId: userId };
    return collection.aggregate([
        { $match: query },
        { $lookup: { from: 'users', localField: 'fromUserId', foreignField: 'id', as: 'fromUserId' } },
        { $unwind: { path: '$fromUserId', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'toUserId', foreignField: 'id', as: 'toUserId' } },
        { $unwind: { path: '$toUserId', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                'fromUserId.username': 1, 'fromUserId.avatar': 1,
                'toUserId.username': 1, 'toUserId.avatar': 1,
                type: 1, message: 1, data: 1, status: 1, expiresAt: 1, createdAt: 1, updatedAt: 1
            }
        },
        { $sort: { createdAt: -1 } }
    ]).toArray();
}
function findPending(collection, userId) {
    return collection.aggregate([
        { $match: { toUserId: userId, status: 'pending', expiresAt: { $gt: new Date() } } },
        { $lookup: { from: 'users', localField: 'fromUserId', foreignField: 'id', as: 'fromUserId' } },
        { $unwind: { path: '$fromUserId', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                'fromUserId.username': 1, 'fromUserId.avatar': 1,
                toUserId: 1, type: 1, message: 1, data: 1, status: 1, expiresAt: 1, createdAt: 1, updatedAt: 1
            }
        },
        { $sort: { createdAt: -1 } }
    ]).toArray();
}
async function createInvitation(collection, invitationData) {
    const defaultData = {
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
    const finalData = { ...defaultData, ...invitationData };
    const { insertedId } = await collection.insertOne(finalData);
    return collection.findOne({ _id: insertedId });
}
function findByType(collection, userId, type, userType = 'received') {
    const query = userType === 'sent'
        ? { fromUserId: userId, type }
        : { toUserId: userId, type };
    return collection.aggregate([
        { $match: query },
        { $lookup: { from: 'users', localField: 'fromUserId', foreignField: 'id', as: 'fromUserId' } },
        { $unwind: { path: '$fromUserId', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'toUserId', foreignField: 'id', as: 'toUserId' } },
        { $unwind: { path: '$toUserId', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                'fromUserId.username': 1, 'fromUserId.avatar': 1,
                'toUserId.username': 1, 'toUserId.avatar': 1,
                type: 1, message: 1, data: 1, status: 1, expiresAt: 1, createdAt: 1, updatedAt: 1
            }
        },
        { $sort: { createdAt: -1 } }
    ]).toArray();
}
function findExpired(collection, userId) {
    const query = { expiresAt: { $lt: new Date() }, status: 'pending' };
    if (userId) {
        query.$or = [{ fromUserId: userId }, { toUserId: userId }];
    }
    return collection.aggregate([
        { $match: query },
        { $lookup: { from: 'users', localField: 'fromUserId', foreignField: 'id', as: 'fromUserId' } },
        { $unwind: { path: '$fromUserId', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'toUserId', foreignField: 'id', as: 'toUserId' } },
        { $unwind: { path: '$toUserId', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                'fromUserId.username': 1, 'fromUserId.avatar': 1,
                'toUserId.username': 1, 'toUserId.avatar': 1,
                type: 1, message: 1, data: 1, status: 1, expiresAt: 1, createdAt: 1, updatedAt: 1
            }
        },
        { $sort: { expiresAt: -1 } }
    ]).toArray();
}
function findByStatus(collection, status, userId) {
    const query = { status };
    if (userId) {
        query.$or = [{ fromUserId: userId }, { toUserId: userId }];
    }
    return collection.aggregate([
        { $match: query },
        { $lookup: { from: 'users', localField: 'fromUserId', foreignField: 'id', as: 'fromUserId' } },
        { $unwind: { path: '$fromUserId', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'toUserId', foreignField: 'id', as: 'toUserId' } },
        { $unwind: { path: '$toUserId', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                'fromUserId.username': 1, 'fromUserId.avatar': 1,
                'toUserId.username': 1, 'toUserId.avatar': 1,
                type: 1, message: 1, data: 1, status: 1, expiresAt: 1, createdAt: 1, updatedAt: 1
            }
        },
        { $sort: { createdAt: -1 } }
    ]).toArray();
}
async function acceptInvitation(collection, invitationId) {
    const result = await collection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(invitationId) }, { $set: { status: 'accepted' } }, { returnDocument: 'after', projection: { fromUserId: 1, toUserId: 1, type: 1, message: 1, data: 1, status: 1, updatedAt: 1 } });
    return result;
}
async function rejectInvitation(collection, invitationId) {
    const result = await collection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(invitationId) }, { $set: { status: 'rejected' } }, { returnDocument: 'after', projection: { fromUserId: 1, toUserId: 1, type: 1, message: 1, data: 1, status: 1, updatedAt: 1 } });
    return result;
}
function countByStatus(collection, userId, status) {
    const query = { $or: [{ fromUserId: userId }, { toUserId: userId }] };
    if (status) {
        query.status = status;
    }
    return collection.countDocuments(query);
}
function findRecentInvitations(collection, hours = 24, limit = 20) {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    return collection.aggregate([
        { $match: { createdAt: { $gte: cutoffDate } } },
        { $lookup: { from: 'users', localField: 'fromUserId', foreignField: 'id', as: 'fromUserId' } },
        { $unwind: { path: '$fromUserId', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'toUserId', foreignField: 'id', as: 'toUserId' } },
        { $unwind: { path: '$toUserId', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                'fromUserId.username': 1, 'fromUserId.avatar': 1,
                'toUserId.username': 1, 'toUserId.avatar': 1,
                type: 1, message: 1, data: 1, status: 1, expiresAt: 1, createdAt: 1, updatedAt: 1
            }
        },
        { $sort: { createdAt: -1 } },
        { $limit: limit }
    ]).toArray();
}
async function hasActiveInvitation(collection, fromUserId, toUserId, type) {
    const result = await collection.findOne({ fromUserId, toUserId, type, status: { $in: ['pending', 'accepted'] } }, { projection: { fromUserId: 1, toUserId: 1, type: 1, status: 1 } });
    return !!result;
}
async function acceptInvitationById(collection, invitationId) {
    const result = await collection.findOneAndUpdate({ _id: invitationId }, { $set: { status: 'accepted' } }, { returnDocument: 'after', projection: { fromUserId: 1, toUserId: 1, type: 1, message: 1, data: 1, status: 1, updatedAt: 1 } });
    return result;
}
async function rejectInvitationById(collection, invitationId) {
    const result = await collection.findOneAndUpdate({ _id: invitationId }, { $set: { status: 'rejected' } }, { returnDocument: 'after', projection: { fromUserId: 1, toUserId: 1, type: 1, message: 1, data: 1, status: 1, updatedAt: 1 } });
    return result;
}
function isInvitationExpired(invitation) {
    return !!invitation.expiresAt && new Date() > invitation.expiresAt;
}
class Invitation extends BaseModel_1.BaseModel {
}
exports.Invitation = Invitation;
Invitation.collectionName = 'invitations';
