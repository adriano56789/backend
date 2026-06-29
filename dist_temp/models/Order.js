"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.Order = exports.COLLECTION = void 0;
exports.createWithIdempotency = createWithIdempotency;
exports.createOrder = createOrder;
exports.findByUser = findByUser;
exports.findByUserMinimal = findByUserMinimal;
exports.findByStatus = findByStatus;
exports.findByPaymentStatus = findByPaymentStatus;
exports.findByExternalReference = findByExternalReference;
exports.findByMercadoPagoId = findByMercadoPagoId;
exports.findRecent = findRecent;
exports.findExpiredPix = findExpiredPix;
exports.updatePaymentStatus = updatePaymentStatus;
exports.countByStatus = countByStatus;
exports.countByPaymentStatus = countByPaymentStatus;
exports.countByPaymentMethod = countByPaymentMethod;
exports.getOrderStats = getOrderStats;
exports.findOrdersByDateRange = findOrdersByDateRange;
exports.findByAmountRange = findByAmountRange;
exports.findPixOrders = findPixOrders;
exports.confirmPayment = confirmPayment;
exports.cancelOrder = cancelOrder;
exports.markOrderAsFailed = markOrderAsFailed;
exports.isPixExpired = isPixExpired;
exports.isPaid = isPaid;
exports.isPending = isPending;
exports.isOrderFailed = isOrderFailed;
exports.isCancelled = isCancelled;
exports.isPaymentApproved = isPaymentApproved;
exports.isPixPayment = isPixPayment;
exports.isCreditCardPayment = isCreditCardPayment;
var BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'orders';
function createWithIdempotency(collection, orderData, externalReference) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!orderData.userId || !orderData.packageId || !orderData.amount || !orderData.diamonds) {
                throw new Error('userId, packageId, amount e diamonds s�o obrigat�rios');
            }
            if (orderData.amount < 0 || orderData.diamonds < 0) {
                throw new Error('Valores monet�rios n�o podem ser negativos');
            }
            return [2 /*return*/, collection.findOneAndUpdate({ externalReference: externalReference }, { $setOnInsert: __assign(__assign({}, orderData), { externalReference: externalReference }) }, { upsert: true, returnDocument: 'after' })];
        });
    });
}
function createOrder(collection, orderData) {
    return __awaiter(this, void 0, void 0, function () {
        var insertedId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!orderData.userId || !orderData.packageId || !orderData.amount || !orderData.diamonds) {
                        throw new Error('userId, packageId, amount e diamonds s�o obrigat�rios');
                    }
                    if (orderData.amount < 0 || orderData.diamonds < 0) {
                        throw new Error('Valores monet�rios n�o podem ser negativos');
                    }
                    return [4 /*yield*/, collection.insertOne(orderData)];
                case 1:
                    insertedId = (_a.sent()).insertedId;
                    return [2 /*return*/, __assign(__assign({}, orderData), { _id: insertedId })];
            }
        });
    });
}
function findByUser(collection, userId, status) {
    return __awaiter(this, void 0, void 0, function () {
        var query;
        return __generator(this, function (_a) {
            query = { userId: userId };
            if (status)
                query.status = status;
            return [2 /*return*/, collection.find(query, {
                    projection: {
                        id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                        status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
                        pixExpiration: 1, confirmedAt: 1, cancelledAt: 1, mpPaymentId: 1,
                        externalReference: 1, createdAt: 1, updatedAt: 1
                    },
                    sort: { createdAt: -1 }
                }).toArray()];
        });
    });
}
function findByUserMinimal(collection, userId, status) {
    return __awaiter(this, void 0, void 0, function () {
        var query;
        return __generator(this, function (_a) {
            query = { userId: userId };
            if (status)
                query.status = status;
            return [2 /*return*/, collection.find(query, {
                    projection: { id: 1, amount: 1, diamonds: 1, status: 1, paymentStatus: 1, paymentMethod: 1, createdAt: 1 },
                    sort: { createdAt: -1 }
                }).toArray()];
        });
    });
}
function findByStatus(collection, status, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var options;
        return __generator(this, function (_a) {
            options = {
                projection: {
                    id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                    status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
                    cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
                },
                sort: { createdAt: -1 }
            };
            if (limit)
                options.limit = limit;
            return [2 /*return*/, collection.find({ status: status }, options).toArray()];
        });
    });
}
function findByPaymentStatus(collection, paymentStatus, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var options;
        return __generator(this, function (_a) {
            options = {
                projection: {
                    id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                    status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
                    cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
                },
                sort: { createdAt: -1 }
            };
            if (limit)
                options.limit = limit;
            return [2 /*return*/, collection.find({ paymentStatus: paymentStatus }, options).toArray()];
        });
    });
}
function findByExternalReference(collection, externalReference) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.findOne({ externalReference: externalReference }, {
                    projection: {
                        id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                        status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
                        pixExpiration: 1, confirmedAt: 1, cancelledAt: 1, mpPaymentId: 1,
                        externalReference: 1, createdAt: 1, updatedAt: 1
                    }
                })];
        });
    });
}
function findByMercadoPagoId(collection, mpPaymentId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.findOne({ mpPaymentId: mpPaymentId }, {
                    projection: {
                        id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                        status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
                        pixExpiration: 1, confirmedAt: 1, cancelledAt: 1, mpPaymentId: 1,
                        externalReference: 1, createdAt: 1, updatedAt: 1
                    }
                })];
        });
    });
}
function findRecent(collection_1) {
    return __awaiter(this, arguments, void 0, function (collection, limit) {
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.find({}, {
                    projection: {
                        id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                        status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
                        cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
                    },
                    sort: { createdAt: -1 },
                    limit: limit
                }).toArray()];
        });
    });
}
function findExpiredPix(collection) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.find({
                    paymentMethod: 'pix',
                    status: 'pending',
                    pixExpiration: { $lt: new Date() }
                }, {
                    projection: {
                        id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                        status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
                        pixExpiration: 1, createdAt: 1, updatedAt: 1
                    },
                    sort: { pixExpiration: 1 }
                }).toArray()];
        });
    });
}
function updatePaymentStatus(collection, orderId, paymentStatus, mpPaymentId) {
    return __awaiter(this, void 0, void 0, function () {
        var update;
        return __generator(this, function (_a) {
            update = { $set: { paymentStatus: paymentStatus } };
            if (mpPaymentId) {
                update.$set.mpPaymentId = mpPaymentId;
            }
            return [2 /*return*/, collection.findOneAndUpdate({ id: orderId }, update, { returnDocument: 'after' })];
        });
    });
}
function countByStatus(collection, userId, status) {
    return __awaiter(this, void 0, void 0, function () {
        var query;
        return __generator(this, function (_a) {
            query = {};
            if (userId)
                query.userId = userId;
            if (status)
                query.status = status;
            return [2 /*return*/, collection.countDocuments(query)];
        });
    });
}
function countByPaymentStatus(collection, userId, paymentStatus) {
    return __awaiter(this, void 0, void 0, function () {
        var query;
        return __generator(this, function (_a) {
            query = {};
            if (userId)
                query.userId = userId;
            if (paymentStatus)
                query.paymentStatus = paymentStatus;
            return [2 /*return*/, collection.countDocuments(query)];
        });
    });
}
function countByPaymentMethod(collection, userId, paymentMethod) {
    return __awaiter(this, void 0, void 0, function () {
        var query;
        return __generator(this, function (_a) {
            query = {};
            if (userId)
                query.userId = userId;
            if (paymentMethod)
                query.paymentMethod = paymentMethod;
            return [2 /*return*/, collection.countDocuments(query)];
        });
    });
}
function getOrderStats(collection, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var matchStage;
        return __generator(this, function (_a) {
            matchStage = {};
            if (userId)
                matchStage.userId = userId;
            return [2 /*return*/, collection.aggregate([
                    { $match: matchStage },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                            paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
                            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                            totalAmount: { $sum: '$amount' },
                            totalDiamonds: { $sum: '$diamonds' },
                            avgAmount: { $avg: '$amount' },
                            pixOrders: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'pix'] }, 1, 0] } },
                            creditCardOrders: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'credit_card'] }, 1, 0] } },
                            approvedPayments: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'approved'] }, 1, 0] } },
                            rejectedPayments: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'rejected'] }, 1, 0] } }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            total: 1,
                            pending: 1,
                            paid: 1,
                            failed: 1,
                            cancelled: 1,
                            successRate: { $multiply: [{ $divide: ['$paid', '$total'] }, 100] },
                            totalAmount: 1,
                            totalDiamonds: 1,
                            avgAmount: { $round: ['$avgAmount', 2] },
                            pixOrders: 1,
                            creditCardOrders: 1,
                            approvedPayments: 1,
                            rejectedPayments: 1,
                            paymentApprovalRate: { $multiply: [{ $divide: ['$approvedPayments', { $add: ['$approvedPayments', '$rejectedPayments'] }] }, 100] }
                        }
                    }
                ]).toArray()];
        });
    });
}
function findOrdersByDateRange(collection, startDate, endDate, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var query;
        return __generator(this, function (_a) {
            query = { createdAt: { $gte: startDate, $lte: endDate } };
            if (userId)
                query.userId = userId;
            return [2 /*return*/, collection.find(query, {
                    projection: {
                        id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                        status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
                        cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
                    },
                    sort: { createdAt: -1 }
                }).toArray()];
        });
    });
}
function findByAmountRange(collection, minAmount, maxAmount, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var query;
        return __generator(this, function (_a) {
            query = { amount: { $gte: minAmount, $lte: maxAmount } };
            if (userId)
                query.userId = userId;
            return [2 /*return*/, collection.find(query, {
                    projection: {
                        id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                        status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
                        cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
                    },
                    sort: { amount: -1 }
                }).toArray()];
        });
    });
}
function findPixOrders(collection, status, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var query, options;
        return __generator(this, function (_a) {
            query = { paymentMethod: 'pix' };
            if (status)
                query.status = status;
            options = {
                projection: {
                    id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                    status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
                    pixExpiration: 1, confirmedAt: 1, cancelledAt: 1, mpPaymentId: 1,
                    createdAt: 1, updatedAt: 1
                },
                sort: { createdAt: -1 }
            };
            if (limit)
                options.limit = limit;
            return [2 /*return*/, collection.find(query, options).toArray()];
        });
    });
}
function confirmPayment(collection, id, mpPaymentId, paymentConfirmationId) {
    return __awaiter(this, void 0, void 0, function () {
        var update;
        return __generator(this, function (_a) {
            update = {
                $set: {
                    paymentStatus: 'approved',
                    status: 'paid',
                    mpPaymentId: mpPaymentId,
                    confirmedAt: new Date()
                }
            };
            if (paymentConfirmationId) {
                update.$set.paymentConfirmationId = paymentConfirmationId;
            }
            return [2 /*return*/, collection.findOneAndUpdate({ id: id }, update, { returnDocument: 'after' })];
        });
    });
}
function cancelOrder(collection, id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.findOneAndUpdate({ id: id }, {
                    $set: {
                        status: 'cancelled',
                        paymentStatus: 'cancelled',
                        cancelledAt: new Date()
                    }
                }, { returnDocument: 'after' })];
        });
    });
}
function markOrderAsFailed(collection, id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, collection.findOneAndUpdate({ id: id }, {
                    $set: {
                        status: 'failed',
                        paymentStatus: 'rejected'
                    }
                }, { returnDocument: 'after' })];
        });
    });
}
function isPixExpired(order) {
    return !!(order.pixExpiration && new Date() > order.pixExpiration);
}
function isPaid(order) {
    return order.status === 'paid';
}
function isPending(order) {
    return order.status === 'pending';
}
function isOrderFailed(order) {
    return order.status === 'failed';
}
function isCancelled(order) {
    return order.status === 'cancelled';
}
function isPaymentApproved(order) {
    return order.paymentStatus === 'approved';
}
function isPixPayment(order) {
    return order.paymentMethod === 'pix';
}
function isCreditCardPayment(order) {
    return order.paymentMethod === 'credit_card';
}
var Order = /** @class */ (function (_super) {
    __extends(Order, _super);
    function Order() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Order.collectionName = 'orders';
    return Order;
}(BaseModel_1.BaseModel));
exports.Order = Order;
