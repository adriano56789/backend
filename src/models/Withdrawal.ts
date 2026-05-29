import { Db, Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';
import { getCollection } from '../config/db';

export interface IWithdrawalBasic {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  isRecent: boolean;
  processingTime?: number;
}

export interface IWithdrawalList {
  id: string;
  userId: string;
  amount: number;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  netAmount: number;
  feeAmount: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  isRecent: boolean;
  processingTime?: number;
}

export interface IWithdrawalDetail {
  id: string;
  userId: string;
  amount: number;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  mpPaymentId?: string;
  externalReference: string;
  payerEmail: string;
  dateCreated?: string;
  dateApproved?: string;
  transactionAmount: number;
  netAmount: number;
  feeAmount: number;
  processedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
  retryCount?: number;
  lastRetryAt?: Date;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  isRecent: boolean;
  processingTime?: number;
}

export interface IWithdrawalFull extends IWithdrawal {
}

export interface IWithdrawal {
  id: string;
  userId: string;
  amount: number;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  mpPaymentId?: string;
  externalReference: string;
  payerEmail: string;
  dateCreated?: string;
  dateApproved?: string;
  transactionAmount: number;
  netAmount: number;
  feeAmount: number;
  processedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
  retryCount?: number;
  lastRetryAt?: Date;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'withdrawals';

function getColl(db?: Db): Collection<any> {
  if (db) return db.collection<IWithdrawal>(COLLECTION_NAME);
  return getCollection<IWithdrawal>(COLLECTION_NAME);
}

export function findBasic(userId?: string, status?: string, limit?: number, db?: Db) {
  const coll = getColl(db);
  const query: any = {};
  if (userId) query.userId = userId;
  if (status) query.status = status;
  const cursor = coll.find(query, {
    projection: { id: 1, userId: 1, amount: 1, status: 1, createdAt: 1, _id: 0 },
    sort: { createdAt: -1 }
  });
  if (limit) cursor.limit(limit);
  return cursor.toArray();
}

export function findList(userId?: string, status?: string, limit?: number, db?: Db) {
  const coll = getColl(db);
  const query: any = {};
  if (userId) query.userId = userId;
  if (status) query.status = status;
  const cursor = coll.find(query, {
    projection: { id: 1, userId: 1, amount: 1, description: 1, status: 1, netAmount: 1, feeAmount: 1, createdAt: 1, processedAt: 1, completedAt: 1, _id: 0 },
    sort: { createdAt: -1 }
  });
  if (limit) cursor.limit(limit);
  return cursor.toArray();
}

export function findDetail(withdrawalId: string, db?: Db) {
  const coll = getColl(db);
  return coll.findOne({ id: withdrawalId }, {
    projection: { id: 1, userId: 1, amount: 1, description: 1, status: 1, mpPaymentId: 1, externalReference: 1, payerEmail: 1, dateCreated: 1, dateApproved: 1, transactionAmount: 1, netAmount: 1, feeAmount: 1, processedAt: 1, completedAt: 1, failureReason: 1, retryCount: 1, lastRetryAt: 1, metadata: 1, createdAt: 1, updatedAt: 1, _id: 0 }
  });
}

export function findByWithdrawalId(withdrawalId: string, projection: 'basic' | 'list' | 'detail' = 'basic', db?: Db) {
  const coll = getColl(db);
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, amount: 1, status: 1, createdAt: 1, _id: 0 },
    list: { id: 1, userId: 1, amount: 1, description: 1, status: 1, netAmount: 1, feeAmount: 1, createdAt: 1, processedAt: 1, completedAt: 1, _id: 0 },
    detail: { id: 1, userId: 1, amount: 1, description: 1, status: 1, mpPaymentId: 1, externalReference: 1, payerEmail: 1, dateCreated: 1, dateApproved: 1, transactionAmount: 1, netAmount: 1, feeAmount: 1, processedAt: 1, completedAt: 1, failureReason: 1, retryCount: 1, lastRetryAt: 1, metadata: 1, createdAt: 1, updatedAt: 1, _id: 0 }
  };
  return coll.findOne({ id: withdrawalId }, { projection: projections[projection] });
}

