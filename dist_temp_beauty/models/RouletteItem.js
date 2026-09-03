"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouletteItem = void 0;
exports.findActiveByOwner = findActiveByOwner;
exports.findItemById = findItemById;
exports.createRouletteItem = createRouletteItem;
exports.updateRouletteItem = updateRouletteItem;
exports.deactivateRouletteItem = deactivateRouletteItem;
exports.hardDeleteRouletteItem = hardDeleteRouletteItem;
const mongodb_1 = require("mongodb");
const BaseModel_1 = require("../db/BaseModel");
const db_1 = require("../config/db");
const COLLECTION_NAME = 'roulette_items';
function getColl(db) {
    if (db)
        return db.collection(COLLECTION_NAME);
    return (0, db_1.getCollection)(COLLECTION_NAME);
}
// Listar itens ativos de um dono (ordem de criação)
function findActiveByOwner(ownerId, db) {
    const coll = getColl(db);
    return coll.find({ ownerId, isActive: true }, { sort: { createdAt: 1 } }).toArray();
}
// Buscar um item por id
async function findItemById(id, db) {
    const coll = getColl(db);
    let query = {};
    try {
        query = { _id: new mongodb_1.ObjectId(id) };
    }
    catch {
        query = { id };
    }
    return coll.findOne(query);
}
// Criar item (com timestamps automáticos)
async function createRouletteItem(data, db) {
    const coll = getColl(db);
    const now = new Date();
    const finalData = {
        isActive: true,
        type: 'action',
        amount: 0,
        color: '#8b5cf6',
        textColor: '#ffffff',
        icon: '🎁',
        ...data,
        createdAt: now,
        updatedAt: now,
    };
    const result = await coll.insertOne(finalData);
    return { _id: result.insertedId, ...finalData };
}
// Atualizar item por id
async function updateRouletteItem(id, update, db) {
    const coll = getColl(db);
    let query = {};
    try {
        query = { _id: new mongodb_1.ObjectId(id) };
    }
    catch {
        query = { id };
    }
    return coll.findOneAndUpdate(query, { $set: { ...update, updatedAt: new Date() } }, { returnDocument: 'after' });
}
// Remover (soft delete) item por id
async function deactivateRouletteItem(id, db) {
    const coll = getColl(db);
    let query = {};
    try {
        query = { _id: new mongodb_1.ObjectId(id) };
    }
    catch {
        query = { id };
    }
    return coll.findOneAndUpdate(query, { $set: { isActive: false, updatedAt: new Date() } }, { returnDocument: 'after' });
}
// Remover (hard delete) item por id
async function hardDeleteRouletteItem(id, db) {
    const coll = getColl(db);
    let query = {};
    try {
        query = { _id: new mongodb_1.ObjectId(id) };
    }
    catch {
        query = { id };
    }
    return coll.deleteOne(query);
}
class RouletteItem extends BaseModel_1.BaseModel {
}
exports.RouletteItem = RouletteItem;
RouletteItem.collectionName = COLLECTION_NAME;
RouletteItem.getColl = getColl;
