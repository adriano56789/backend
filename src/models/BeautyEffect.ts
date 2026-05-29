import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export enum BeautyEffectType {
    FILTER = 'filter',
    EFFECT = 'effect'
}

export interface IBeautyEffect {
    name: string;
    type: BeautyEffectType;
    icon?: string;
    img?: string;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'beautyeffects';

export async function createEffect(collection: Collection<any>, effectData: any) {
    const defaultData = {
        type: BeautyEffectType.FILTER
    };

    const finalData = { ...defaultData, ...effectData };

    if (finalData.name) {
        finalData.name = finalData.name.toLowerCase().trim();
    }

    const doc = { ...finalData, createdAt: new Date(), updatedAt: new Date() };
    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId } as IBeautyEffect;
}

export function findByName(collection: Collection<any>, name: string) {
    return collection.findOne(
        { name: name.toLowerCase().trim() },
        {
            projection: {
                name: 1,
                type: 1,
                icon: 1,
                img: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    );
}

export function findByType(collection: Collection<any>, type: BeautyEffectType) {
    return collection.find(
        { type },
        {
            projection: {
                name: 1,
                type: 1,
                icon: 1,
                img: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ).sort({ name: 1 }).toArray();
}

export function searchEffects(collection: Collection<any>, query: string, limit: number = 50) {
    const searchRegex = new RegExp(query, 'i');

    return collection.find(
        {
            name: { $regex: searchRegex }
        },
        {
            projection: {
                name: 1,
                type: 1,
                icon: 1,
                img: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    )
    .sort({ name: 1 })
    .limit(limit)
    .toArray();
}

export function getEffectStats(collection: Collection<any>) {
    return collection.aggregate([
        {
            $group: {
                _id: '$type',
                count: { $sum: 1 },
                withIcon: { $sum: { $cond: [{ $ne: ['$icon', null] }, 1, 0] } },
                withImg: { $sum: { $cond: [{ $ne: ['$img', null] }, 1, 0] } },
                withBothAssets: {
                    $sum: {
                        $and: [
                            { $ne: ['$icon', null] },
                            { $ne: ['$img', null] }
                        ]
                    }
                }
            }
        },
        { $sort: { count: -1 } }
    ]).toArray();
}

export function getEffectsByCategory(collection: Collection<any>) {
    return collection.aggregate([
        {
            $group: {
                _id: '$type',
                effects: {
                    $push: {
                        name: '$name',
                        icon: '$icon',
                        img: '$img',
                        createdAt: '$createdAt'
                    }
                },
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                type: '$_id',
                effects: { $sortArray: { input: '$effects', sortBy: { name: 1 } } },
                count: 1
            }
        }
    ]).toArray();
}

export async function updateName(collection: Collection<any>, _id: ObjectId, newName: string) {
    const name = newName.toLowerCase().trim();

    return collection.findOneAndUpdate(
        { _id },
        { $set: { name, updatedAt: new Date() } },
        {
            returnDocument: 'after',
            projection: {
                name: 1,
                type: 1,
                icon: 1,
                img: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    );
}

export async function updateType(collection: Collection<any>, _id: ObjectId, newType: BeautyEffectType) {
    return collection.findOneAndUpdate(
        { _id },
        { $set: { type: newType, updatedAt: new Date() } },
        {
            returnDocument: 'after',
            projection: {
                name: 1,
                type: 1,
                icon: 1,
                img: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    );
}

export async function updateAssets(collection: Collection<any>, _id: ObjectId, icon?: string, img?: string) {
    const updateData: any = {
        updatedAt: new Date()
    };

    if (icon !== undefined) updateData.icon = icon;
    if (img !== undefined) updateData.img = img;

    return collection.findOneAndUpdate(
        { _id },
        { $set: updateData },
        {
            returnDocument: 'after',
            projection: {
                name: 1,
                type: 1,
                icon: 1,
                img: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    );
}

export function getDisplayName(effect: IBeautyEffect): string {
    return effect.name.charAt(0).toUpperCase() + effect.name.slice(1);
}

export function hasBothAssets(effect: IBeautyEffect): boolean {
    return !!(effect.icon && effect.img);
}
export class BeautyEffect extends BaseModel<IBeautyEffect> {
  static collectionName = 'beautyeffects';
}
