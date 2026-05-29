import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IBlock {
    blockerId: string;
    blockedId: string;
    blockedAt: Date;
    isActive: boolean;
    unblockedAt?: Date;
    reason?: string;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'blocks';

export async function createBlock(collection: Collection<any>, blockerId: string, blockedId: string, reason?: string) {
    if (!blockerId || !blockedId) {
        throw new Error('blockerId e blockedId são obrigatórios');
    }

    if (blockerId === blockedId) {
        throw new Error('Usuário não pode bloquear a si mesmo');
    }

    const existingBlock = await collection.findOne({
        blockerId,
        blockedId,
        isActive: true
    });

    if (existingBlock) {
        throw new Error('Já existe um bloqueio ativo entre estes usuários');
    }

    const doc = {
        blockerId,
        blockedId,
        blockedAt: new Date(),
        isActive: true,
        reason,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId } as IBlock;
}

export async function findActiveBlocks(collection: Collection<any>, blockerId: string) {
    return collection.find(
        { blockerId, isActive: true },
        {
            projection: {
                blockerId: 1,
                blockedId: 1,
                blockedAt: 1,
                reason: 1,
                createdAt: 1
            }
        }
    ).sort({ blockedAt: -1 }).toArray();
}

export async function findWhoBlockedMe(collection: Collection<any>, blockedId: string) {
    return collection.find(
        { blockedId, isActive: true },
        {
            projection: {
                blockerId: 1,
                blockedId: 1,
                blockedAt: 1,
                reason: 1,
                createdAt: 1
            }
        }
    ).sort({ blockedAt: -1 }).toArray();
}

export async function isBlocked(collection: Collection<any>, blockerId: string, blockedId: string) {
    const result = await collection.findOne(
        { blockerId, blockedId, isActive: true },
        { projection: { blockerId: 1, blockedId: 1, isActive: 1 } }
    );
    return !!result;
}

export async function unblockUser(collection: Collection<any>, blockerId: string, blockedId: string) {
    return collection.findOneAndUpdate(
        { blockerId, blockedId, isActive: true },
        {
            $set: {
                isActive: false,
                unblockedAt: new Date(),
                updatedAt: new Date()
            }
        },
        {
            returnDocument: 'after',
            projection: {
                blockerId: 1,
                blockedId: 1,
                isActive: 1,
                unblockedAt: 1,
                updatedAt: 1
            }
        }
    );
}

export async function findAllBlocks(collection: Collection<any>, blockerId?: string, blockedId?: string) {
    const query: any = {};

    if (blockerId) query.blockerId = blockerId;
    if (blockedId) query.blockedId = blockedId;

    return collection.find(
        query,
        {
            projection: {
                blockerId: 1,
                blockedId: 1,
                blockedAt: 1,
                isActive: 1,
                unblockedAt: 1,
                reason: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ).sort({ blockedAt: -1 }).toArray();
}

export async function getBlockCount(collection: Collection<any>, userId: string, type: 'blocking' | 'blocked' = 'blocking') {
    const query = type === 'blocking'
        ? { blockerId: userId, isActive: true }
        : { blockedId: userId, isActive: true };

    return collection.countDocuments(query);
}
export class Block extends BaseModel<IBlock> {
  static collectionName = 'blocks';
}
