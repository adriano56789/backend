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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveCard = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const LiveCardSchema = new mongoose_1.Schema({
    hostId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '' },
    title: { type: String, default: '' },
    streamKey: { type: String, required: true },
    playbackUrl: { type: String, default: null },
    hlsUrl: { type: String, default: null },
    webrtcUrl: { type: String, default: null },
    flvUrl: { type: String, default: null },
    whipUrl: { type: String, default: null },
    whepUrl: { type: String, default: null },
    country: { type: String, default: 'br', index: true },
    isLive: { type: Boolean, default: false },
    streamStatus: {
        type: String,
        enum: ['active', 'live', 'ended'],
        default: 'ended'
    },
    viewers: { type: Number, default: 0 },
    category: { type: String, default: 'popular' },
    categoryList: { type: [String], default: [] },
    notice: { type: String, default: '' },
    metaData: { type: Map, of: String, default: {} },
    isPrivate: { type: Boolean, default: false },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null }
}, { timestamps: true });
LiveCardSchema.index({ isLive: 1, country: 1 });
LiveCardSchema.index({ streamStatus: 1 });
LiveCardSchema.pre('save', function (next) {
    if (!this.streamKey) {
        this.streamKey = crypto_1.default.randomBytes(16).toString('hex');
    }
    next();
});
exports.LiveCard = mongoose_1.default.model('LiveCard', LiveCardSchema);
