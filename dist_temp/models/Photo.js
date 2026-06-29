"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Photo = void 0;
var mongoose_1 = require("mongoose");
var PhotoSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    photoUrl: { type: String, required: true },
    caption: { type: String },
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: true },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 }
}, { timestamps: true });
exports.Photo = mongoose_1.default.model('Photo', PhotoSchema);
