"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouletteSpin = void 0;
exports.recordSpin = recordSpin;
exports.findSpinsByUser = findSpinsByUser;
exports.findSpinsByStream = findSpinsByStream;
const BaseModel_1 = require("../db/BaseModel");
const db_1 = require("../config/db");
const COLLECTION_NAME = 'roulette_spins';
function getColl(db) {
    if (db)
        return db.collection(COLLECTION_NAME);
    return (0, db_1.getCollection)(COLLECTION_NAME);
}
// Registrar giro
async function recordSpin(data, db) {
    const coll = getColl(db);
    const finalData = {
        ...data,
        createdAt: new Date(),
    };
    const result = await coll.insertOne(finalData);
    return { _id: result.insertedId, ...finalData };
}
// Histórico de giros de um usuário (limitado)
function findSpinsByUser(userId, limit = 50, db) {
    const coll = getColl(db);
    return coll.find({ userId }, { sort: { createdAt: -1 }, limit }).toArray();
}
// Histórico de giros de uma stream (limitado)
function findSpinsByStream(streamId, limit = 100, db) {
    const coll = getColl(db);
    return coll.find({ streamId }, { sort: { createdAt: -1 }, limit }).toArray();
}
class RouletteSpin extends BaseModel_1.BaseModel {
}
exports.RouletteSpin = RouletteSpin;
RouletteSpin.collectionName = COLLECTION_NAME;
RouletteSpin.getColl = getColl;
