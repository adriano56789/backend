"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BeautySettings = exports.COLLECTION = exports.BEAUTY_SETTINGS_PROJECTION = void 0;
exports.upsertSettings = upsertSettings;
exports.findByUserId = findByUserId;
exports.getSettingsOnly = getSettingsOnly;
exports.hasSettings = hasSettings;
exports.getSettingByKey = getSettingByKey;
exports.updateSetting = updateSetting;
const BaseModel_1 = require("../db/BaseModel");
exports.BEAUTY_SETTINGS_PROJECTION = {
    userId: 1,
    settings: 1,
    createdAt: 1,
    updatedAt: 1,
    _id: 0
};
exports.COLLECTION = 'beautysettings';
async function upsertSettings(collection, userId, settings) {
    if (!userId) {
        throw new Error('Campo "userId" é obrigatório para upsert');
    }
    return collection.findOneAndUpdate({ userId }, {
        $set: { settings }
    }, {
        upsert: true,
        returnDocument: 'after',
        projection: exports.BEAUTY_SETTINGS_PROJECTION
    });
}
async function findByUserId(collection, userId) {
    return collection.findOne({ userId }, { projection: exports.BEAUTY_SETTINGS_PROJECTION });
}
async function getSettingsOnly(collection, userId) {
    const result = await collection.findOne({ userId }, { projection: { settings: 1, _id: 0 } });
    return result?.settings || {};
}
async function hasSettings(collection, userId) {
    const result = await collection.findOne({ userId }, { projection: { userId: 1, _id: 0 } });
    return !!result;
}
async function getSettingByKey(collection, userId, key) {
    const result = await collection.findOne({ userId }, { projection: { [`settings.${key}`]: 1, _id: 0 } });
    return result?.settings?.[key];
}
async function updateSetting(collection, userId, key, value) {
    if (value < 0 || value > 1) {
        throw new Error('Valor deve estar entre 0 e 1');
    }
    return collection.findOneAndUpdate({ userId }, {
        $set: { [`settings.${key}`]: value }
    }, {
        upsert: true,
        returnDocument: 'after',
        projection: exports.BEAUTY_SETTINGS_PROJECTION
    });
}
class BeautySettings extends BaseModel_1.BaseModel {
    static async getSettingsOnly(userId) {
        const { getDb } = await Promise.resolve().then(() => __importStar(require('../config/db')));
        const collection = getDb().collection(this.collectionName);
        return getSettingsOnly(collection, userId);
    }
    static async upsertSettings(userId, settings) {
        const { getDb } = await Promise.resolve().then(() => __importStar(require('../config/db')));
        const collection = getDb().collection(this.collectionName);
        return upsertSettings(collection, userId, settings);
    }
}
exports.BeautySettings = BeautySettings;
BeautySettings.collectionName = 'beautysettings';
