"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilePhoto = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ProfilePhotoSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    obraId: { type: String, required: true, unique: true },
    photoUrl: { type: String, required: true },
    photoType: { type: String, enum: ['avatar', 'cover', 'gallery', 'video'], default: 'gallery' },
    isActive: { type: Boolean, default: true },
    isMain: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    metadata: {
        originalName: String,
        filename: String,
        size: Number,
        mimeType: String,
        width: Number,
        height: Number,
        uploadedAt: { type: Date, default: Date.now },
        source: String,
        isAvatar: Boolean
    }
}, { timestamps: true });
// Create indexes
ProfilePhotoSchema.index({ userId: 1, photoType: 1, isActive: 1 });
ProfilePhotoSchema.index({ obraId: 1 }, { unique: true });
exports.ProfilePhoto = mongoose_1.default.model('ProfilePhoto', ProfilePhotoSchema);