export function findByUser(userId: string, status?: string, projection: 'basic' | 'list' = 'basic', db?: Db) {
  const coll = getColl(db);
  const query: any = { userId };
  if (status) query.status = status;
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, amount: 1, status: 1, createdAt: 1, _id: 0 },
    list: { id: 1, userId: 1, amount: 1, description: 1, status: 1, netAmount: 1, feeAmount: 1, createdAt: 1, processedAt: 1, completedAt: 1, _id: 0 }
  };
  return coll.find(query, { projection: projections[projection], sort: { createdAt: -1 } }).toArray();
}

export function findByExternalReference(externalReference: string, projection: 'basic' | 'list' | 'detail' = 'detail', db?: Db) {
  const coll = getColl(db);
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, amount: 1, status: 1, createdAt: 1, _id: 0 },
    list: { id: 1, userId: 1, amount: 1, description: 1, status: 1, netAmount: 1, feeAmount: 1, createdAt: 1, processedAt: 1, completedAt: 1, _id: 0 },
    detail: { id: 1, userId: 1, amount: 1, description: 1, status: 1, mpPaymentId: 1, externalReference: 1, payerEmail: 1, dateCreated: 1, dateApproved: 1, transactionAmount: 1, netAmount: 1, feeAmount: 1, processedAt: 1, completedAt: 1, failureReason: 1, retryCount: 1, lastRetryAt: 1, metadata: 1, createdAt: 1, updatedAt: 1, _id: 0 }
  };
  return coll.findOne({ externalReference }, { projection: projections[projection] });
}

export function findByMpPaymentId(mpPaymentId: string, projection: 'basic' | 'list' | 'detail' = 'detail', db?: Db) {
  const coll = getColl(db);
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, amount: 1, status: 1, createdAt: 1, _id: 0 },
    list: { id: 1, userId: 1, amount: 1, description: 1, status: 1, netAmount: 1, feeAmount: 1, createdAt: 1, processedAt: 1, completedAt: 1, _id: 0 },
    detail: { id: 1, userId: 1, amount: 1, description: 1, status: 1, mpPaymentId: 1, externalReference: 1, payerEmail: 1, dateCreated: 1, dateApproved: 1, transactionAmount: 1, netAmount: 1, feeAmount: 1, processedAt: 1, completedAt: 1, failureReason: 1, retryCount: 1, lastRetryAt: 1, metadata: 1, createdAt: 1, updatedAt: 1, _id: 0 }
  };
  return coll.findOne({ mpPaymentId }, { projection: projections[projection] });
}

