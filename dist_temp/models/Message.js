"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
var mongoose_1 = require("mongoose");
var MessageSchema = new mongoose_1.Schema({
    chatId: { type: String, required: true, index: true },
    fromUserId: { type: String, required: true, index: true },
    toUserId: { type: String, required: true, index: true },
    text: { type: String, required: true },
    imageUrl: { type: String },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'sending', 'failed'],
        default: 'sent'
    },
    type: {
        type: String,
        enum: ['text', 'image', 'gift', 'system', 'friend-notification', 'stream-notification'],
        default: 'text'
    },
    messageId: { type: String, unique: true, sparse: true }
}, { timestamps: true });
exports.Message = mongoose_1.default.model('Message', MessageSchema);
