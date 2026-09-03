"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoQualitySettings = void 0;
const db_1 = require("../config/db");
const COLLECTION = 'videoqualitysettings';
const DEFAULTS = {
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
class VideoQualitySettings {
    static async getSettings(userId) {
        const db = (0, db_1.getDb)();
        const result = await db.collection(COLLECTION).findOne({ userId }, { projection: { settings: 1, _id: 0 } });
        return result?.settings || { ...DEFAULTS };
    }
    static async upsertSettings(userId, settings) {
        const db = (0, db_1.getDb)();
        const merged = { ...DEFAULTS, ...settings };
        return db.collection(COLLECTION).findOneAndUpdate({ userId }, { $set: { settings: merged, updatedAt: new Date() } }, { upsert: true, returnDocument: 'after', projection: PROJECTION });
    }
    static async resetSettings(userId) {
        return this.upsertSettings(userId, { ...DEFAULTS });
    }
}
exports.VideoQualitySettings = VideoQualitySettings;