export async function findPaginated(page: number = 1, limit: number = 20, filters?: {
  userId?: string;
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  minDate?: Date;
  maxDate?: Date;
  hasMpPaymentId?: boolean;
  hasFailureReason?: boolean;
}, projection: 'basic' | 'list' = 'basic', db?: Db) {
  const coll = getColl(db);
  const skip = (page - 1) * limit;
  const query: any = {};
  if (filters?.userId) query.userId = filters.userId;
  if (filters?.status) query.status = filters.status;
  if (filters?.minAmount !== undefined || filters?.maxAmount !== undefined) {
    query.amount = {};
    if (filters?.minAmount !== undefined) query.amount.$gte = filters.minAmount;
    if (filters?.maxAmount !== undefined) query.amount.$lte = filters.maxAmount;
  }
  if (filters?.minDate || filters?.maxDate) {
    query.createdAt = {};
    if (filters?.minDate) query.createdAt.$gte = filters.minDate;
    if (filters?.maxDate) query.createdAt.$lte = filters.maxDate;
  }
  if (filters?.hasMpPaymentId !== undefined) {
    query.mpPaymentId = filters.hasMpPaymentId ? { $exists: true, $ne: null } : { $exists: false };
  }
  if (filters?.hasFailureReason !== undefined) {
    query.failureReason = filters.hasFailureReason ? { $exists: true, $ne: null } : { $exists: false };
  }
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, amount: 1, status: 1, createdAt: 1, _id: 0 },
    list: { id: 1, userId: 1, amount: 1, description: 1, status: 1, netAmount: 1, feeAmount: 1, createdAt: 1, processedAt: 1, completedAt: 1, _id: 0 }
  };
  const [data, total] = await Promise.all([
    coll.find(query, { projection: projections[projection], sort: { createdAt: -1 }, skip, limit }).toArray(),
    coll.countDocuments(query)
  ]);
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export function getGlobalStats(db?: Db) {
  const coll = getColl(db);
  return coll.aggregate([
    {
      $group: {
        _id: null,
        totalWithdrawals: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalNetAmount: { $sum: '$netAmount' },
        totalFees: { $sum: '$feeAmount' },
        avgAmount: { $avg: '$amount' },
        avgFeeAmount: { $avg: '$feeAmount' },
        maxAmount: { $max: '$amount' },
        minAmount: { $min: '$amount' },
        uniqueUsers: { $addToSet: '$userId' },
        lastWithdrawal: { $max: '$createdAt' },
        firstWithdrawal: { $min: '$createdAt' }
      }
    },
    {
      $project: {
        _id: 0,
        totalWithdrawals: 1,
        totalAmount: { $round: ['$totalAmount', 2] },
        totalNetAmount: { $round: ['$totalNetAmount', 2] },
        totalFees: { $round: ['$totalFees', 2] },
        avgAmount: { $round: ['$avgAmount', 2] },
        avgFeeAmount: { $round: ['$avgFeeAmount', 2] },
        maxAmount: 1,
        minAmount: 1,
        uniqueUsersCount: { $size: '$uniqueUsers' },
        feeRate: { $multiply: [{ $divide: ['$totalFees', '$totalAmount'] }, 100] },
        lastWithdrawal: 1,
        firstWithdrawal: 1
      }
    }
  ]).toArray();
}

export function getUserStats(userId: string, db?: Db) {
  const coll = getColl(db);
  return coll.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalNetAmount: { $sum: '$netAmount' },
        totalFees: { $sum: '$feeAmount' },
        avgAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' },
        minAmount: { $min: '$amount' },
        lastWithdrawal: { $max: '$createdAt' },
        firstWithdrawal: { $min: '$createdAt' }
      }
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        totalAmount: { $round: ['$totalAmount', 2] },
        totalNetAmount: { $round: ['$totalNetAmount', 2] },
        totalFees: { $round: ['$totalFees', 2] },
        avgAmount: { $round: ['$avgAmount', 2] },
        maxAmount: 1,
        minAmount: 1,
        feeRate: { $multiply: [{ $divide: ['$totalFees', '$totalAmount'] }, 100] },
        lastWithdrawal: 1,
        firstWithdrawal: 1,
        _id: 0
      }
    },
    { $sort: { status: 1 } }
  ]).toArray();
}

export function getStatusStats(db?: Db) {
  const coll = getColl(db);
  return coll.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalNetAmount: { $sum: '$netAmount' },
        totalFees: { $sum: '$feeAmount' },
        avgAmount: { $avg: '$amount' },
        avgProcessingTime: { $avg: { $subtract: ['$processedAt', '$createdAt'] } },
        lastWithdrawal: { $max: '$createdAt' }
      }
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        totalAmount: { $round: ['$totalAmount', 2] },
        totalNetAmount: { $round: ['$totalNetAmount', 2] },
        totalFees: { $round: ['$totalFees', 2] },
        avgAmount: { $round: ['$avgAmount', 2] },
        avgProcessingTime: { $round: [{ $divide: [{ $subtract: ['$processedAt', '$createdAt'] }, 1000 * 60] }, 2] },
        percentage: { $multiply: [{ $divide: ['$count', { $sum: '$count' }] }, 100] },
        lastWithdrawal: 1,
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
}

