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
exports.LiveKitWebhookLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LiveKitWebhookLogSchema = new mongoose_1.Schema({
    event: { type: String, required: true, index: true },
    roomName: { type: String, index: true },
    roomSid: { type: String },
    participantIdentity: { type: String },
    participantName: { type: String },
    success: { type: Boolean, required: true },
    error: { type: String },
    rawEvent: { type: mongoose_1.Schema.Types.Mixed },
    processedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});
LiveKitWebhookLogSchema.index({ createdAt: -1 });
LiveKitWebhookLogSchema.index({ event: 1, createdAt: -1 });
LiveKitWebhookLogSchema.index({ roomName: 1, createdAt: -1 });
exports.LiveKitWebhookLog = mongoose_1.default.model('LiveKitWebhookLog', LiveKitWebhookLogSchema);
