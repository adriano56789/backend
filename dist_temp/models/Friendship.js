"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Friendship = void 0;
var mongoose_1 = require("mongoose");
var FriendshipSchema = new mongoose_1.Schema({
    userId1: { type: String, required: true, index: true },
    userId2: { type: String, required: true, index: true },
    initiatedBy: { type: String, required: true },
    friendshipStartedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
// Create composite index (sorted IDs to avoid duplicates in either order)
FriendshipSchema.index({ userId1: 1, userId2: 1 }, { unique: true });
exports.Friendship = mongoose_1.default.model('Friendship', FriendshipSchema);
