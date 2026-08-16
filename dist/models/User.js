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
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    token: { type: String },
    identification: { type: String, required: true },
    name: { type: String, required: true },
    displayName: { type: String },
    avatar: { type: String },
    avatarUrl: { type: String, default: '' },
    coverUrl: { type: String },
    streamServerUrl: { type: String },
    rtmpIngestUrl: { type: String },
    srtIngestUrl: { type: String },
    streamKey: { type: String },
    playbackUrl: { type: String },
    roomId: { type: String },
    photos: [{ type: String }],
    avatarImages: [{ type: String }],
    country: { type: String, default: 'br' },
    age: { type: Number, default: 25 },
    gender: { type: String, enum: ['male', 'female', 'other', 'not_specified'], default: 'not_specified' },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    rank: { type: Number },
    location: { type: mongoose_1.Schema.Types.Mixed },
    latitude: { type: Number },
    longitude: { type: Number },
    city: { type: String },
    state: { type: String },
    distance: { type: String },
    fans: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
    followingList: [{ type: String }],
    followersList: [{ type: String }],
    blockedUsers: [{ type: String }],
    friendsList: [{ type: String }],
    receptores: { type: Number, default: 0 },
    enviados: { type: Number, default: 0 },
    topFansAvatars: [{ type: String }],
    accountStatus: { type: String, enum: ['active', 'inactive', 'blocked', 'suspended'], default: 'active' },
    isLive: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date },
    currentStreamId: { type: String },
    permanentStreamId: { type: String },
    diamonds: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    earnings_withdrawn: { type: Number, default: 0 },
    diamonds_purchased: { type: Number, default: 0 },
    withdrawal_method: { type: Object },
    cadastral: { type: Object },
    bio: { type: String },
    obras: [{ id: String, url: String }],
    curtidas: [{ type: String }],
    birthday: { type: String },
    residence: { type: String },
    emotional_status: { type: String },
    tags: [{ type: String }],
    profession: { type: String },
    isVIP: { type: Boolean, default: false },
    vipSubscriptionDate: { type: String },
    vipExpirationDate: { type: String },
    isAvatarProtected: { type: Boolean, default: false },
    activeFrameId: { type: String, default: null },
    ownedFrames: [{ frameId: String, expirationDate: String }],
    chatPermission: { type: String, enum: ['all', 'followers', 'following', 'friends', 'none'], default: 'all' },
    pipEnabled: { type: Boolean, default: true },
    streamPreviewEnabled: { type: Boolean, default: false },
    screenSecurityEnabled: { type: Boolean, default: false },
    locationPermission: { type: String, enum: ['granted', 'denied', 'prompt'], default: 'prompt' },
    cameraPermissionStatus: { type: String, enum: ['granted', 'denied', 'prompt'], default: 'prompt' },
    microphonePermissionStatus: { type: String, enum: ['granted', 'denied', 'prompt'], default: 'prompt' },
    cameraAccessEnabled: { type: Boolean, default: false },
    cameraAccessPermanent: { type: Boolean, default: false },
    cameraAccessGrantedAt: { type: Date },
    cameraAccessDeniedAt: { type: Date },
    audioRecordingEnabled: { type: Boolean, default: false },
    audioRecordingPermanent: { type: Boolean, default: false },
    audioRecordingGrantedAt: { type: Date },
    audioRecordingDeniedAt: { type: Date },
    pushNotificationSettings: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    showActivityStatus: { type: Boolean, default: true },
    showLocation: { type: Boolean, default: true },
    privateStreamSettings: {
        privateInvite: { type: Boolean, default: false },
        followersOnly: { type: Boolean, default: false },
        fansOnly: { type: Boolean, default: false },
        friendsOnly: { type: Boolean, default: false }
    },
    platformEarnings: { type: Number, default: 0 },
    adminWithdrawalMethod: { email: String },
    withdrawal_requests: [{ type: mongoose_1.Schema.Types.Mixed }],
    frameExpiration: { type: Date },
    loginCount: { type: Number, default: 0 },
    lastLogin: { type: Date },
    profileViews: { type: Number, default: 0 },
    totalLives: { type: Number, default: 0 },
    livesJoined: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    searchesPerformed: { type: Number, default: 0 },
    recentActivities: [{ action: String, resource: String, timestamp: Date, endpoint: String }],
    isNewUser: { type: Boolean, default: true },
    newUserNotified: { type: Boolean, default: false },
    rouletteSpinCost: { type: Number, default: 0 }
}, { timestamps: true, id: false });
// Create text index for search
UserSchema.index({ name: 'text', displayName: 'text', bio: 'text', profession: 'text' });
// Create 2dsphere index for geospatial queries
UserSchema.index({ location: '2dsphere' });
exports.User = mongoose_1.default.model('User', UserSchema);
