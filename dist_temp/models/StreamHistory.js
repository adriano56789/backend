"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamHistory = void 0;
var mongoose_1 = require("mongoose");
var StreamHistorySchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    streamId: { type: String, required: true, index: true },
    hostId: { type: String, required: true, index: true },
    hostName: { type: String },
    hostAvatar: { type: String },
    title: { type: String },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: String },
    peakViewers: { type: Number, default: 0 },
    totalCoins: { type: Number, default: 0 },
    totalFollowers: { type: Number, default: 0 },
    totalMembers: { type: Number, default: 0 },
    totalFans: { type: Number, default: 0 },
    category: { type: String },
    tags: [{ type: String }],
    country: { type: String }
}, { timestamps: true });
exports.StreamHistory = mongoose_1.default.model('StreamHistory', StreamHistorySchema);
