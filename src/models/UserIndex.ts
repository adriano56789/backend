import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IUserIndexBasic {
    id: string;
    userId: string;
    name: string;
    displayName: string;
    avatarUrl: string;
    isActive: boolean;
}

export interface IUserIndexList {
    id: string;
    userId: string;
    identification: string;
    name: string;
    displayName: string;
    avatarUrl: string;
    isFriend?: boolean;
    isActive: boolean;
    lastUpdated: Date;
    createdAt: Date;
}

export interface IUserIndexDetail {
    id: string;
    userId: string;
    identification: string;
    name: string;
    displayName: string;
    avatarUrl: string;
    isFriend?: boolean;
    isActive: boolean;
    lastUpdated: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserIndex {
    id: string;
    userId: string;
    identification: string;
    name: string;
    displayName: string;
    avatarUrl: string;
    isFriend?: boolean;
    searchTerms: string[];
    isActive: boolean;
    lastUpdated: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserIndex extends Omit<IUserIndex, 'searchTerms'> {}

export const COLLECTION = 'userindexes';

const PROJ_BASIC = { id: 1, userId: 1, name: 1, displayName: 1, avatarUrl: 1, isActive: 1, _id: 0 };
const PROJ_LIST = { id: 1, userId: 1, identification: 1, name: 1, displayName: 1, avatarUrl: 1, isFriend: 1, isActive: 1, lastUpdated: 1, createdAt: 1, _id: 0 };
const PROJ_DETAIL = { id: 1, userId: 1, identification: 1, name: 1, displayName: 1, avatarUrl: 1, isFriend: 1, isActive: 1, lastUpdated: 1, createdAt: 1, updatedAt: 1, _id: 0 };

function buildSearchTerms(name: string, displayName: string): string[] {
    const n = (name || '').toLowerCase();
    const dn = (displayName || '').toLowerCase();
    return [...new Set([
        n,
        dn,
        ...n.split(' '),
        ...dn.split(' '),
    ].filter(Boolean))];
}

export async function createOrUpdateUserIndex(collection: Collection, userData: any) {
    const now = new Date();
    const searchTerms = buildSearchTerms(userData.name, userData.displayName);
    const result = await collection.findOneAndUpdate(
        { userId: userData.userId },
        {
            $set: {
                id: userData.id,
                identification: userData.identification,
                name: userData.name,
                displayName: userData.displayName,
                avatarUrl: userData.avatarUrl,
                isFriend: userData.isFriend || false,
                isActive: userData.isActive !== false,
                searchTerms,
                lastUpdated: now,
            },
            $setOnInsert: { createdAt: now },
        },
        { upsert: true, returnDocument: 'after', projection: PROJ_LIST }
    );
    return result;
}

export async function findUserIndexesBasic(collection: Collection, limit?: number, filters?: {
    isActive?: boolean;
    isFriend?: boolean;
}) {
    const query: any = {};
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isFriend !== undefined) query.isFriend = filters.isFriend;
    let cursor = collection.find(query, { projection: PROJ_BASIC }).sort({ lastUpdated: -1 });
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
}

export async function findUserIndexesList(collection: Collection, limit?: number, filters?: {
    isActive?: boolean;
    isFriend?: boolean;
}) {
    const query: any = {};
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isFriend !== undefined) query.isFriend = filters.isFriend;
    let cursor = collection.find(query, { projection: PROJ_LIST }).sort({ lastUpdated: -1 });
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
}

export async function findUserIndexDetail(collection: Collection, userIndexId: string) {
    return collection.findOne(
        { _id: new ObjectId(userIndexId) },
        { projection: PROJ_DETAIL }
    );
}

export async function searchUserIndexesByName(collection: Collection, queryStr: string, limit: number = 20, filters?: {
    isActive?: boolean;
    isFriend?: boolean;
}) {
    const regex = new RegExp(queryStr.toLowerCase(), 'i');
    const andClauses: any[] = [
        { $or: [
            { name: regex },
            { displayName: regex },
            { searchTerms: regex },
        ]},
    ];
    if (filters?.isActive !== undefined) andClauses.push({ isActive: filters.isActive });
    if (filters?.isFriend !== undefined) andClauses.push({ isFriend: filters.isFriend });
    return collection.find(
        { $and: andClauses },
        { projection: PROJ_BASIC }
    ).sort({ lastUpdated: -1 }).limit(limit).toArray();
}

