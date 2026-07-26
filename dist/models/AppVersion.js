"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersion = exports.COLLECTION = void 0;
exports.getLatestVersion = getLatestVersion;
exports.needsUpdate = needsUpdate;
exports.upsertVersion = upsertVersion;
exports.getVersionInfo = getVersionInfo;
exports.getDownloadUrls = getDownloadUrls;
exports.getChangelog = getChangelog;
const BaseModel_1 = require("../db/BaseModel");
const db_1 = require("../config/db");
exports.COLLECTION = 'appversions';
function compareVersions(v1, v2) {
    const v1Parts = v1.split('.').map(Number);
    const v2Parts = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const part1 = v1Parts[i] || 0;
        const part2 = v2Parts[i] || 0;
        if (part1 > part2)
            return 1;
        if (part1 < part2)
            return -1;
    }
    return 0;
}
async function getLatestVersion(collection, appName) {
    return collection.findOne({ app: appName }, {
        projection: {
            app: 1,
            latestVersion: 1,
            forceUpdate: 1,
            message: 1,
            updateUrl: 1,
            websiteUrl: 1,
            changelog: 1,
            minSupportedVersion: 1,
            updatedAt: 1,
            createdAt: 1
        }
    });
}
async function needsUpdate(collection, appName, currentVersion) {
    const latest = await collection.findOne({ app: appName }, {
        projection: {
            app: 1,
            latestVersion: 1,
            forceUpdate: 1
        }
    });
    if (!latest)
        return false;
    if (latest.forceUpdate)
        return true;
    return compareVersions(currentVersion, latest.latestVersion) < 0;
}
async function upsertVersion(collection, versionData) {
    const { app, ...updateData } = versionData;
    return collection.findOneAndUpdate({ app }, { $set: updateData }, {
        upsert: true,
        returnDocument: 'after',
        projection: {
            app: 1,
            latestVersion: 1,
            forceUpdate: 1,
            message: 1,
            updateUrl: 1,
            websiteUrl: 1,
            changelog: 1,
            minSupportedVersion: 1,
            updatedAt: 1,
            createdAt: 1
        }
    });
}
async function getVersionInfo(collection, appName) {
    return collection.findOne({ app: appName }, {
        projection: {
            app: 1,
            latestVersion: 1,
            forceUpdate: 1,
            message: 1
        }
    });
}
async function getDownloadUrls(collection, appName) {
    return collection.findOne({ app: appName }, {
        projection: {
            app: 1,
            updateUrl: 1,
            websiteUrl: 1
        }
    });
}
async function getChangelog(collection, appName) {
    return collection.findOne({ app: appName }, {
        projection: {
            app: 1,
            latestVersion: 1,
            changelog: 1,
            updatedAt: 1
        }
    });
}
class AppVersion extends BaseModel_1.BaseModel {
    static getLatestVersion(app) {
        return getLatestVersion((0, db_1.getDb)().collection('appversions'), app);
    }
    static needsUpdate(app, currentVersion) {
        return needsUpdate((0, db_1.getDb)().collection('appversions'), app, currentVersion);
    }
    static upsertVersion(app, versionData) {
        return upsertVersion((0, db_1.getDb)().collection('appversions'), versionData);
    }
}
exports.AppVersion = AppVersion;
AppVersion.collectionName = 'appversions';
