import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IInvitation {
    fromUserId: string;
    toUserId: string;
    type: 'stream' | 'friend' | 'private_chat' | 'group_chat';
    message: string;
    data?: {
        streamId?: string;
        groupName?: string;
        groupId?: string;
        customData?: any;
    };
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'invitations';

export function findByUser(collection: Collection<IInvitation>, userId: string, type: 'sent' | 'received' = 'received') {
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

export function findPending(collection: Collection<IInvitation>, userId: string) {
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

export async function createInvitation(collection: Collection<IInvitation>, invitationData: any) {
    const defaultData = {
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
    const finalData = { ...defaultData, ...invitationData };
    const { insertedId } = await collection.insertOne(finalData);
    return collection.findOne({ _id: insertedId });
}

export function findByType(collection: Collection<any>, userId: string, type: string, userType: 'sent' | 'received' = 'received') {
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

export function findExpired(collection: Collection<IInvitation>, userId?: string) {
    const query: any = { expiresAt: { $lt: new Date() }, status: 'pending' };
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

export function findByStatus(collection: Collection<any>, status: string, userId?: string) {
    const query: any = { status };
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

export async function acceptInvitation(collection: Collection<IInvitation>, invitationId: string) {
    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(invitationId) },
        { $set: { status: 'accepted' } },
        { returnDocument: 'after', projection: { fromUserId: 1, toUserId: 1, type: 1, message: 1, data: 1, status: 1, updatedAt: 1 } }
    );
    return result;
}

export async function rejectInvitation(collection: Collection<IInvitation>, invitationId: string) {
    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(invitationId) },
        { $set: { status: 'rejected' } },
        { returnDocument: 'after', projection: { fromUserId: 1, toUserId: 1, type: 1, message: 1, data: 1, status: 1, updatedAt: 1 } }
    );
    return result;
}

export function countByStatus(collection: Collection<any>, userId: string, status?: string) {
    const query: any = { $or: [{ fromUserId: userId }, { toUserId: userId }] };
    if (status) {
        query.status = status;
    }
    return collection.countDocuments(query);
}

export function findRecentInvitations(collection: Collection<IInvitation>, hours = 24, limit = 20) {
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

export async function hasActiveInvitation(collection: Collection<any>, fromUserId: string, toUserId: string, type: string) {
    const result = await collection.findOne(
        { fromUserId, toUserId, type, status: { $in: ['pending', 'accepted'] } },
        { projection: { fromUserId: 1, toUserId: 1, type: 1, status: 1 } }
    );
    return !!result;
}

export async function acceptInvitationById(collection: Collection<IInvitation>, invitationId: ObjectId) {
    const result = await collection.findOneAndUpdate(
        { _id: invitationId },
        { $set: { status: 'accepted' } },
        { returnDocument: 'after', projection: { fromUserId: 1, toUserId: 1, type: 1, message: 1, data: 1, status: 1, updatedAt: 1 } }
    );
    return result;
}

export async function rejectInvitationById(collection: Collection<IInvitation>, invitationId: ObjectId) {
    const result = await collection.findOneAndUpdate(
        { _id: invitationId },
        { $set: { status: 'rejected' } },
        { returnDocument: 'after', projection: { fromUserId: 1, toUserId: 1, type: 1, message: 1, data: 1, status: 1, updatedAt: 1 } }
    );
    return result;
}

export function isInvitationExpired(invitation: IInvitation) {
    return !!invitation.expiresAt && new Date() > invitation.expiresAt;
}
export class Invitation extends BaseModel<IInvitation> {
  static collectionName = 'invitations';
}
