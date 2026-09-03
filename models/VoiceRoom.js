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
exports.VoiceRoom = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const VoiceSlotSchema = new mongoose_1.Schema({
    index: { type: Number, required: true },
    userId: { type: String, default: null },
    userName: { type: String, default: '' },
    avatar: { type: String, default: '' },
    level: { type: Number, default: 1 },
    isSpeaking: { type: Boolean, default: false },
    isMuted: { type: Boolean, default: false },
    joinedAt: { type: Date, default: null },
}, { _id: false });
const VoiceRoomSchema = new mongoose_1.Schema({
    roomId: { type: String, required: true, unique: true, index: true },
    hostId: { type: String, required: true, index: true },
    hostName: { type: String, default: '' },
    hostAvatar: { type: String, default: '' },
    name: { type: String, default: '' },
    category: { type: String, default: 'voice_chat' },
    slots: { type: [VoiceSlotSchema], default: [] },
    maxSlots: { type: Number, default: 6 },
    minLevelToSpeak: { type: Number, default: 1 },
    isLive: { type: Boolean, default: false },
    viewers: { type: Number, default: 0 },
    viewerIds: { type: [String], default: [] },
    startTime: { type: Date, default: null },
}, { timestamps: true });
VoiceRoomSchema.index({ isLive: 1, category: 1 });
VoiceRoomSchema.index({ isLive: 1, viewers: -1 });
exports.VoiceRoom = mongoose_1.default.model('VoiceRoom', VoiceRoomSchema);
