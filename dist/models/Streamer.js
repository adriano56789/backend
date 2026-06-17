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
exports.Streamer = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const StreamerSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    hostId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    avatar: { type: String, required: true },
    location: { type: String },
    time: { type: String },
    message: { type: String },
    tags: [{ type: String }],
    isHot: { type: Boolean, default: false },
    icon: { type: String },
    country: { type: String },
    viewers: { type: Number, default: 0 },
    onlineFans: { type: Number, default: 0 },
    onlineVisitors: { type: Number, default: 0 },
    isPrivate: { type: Boolean, default: false },
    quality: { type: String, default: 'HD' },
    demoVideoUrl: { type: String },
    rtmpIngestUrl: { type: String },
    srtIngestUrl: { type: String },
    streamKey: { type: String },
    playbackUrl: { type: String },
    streamServerUrl: { type: String },
    webrtcUrl: { type: String },
    hlsUrl: { type: String },
    flvUrl: { type: String },
    title: { type: String },
    description: { type: String },
    roomId: { type: String },
    endedBy: { type: String },
    endedAt: { type: Date },
    isLive: { type: Boolean, default: false },
    startTime: { type: Date },
    endTime: { type: Date },
    streamStatus: { type: String, enum: ['active', 'ended', 'preparing', 'paused'], default: 'preparing' },
    category: { type: String, default: 'popular' },
    language: { type: String, default: 'pt' },
    maxViewers: { type: Number, default: 1000 },
    recordingEnabled: { type: Boolean, default: false },
    chatEnabled: { type: Boolean, default: true },
    giftsEnabled: { type: Boolean, default: true },
    privateGiftId: { type: String },
    isAutoPrivateInviteEnabled: { type: Boolean, default: false },
    password: { type: String },
    heartsCount: { type: Number, default: 0 },
    microphoneEnabled: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
    autoFollowEnabled: { type: Boolean, default: false },
    autoInviteEnabled: { type: Boolean, default: false },
    moderators: [{ type: String }],
    kickedUsers: [{ type: String }],
    diamonds: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    cover: { type: String },
    liveId: { type: String },
    rtmpUrl: { type: String },
    heartbeatCount: { type: Number, default: 0 },
    webrtcSessionId: { type: String },
    srsClientId: { type: String },
    srsPublishData: { type: Object },
    srsUnpublishData: { type: Object },
    latitude: { type: Number },
    longitude: { type: Number },
    city: { type: String },
    state: { type: String },
    candidates: { type: String },
    streamUrl: { type: String },
    pushUrl: { type: String },
    distance: { type: String },
    token: { type: String },
    vhost: { type: String },
    app: { type: String },
    stream: { type: String }
}, { timestamps: true });
// Create indexes
StreamerSchema.index({ isLive: 1, category: 1 });
StreamerSchema.index({ isLive: 1, viewers: -1 });
exports.Streamer = mongoose_1.default.model('Streamer', StreamerSchema);
