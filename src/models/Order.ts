import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IOrder {
    id: string;
    userId: string;
    packageId: string;
    amount: number;
    diamonds: number;
    status: 'pending' | 'paid' | 'failed' | 'cancelled';
    paymentStatus?: 'pending' | 'approved' | 'rejected' | 'cancelled';
    paymentMethod?: 'pix' | 'credit_card' | 'payoneer' | 'card' | 'payoneer_account';
    pixCode?: string;
    pixExpiration?: Date;
    paymentConfirmationId?: string;
    confirmedAt?: Date;
    cancelledAt?: Date;
    mpPaymentId?: string;
    externalReference?: string;
    pixQrCode?: string;
    paymentSessionId?: string;
    redirectUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'orders';

export async function createWithIdempotency(collection: Collection<IOrder>, orderData: any, externalReference: string): Promise<IOrder | null> {
    if (!orderData.userId || !orderData.packageId || !orderData.amount || !orderData.diamonds) {
        throw new Error('userId, packageId, amount e diamonds s�o obrigat�rios');
    }
    if (orderData.amount < 0 || orderData.diamonds < 0) {
        throw new Error('Valores monet�rios n�o podem ser negativos');
    }
    return collection.findOneAndUpdate(
        { externalReference },
        { $setOnInsert: { ...orderData, externalReference } },
        { upsert: true, returnDocument: 'after' }
    );
}

export async function createOrder(collection: Collection<IOrder>, orderData: any): Promise<IOrder> {
    if (!orderData.userId || !orderData.packageId || !orderData.amount || !orderData.diamonds) {
        throw new Error('userId, packageId, amount e diamonds s�o obrigat�rios');
    }
    if (orderData.amount < 0 || orderData.diamonds < 0) {
        throw new Error('Valores monet�rios n�o podem ser negativos');
    }
    const { insertedId } = await collection.insertOne(orderData);
    return { ...orderData, _id: insertedId } as unknown as IOrder;
}

export async function findByUser(collection: Collection<IOrder>, userId: string, status?: string): Promise<IOrder[]> {
    const query: any = { userId };
    if (status) query.status = status;
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

export async function findByUserMinimal(collection: Collection<IOrder>, userId: string, status?: string): Promise<IOrder[]> {
    const query: any = { userId };
    if (status) query.status = status;
    return collection.find(query, {
        projection: { id: 1, amount: 1, diamonds: 1, status: 1, paymentStatus: 1, paymentMethod: 1, createdAt: 1 },
        sort: { createdAt: -1 }
    }).toArray();
}

export async function findByStatus(collection: Collection<any>, status: string, limit?: number): Promise<IOrder[]> {
    const options: any = {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
            cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
        },
        sort: { createdAt: -1 }
    };
    if (limit) options.limit = limit;
    return collection.find({ status }, options).toArray();
}

export async function findByPaymentStatus(collection: Collection<any>, paymentStatus: string, limit?: number): Promise<IOrder[]> {
    const options: any = {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
            cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
        },
        sort: { createdAt: -1 }
    };
    if (limit) options.limit = limit;
    return collection.find({ paymentStatus }, options).toArray();
}

export async function findByExternalReference(collection: Collection<IOrder>, externalReference: string): Promise<IOrder | null> {
    return collection.findOne(
        { externalReference },
        {
            projection: {
                id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
                pixExpiration: 1, confirmedAt: 1, cancelledAt: 1, mpPaymentId: 1,
                externalReference: 1, createdAt: 1, updatedAt: 1
            }
        }
    );
}

export async function findByMercadoPagoId(collection: Collection<IOrder>, mpPaymentId: string): Promise<IOrder | null> {
    return collection.findOne(
        { mpPaymentId },
        {
            projection: {
                id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
                pixExpiration: 1, confirmedAt: 1, cancelledAt: 1, mpPaymentId: 1,
                externalReference: 1, createdAt: 1, updatedAt: 1
            }
        }
    );
}

