
import { BaseModel } from '../db/BaseModel';

export interface IFollow {
    followerId: string;
    followingId: string;
    followedAt: Date;
    unfollowedAt?: Date;
    isActive: boolean;
}

export const COLLECTION = 'follows';

export function findFollow(collection: any, followerId: string, followingId: string) {
    return collection.findOne(
        {
            followerId,
            followingId,
            isActive: true
        },
        {
            projection: {
                followerId: 1,
                followingId: 1,
                followedAt: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    );
}

export function findFollowers(collection: any, userId: string) {
    return collection.find(
        {
            followingId: userId,
            isActive: true
        },
        {
            projection: {
                followerId: 1,
                followingId: 1,
                followedAt: 1,
                isActive: 1,
                createdAt: 1
            }
        }
    )
    .sort({ followedAt: -1 })
    .toArray();
}

export function findFollowing(collection: any, userId: string) {
    return collection.find(
        {
            followerId: userId,
            isActive: true
        },
        {
            projection: {
                followerId: 1,
                followingId: 1,
                followedAt: 1,
                isActive: 1,
                createdAt: 1
            }
        }
    )
    .sort({ followedAt: -1 })
    .toArray();
}

export async function createFollow(collection: any, followerId: string, followingId: string) {
    if (!followerId || !followingId) {
        throw new Error('followerId e followingId s�o obrigat�rios');
    }

    if (followerId === followingId) {
        throw new Error('Usu�rio n�o pode seguir a si mesmo');
    }

    const existingFollow = await collection.findOne(
        {
            followerId,
            followingId,
            isActive: true
        },
        {
            projection: {
                followerId: 1,
                followingId: 1,
                isActive: 1
            }
        }
    );

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

export async function isFollowing(collection: any, followerId: string, followingId: string) {
    const result = await collection.findOne(
        {
            followerId,
            followingId,
            isActive: true
        },
        { projection: { followerId: 1, followingId: 1, isActive: 1 } }
    );
    return !!result;
}

export async function unfollowUser(collection: any, followerId: string, followingId: string) {
    return collection.findOneAndUpdate(
        {
            followerId,
            followingId,
            isActive: true
        },
        {
            $set: {
                isActive: false,
                unfollowedAt: new Date()
            }
        },
        {
            returnDocument: 'after',
            projection: {
                followerId: 1,
                followingId: 1,
                isActive: 1,
                unfollowedAt: 1,
                updatedAt: 1
            }
        }
    );
}

export function countFollowers(collection: any, userId: string) {
    return collection.countDocuments({
        followingId: userId,
        isActive: true
    });
}

export function countFollowing(collection: any, userId: string) {
    return collection.countDocuments({
        followerId: userId,
        isActive: true
    });
}

export function findRecentFollows(collection: any, limit = 50) {
    return collection.find(
        {
            isActive: true
        },
        {
            projection: {
                followerId: 1,
                followingId: 1,
                followedAt: 1,
                createdAt: 1
            }
        }
    )
    .sort({ followedAt: -1 })
    .limit(limit)
    .toArray();
}

export function findMutualFollows(collection: any, userId: string, otherUserId: string) {
    return collection.find(
        {
            $or: [
                { followerId: userId, followingId: otherUserId },
                { followerId: otherUserId, followingId: userId }
            ],
            isActive: true
        },
        {
            projection: {
                followerId: 1,
                followingId: 1,
                followedAt: 1,
                isActive: 1
            }
        }
    ).toArray();
}

export async function unfollow(collection: any, follow: IFollow & { _id: any }) {
    return collection.findOneAndUpdate(
        { _id: follow._id },
        {
            $set: {
                isActive: false,
                unfollowedAt: new Date()
            }
        },
        {
            returnDocument: 'after',
            projection: {
                followerId: 1,
                followingId: 1,
                isActive: 1,
                unfollowedAt: 1,
                updatedAt: 1
            }
        }
    );
}
export class Follow extends BaseModel<IFollow> {
  static collectionName = 'follows';
}
