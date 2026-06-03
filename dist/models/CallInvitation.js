"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallInvitation = exports.COLLECTION = void 0;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'callinvitations';
class CallInvitation extends BaseModel_1.BaseModel {
}
exports.CallInvitation = CallInvitation;
CallInvitation.collectionName = 'callinvitations';