export function getAmountStats(db?: Db) {
  const coll = getColl(db);
  return coll.aggregate([
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $lte: ['$amount', 50] }, then: 'small' },
              { case: { $lte: ['$amount', 200] }, then: 'medium' },
              { case: { $lte: ['$amount', 500] }, then: 'large' },
              { case: { $lte: ['$amount', 1000] }, then: 'veryLarge' }
            ],
            default: 'huge'
          }
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: '$feeAmount' },
        avgAmount: { $avg: '$amount' },
        avgFeeAmount: { $avg: '$feeAmount' }
      }
    },
    {
      $project: {
        amountRange: '$_id',
        count: 1,
        totalAmount: { $round: ['$totalAmount', 2] },
        totalFees: { $round: ['$totalFees', 2] },
        avgAmount: { $round: ['$avgAmount', 2] },
        avgFeeAmount: { $round: ['$avgFeeAmount', 2] },
        percentage: { $multiply: [{ $divide: ['$count', { $sum: '$count' }] }, 100] },
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
}

export function getProcessingStats(db?: Db) {
  const coll = getColl(db);
  return coll.aggregate([
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $and: [{ $ne: ['$processedAt', null] }, { $ne: ['$completedAt', null] }] }, then: 'completed' },
              { case: { $eq: ['$status', 'pending'] }, then: 'pending' },
              { case: { $eq: ['$status', 'processing'] }, then: 'processing' },
              { case: { $eq: ['$status', 'failed'] }, then: 'failed' },
              { case: { $eq: ['$status', 'cancelled'] }, then: 'cancelled' }
            ],
            default: 'unknown'
          }
        },
        count: { $sum: 1 },
        avgProcessingTime: { $avg: { $cond: [{ $and: [{ $ne: ['$processedAt', null] }, { $ne: ['$createdAt', null] }] }, { $subtract: ['$processedAt', '$createdAt'] }, null] } },
        totalAmount: { $sum: '$amount' }
      }
    },
    {
      $project: {
        processingStatus: '$_id',
        count: 1,
        avgProcessingTime: { $round: [{ $divide: ['$avgProcessingTime', 1000 * 60] }, 2] },
        totalAmount: { $round: ['$totalAmount', 2] },
        percentage: { $multiply: [{ $divide: ['$count', { $sum: '$count' }] }, 100] },
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
}

export function getFeeStats(db?: Db) {
  const coll = getColl(db);
  return coll.aggregate([
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $lte: ['$feeAmount', 5] }, then: 'veryLow' },
              { case: { $lte: ['$feeAmount', 15] }, then: 'low' },
              { case: { $lte: ['$feeAmount', 30] }, then: 'medium' },
              { case: { $lte: ['$feeAmount', 50] }, then: 'high' }
            ],
            default: 'veryHigh'
          }
        },
        count: { $sum: 1 },
        totalFees: { $sum: '$feeAmount' },
        avgFeeAmount: { $avg: '$feeAmount' },
        totalAmount: { $sum: '$amount' },
        avgFeePercentage: { $avg: { $multiply: [{ $divide: ['$feeAmount', '$amount'] }, 100] } }
      }
    },
    {
      $project: {
        feeCategory: '$_id',
        count: 1,
        totalFees: { $round: ['$totalFees', 2] },
        avgFeeAmount: { $round: ['$avgFeeAmount', 2] },
        totalAmount: { $round: ['$totalAmount', 2] },
        avgFeePercentage: { $round: ['$avgFeePercentage', 2] },
        percentage: { $multiply: [{ $divide: ['$count', { $sum: '$count' }] }, 100] },
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
}

export function getRecentWithdrawals(limit: number = 50, projection: 'basic' | 'list' = 'basic', db?: Db) {
  const coll = getColl(db);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, amount: 1, status: 1, createdAt: 1, _id: 0 },
    list: { id: 1, userId: 1, amount: 1, description: 1, status: 1, netAmount: 1, feeAmount: 1, createdAt: 1, processedAt: 1, completedAt: 1, _id: 0 }
  };
  return coll.find({ createdAt: { $gte: oneDayAgo } }, { projection: projections[projection], sort: { createdAt: -1 }, limit }).toArray();
}

export function getFailedWithdrawals(limit: number = 50, projection: 'basic' | 'list' = 'basic', db?: Db) {
  const coll = getColl(db);
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, amount: 1, status: 1, createdAt: 1, _id: 0 },
    list: { id: 1, userId: 1, amount: 1, description: 1, status: 1, netAmount: 1, feeAmount: 1, createdAt: 1, processedAt: 1, completedAt: 1, failureReason: 1, _id: 0 }
  };
  return coll.find({ status: 'failed' }, { projection: projections[projection], sort: { createdAt: -1 }, limit }).toArray();
}

