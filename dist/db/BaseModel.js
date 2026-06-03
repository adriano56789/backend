"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseModel = void 0;
const db_1 = require("../config/db");
const QueryBuilder_1 = require("./QueryBuilder");
const DocumentProxy_1 = require("./DocumentProxy");
class BaseModel {
    static _coll() {
        return (0, db_1.getDb)().collection(this.collectionName);
    }
    static find(filter = {}) {
        const coll = this._coll();
        return new QueryBuilder_1.QueryBuilder(coll, filter, 'find');
    }
    static findOne(filter = {}) {
        const coll = this._coll();
        return new QueryBuilder_1.QueryBuilder(coll, filter, 'findOne');
    }
    static findById(id) {
        return this.findOne({ id });
    }
    static async create(data) {
        const coll = this._coll();
        const doc = { ...data, createdAt: data.createdAt || new Date(), updatedAt: data.updatedAt || new Date() };
        const result = await coll.insertOne(doc);
        return new DocumentProxy_1.DocumentProxy(coll, { _id: result.insertedId }, { _id: result.insertedId, ...doc }, false);
    }
    static async updateOne(filter, update) {
        return this._coll().updateOne(filter, update);
    }
    static async updateMany(filter, update) {
        return this._coll().updateMany(filter, update);
    }
    static async deleteOne(filter) {
        return this._coll().deleteOne(filter);
    }
    static async deleteMany(filter) {
        return this._coll().deleteMany(filter);
    }
    static async countDocuments(filter = {}) {
        return this._coll().countDocuments(filter);
    }
    static async exists(filter) {
        const doc = await this._coll().findOne(filter, { projection: { _id: 1 } });
        return doc !== null;
    }
    static aggregate(pipeline) {
        return this._coll().aggregate(pipeline);
    }
    static async bulkWrite(ops) {
        return this._coll().bulkWrite(ops);
    }
    static async insertMany(docs) {
        return this._coll().insertMany(docs.map((d) => ({ ...d, createdAt: new Date(), updatedAt: new Date() })));
    }
    static async findOneAndUpdate(filter, update, options = {}) {
        const coll = this._coll();
        const opts = { returnDocument: 'after' };
        if (options.returnDocument === 'before')
            opts.returnDocument = 'before';
        if (options.projection)
            opts.projection = options.projection;
        if (options.upsert)
            opts.upsert = true;
        if (options.sort)
            opts.sort = options.sort;
        if (options.new === false)
            opts.returnDocument = 'before';
        if (options.new === true)
            opts.returnDocument = 'after';
        const doc = await coll.findOneAndUpdate(filter, update, opts);
        if (!doc)
            return null;
        return new DocumentProxy_1.DocumentProxy(coll, filter, doc, false);
    }
    static async findOneAndDelete(filter) {
        const coll = this._coll();
        const doc = await coll.findOneAndDelete(filter);
        if (!doc)
            return null;
        return new DocumentProxy_1.DocumentProxy(coll, filter, doc, false);
    }
    static async distinct(field, filter = {}) {
        return this._coll().distinct(field, filter);
    }
    static async insertOne(data) {
        return this._coll().insertOne({ ...data, createdAt: new Date(), updatedAt: new Date() });
    }
}
exports.BaseModel = BaseModel;
