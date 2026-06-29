"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Followers = void 0;
var mongoose_1 = require("mongoose");
var FollowersSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    followerId: { type: String, required: true, index: true },
    followingId: { type: String, required: true, index: true },
    followedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    unfollowedAt: { type: Date }
}, { timestamps: true });
// Create composite index
FollowersSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
exports.Followers = mongoose_1.default.model('Followers', FollowersSchema, 'follows');
