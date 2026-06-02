
import { BaseModel } from '../db/BaseModel';

export interface IBeautySettings {
  userId: string;
  settings: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export const BEAUTY_SETTINGS_PROJECTION = {
  userId: 1,
  settings: 1,
  createdAt: 1,
  updatedAt: 1,
  _id: 0
};

export const COLLECTION = 'beautysettings';

export async function upsertSettings(collection: any, userId: string, settings: Record<string, number>) {
  if (!userId) {
    throw new Error('Campo "userId" é obrigatório para upsert');
  }

  return collection.findOneAndUpdate(
    { userId },
    {
      $set: { settings }
    },
    {
      upsert: true,
      returnDocument: 'after',
      projection: BEAUTY_SETTINGS_PROJECTION
    }
  );
}

export async function findByUserId(collection: any, userId: string) {
  return collection.findOne(
    { userId },
    { projection: BEAUTY_SETTINGS_PROJECTION }
  );
}

export async function getSettingsOnly(collection: any, userId: string) {
  const result = await collection.findOne(
    { userId },
    { projection: { settings: 1, _id: 0 } }
  );
  return result?.settings || {};
}

export async function hasSettings(collection: any, userId: string) {
  const result = await collection.findOne(
    { userId },
    { projection: { userId: 1, _id: 0 } }
  );
  return !!result;
}

export async function getSettingByKey(collection: any, userId: string, key: string) {
  const result = await collection.findOne(
    { userId },
    { projection: { [`settings.${key}`]: 1, _id: 0 } }
  );
  return result?.settings?.[key];
}

export async function updateSetting(collection: any, userId: string, key: string, value: number) {
  if (value < 0 || value > 1) {
    throw new Error('Valor deve estar entre 0 e 1');
  }

  return collection.findOneAndUpdate(
    { userId },
    {
      $set: { [`settings.${key}`]: value }
    },
    {
      upsert: true,
      returnDocument: 'after',
      projection: BEAUTY_SETTINGS_PROJECTION
    }
  );
}
export class BeautySettings extends BaseModel<IBeautySettings> {
  static collectionName = 'beautysettings';

  static async getSettingsOnly(userId: string): Promise<Record<string, number>> {
    const { getDb } = await import('../config/db');
    const collection = getDb().collection(this.collectionName);
    return getSettingsOnly(collection, userId);
  }

  static async upsertSettings(userId: string, settings: Record<string, number>): Promise<any> {
    const { getDb } = await import('../config/db');
    const collection = getDb().collection(this.collectionName);
    return upsertSettings(collection, userId, settings);
  }
}