export async function findRecent(collection: Collection<IOrder>, limit: number = 20): Promise<IOrder[]> {
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

export async function findExpiredPix(collection: Collection<IOrder>): Promise<IOrder[]> {
    return collection.find(
        {
            paymentMethod: 'pix',
            status: 'pending',
            pixExpiration: { $lt: new Date() }
        },
        {
            projection: {
                id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
                status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
                pixExpiration: 1, createdAt: 1, updatedAt: 1
            },
            sort: { pixExpiration: 1 }
        }
    ).toArray();
}

export async function updatePaymentStatus(collection: Collection<IOrder>, orderId: string, paymentStatus: string, mpPaymentId?: string): Promise<IOrder | null> {
    const update: any = { $set: { paymentStatus } };
    if (mpPaymentId) {
        update.$set.mpPaymentId = mpPaymentId;
    }
    return collection.findOneAndUpdate(
        { id: orderId },
        update,
        { returnDocument: 'after' }
    );
}

export async function countByStatus(collection: Collection<IOrder>, userId?: string, status?: string): Promise<number> {
    const query: any = {};
    if (userId) query.userId = userId;
    if (status) query.status = status;
    return collection.countDocuments(query);
}

export async function countByPaymentStatus(collection: Collection<IOrder>, userId?: string, paymentStatus?: string): Promise<number> {
    const query: any = {};
    if (userId) query.userId = userId;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    return collection.countDocuments(query);
}

export async function countByPaymentMethod(collection: Collection<IOrder>, userId?: string, paymentMethod?: string): Promise<number> {
    const query: any = {};
    if (userId) query.userId = userId;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    return collection.countDocuments(query);
}

export async function getOrderStats(collection: Collection<IOrder>, userId?: string): Promise<any[]> {
    const matchStage: any = {};
    if (userId) matchStage.userId = userId;
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

export async function findOrdersByDateRange(collection: Collection<IOrder>, startDate: Date, endDate: Date, userId?: string): Promise<IOrder[]> {
    const query: any = { createdAt: { $gte: startDate, $lte: endDate } };
    if (userId) query.userId = userId;
    return collection.find(query, {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
            cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
        },
        sort: { createdAt: -1 }
    }).toArray();
}

export async function findByAmountRange(collection: Collection<IOrder>, minAmount: number, maxAmount: number, userId?: string): Promise<IOrder[]> {
    const query: any = { amount: { $gte: minAmount, $lte: maxAmount } };
    if (userId) query.userId = userId;
    return collection.find(query, {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, confirmedAt: 1,
            cancelledAt: 1, mpPaymentId: 1, createdAt: 1, updatedAt: 1
        },
        sort: { amount: -1 }
    }).toArray();
}

export async function findPixOrders(collection: Collection<IOrder>, status?: string, limit?: number): Promise<IOrder[]> {
    const query: any = { paymentMethod: 'pix' };
    if (status) query.status = status;
    const options: any = {
        projection: {
            id: 1, userId: 1, packageId: 1, amount: 1, diamonds: 1,
            status: 1, paymentStatus: 1, paymentMethod: 1, pixCode: 1,
            pixExpiration: 1, confirmedAt: 1, cancelledAt: 1, mpPaymentId: 1,
            createdAt: 1, updatedAt: 1
        },
        sort: { createdAt: -1 }
    };
    if (limit) options.limit = limit;
    return collection.find(query, options).toArray();
}

export async function confirmPayment(collection: Collection<IOrder>, id: string, mpPaymentId: string, paymentConfirmationId?: string): Promise<IOrder | null> {
    const update: any = {
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
    return collection.findOneAndUpdate(
        { id },
        update,
        { returnDocument: 'after' }
    );
}

export async function cancelOrder(collection: Collection<IOrder>, id: string): Promise<IOrder | null> {
    return collection.findOneAndUpdate(
        { id },
        {
            $set: {
                status: 'cancelled',
                paymentStatus: 'cancelled',
                cancelledAt: new Date()
            }
        },
        { returnDocument: 'after' }
    );
}

export async function markOrderAsFailed(collection: Collection<IOrder>, id: string): Promise<IOrder | null> {
    return collection.findOneAndUpdate(
        { id },
        {
            $set: {
                status: 'failed',
                paymentStatus: 'rejected'
            }
        },
        { returnDocument: 'after' }
    );
}

export function isPixExpired(order: IOrder): boolean {
    return !!(order.pixExpiration && new Date() > order.pixExpiration);
}

export function isPaid(order: IOrder): boolean {
    return order.status === 'paid';
}

export function isPending(order: IOrder): boolean {
    return order.status === 'pending';
}

export function isOrderFailed(order: IOrder): boolean {
    return order.status === 'failed';
}

export function isCancelled(order: IOrder): boolean {
    return order.status === 'cancelled';
}

export function isPaymentApproved(order: IOrder): boolean {
    return order.paymentStatus === 'approved';
}

export function isPixPayment(order: IOrder): boolean {
    return order.paymentMethod === 'pix';
}

export function isCreditCardPayment(order: IOrder): boolean {
    return order.paymentMethod === 'credit_card';
}
export class Order extends BaseModel<IOrder> {
  static collectionName = 'orders';
}
