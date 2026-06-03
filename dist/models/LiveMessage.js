"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveMessage = exports.COLLECTION = void 0;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'livemessages';
class LiveMessage extends BaseModel_1.BaseModel {
}
exports.LiveMessage = LiveMessage;
LiveMessage.collectionName = 'livemessages';
