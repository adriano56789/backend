import { getDb } from '../config/db';

export interface IVideoQualitySettings {
  userId: string;
  settings: {
    resolution: '1080p' | '720p' | '480p' | '360p' | 'auto';
    frameRate: number;
    bitrate: number;
    denoiseLevel: number;
    sharpnessLevel: number;
    whiteBalanceLevel: number;
    faceVolume3D: number;
    autoDenoise: boolean;
    encodingPreset: 'quality' | 'balanced' | 'speed';
    codec: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION = 'videoqualitysettings';

const DEFAULTS: IVideoQualitySettings['settings'] = {
  resolution: '1080p',
  frameRate: 30,
  bitrate: 2500,
  denoiseLevel: 70,
  sharpnessLevel: 60,
  whiteBalanceLevel: 48,
  faceVolume3D: 50,
  autoDenoise: true,
  encodingPreset: 'quality',
  codec: 'vp8',
};

const PROJECTION = { userId: 1, settings: 1, createdAt: 1, updatedAt: 1, _id: 0 };

export class VideoQualitySettings {
  static async getSettings(userId: string): Promise<IVideoQualitySettings['settings']> {
    const db = getDb();
    const result = await db.collection(COLLECTION).findOne(
      { userId },
      { projection: { settings: 1, _id: 0 } }
    );
    return result?.settings || { ...DEFAULTS };
  }

  static async upsertSettings(userId: string, settings: Partial<IVideoQualitySettings['settings']>) {
    const db = getDb();
    const merged = { ...DEFAULTS, ...settings };
    return db.collection(COLLECTION).findOneAndUpdate(
      { userId },
      { $set: { settings: merged, updatedAt: new Date() } },
      { upsert: true, returnDocument: 'after', projection: PROJECTION }
    );
  }

  static async resetSettings(userId: string) {
    return this.upsertSettings(userId, { ...DEFAULTS });
  }
}
