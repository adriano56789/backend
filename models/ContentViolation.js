"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentViolation = exports.COLLECTION = void 0;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'contentviolations';
class ContentViolation extends BaseModel_1.BaseModel {
}
exports.ContentViolation = ContentViolation;
ContentViolation.collectionName = 'contentviolations';
