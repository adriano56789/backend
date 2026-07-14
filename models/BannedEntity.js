"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BannedEntity = exports.COLLECTION = exports.BannedEntityType = void 0;
exports.isBanExpired = isBanExpired;
exports.isBanActive = isBanActive;
exports.deactivateBan = deactivateBan;
exports.extendBan = extendBan;
exports.createBan = createBan;
exports.findActiveBans = findActiveBans;
exports.findByEntity = findByEntity;
exports.deactivatePreviousBans = deactivatePreviousBans;
exports.cleanupExpiredBans = cleanupExpiredBans;
exports.getBanStats = getBanStats;
exports.isEntityBanned = isEntityBanned;
exports.findBansByType = findBansByType;
exports.findRelatedEntities = findRelatedEntities;
exports.getBanInfo = getBanInfo;
const BaseModel_1 = require("../db/BaseModel");
var BannedEntityType;
(function (BannedEntityType) {
    BannedEntityType["IP"] = "ip";
    BannedEntityType["DEVICE"] = "device";
    BannedEntityType["USER"] = "user";
    BannedEntityType["EMAIL"] = "email";
})(BannedEntityType || (exports.BannedEntityType = BannedEntityType = {}));
exports.COLLECTION = 'bannedentities';
// --- Instance method conversions (pure functions) ---
function isBanExpired(ban) {
    if (ban.permanent)
        return false;
    if (!ban.expiresAt)
        return false;
    return new Date() > ban.expiresAt;
}
function isBanActive(ban) {
    return ban.active && !isBanExpired(ban);
}
// --- Instance method conversions (collection-based) ---
async function deactivateBan(collection, _id) {
    return collection.findOneAndUpdate({ _id }, { $set: { active: false, updatedAt: new Date() } }, { returnDocument: 'after' });
}
async function extendBan(collection, _id, newExpiresAt) {
    const update = { updatedAt: new Date() };
    if (newExpiresAt) {
        update.expiresAt = newExpiresAt;
        update.permanent = false;
    }
    else {
        update.permanent = true;
        update.expiresAt = null;
    }
    return collection.findOneAndUpdate({ _id }, { $set: update }, { returnDocument: 'after' });
}
// --- Static method conversions ---
async function createBan(collection, banData) {
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
    return { ...doc, _id: result.insertedId };
}
function findActiveBans(collection, entityType, entityId) {
    const query = { active: true };
    if (entityType)
        query.entityType = entityType;
    if (entityId)
        query.entityId = entityId;
    return collection.find(query, {
        projection: {
            entityType: 1,
            entityId: 1,
            reason: 1,
            bannedAt: 1,
            permanent: 1,
            expiresAt: 1,
            active: 1
        }
    }).sort({ bannedAt: -1 }).toArray();
}
function findByEntity(collection, entityType, entityId) {
    return collection.find({ entityType, entityId }, {
        projection: {
            entityType: 1,
            entityId: 1,
            reason: 1,
            bannedAt: 1,
            permanent: 1,
            expiresAt: 1,
            active: 1
        }
    }).sort({ bannedAt: -1 }).toArray();
}
async function deactivatePreviousBans(collection, entityType, entityId) {
    return collection.updateMany({
        entityType,
        entityId,
        active: true,
        _id: { $ne: null }
    }, {
        $set: {
            active: false,
            deactivatedAt: new Date(),
            updatedAt: new Date()
        }
    });
}
async function cleanupExpiredBans(collection) {
    const now = new Date();
    return collection.updateMany({
        active: true,
        permanent: false,
        expiresAt: { $lt: now }
    }, {
        $set: {
            active: false,
            deactivatedAt: new Date(),
            updatedAt: new Date()
        }
    });
}
function getBanStats(collection) {
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
async function isEntityBanned(collection, entityType, entityId) {
    const ban = await collection.findOne({
        entityType,
        entityId,
        active: true
    }, {
        projection: {
            permanent: 1,
            expiresAt: 1
        }
    });
    if (!ban)
        return false;
    if (ban.permanent)
        return true;
    if (!ban.expiresAt)
        return true;
    return new Date() <= ban.expiresAt;
}
function findBansByType(collection, entityType) {
    return collection.find({ entityType, active: true }, {
        projection: {
            entityType: 1,
            entityId: 1,
            reason: 1,
            bannedAt: 1,
            permanent: 1,
            expiresAt: 1
        }
    }).sort({ bannedAt: -1 }).toArray();
}
function findRelatedEntities(collection, entityType, entityId) {
    return collection.find({
        active: true,
        $or: [
            { entityType, entityId },
            { 'relatedEntities.ips': entityId },
            { 'relatedEntities.devices': entityId },
            { 'relatedEntities.users': entityId },
            { 'relatedEntities.emails': entityId }
        ]
    }, {
        projection: {
            entityType: 1,
            entityId: 1,
            reason: 1,
            bannedAt: 1,
            permanent: 1,
            expiresAt: 1,
            relatedEntities: 1
        }
    }).sort({ bannedAt: -1 }).toArray();
}
function getBanInfo(collection, entityType, entityId) {
    return collection.findOne({ entityType, entityId, active: true }, {
        projection: {
            entityType: 1,
            entityId: 1,
            reason: 1,
            bannedAt: 1,
            permanent: 1,
            expiresAt: 1
        }
    });
}
class BannedEntity extends BaseModel_1.BaseModel {
}
exports.BannedEntity = BannedEntity;
BannedEntity.collectionName = 'bannedentities';
