import { BaseModel } from '../db/BaseModel';
import { getDb } from '../config/db';

export interface IAppVersion {
    app: string;
    latestVersion: string;
    forceUpdate: boolean;
    message: string;
    updateUrl?: string;
    websiteUrl?: string;
    changelog?: string;
    minSupportedVersion?: string;
    updatedAt: Date;
    createdAt: Date;
}

export const COLLECTION = 'appversions';

function compareVersions(v1: string, v2: string): number {
    const v1Parts = v1.split('.').map(Number);
    const v2Parts = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const part1 = v1Parts[i] || 0;
        const part2 = v2Parts[i] || 0;

        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }

    return 0;
}

export async function getLatestVersion(collection: any, appName: string) {
    return collection.findOne(
        { app: appName },
        {
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
        }
    );
}

export async function needsUpdate(collection: any, appName: string, currentVersion: string) {
    const latest = await collection.findOne(
        { app: appName },
        {
            projection: {
                app: 1,
                latestVersion: 1,
                forceUpdate: 1
            }
        }
    );
    if (!latest) return false;
    if (latest.forceUpdate) return true;
    return compareVersions(currentVersion, latest.latestVersion) < 0;
}

export async function upsertVersion(collection: any, versionData: Partial<IAppVersion>) {
    const { app, ...updateData } = versionData;

    return collection.findOneAndUpdate(
        { app },
        { $set: updateData },
        {
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
        }
    );
}

export async function getVersionInfo(collection: any, appName: string) {
    return collection.findOne(
        { app: appName },
        {
            projection: {
                app: 1,
                latestVersion: 1,
                forceUpdate: 1,
                message: 1
            }
        }
    );
}

export async function getDownloadUrls(collection: any, appName: string) {
    return collection.findOne(
        { app: appName },
        {
            projection: {
                app: 1,
                updateUrl: 1,
                websiteUrl: 1
            }
        }
    );
}

export async function getChangelog(collection: any, appName: string) {
    return collection.findOne(
        { app: appName },
        {
            projection: {
                app: 1,
                latestVersion: 1,
                changelog: 1,
                updatedAt: 1
            }
        }
    );
}
export class AppVersion extends BaseModel<IAppVersion> {
  static collectionName = 'appversions';

  static getLatestVersion(app: string) {
    return getLatestVersion(getDb().collection('appversions'), app);
  }

  static needsUpdate(app: string, currentVersion: string) {
    return needsUpdate(getDb().collection('appversions'), app, currentVersion);
  }

  static upsertVersion(app: string, versionData: any) {
    return upsertVersion(getDb().collection('appversions'), versionData);
  }
}
