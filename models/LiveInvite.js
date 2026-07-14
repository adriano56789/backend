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
exports.LiveInvite = exports.LiveUser = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LiveUserSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    status: {
        type: String,
        enum: ['idle', 'broadcasting', 'viewing', 'co-host', 'pk-battle'],
        default: 'idle'
    },
    currentStreamId: { type: String, default: null, index: true },
    socketId: { type: String, default: null },
    isMuted: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now, index: true }
}, { timestamps: true });
LiveUserSchema.index({ lastActive: 1 }, { expireAfterSeconds: 7200 });
const SrsSfuConfigSchema = new mongoose_1.Schema({
    whipUrl: { type: String, required: true },
    whepUrl: { type: String, required: true },
    streamKey: { type: String, required: true },
    rtcRoomId: { type: String, required: true }
}, { _id: false });
const LiveInviteSchema = new mongoose_1.Schema({
    inviterUsername: { type: String, required: true, index: true },
    inviterName: { type: String, required: true },
    inviteeUsername: { type: String, required: true, index: true },
    inviteeName: { type: String, required: true },
    inviteType: {
        type: String,
        enum: ['co-host', 'pk-battle'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'expired'],
        default: 'pending',
        index: true
    },
    streamId: { type: String, required: true, index: true },
    inviteLink: { type: String, required: true },
    srsSfuConfig: { type: SrsSfuConfigSchema, required: true }
}, { timestamps: true });
LiveInviteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });
exports.LiveUser = mongoose_1.default.models.LiveUser || mongoose_1.default.model('LiveUser', LiveUserSchema);
exports.LiveInvite = mongoose_1.default.models.LiveInvite || mongoose_1.default.model('LiveInvite', LiveInviteSchema);
