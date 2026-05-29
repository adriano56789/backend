import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IComment {
    userId: string;
    targetId: string;
    targetType: 'message' | 'chat' | 'stream' | 'photo' | 'video' | 'profile';
    content: string;
    parentId?: string;
    likes: number;
    isActive: boolean;
    isEdited: boolean;
    editedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'comments';

export async function createComment(collection: Collection<any>, commentData: any) {
    const defaultData = {
        likes: 0,
        isActive: true,
        isEdited: false
    };

    const finalData = { ...defaultData, ...commentData };

    const result = await collection.insertOne(finalData);
    return { ...finalData, _id: result.insertedId };
}

export function findByUser(collection: Collection<any>, userId: string, limit = 50) {
    return collection.find(
        {
            userId,
            isActive: true
        },
        {
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
        }
    )
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export function findReplies(collection: Collection<any>, parentId: string, limit = 20) {
    return collection.find(
        {
            parentId,
            isActive: true
        },
        {
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
        }
    )
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
}

export function findByTargetType(collection: Collection<any>, targetType: string, limit = 100) {
    return collection.find(
        {
            targetType,
            isActive: true
        },
        {
            projection: {
                userId: 1,
                targetId: 1,
                targetType: 1,
                content: 1,
                likes: 1,
                createdAt: 1
            }
        }
    )
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export function countCommentsByTarget(collection: Collection<any>, targetId: string, targetType: string) {
    return collection.countDocuments({
        targetId,
        targetType,
        isActive: true
    });
}

export async function deactivateComment(collection: Collection<any>, commentId: string) {
    return collection.findOneAndUpdate(
        { _id: commentId },
        { $set: { isActive: false } },
        {
            returnDocument: 'after',
            projection: {
                userId: 1,
                targetId: 1,
                targetType: 1,
                isActive: 1,
                updatedAt: 1
            }
        }
    );
}

export function findRecentComments(collection: Collection<any>, limit = 50) {
    return collection.find(
        {
            isActive: true
        },
        {
            projection: {
                userId: 1,
                targetId: 1,
                targetType: 1,
                content: 1,
                likes: 1,
                createdAt: 1
            }
        }
    )
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function updateLikes(collection: Collection<any>, comment: IComment & { _id: any }, increment: number) {
    return collection.findOneAndUpdate(
        { _id: comment._id },
        {
            $set: {
                likes: Math.max(0, comment.likes + increment)
            }
        },
        {
            returnDocument: 'after',
            projection: {
                userId: 1,
                targetId: 1,
                targetType: 1,
                content: 1,
                likes: 1,
                updatedAt: 1
            }
        }
    );
}

export async function editContent(collection: Collection<any>, comment: IComment & { _id: any }, newContent: string) {
    return collection.findOneAndUpdate(
        { _id: comment._id },
        {
            $set: {
                content: newContent,
                isEdited: true,
                editedAt: new Date()
            }
        },
        {
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
        }
    );
}
export class Comment extends BaseModel<IComment> {
  static collectionName = 'comments';
}
