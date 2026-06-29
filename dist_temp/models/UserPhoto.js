"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPhoto = void 0;
var mongoose_1 = require("mongoose");
var UserPhotoSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    photoUrl: { type: String, required: true },
    caption: { type: String },
    tags: [{ type: String }],
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
    postedAt: { type: Date, default: Date.now }
}, { timestamps: true });
exports.UserPhoto = mongoose_1.default.model('UserPhoto', UserPhotoSchema);
