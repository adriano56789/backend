"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveNotification = void 0;
var mongoose_1 = require("mongoose");
var LiveNotificationSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    streamerId: { type: String, required: true, index: true },
    streamId: { type: String, required: true },
    read: { type: Boolean, default: false },
    message: { type: String }
}, { timestamps: true });
exports.LiveNotification = mongoose_1.default.model('LiveNotification', LiveNotificationSchema);
