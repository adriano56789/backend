"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Frame = void 0;
exports.findActive = findActive;
exports.findByName = findByName;
exports.createFrame = createFrame;
exports.findByPriceRange = findByPriceRange;
exports.findByDuration = findByDuration;
exports.findMostExpensive = findMostExpensive;
exports.findCheapest = findCheapest;
exports.findRecent = findRecent;
exports.deactivateFrame = deactivateFrame;
exports.findByIdWithProjection = findByIdWithProjection;
exports.countActiveFrames = countActiveFrames;
const BaseModel_1 = require("../db/BaseModel");
const db_1 = require("../config/db");
const COLLECTION_NAME = 'frames';
function getColl(db) {
    if (db)
        return db.collection(COLLECTION_NAME);
    return (0, db_1.getCollection)(COLLECTION_NAME);
}
function findActive(db) {
    const coll = getColl(db);
    return coll.find({ isActive: true }, { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { price: 1 } }).toArray();
}
function findByName(name, db) {
    const coll = getColl(db);
    return coll.findOne({ name, isActive: true }, { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 } });
}
async function createFrame(frameData, db) {
    const coll = getColl(db);
    const finalData = { isActive: true, ...frameData };
    const result = await coll.insertOne(finalData);
    return { _id: result.insertedId, ...finalData };
}
function findByPriceRange(minPrice, maxPrice, db) {
    const coll = getColl(db);
    return coll.find({ isActive: true, price: { $gte: minPrice, $lte: maxPrice } }, { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { price: 1 } }).toArray();
}
function findByDuration(minDays, maxDays, db) {
    const coll = getColl(db);
    const query = { isActive: true, duration: { $gte: minDays } };
    if (maxDays)
        query.duration.$lte = maxDays;
    return coll.find(query, { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { duration: 1 } }).toArray();
}
function findMostExpensive(limit = 10, db) {
    const coll = getColl(db);
    return coll.find({ isActive: true }, { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { price: -1 }, limit }).toArray();
}
function findCheapest(limit = 10, db) {
    const coll = getColl(db);
    return coll.find({ isActive: true }, { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { price: 1 }, limit }).toArray();
}
function findRecent(limit = 10, db) {
    const coll = getColl(db);
    return coll.find({ isActive: true }, { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { createdAt: -1 }, limit }).toArray();
}
async function deactivateFrame(frameId, db) {
    const coll = getColl(db);
    return coll.findOneAndUpdate({ _id: frameId }, { $set: { isActive: false } }, { projection: { name: 1, price: 1, duration: 1, isActive: 1, updatedAt: 1 }, returnDocument: 'after' });
}
function findByIdWithProjection(frameId, db) {
    const coll = getColl(db);
    return coll.findOne({ _id: frameId, isActive: true }, { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 } });
}
function countActiveFrames(db) {
    const coll = getColl(db);
    return coll.countDocuments({ isActive: true });
}
class Frame extends BaseModel_1.BaseModel {
}
exports.Frame = Frame;
Frame.collectionName = COLLECTION_NAME;
Frame.getColl = getColl;
