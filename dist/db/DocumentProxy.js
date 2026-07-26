"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentProxy = void 0;
class DocumentProxy {
    constructor(collection, filter, data, isNew = false) {
        this._collection = collection;
        this._filter = filter;
        this._isNew = isNew;
        Object.assign(this, data);
    }
    _getData() {
        const data = {};
        for (const key of Object.keys(this)) {
            if (!key.startsWith('_')) {
                data[key] = this[key];
            }
        }
        return data;
    }
    async save() {
        if (this._isNew) {
            const data = this._getData();
            await this._collection.insertOne(data);
            this._isNew = false;
            this._filter = { id: data.id };
        }
        else if (this._filter) {
            await this._collection.updateOne(this._filter, { $set: this._getData() });
        }
        return this;
    }
    toObject() {
        return this._getData();
    }
}
exports.DocumentProxy = DocumentProxy;
