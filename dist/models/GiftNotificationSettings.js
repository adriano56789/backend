"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GiftNotificationSettings = exports.COLLECTION = void 0;
exports.findByUser = findByUser;
exports.updateGiftSetting = updateGiftSetting;
exports.getGiftSetting = getGiftSetting;
exports.createSettings = createSettings;
exports.updateMultipleGifts = updateMultipleGifts;
exports.enableAllGiftsSettings = enableAllGiftsSettings;
exports.disableAllGiftsSettings = disableAllGiftsSettings;
exports.getEnabledGifts = getEnabledGifts;
exports.hasSettings = hasSettings;
exports.deleteSettings = deleteSettings;
exports.updateGifts = updateGifts;
exports.enableAllGifts = enableAllGifts;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'giftnotificationsettings';
function findByUser(collection, userId) {
    return collection.findOne({ userId }, { projection: { userId: 1, gifts: 1, createdAt: 1, updatedAt: 1 } });
}
async function updateGiftSetting(collection, userId, giftId, enabled) {
    return collection.findOneAndUpdate({ userId }, { $set: { [`gifts.${giftId}`]: enabled, updatedAt: new Date() }, $setOnInsert: { userId, createdAt: new Date() } }, { upsert: true, returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } });
}
function getGiftSetting(collection, userId, giftId) {
    return collection.findOne({ userId }, { projection: { [`gifts.${giftId}`]: 1 } });
}
async function createSettings(collection, userId, gifts) {
    if (!userId) {
        throw new Error('userId é obrigatório');
    }
    const { insertedId } = await collection.insertOne({
        userId,
        gifts: gifts || {},
        createdAt: new Date(),
        updatedAt: new Date()
    });
    return collection.findOne({ _id: insertedId });
}
async function updateMultipleGifts(collection, userId, giftUpdates) {
    const $set = { updatedAt: new Date() };
    for (const [giftId, enabled] of Object.entries(giftUpdates)) {
        $set[`gifts.${giftId}`] = enabled;
    }
    return collection.findOneAndUpdate({ userId }, { $set }, { upsert: true, returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } });
}
async function enableAllGiftsSettings(collection, userId, allGiftIds) {
    const $set = { updatedAt: new Date() };
    for (const giftId of allGiftIds) {
        $set[`gifts.${giftId}`] = true;
    }
    return collection.findOneAndUpdate({ userId }, { $set }, { upsert: true, returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } });
}
async function disableAllGiftsSettings(collection, userId) {
    const current = await collection.findOne({ userId }, { projection: { gifts: 1 } });
    if (!current || !current.gifts || Object.keys(current.gifts).length === 0) {
        return null;
    }
    const $set = { updatedAt: new Date() };
    for (const giftId of Object.keys(current.gifts)) {
        $set[`gifts.${giftId}`] = false;
    }
    return collection.findOneAndUpdate({ userId }, { $set }, { returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } });
}
async function getEnabledGifts(collection, userId) {
    const settings = await collection.findOne({ userId }, { projection: { userId: 1, gifts: 1, createdAt: 1, updatedAt: 1 } });
    if (!settings || !settings.gifts)
        return null;
    const enabledGifts = {};
    for (const [giftId, enabled] of Object.entries(settings.gifts)) {
        if (enabled === true) {
            enabledGifts[giftId] = true;
        }
    }
    return {
        userId: settings.userId,
        gifts: enabledGifts,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt
    };
}
async function hasSettings(collection, userId) {
    const result = await collection.findOne({ userId }, { projection: { userId: 1, gifts: 1 } });
    return !!result && result.gifts && Object.keys(result.gifts).length > 0;
}
async function deleteSettings(collection, userId) {
    return collection.findOneAndDelete({ userId }, { projection: { userId: 1, gifts: 1, createdAt: 1, updatedAt: 1 } });
}
async function updateGifts(collection, settingsId, giftUpdates) {
    const $set = { updatedAt: new Date() };
    for (const [giftId, enabled] of Object.entries(giftUpdates)) {
        $set[`gifts.${giftId}`] = enabled;
    }
    return collection.findOneAndUpdate({ _id: settingsId }, { $set }, { returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } });
}
async function enableAllGifts(collection, settingsId) {
    const settings = await collection.findOne({ _id: settingsId }, { projection: { gifts: 1 } });
    if (!settings || !settings.gifts) {
        throw new Error('Configurações de gifts inválidas');
    }
    const giftIds = Object.keys(settings.gifts);
    if (giftIds.length === 0) {
        throw new Error('Nenhum gift encontrado para habilitar');
    }
    const $set = { updatedAt: new Date() };
    for (const giftId of giftIds) {
        $set[`gifts.${giftId}`] = true;
    }
    return collection.findOneAndUpdate({ _id: settingsId }, { $set }, { returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } });
}
class GiftNotificationSettings extends BaseModel_1.BaseModel {
}
exports.GiftNotificationSettings = GiftNotificationSettings;
GiftNotificationSettings.collectionName = 'giftnotificationsettings';
