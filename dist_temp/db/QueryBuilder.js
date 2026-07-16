"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryBuilder = void 0;
const DocumentProxy_1 = require("./DocumentProxy");
class QueryBuilder {
    constructor(collection, filter, mode) {
        this._projection = {};
        this._sort = {};
        this._limitValue = 0;
        this._skipValue = 0;
        this._collection = collection;
        this._filter = filter;
        this._mode = mode;
    }
    select(fields) {
        if (typeof fields === 'string') {
            const parts = fields.split(/\s+/);
            for (const p of parts) {
                if (p.startsWith('-')) {
                    this._projection[p.slice(1)] = 0;
                }
                else {
                    this._projection[p] = 1;
                }
            }
        }
        else {
            Object.assign(this._projection, fields);
        }
        return this;
    }
    sort(sort) {
        this._sort = sort;
        return this;
    }
    limit(n) {
        this._limitValue = n;
        return this;
    }
    skip(n) {
        this._skipValue = n;
        return this;
    }
    lean() {
        return this;
    }
    populate(field, select) {
        return this;
    }
    _buildOptions() {
        const opts = {};
        if (Object.keys(this._projection).length > 0)
            opts.projection = this._projection;
        if (Object.keys(this._sort).length > 0)
            opts.sort = this._sort;
        if (this._limitValue > 0)
            opts.limit = this._limitValue;
        if (this._skipValue > 0)
            opts.skip = this._skipValue;
        return opts;
    }
    _execFindOne() {
        const opts = this._buildOptions();
        return this._collection.findOne(this._filter, opts).then((doc) => {
            if (!doc)
                return null;
            return new DocumentProxy_1.DocumentProxy(this._collection, { _id: doc._id }, doc, false);
        });
    }
    _execFind() {
        const opts = this._buildOptions();
        return this._collection.find(this._filter, opts).toArray().then((docs) => docs.map((d) => new DocumentProxy_1.DocumentProxy(this._collection, { _id: d._id }, d, false)));
    }
    then(onfulfilled, onrejected) {
        const promise = this._mode === 'findOne'
            ? this._execFindOne()
            : this._execFind();
        return promise.then(onfulfilled, onrejected);
    }
    exec() {
        return (this._mode === 'findOne'
            ? this._execFindOne()
            : this._execFind());
    }
    toArray() {
        return this._execFind();
    }
}
exports.QueryBuilder = QueryBuilder;
