"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseModel = void 0;
var db_1 = require("../config/db");
var QueryBuilder_1 = require("./QueryBuilder");
var DocumentProxy_1 = require("./DocumentProxy");
var BaseModel = /** @class */ (function () {
    function BaseModel() {
    }
    BaseModel._coll = function () {
        return (0, db_1.getDb)().collection(this.collectionName);
    };
    BaseModel.find = function (filter) {
        if (filter === void 0) { filter = {}; }
        var coll = this._coll();
        return new QueryBuilder_1.QueryBuilder(coll, filter, 'find');
    };
    BaseModel.findOne = function (filter) {
        if (filter === void 0) { filter = {}; }
        var coll = this._coll();
        return new QueryBuilder_1.QueryBuilder(coll, filter, 'findOne');
    };
    BaseModel.findById = function (id) {
        return this.findOne({ id: id });
    };
    BaseModel.create = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var coll, doc, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        coll = this._coll();
                        doc = __assign(__assign({}, data), { createdAt: data.createdAt || new Date(), updatedAt: data.updatedAt || new Date() });
                        return [4 /*yield*/, coll.insertOne(doc)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, new DocumentProxy_1.DocumentProxy(coll, { _id: result.insertedId }, __assign({ _id: result.insertedId }, doc), false)];
                }
            });
        });
    };
    BaseModel.updateOne = function (filter, update) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._coll().updateOne(filter, update)];
            });
        });
    };
    BaseModel.updateMany = function (filter, update) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._coll().updateMany(filter, update)];
            });
        });
    };
    BaseModel.deleteOne = function (filter) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._coll().deleteOne(filter)];
            });
        });
    };
    BaseModel.deleteMany = function (filter) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._coll().deleteMany(filter)];
            });
        });
    };
    BaseModel.countDocuments = function () {
        return __awaiter(this, arguments, void 0, function (filter) {
            if (filter === void 0) { filter = {}; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this._coll().countDocuments(filter)];
            });
        });
    };
    BaseModel.exists = function (filter) {
        return __awaiter(this, void 0, void 0, function () {
            var doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._coll().findOne(filter, { projection: { _id: 1 } })];
                    case 1:
                        doc = _a.sent();
                        return [2 /*return*/, doc !== null];
                }
            });
        });
    };
    BaseModel.aggregate = function (pipeline) {
        return this._coll().aggregate(pipeline);
    };
    BaseModel.bulkWrite = function (ops) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._coll().bulkWrite(ops)];
            });
        });
    };
    BaseModel.insertMany = function (docs) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._coll().insertMany(docs.map(function (d) { return (__assign(__assign({}, d), { createdAt: new Date(), updatedAt: new Date() })); }))];
            });
        });
    };
    BaseModel.findOneAndUpdate = function (filter_1, update_1) {
        return __awaiter(this, arguments, void 0, function (filter, update, options) {
            var coll, opts, doc;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        coll = this._coll();
                        opts = { returnDocument: 'after' };
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
                        return [4 /*yield*/, coll.findOneAndUpdate(filter, update, opts)];
                    case 1:
                        doc = _a.sent();
                        if (!doc)
                            return [2 /*return*/, null];
                        return [2 /*return*/, new DocumentProxy_1.DocumentProxy(coll, filter, doc, false)];
                }
            });
        });
    };
    BaseModel.findOneAndDelete = function (filter) {
        return __awaiter(this, void 0, void 0, function () {
            var coll, doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        coll = this._coll();
                        return [4 /*yield*/, coll.findOneAndDelete(filter)];
                    case 1:
                        doc = _a.sent();
                        if (!doc)
                            return [2 /*return*/, null];
                        return [2 /*return*/, new DocumentProxy_1.DocumentProxy(coll, filter, doc, false)];
                }
            });
        });
    };
    BaseModel.distinct = function (field_1) {
        return __awaiter(this, arguments, void 0, function (field, filter) {
            if (filter === void 0) { filter = {}; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this._coll().distinct(field, filter)];
            });
        });
    };
    BaseModel.insertOne = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._coll().insertOne(__assign(__assign({}, data), { createdAt: new Date(), updatedAt: new Date() }))];
            });
        });
    };
    return BaseModel;
}());
exports.BaseModel = BaseModel;
