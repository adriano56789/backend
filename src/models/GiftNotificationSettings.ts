import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IGiftNotificationSettings {
    userId: string;
    gifts: Record<string, boolean>;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'giftnotificationsettings';

export function findByUser(collection: Collection<any>, userId: string) {
    return collection.findOne(
        { userId },
        { projection: { userId: 1, gifts: 1, createdAt: 1, updatedAt: 1 } }
    );
}

export async function updateGiftSetting(collection: Collection<any>, userId: string, giftId: string, enabled: boolean) {
    return collection.findOneAndUpdate(
        { userId },
        { $set: { [`gifts.${giftId}`]: enabled, updatedAt: new Date() }, $setOnInsert: { userId, createdAt: new Date() } },
        { upsert: true, returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } }
    );
}

export function getGiftSetting(collection: Collection<any>, userId: string, giftId: string) {
    return collection.findOne(
        { userId },
        { projection: { [`gifts.${giftId}`]: 1 } }
    );
}

export async function createSettings(collection: Collection<any>, userId: string, gifts?: Record<string, boolean>) {
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

export async function updateMultipleGifts(collection: Collection<any>, userId: string, giftUpdates: Record<string, boolean>) {
    const $set: Record<string, any> = { updatedAt: new Date() };
    for (const [giftId, enabled] of Object.entries(giftUpdates)) {
        $set[`gifts.${giftId}`] = enabled;
    }
    return collection.findOneAndUpdate(
        { userId },
        { $set },
        { upsert: true, returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } }
    );
}

export async function enableAllGiftsSettings(collection: Collection<any>, userId: string, allGiftIds: string[]) {
    const $set: Record<string, any> = { updatedAt: new Date() };
    for (const giftId of allGiftIds) {
        $set[`gifts.${giftId}`] = true;
    }
    return collection.findOneAndUpdate(
        { userId },
        { $set },
        { upsert: true, returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } }
    );
}

export async function disableAllGiftsSettings(collection: Collection<any>, userId: string) {
    const current = await collection.findOne({ userId }, { projection: { gifts: 1 } });
    if (!current || !current.gifts || Object.keys(current.gifts).length === 0) {
        return null;
    }
    const $set: Record<string, any> = { updatedAt: new Date() };
    for (const giftId of Object.keys(current.gifts)) {
        $set[`gifts.${giftId}`] = false;
    }
    return collection.findOneAndUpdate(
        { userId },
        { $set },
        { returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } }
    );
}

export async function getEnabledGifts(collection: Collection<any>, userId: string) {
    const settings = await collection.findOne(
        { userId },
        { projection: { userId: 1, gifts: 1, createdAt: 1, updatedAt: 1 } }
    );
    if (!settings || !settings.gifts) return null;

    const enabledGifts: Record<string, boolean> = {};
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

export async function hasSettings(collection: Collection<any>, userId: string) {
    const result = await collection.findOne(
        { userId },
        { projection: { userId: 1, gifts: 1 } }
    );
    return !!result && result.gifts && Object.keys(result.gifts).length > 0;
}

export async function deleteSettings(collection: Collection<any>, userId: string) {
    return collection.findOneAndDelete(
        { userId },
        { projection: { userId: 1, gifts: 1, createdAt: 1, updatedAt: 1 } }
    );
}

export async function updateGifts(collection: Collection<any>, settingsId: ObjectId, giftUpdates: Record<string, boolean>) {
    const $set: Record<string, any> = { updatedAt: new Date() };
    for (const [giftId, enabled] of Object.entries(giftUpdates)) {
        $set[`gifts.${giftId}`] = enabled;
    }
    return collection.findOneAndUpdate(
        { _id: settingsId },
        { $set },
        { returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } }
    );
}

export async function enableAllGifts(collection: Collection<any>, settingsId: ObjectId) {
    const settings = await collection.findOne({ _id: settingsId }, { projection: { gifts: 1 } });
    if (!settings || !settings.gifts) {
        throw new Error('Configurações de gifts inválidas');
    }
    const giftIds = Object.keys(settings.gifts);
    if (giftIds.length === 0) {
        throw new Error('Nenhum gift encontrado para habilitar');
    }
    const $set: Record<string, any> = { updatedAt: new Date() };
    for (const giftId of giftIds) {
        $set[`gifts.${giftId}`] = true;
    }
    return collection.findOneAndUpdate(
        { _id: settingsId },
        { $set },
        { returnDocument: 'after', projection: { userId: 1, gifts: 1, updatedAt: 1 } }
    );
}
export class GiftNotificationSettings extends BaseModel<IGiftNotificationSettings> {
  static collectionName = 'giftnotificationsettings';
}
