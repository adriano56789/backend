"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Conversation = exports.COLLECTION = void 0;
exports.findConversation = findConversation;
exports.findByUser = findByUser;
exports.createConversation = createConversation;
exports.findPrivateConversations = findPrivateConversations;
exports.findGroupConversations = findGroupConversations;
exports.updateLastMessage = updateLastMessage;
exports.deactivateConversation = deactivateConversation;
exports.isUserInConversation = isUserInConversation;
exports.countUserConversations = countUserConversations;
exports.updateConversationLastMessage = updateConversationLastMessage;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'conversations';
function findConversation(collection, participants) {
    if (participants.length === 2) {
        return collection.findOne({
            participants: { $all: participants, $size: 2 },
            isActive: true
        }, {
            projection: {
                participants: 1,
                lastMessage: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });
    }
    return collection.findOne({
        participants: participants,
        isActive: true
    }, {
        projection: {
            participants: 1,
            lastMessage: 1,
            isActive: 1,
            createdAt: 1,
            updatedAt: 1
        }
    });
}
function findByUser(collection, userId) {
    return collection.find({
        participants: userId,
        isActive: true
    }, {
        projection: {
            participants: 1,
            lastMessage: 1,
            isActive: 1,
            updatedAt: 1
        }
    })
        .sort({ 'lastMessage.timestamp': -1 })
        .toArray();
}
async function createConversation(collection, participants) {
    if (!participants || participants.length < 2) {
        throw new Error('� necess�rio pelo menos 2 participantes para criar uma conversa');
    }
    let existingConversation;
    if (participants.length === 2) {
        existingConversation = await collection.findOne({
            participants: { $all: participants, $size: 2 },
            isActive: true
        }, {
            projection: {
                participants: 1,
                lastMessage: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });
    }
    else {
        existingConversation = await collection.findOne({
            participants: participants,
            isActive: true
        }, {
            projection: {
                participants: 1,
                lastMessage: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1
            }
        });
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
function findPrivateConversations(collection, userId) {
    return collection.find({
        participants: userId,
        isActive: true,
        $expr: { $eq: [{ $size: '$participants' }, 2] }
    }, {
        projection: {
            participants: 1,
            lastMessage: 1,
            isActive: 1,
            updatedAt: 1
        }
    })
        .sort({ 'lastMessage.timestamp': -1 })
        .toArray();
}
function findGroupConversations(collection, userId) {
    return collection.find({
        participants: userId,
        isActive: true,
        $expr: { $gt: [{ $size: '$participants' }, 2] }
    }, {
        projection: {
            participants: 1,
            lastMessage: 1,
            isActive: 1,
            updatedAt: 1
        }
    })
        .sort({ 'lastMessage.timestamp': -1 })
        .toArray();
}
async function updateLastMessage(collection, conversationId, message) {
    return collection.findOneAndUpdate({ _id: conversationId }, {
        $set: {
            lastMessage: message,
            updatedAt: new Date()
        }
    }, {
        returnDocument: 'after',
        projection: {
            participants: 1,
            lastMessage: 1,
            isActive: 1,
            updatedAt: 1
        }
    });
}
async function deactivateConversation(collection, conversationId) {
    return collection.findOneAndUpdate({ _id: conversationId }, { $set: { isActive: false } }, {
        returnDocument: 'after',
        projection: {
            participants: 1,
            isActive: 1,
            updatedAt: 1
        }
    });
}
async function isUserInConversation(collection, conversationId, userId) {
    const result = await collection.findOne({
        _id: conversationId,
        participants: userId,
        isActive: true
    }, { projection: { participants: 1, isActive: 1 } });
    return !!result;
}
function countUserConversations(collection, userId) {
    return collection.countDocuments({
        participants: userId,
        isActive: true
    });
}
async function updateConversationLastMessage(collection, conversation, content, senderId, messageType = 'text') {
    return collection.findOneAndUpdate({ _id: conversation._id }, {
        $set: {
            lastMessage: {
                content,
                senderId,
                timestamp: new Date(),
                messageType
            },
            updatedAt: new Date()
        }
    }, {
        returnDocument: 'after',
        projection: {
            participants: 1,
            lastMessage: 1,
            isActive: 1,
            updatedAt: 1
        }
    });
}
class Conversation extends BaseModel_1.BaseModel {
}
exports.Conversation = Conversation;
Conversation.collectionName = 'conversations';
