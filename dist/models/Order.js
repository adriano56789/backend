"use strict";
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
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'orders';
async function createWithIdempotency(collection, orderData, externalReference) {
    if (!orderData.userId || !orderData.packageId || !orderData.amount || !orderData.diamonds) {
        throw new Error('userId, packageId, amount e diamonds s�o obrigat�rios');
    }
    if (orderData.amount < 0 || orderData.diamonds < 0) {
        throw new Error('Valores monet�rios n�o podem ser negativos');
    }
    return collection.findOneAndUpdate({ externalReference }, { $setOnInsert: { ...orderData, externalReference } }, { upsert: true, returnDocument: 'after' });
}
async function createOrder(collection, orderData) {
    if (!orderData.userId || !orderData.packageId || !orderData.amount || !orderData.diamonds) {
        throw new Error('userId, packageId, amount e diamonds s�o obrigat�rios');
    }
    if (orderData.amount < 0 || orderData.diamonds < 0) {
        throw new Error('Valores monet�rios n�o podem ser negativos');
    }
    const { insertedId } = await collection.insertOne(orderData);
    return { ...orderData, _id: insertedId };
}
async function findByUser(collection, userId, status) {
    const query = { userId };
    if (status)
        query.status = status;
    return collection.find(query, {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
            pixExpiration: 1, confirmedAt: 1, cancelledAt: 1, mpPaymentId: 1,
            externalReference: 1, createdAt: 1, updatedAt: 1
        },
        sort: { createdAt: -1 }
    }).toArray();
}
async function findByUserMinimal(collection, userId, status) {
    const query = { userId };
    if (status)
        query.status = status;
    return collection.find(query, {
        projection: { id: 1, amount: 1, diamonds: 1, status: 1, paymentStatus: 1, paymentMethod: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    }).toArray();
}
async function findByStatus(collection, status, limit) {
    const options = {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
            cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
        },
        sort: { createdAt: -1 }
    };
    if (limit)
        options.limit = limit;
    return collection.find({ status }, options).toArray();
}
async function findByPaymentStatus(collection, paymentStatus, limit) {
    const options = {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
            cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
        },
        sort: { createdAt: -1 }
    };
    if (limit)
        options.limit = limit;
    return collection.find({ paymentStatus }, options).toArray();
}
async function findByExternalReference(collection, externalReference) {
    return collection.findOne({ externalReference }, {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
            pixExpiration: 1, confirmedAt: 1, cancelledAt: 1, mpPaymentId: 1,
            externalReference: 1, createdAt: 1, updatedAt: 1
        }
    });
}
async function findByMercadoPagoId(collection, mpPaymentId) {
    return collection.findOne({ mpPaymentId }, {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
            pixExpiration: 1, confirmedAt: 1, cancelledAt: 1, mpPaymentId: 1,
            externalReference: 1, createdAt: 1, updatedAt: 1
        }
    });
}
async function findRecent(collection, limit = 20) {
    return collection.find({}, {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
            cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
        },
        sort: { createdAt: -1 },
        limit
    }).toArray();
}
async function findExpiredPix(collection) {
    return collection.find({
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
    }).toArray();
}
async function updatePaymentStatus(collection, orderId, paymentStatus, mpPaymentId) {
    const update = { $set: { paymentStatus } };
    if (mpPaymentId) {
        update.$set.mpPaymentId = mpPaymentId;
    }
    return collection.findOneAndUpdate({ id: orderId }, update, { returnDocument: 'after' });
}
async function countByStatus(collection, userId, status) {
    const query = {};
    if (userId)
        query.userId = userId;
    if (status)
        query.status = status;
    return collection.countDocuments(query);
}
async function countByPaymentStatus(collection, userId, paymentStatus) {
    const query = {};
    if (userId)
        query.userId = userId;
    if (paymentStatus)
        query.paymentStatus = paymentStatus;
    return collection.countDocuments(query);
}
async function countByPaymentMethod(collection, userId, paymentMethod) {
    const query = {};
    if (userId)
        query.userId = userId;
    if (paymentMethod)
        query.paymentMethod = paymentMethod;
    return collection.countDocuments(query);
}
async function getOrderStats(collection, userId) {
    const matchStage = {};
    if (userId)
        matchStage.userId = userId;
    return collection.aggregate([
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
    ]).toArray();
}
async function findOrdersByDateRange(collection, startDate, endDate, userId) {
    const query = { createdAt: { $gte: startDate, $lte: endDate } };
    if (userId)
        query.userId = userId;
    return collection.find(query, {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
            cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
        },
        sort: { createdAt: -1 }
    }).toArray();
}
async function findByAmountRange(collection, minAmount, maxAmount, userId) {
    const query = { amount: { $gte: minAmount, $lte: maxAmount } };
    if (userId)
        query.userId = userId;
    return collection.find(query, {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
            cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
        },
        sort: { amount: -1 }
    }).toArray();
}
async function findPixOrders(collection, status, limit) {
    const query = { paymentMethod: 'pix' };
    if (status)
        query.status = status;
    const options = {
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
    return collection.find(query, options).toArray();
}
async function confirmPayment(collection, id, mpPaymentId, paymentConfirmationId) {
    const update = {
        $set: {
            paymentStatus: 'approved',
            status: 'paid',
            mpPaymentId,
            confirmedAt: new Date()
        }
    };
    if (paymentConfirmationId) {
        update.$set.paymentConfirmationId = paymentConfirmationId;
    }
    return collection.findOneAndUpdate({ id }, update, { returnDocument: 'after' });
}
async function cancelOrder(collection, id) {
    return collection.findOneAndUpdate({ id }, {
        $set: {
            status: 'cancelled',
            paymentStatus: 'cancelled',
            cancelledAt: new Date()
        }
    }, { returnDocument: 'after' });
}
async function markOrderAsFailed(collection, id) {
    return collection.findOneAndUpdate({ id }, {
        $set: {
            status: 'failed',
            paymentStatus: 'rejected'
        }
    }, { returnDocument: 'after' });
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
class Order extends BaseModel_1.BaseModel {
}
exports.Order = Order;
Order.collectionName = 'orders';
