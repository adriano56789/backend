import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export enum BannedEntityType {
    IP = 'ip',
    DEVICE = 'device',
    USER = 'user',
    EMAIL = 'email'
}

interface BannedRelatedEntities {
    ips?: string[];
    devices?: string[];
    users?: string[];
    emails?: string[];
}

export interface IBannedEntity {
    entityType: BannedEntityType;
    entityId: string;
    reason: string;
    evidence: any;
    bannedAt: Date;
    permanent: boolean;
    expiresAt?: Date;
    active: boolean;
    relatedEntities: BannedRelatedEntities;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'bannedentities';

// --- Instance method conversions (pure functions) ---

export function isBanExpired(ban: IBannedEntity): boolean {
    if (ban.permanent) return false;
    if (!ban.expiresAt) return false;
    return new Date() > ban.expiresAt;
}

export function isBanActive(ban: IBannedEntity): boolean {
    return ban.active && !isBanExpired(ban);
}

// --- Instance method conversions (collection-based) ---

export async function deactivateBan(collection: Collection<any>, _id: ObjectId) {
    return collection.findOneAndUpdate(
        { _id },
        { $set: { active: false, updatedAt: new Date() } },
        { returnDocument: 'after' }
    );
}

export async function extendBan(collection: Collection<any>, _id: ObjectId, newExpiresAt?: Date) {
    const update: any = { updatedAt: new Date() };
    if (newExpiresAt) {
        update.expiresAt = newExpiresAt;
        update.permanent = false;
    } else {
        update.permanent = true;
        update.expiresAt = null;
    }

    return collection.findOneAndUpdate(
        { _id },
        { $set: update },
        { returnDocument: 'after' }
    );
}

// --- Static method conversions ---

export async function createBan(collection: Collection<any>, banData: any) {
    const defaultData = {
        bannedAt: new Date(),
        permanent: true,
        active: true,
        relatedEntities: {
            ips: [],
            devices: [],
            users: [],
            emails: []
        }
    };

    const finalData = { ...defaultData, ...banData };

    await deactivatePreviousBans(collection, finalData.entityType, finalData.entityId);

    const doc = { ...finalData, createdAt: new Date(), updatedAt: new Date() };
    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId } as IBannedEntity;
}

export function findActiveBans(collection: Collection<any>, entityType?: BannedEntityType, entityId?: string) {
    const query: any = { active: true };

    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;

    return collection.find(
        query,
        {
            projection: {
                entityType: 1,
                entityId: 1,
                reason: 1,
                bannedAt: 1,
                permanent: 1,
                expiresAt: 1,
                active: 1
            }
        }
    ).sort({ bannedAt: -1 }).toArray();
}

export function findByEntity(collection: Collection<any>, entityType: BannedEntityType, entityId: string) {
    return collection.find(
        { entityType, entityId },
        {
            projection: {
                entityType: 1,
                entityId: 1,
                reason: 1,
                bannedAt: 1,
                permanent: 1,
                expiresAt: 1,
                active: 1
            }
        }
    ).sort({ bannedAt: -1 }).toArray();
}

export async function deactivatePreviousBans(collection: Collection<any>, entityType: BannedEntityType, entityId: string) {
    return collection.updateMany(
        {
            entityType,
            entityId,
            active: true,
            _id: { $ne: null }
        },
        {
            $set: {
                active: false,
                deactivatedAt: new Date(),
                updatedAt: new Date()
            }
        }
    );
}

export async function cleanupExpiredBans(collection: Collection<any>) {
    const now = new Date();

    return collection.updateMany(
        {
            active: true,
            permanent: false,
            expiresAt: { $lt: now }
        },
        {
            $set: {
                active: false,
                deactivatedAt: new Date(),
                updatedAt: new Date()
            }
        }
    );
}

export function getBanStats(collection: Collection<any>) {
    return collection.aggregate([
        {
            $group: {
                _id: '$entityType',
                total: { $sum: 1 },
                active: { $sum: { $cond: ['$active', 1, 0] } },
                permanent: { $sum: { $cond: ['$permanent', 1, 0] } },
                temporary: { $sum: { $cond: ['$permanent', 0, 1] } }
            }
        },
        { $sort: { total: -1 } }
    ]).toArray();
}

export async function isEntityBanned(collection: Collection<any>, entityType: BannedEntityType, entityId: string) {
    const ban = await collection.findOne(
        {
            entityType,
            entityId,
            active: true
        },
        {
            projection: {
                permanent: 1,
                expiresAt: 1
            }
        }
    );

    if (!ban) return false;
    if (ban.permanent) return true;
    if (!ban.expiresAt) return true;
    return new Date() <= ban.expiresAt;
}

export function findBansByType(collection: Collection<any>, entityType: BannedEntityType) {
    return collection.find(
        { entityType, active: true },
        {
            projection: {
                entityType: 1,
                entityId: 1,
                reason: 1,
                bannedAt: 1,
                permanent: 1,
                expiresAt: 1
            }
        }
    ).sort({ bannedAt: -1 }).toArray();
}

export function findRelatedEntities(collection: Collection<any>, entityType: BannedEntityType, entityId: string) {
    return collection.find(
        {
            active: true,
            $or: [
                { entityType, entityId },
                { 'relatedEntities.ips': entityId },
                { 'relatedEntities.devices': entityId },
                { 'relatedEntities.users': entityId },
                { 'relatedEntities.emails': entityId }
            ]
        },
        {
            projection: {
                entityType: 1,
                entityId: 1,
                reason: 1,
                bannedAt: 1,
                permanent: 1,
                expiresAt: 1,
                relatedEntities: 1
            }
        }
    ).sort({ bannedAt: -1 }).toArray();
}

export function getBanInfo(collection: Collection<any>, entityType: BannedEntityType, entityId: string) {
    return collection.findOne(
        { entityType, entityId, active: true },
        {
            projection: {
                entityType: 1,
                entityId: 1,
                reason: 1,
                bannedAt: 1,
                permanent: 1,
                expiresAt: 1
            }
        }
    );
}
export class BannedEntity extends BaseModel<IBannedEntity> {
  static collectionName = 'bannedentities';
}
