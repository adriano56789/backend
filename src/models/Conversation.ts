import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IConversation {
    participants: string[];
    lastMessage?: {
        content: string;
        senderId: string;
        timestamp: Date;
        messageType: 'text' | 'image' | 'gift' | 'system';
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'conversations';

export function findConversation(collection: Collection<any>, participants: string[]) {
    if (participants.length === 2) {
        return collection.findOne(
            {
                participants: { $all: participants, $size: 2 },
                isActive: true
            },
            {
                projection: {
                    participants: 1,
                    lastMessage: 1,
                    isActive: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        );
    }

    return collection.findOne(
        {
            participants: participants,
            isActive: true
        },
        {
            projection: {
                participants: 1,
                lastMessage: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    );
}

export function findByUser(collection: Collection<any>, userId: string) {
    return collection.find(
        {
            participants: userId,
            isActive: true
        },
        {
            projection: {
                participants: 1,
                lastMessage: 1,
                isActive: 1,
                updatedAt: 1
            }
        }
    )
    .sort({ 'lastMessage.timestamp': -1 })
    .toArray();
}

export async function createConversation(collection: Collection<any>, participants: string[]) {
    if (!participants || participants.length < 2) {
        throw new Error('É necessário pelo menos 2 participantes para criar uma conversa');
    }

    let existingConversation;
    if (participants.length === 2) {
        existingConversation = await collection.findOne(
            {
                participants: { $all: participants, $size: 2 },
                isActive: true
            },
            {
                projection: {
                    participants: 1,
                    lastMessage: 1,
                    isActive: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        );
    } else {
        existingConversation = await collection.findOne(
            {
                participants: participants,
                isActive: true
            },
            {
                projection: {
                    participants: 1,
                    lastMessage: 1,
                    isActive: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        );
    }

    if (existingConversation) {
        return existingConversation;
    }

    const doc = {
        participants,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
}

export function findPrivateConversations(collection: Collection<any>, userId: string) {
    return collection.find(
        {
            participants: userId,
            isActive: true,
            $expr: { $eq: [{ $size: '$participants' }, 2] }
        },
        {
            projection: {
                participants: 1,
                lastMessage: 1,
                isActive: 1,
                updatedAt: 1
            }
        }
    )
    .sort({ 'lastMessage.timestamp': -1 })
    .toArray();
}

export function findGroupConversations(collection: Collection<any>, userId: string) {
    return collection.find(
        {
            participants: userId,
            isActive: true,
            $expr: { $gt: [{ $size: '$participants' }, 2] }
        },
        {
            projection: {
                participants: 1,
                lastMessage: 1,
                isActive: 1,
                updatedAt: 1
            }
        }
    )
    .sort({ 'lastMessage.timestamp': -1 })
    .toArray();
}

export async function updateLastMessage(collection: Collection<any>, conversationId: string, message: any) {
    return collection.findOneAndUpdate(
        { _id: conversationId },
        {
            $set: {
                lastMessage: message,
                updatedAt: new Date()
            }
        },
        {
            returnDocument: 'after',
            projection: {
                participants: 1,
                lastMessage: 1,
                isActive: 1,
                updatedAt: 1
            }
        }
    );
}

export async function deactivateConversation(collection: Collection<any>, conversationId: string) {
    return collection.findOneAndUpdate(
        { _id: conversationId },
        { $set: { isActive: false } },
        {
            returnDocument: 'after',
            projection: {
                participants: 1,
                isActive: 1,
                updatedAt: 1
            }
        }
    );
}

export async function isUserInConversation(collection: Collection<any>, conversationId: string, userId: string) {
    const result = await collection.findOne(
        {
            _id: conversationId,
            participants: userId,
            isActive: true
        },
        { projection: { participants: 1, isActive: 1 } }
    );
    return !!result;
}

export function countUserConversations(collection: Collection<any>, userId: string) {
    return collection.countDocuments({
        participants: userId,
        isActive: true
    });
}

export async function updateConversationLastMessage(
    collection: Collection<any>,
    conversation: IConversation & { _id: any },
    content: string,
    senderId: string,
    messageType = 'text'
) {
    return collection.findOneAndUpdate(
        { _id: conversation._id },
        {
            $set: {
                lastMessage: {
                    content,
                    senderId,
                    timestamp: new Date(),
                    messageType
                },
                updatedAt: new Date()
            }
        },
        {
            returnDocument: 'after',
            projection: {
                participants: 1,
                lastMessage: 1,
                isActive: 1,
                updatedAt: 1
            }
        }
    );
}
export class Conversation extends BaseModel<IConversation> {
  static collectionName = 'conversations';
}