export async function searchUserIndexesAdvanced(collection: Collection, searchText: string, limit: number = 20, filters?: {
    isActive?: boolean;
    isFriend?: boolean;
}) {
    const regex = new RegExp(searchText.toLowerCase(), 'i');
    const andClauses: any[] = [
        { $or: [
            { name: regex },
            { displayName: regex },
            { identification: regex },
            { searchTerms: regex },
        ]},
    ];
    if (filters?.isActive !== undefined) andClauses.push({ isActive: filters.isActive });
    if (filters?.isFriend !== undefined) andClauses.push({ isFriend: filters.isFriend });
    return collection.find(
        { $and: andClauses },
        { projection: PROJ_LIST }
    ).sort({ lastUpdated: -1 }).limit(limit).toArray();
}

export async function findUserIndexByUserId(collection: Collection, userId: string) {
    return collection.findOne({ userId }, { projection: PROJ_BASIC });
}

export async function findUserIndexById(collection: Collection, id: string) {
    return collection.findOne({ id }, { projection: PROJ_BASIC });
}

export async function deactivateUserIndex(collection: Collection, userId: string) {
    const result = await collection.updateOne(
        { userId },
        { $set: { isActive: false, lastUpdated: new Date() } }
    );
    return result;
}

export async function activateUserIndex(collection: Collection, userId: string) {
    const result = await collection.updateOne(
        { userId },
        { $set: { isActive: true, lastUpdated: new Date() } }
    );
    return result;
}

export async function findFriendIndexes(collection: Collection, limit?: number) {
    let cursor = collection.find(
        { isFriend: true, isActive: true },
        { projection: PROJ_LIST }
    ).sort({ lastUpdated: -1 });
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
}

export async function findActiveUserIndexes(collection: Collection, limit?: number) {
    let cursor = collection.find(
        { isActive: true },
        { projection: PROJ_LIST }
    ).sort({ lastUpdated: -1 });
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
}

export async function findUserIndexesPaginated(collection: Collection, page: number = 1, limit: number = 20, filters?: {
    isActive?: boolean;
    isFriend?: boolean;
}) {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;
    if (filters?.isFriend !== undefined) query.isFriend = filters.isFriend;
    const [data, total] = await Promise.all([
        collection.find(query, { projection: PROJ_BASIC })
            .sort({ lastUpdated: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        collection.countDocuments(query),
    ]);
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

export async function getUserIndexGlobalStats(collection: Collection) {
    const results = await collection.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
                inactiveUsers: { $sum: { $cond: ['$isActive', 0, 1] } },
                friendUsers: { $sum: { $cond: ['$isFriend', 1, 0] } },
                activeFriends: {
                    $sum: {
                        $cond: [{ $and: ['$isActive', '$isFriend'] }, 1, 0],
                    },
                },
                lastUpdated: { $max: '$lastUpdated' },
                createdAt: { $max: '$createdAt' },
            },
        },
        {
            $project: {
                _id: 0,
                totalUsers: 1,
                activeUsers: 1,
                inactiveUsers: 1,
                friendUsers: 1,
                activeFriends: 1,
                activeRate: { $multiply: [{ $divide: ['$activeUsers', '$totalUsers'] }, 100] },
                friendRate: { $multiply: [{ $divide: ['$friendUsers', '$totalUsers'] }, 100] },
                lastUpdated: 1,
                createdAt: 1,
            },
        },
    ]).toArray();
    return results;
}

export async function findRecentlyUpdatedIndexes(collection: Collection, hours: number = 24, limit?: number) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    let cursor = collection.find(
        { lastUpdated: { $gte: cutoff } },
        { projection: PROJ_LIST }
    ).sort({ lastUpdated: -1 });
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
}

export async function updateUserIndexData(collection: Collection, userId: string, userData: any) {
    const updates: any = {};
    if (userData.name) updates.name = userData.name;
    if (userData.displayName) updates.displayName = userData.displayName;
    if (userData.avatarUrl) updates.avatarUrl = userData.avatarUrl;
    if (userData.identification) updates.identification = userData.identification;
    if (userData.isFriend !== undefined) updates.isFriend = userData.isFriend;
    updates.lastUpdated = new Date();
    if (Object.keys(updates).length > 0) {
        await collection.updateOne({ userId }, { $set: updates });
    }
    return collection.findOne({ userId }, { projection: PROJ_LIST });
}

export async function toggleUserIndexFriend(collection: Collection, userId: string) {
    const user = await collection.findOne({ userId });
    if (!user) return null;
    const newIsFriend = !user.isFriend;
    await collection.updateOne(
        { userId },
        { $set: { isFriend: newIsFriend, lastUpdated: new Date() } }
    );
    return collection.findOne({ userId }, { projection: PROJ_LIST });
}
export class UserIndex extends BaseModel<IUserIndex> {
  static collectionName = 'userindexes';
}
