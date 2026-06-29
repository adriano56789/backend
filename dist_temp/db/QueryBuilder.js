"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryBuilder = void 0;
var DocumentProxy_1 = require("./DocumentProxy");
var QueryBuilder = /** @class */ (function () {
    function QueryBuilder(collection, filter, mode) {
        this._projection = {};
        this._sort = {};
        this._limitValue = 0;
        this._skipValue = 0;
        this._collection = collection;
        this._filter = filter;
        this._mode = mode;
    }
    QueryBuilder.prototype.select = function (fields) {
        if (typeof fields === 'string') {
            var parts = fields.split(/\s+/);
            for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
                var p = parts_1[_i];
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
    };
    QueryBuilder.prototype.sort = function (sort) {
        this._sort = sort;
        return this;
    };
    QueryBuilder.prototype.limit = function (n) {
        this._limitValue = n;
        return this;
    };
    QueryBuilder.prototype.skip = function (n) {
        this._skipValue = n;
        return this;
    };
    QueryBuilder.prototype.lean = function () {
        return this;
    };
    QueryBuilder.prototype.populate = function (field, select) {
        return this;
    };
    QueryBuilder.prototype._buildOptions = function () {
        var opts = {};
        if (Object.keys(this._projection).length > 0)
            opts.projection = this._projection;
        if (Object.keys(this._sort).length > 0)
            opts.sort = this._sort;
        if (this._limitValue > 0)
            opts.limit = this._limitValue;
        if (this._skipValue > 0)
            opts.skip = this._skipValue;
        return opts;
    };
    QueryBuilder.prototype._execFindOne = function () {
        var _this = this;
        var opts = this._buildOptions();
        return this._collection.findOne(this._filter, opts).then(function (doc) {
            if (!doc)
                return null;
            return new DocumentProxy_1.DocumentProxy(_this._collection, { _id: doc._id }, doc, false);
        });
    };
    QueryBuilder.prototype._execFind = function () {
        var _this = this;
        var opts = this._buildOptions();
        return this._collection.find(this._filter, opts).toArray().then(function (docs) {
            return docs.map(function (d) { return new DocumentProxy_1.DocumentProxy(_this._collection, { _id: d._id }, d, false); });
        });
    };
    QueryBuilder.prototype.then = function (onfulfilled, onrejected) {
        var promise = this._mode === 'findOne'
            ? this._execFindOne()
            : this._execFind();
        return promise.then(onfulfilled, onrejected);
    };
    QueryBuilder.prototype.exec = function () {
        return (this._mode === 'findOne'
            ? this._execFindOne()
            : this._execFind());
    };
    QueryBuilder.prototype.toArray = function () {
        return this._execFind();
    };
    return QueryBuilder;
}());
exports.QueryBuilder = QueryBuilder;
