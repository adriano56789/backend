"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamBan = exports.COLLECTION = void 0;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'streambans';
class StreamBan extends BaseModel_1.BaseModel {
}
exports.StreamBan = StreamBan;
StreamBan.collectionName = 'streambans';
