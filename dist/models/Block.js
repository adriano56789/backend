"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Block = exports.COLLECTION = void 0;
exports.createBlock = createBlock;
exports.findActiveBlocks = findActiveBlocks;
exports.findWhoBlockedMe = findWhoBlockedMe;
exports.isBlocked = isBlocked;
exports.unblockUser = unblockUser;
exports.findAllBlocks = findAllBlocks;
exports.getBlockCount = getBlockCount;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'blocks';
async function createBlock(collection, blockerId, blockedId, reason) {
    if (!blockerId || !blockedId) {
        throw new Error('blockerId e blockedId s�o obrigat�rios');
    }
    if (blockerId === blockedId) {
        throw new Error('Usu�rio n�o pode bloquear a si mesmo');
    }
    const existingBlock = await collection.findOne({
        blockerId,
        blockedId,
        isActive: true
    });
    if (existingBlock) {
        throw new Error('J� existe um bloqueio ativo entre estes usu�rios');
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
    return { ...doc, _id: result.insertedId };
}
async function findActiveBlocks(collection, blockerId) {
    return collection.find({ blockerId, isActive: true }, {
        projection: {
            blockerId: 1,
            blockedId: 1,
            blockedAt: 1,
            reason: 1,
            createdAt: 1
        }
    }).sort({ blockedAt: -1 }).toArray();
}
async function findWhoBlockedMe(collection, blockedId) {
    return collection.find({ blockedId, isActive: true }, {
        projection: {
            blockerId: 1,
            blockedId: 1,
            blockedAt: 1,
            reason: 1,
            createdAt: 1
        }
    }).sort({ blockedAt: -1 }).toArray();
}
async function isBlocked(collection, blockerId, blockedId) {
    const result = await collection.findOne({ blockerId, blockedId, isActive: true }, { projection: { blockerId: 1, blockedId: 1, isActive: 1 } });
    return !!result;
}
async function unblockUser(collection, blockerId, blockedId) {
    return collection.findOneAndUpdate({ blockerId, blockedId, isActive: true }, {
        $set: {
            isActive: false,
            unblockedAt: new Date(),
            updatedAt: new Date()
        }
    }, {
        returnDocument: 'after',
        projection: {
            blockerId: 1,
            blockedId: 1,
            isActive: 1,
            unblockedAt: 1,
            updatedAt: 1
        }
    });
}
async function findAllBlocks(collection, blockerId, blockedId) {
    const query = {};
    if (blockerId)
        query.blockerId = blockerId;
    if (blockedId)
        query.blockedId = blockedId;
    return collection.find(query, {
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
    }).sort({ blockedAt: -1 }).toArray();
}
async function getBlockCount(collection, userId, type = 'blocking') {
    const query = type === 'blocking'
        ? { blockerId: userId, isActive: true }
        : { blockedId: userId, isActive: true };
    return collection.countDocuments(query);
}
class Block extends BaseModel_1.BaseModel {
}
exports.Block = Block;
Block.collectionName = 'blocks';