export function updateMpStatus(externalReference: string, mpData: { mpPaymentId: string; status: string; dateCreated?: string; dateApproved?: string; transactionAmount: number; netAmount: number; feeAmount: number }, db?: Db) {
  const coll = getColl(db);
  const update: any = {
    mpPaymentId: mpData.mpPaymentId,
    dateCreated: mpData.dateCreated,
    dateApproved: mpData.dateApproved,
    transactionAmount: mpData.transactionAmount,
    netAmount: mpData.netAmount,
    feeAmount: mpData.feeAmount,
    processedAt: new Date()
  };
  switch (mpData.status) {
    case 'approved':
      update.status = 'completed';
      update.completedAt = new Date();
      break;
    case 'rejected':
    case 'cancelled':
      update.status = mpData.status === 'cancelled' ? 'cancelled' : 'failed';
      break;
    case 'in_process':
      update.status = 'processing';
      break;
    case 'pending':
      update.status = 'pending';
      break;
  }
  return coll.findOneAndUpdate({ externalReference }, { $set: update }, { returnDocument: 'after' });
}

export function countByStatus(userId: string, status: string, db?: Db) {
  const coll = getColl(db);
  return coll.countDocuments({ userId, status });
}

export function getUserTotals(userId: string, db?: Db) {
  const coll = getColl(db);
  return coll.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalNetAmount: { $sum: '$netAmount' },
        totalFees: { $sum: '$feeAmount' }
      }
    }
  ]).toArray();
}

export async function markAsProcessed(doc: IWithdrawal, mpData: any, db?: Db) {
  const coll = getColl(db);
  const update: any = {
    mpPaymentId: mpData.mpPaymentId,
    dateCreated: mpData.dateCreated,
    dateApproved: mpData.dateApproved,
    transactionAmount: mpData.transactionAmount,
    netAmount: mpData.netAmount,
    feeAmount: mpData.feeAmount,
    processedAt: new Date()
  };
  if (mpData.status === 'approved') {
    update.status = 'completed';
    update.completedAt = new Date();
  } else if (mpData.status === 'rejected') {
    update.status = 'failed';
  }
  return coll.updateOne({ _id: (doc as any)._id }, { $set: update });
}

export async function markAsFailed(doc: IWithdrawal, reason: string, db?: Db) {
  const coll = getColl(db);
  return coll.updateOne(
    { _id: (doc as any)._id },
    { $set: { status: 'failed', failureReason: reason, lastRetryAt: new Date() }, $inc: { retryCount: 1 } }
  );
}

export async function cancelWithdrawal(doc: IWithdrawal, reason?: string, db?: Db) {
  const coll = getColl(db);
  const update: any = { status: 'cancelled' };
  if (reason) update.failureReason = reason;
  return coll.updateOne({ _id: (doc as any)._id }, { $set: update });
}

export function canRetry(doc: IWithdrawal, maxRetries: number = 3): boolean {
  return doc.status === 'failed' && (doc.retryCount || 0) < maxRetries;
}

export function getProcessingTime(doc: IWithdrawal): number {
  if (doc.processedAt && doc.createdAt) {
    return Math.floor((doc.processedAt.getTime() - doc.createdAt.getTime()) / (1000 * 60));
  }
  return 0;
}

export function isRecentWithdrawal(doc: IWithdrawal): boolean {
  const now = new Date();
  const hoursSinceCreation = Math.floor((now.getTime() - doc.createdAt.getTime()) / (1000 * 60 * 60));
  return hoursSinceCreation <= 24;
}

export function getFeePercentage(doc: IWithdrawal): number {
  if (doc.amount > 0) return Math.round((doc.feeAmount / doc.amount) * 100 * 100) / 100;
  return 0;
}

export class Withdrawal extends BaseModel<IWithdrawal> {
  static collectionName = COLLECTION_NAME;
  static getColl = getColl;
}
