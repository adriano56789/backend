import { Db, Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';
import { getCollection } from '../config/db';

export enum ActivityType {
  JOIN_LIVE = 'join_live',
  LEAVE_LIVE = 'leave_live',
  START_LIVE = 'start_live',
  END_LIVE = 'end_live',
  FOLLOW_USER = 'follow_user',
  UNFOLLOW_USER = 'unfollow_user',
  BLOCK_USER = 'block_user',
  UNBLOCK_USER = 'unblock_user',
  SEND_FRIEND_REQUEST = 'send_friend_request',
  ACCEPT_FRIEND_REQUEST = 'accept_friend_request',
  REJECT_FRIEND_REQUEST = 'reject_friend_request',
  SEND_GIFT = 'send_gift',
  RECEIVE_GIFT = 'receive_gift',
  PURCHASE_ITEM = 'purchase_item',
  WITHDRAW_FUNDS = 'withdraw_funds',
  UPLOAD_PHOTO = 'upload_photo',
  UPLOAD_VIDEO = 'upload_video',
  DELETE_PHOTO = 'delete_photo',
  DELETE_VIDEO = 'delete_video',
  LIKE_CONTENT = 'like_content',
  UNLIKE_CONTENT = 'unlike_content',
  COMMENT_CONTENT = 'comment_content',
  SEND_MESSAGE = 'send_message',
  READ_MESSAGE = 'read_message',
  DELETE_MESSAGE = 'delete_message',
  UPDATE_PROFILE = 'update_profile',
  CHANGE_AVATAR = 'change_avatar',
  UPDATE_STATUS = 'update_status',
  LOGIN = 'login',
  LOGOUT = 'logout',
  CHANGE_SETTINGS = 'change_settings',
  REPORT_CONTENT = 'report_content'
}

export interface IUserActivityBasic {
  id: string;
  userId: string;
  activityType: ActivityType;
  targetId?: string;
  targetType?: string;
  timestamp: Date;
  metadata?: any;
}

export interface IUserActivityList {
  id: string;
  userId: string;
  activityType: ActivityType;
  targetId?: string;
  targetType?: string;
  timestamp: Date;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface IUserActivityDetail {
  id: string;
  userId: string;
  activityType: ActivityType;
  targetId?: string;
  targetType?: string;
  timestamp: Date;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  location?: { country?: string; city?: string; latitude?: number; longitude?: number };
  deviceInfo?: { platform?: string; browser?: string; version?: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserActivityFull extends IUserActivity {
}

export interface IUserActivity {
  id: string;
  userId: string;
  activityType: ActivityType;
  targetId?: string;
  targetType?: string;
  timestamp: Date;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  location?: { country?: string; city?: string; latitude?: number; longitude?: number };
  deviceInfo?: { platform?: string; browser?: string; version?: string; mobile?: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'useractivities';

function getColl(db?: Db): Collection<IUserActivity> {
  if (db) return db.collection<IUserActivity>(COLLECTION_NAME);
  return getCollection<IUserActivity>(COLLECTION_NAME);
}

export async function logActivity(data: {
  userId: string;
  activityType: ActivityType;
  targetId?: string;
  targetType?: string;
  metadata?: any;
  context?: { ipAddress?: string; userAgent?: string; sessionId?: string; location?: any; deviceInfo?: any };
}, db?: Db) {
  const coll = getColl(db);
  const activityData = {
    id: `ACT${Date.now()}${Math.floor(Math.random() * 1000)}`,
    userId: data.userId,
    activityType: data.activityType,
    targetId: data.targetId,
    targetType: data.targetType,
    timestamp: new Date(),
    metadata: data.metadata || {},
    ...data.context,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await coll.insertOne(activityData as any);
  return { _id: result.insertedId, ...activityData };
}

export function findBasic(userId?: string, limit?: number, db?: Db) {
  const coll = getColl(db);
  const query: any = {};
  if (userId) query.userId = userId;
  const cursor = coll.find(query, {
    projection: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
    sort: { timestamp: -1 }
  });
  if (limit) cursor.limit(limit);
  return cursor.toArray();
}

export function findList(userId?: string, limit?: number, db?: Db) {
  const coll = getColl(db);
  const query: any = {};
  if (userId) query.userId = userId;
  const cursor = coll.find(query, {
    projection: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 },
    sort: { timestamp: -1 }
  });
  if (limit) cursor.limit(limit);
  return cursor.toArray();
}

export function findDetail(activityId: string, db?: Db) {
  const coll = getColl(db);
  return coll.findOne({ id: activityId }, {
    projection: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, location: 1, deviceInfo: 1, createdAt: 1, updatedAt: 1, _id: 0 }
  });
}

export function findByActivityId(activityId: string, projection: 'basic' | 'list' | 'detail' = 'basic', db?: Db) {
  const coll = getColl(db);
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
    list: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 },
    detail: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, location: 1, deviceInfo: 1, createdAt: 1, updatedAt: 1, _id: 0 }
  };
  return coll.findOne({ id: activityId }, { projection: projections[projection] });
}

export async function findPaginated(page: number = 1, limit: number = 20, filters?: {
  userId?: string;
  activityType?: ActivityType;
  targetType?: string;
  targetId?: string;
  minDate?: Date;
  maxDate?: Date;
  hasTarget?: boolean;
}, projection: 'basic' | 'list' = 'basic', db?: Db) {
  const coll = getColl(db);
  const skip = (page - 1) * limit;
  const query: any = {};
  if (filters?.userId) query.userId = filters.userId;
  if (filters?.activityType) query.activityType = filters.activityType;
  if (filters?.targetType) query.targetType = filters.targetType;
  if (filters?.targetId) query.targetId = filters.targetId;
  if (filters?.minDate || filters?.maxDate) {
    query.timestamp = {};
    if (filters?.minDate) query.timestamp.$gte = filters.minDate;
    if (filters?.maxDate) query.timestamp.$lte = filters.maxDate;
  }
  if (filters?.hasTarget !== undefined) {
    query.targetId = filters.hasTarget ? { $exists: true, $ne: null } : { $exists: false };
  }
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
    list: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 }
  };
  const [data, total] = await Promise.all([
    coll.find(query, { projection: projections[projection], sort: { timestamp: -1 }, skip, limit }).toArray(),
    coll.countDocuments(query)
  ]);
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export function getUserActivityStats(userId: string, days: number = 30, db?: Db) {
  const coll = getColl(db);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return coll.aggregate([
    { $match: { userId, timestamp: { $gte: threshold } } },
    {
      $group: {
        _id: '$activityType',
        count: { $sum: 1 },
        lastActivity: { $max: '$timestamp' },
        firstActivity: { $min: '$timestamp' }
      }
    },
    {
      $project: {
        activityType: '$_id',
        count: 1,
        lastActivity: 1,
        firstActivity: 1,
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
}

export function getGlobalActivityStats(days: number = 30, db?: Db) {
  const coll = getColl(db);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return coll.aggregate([
    { $match: { timestamp: { $gte: threshold } } },
    {
      $group: {
        _id: '$activityType',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        lastActivity: { $max: '$timestamp' }
      }
    },
    {
      $project: {
        activityType: '$_id',
        count: 1,
        uniqueUsersCount: { $size: '$uniqueUsers' },
        lastActivity: 1,
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
}

export function getActivityTypesStats(days: number = 30, db?: Db) {
  const coll = getColl(db);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return coll.aggregate([
    { $match: { timestamp: { $gte: threshold } } },
    {
      $group: {
        _id: '$activityType',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        avgPerUser: { $avg: 1 }
      }
    },
    {
      $project: {
        activityType: '$_id',
        count: 1,
        uniqueUsersCount: { $size: '$uniqueUsers' },
        avgPerUser: { $round: ['$avgPerUser', 2] },
        percentage: { $multiply: [{ $divide: ['$count', { $sum: '$count' }] }, 100] },
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
}

export function getMostActiveUsers(limit: number = 50, days: number = 30, db?: Db) {
  const coll = getColl(db);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return coll.aggregate([
    { $match: { timestamp: { $gte: threshold } } },
    {
      $group: {
        _id: '$userId',
        totalActivities: { $sum: 1 },
        uniqueActivityTypes: { $addToSet: '$activityType' },
        lastActivity: { $max: '$timestamp' },
        firstActivity: { $min: '$timestamp' }
      }
    },
    {
      $project: {
        userId: '$_id',
        totalActivities: 1,
        uniqueActivityTypesCount: { $size: '$uniqueActivityTypes' },
        lastActivity: 1,
        firstActivity: 1,
        _id: 0
      }
    },
    { $sort: { totalActivities: -1 } },
    { $limit: limit }
  ]).toArray();
}

export function getRecentActivities(limit: number = 50, projection: 'basic' | 'list' = 'basic', db?: Db) {
  const coll = getColl(db);
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
    list: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 }
  };
  return coll.find({}, { projection: projections[projection], sort: { timestamp: -1 }, limit }).toArray();
}

export function getActivitiesByType(activityType: ActivityType, limit: number = 50, projection: 'basic' | 'list' = 'basic', db?: Db) {
  const coll = getColl(db);
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
    list: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 }
  };
  return coll.find({ activityType }, { projection: projections[projection], sort: { timestamp: -1 }, limit }).toArray();
}

export function getTargetActivities(targetId: string, targetType: string, limit: number = 50, projection: 'basic' | 'list' = 'basic', db?: Db) {
  const coll = getColl(db);
  const projections: Record<string, any> = {
    basic: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, _id: 0 },
    list: { id: 1, userId: 1, activityType: 1, targetId: 1, targetType: 1, timestamp: 1, metadata: 1, ipAddress: 1, userAgent: 1, sessionId: 1, _id: 0 }
  };
  return coll.find({ targetId, targetType }, { projection: projections[projection], sort: { timestamp: -1 }, limit }).toArray();
}

export function cleanupOldActivities(daysOld: number = 90, db?: Db) {
  const coll = getColl(db);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - daysOld);
  return coll.deleteMany({ timestamp: { $lt: threshold } });
}

const typeLabels: Record<ActivityType, string> = {
  [ActivityType.JOIN_LIVE]: 'Entrou na live',
  [ActivityType.LEAVE_LIVE]: 'Saiu da live',
  [ActivityType.START_LIVE]: 'Iniciou live',
  [ActivityType.END_LIVE]: 'Encerrou live',
  [ActivityType.FOLLOW_USER]: 'Seguiu usuário',
  [ActivityType.UNFOLLOW_USER]: 'Deixou de seguir',
  [ActivityType.BLOCK_USER]: 'Bloqueou usuário',
  [ActivityType.UNBLOCK_USER]: 'Desbloqueou usuário',
  [ActivityType.SEND_FRIEND_REQUEST]: 'Enviou solicitação de amizade',
  [ActivityType.ACCEPT_FRIEND_REQUEST]: 'Aceitou solicitação de amizade',
  [ActivityType.REJECT_FRIEND_REQUEST]: 'Rejeitou solicitação de amizade',
  [ActivityType.SEND_GIFT]: 'Enviou presente',
  [ActivityType.RECEIVE_GIFT]: 'Recebeu presente',
  [ActivityType.PURCHASE_ITEM]: 'Comprou item',
  [ActivityType.WITHDRAW_FUNDS]: 'Sacou fundos',
  [ActivityType.UPLOAD_PHOTO]: 'Enviou foto',
  [ActivityType.UPLOAD_VIDEO]: 'Enviou vídeo',
  [ActivityType.DELETE_PHOTO]: 'Apagou foto',
  [ActivityType.DELETE_VIDEO]: 'Apagou vídeo',
  [ActivityType.LIKE_CONTENT]: 'Curtiu conteúdo',
  [ActivityType.UNLIKE_CONTENT]: 'Descurtiu conteúdo',
  [ActivityType.COMMENT_CONTENT]: 'Comentou',
  [ActivityType.SEND_MESSAGE]: 'Enviou mensagem',
  [ActivityType.READ_MESSAGE]: 'Leu mensagem',
  [ActivityType.DELETE_MESSAGE]: 'Apagou mensagem',
  [ActivityType.UPDATE_PROFILE]: 'Atualizou perfil',
  [ActivityType.CHANGE_AVATAR]: 'Mudou avatar',
  [ActivityType.UPDATE_STATUS]: 'Atualizou status',
  [ActivityType.LOGIN]: 'Entrou no sistema',
  [ActivityType.LOGOUT]: 'Saiu do sistema',
  [ActivityType.CHANGE_SETTINGS]: 'Alterou configurações',
  [ActivityType.REPORT_CONTENT]: 'Denunciou conteúdo'
};

export function getFormattedActivity(doc: IUserActivity): string {
  return typeLabels[doc.activityType] || doc.activityType;
}

export function isRecentActivity(doc: IUserActivity, hours: number = 24): boolean {
  const now = new Date();
  const hoursSinceActivity = Math.floor((now.getTime() - doc.timestamp.getTime()) / (1000 * 60 * 60));
  return hoursSinceActivity <= hours;
}

const categories: Record<ActivityType, string> = {
  [ActivityType.JOIN_LIVE]: 'live',
  [ActivityType.LEAVE_LIVE]: 'live',
  [ActivityType.START_LIVE]: 'live',
  [ActivityType.END_LIVE]: 'live',
  [ActivityType.FOLLOW_USER]: 'social',
  [ActivityType.UNFOLLOW_USER]: 'social',
  [ActivityType.BLOCK_USER]: 'social',
  [ActivityType.UNBLOCK_USER]: 'social',
  [ActivityType.SEND_FRIEND_REQUEST]: 'social',
  [ActivityType.ACCEPT_FRIEND_REQUEST]: 'social',
  [ActivityType.REJECT_FRIEND_REQUEST]: 'social',
  [ActivityType.SEND_GIFT]: 'economy',
  [ActivityType.RECEIVE_GIFT]: 'economy',
  [ActivityType.PURCHASE_ITEM]: 'economy',
  [ActivityType.WITHDRAW_FUNDS]: 'economy',
  [ActivityType.UPLOAD_PHOTO]: 'content',
  [ActivityType.UPLOAD_VIDEO]: 'content',
  [ActivityType.DELETE_PHOTO]: 'content',
  [ActivityType.DELETE_VIDEO]: 'content',
  [ActivityType.LIKE_CONTENT]: 'content',
  [ActivityType.UNLIKE_CONTENT]: 'content',
  [ActivityType.COMMENT_CONTENT]: 'content',
  [ActivityType.SEND_MESSAGE]: 'communication',
  [ActivityType.READ_MESSAGE]: 'communication',
  [ActivityType.DELETE_MESSAGE]: 'communication',
  [ActivityType.UPDATE_PROFILE]: 'profile',
  [ActivityType.CHANGE_AVATAR]: 'profile',
  [ActivityType.UPDATE_STATUS]: 'profile',
  [ActivityType.LOGIN]: 'system',
  [ActivityType.LOGOUT]: 'system',
  [ActivityType.CHANGE_SETTINGS]: 'system',
  [ActivityType.REPORT_CONTENT]: 'system'
};

export function getActivityCategory(doc: IUserActivity): string {
  return categories[doc.activityType] || 'other';
}

export class UserActivity extends BaseModel<IUserActivity> {
  static collectionName = COLLECTION_NAME;
  static getColl = getColl;
}
