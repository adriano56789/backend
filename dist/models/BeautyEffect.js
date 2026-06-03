"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BeautyEffect = exports.COLLECTION = exports.BeautyEffectType = void 0;
exports.createEffect = createEffect;
exports.findByName = findByName;
exports.findByType = findByType;
exports.searchEffects = searchEffects;
exports.getEffectStats = getEffectStats;
exports.getEffectsByCategory = getEffectsByCategory;
exports.updateName = updateName;
exports.updateType = updateType;
exports.updateAssets = updateAssets;
exports.getDisplayName = getDisplayName;
exports.hasBothAssets = hasBothAssets;
const BaseModel_1 = require("../db/BaseModel");
var BeautyEffectType;
(function (BeautyEffectType) {
    BeautyEffectType["FILTER"] = "filter";
    BeautyEffectType["EFFECT"] = "effect";
})(BeautyEffectType || (exports.BeautyEffectType = BeautyEffectType = {}));
exports.COLLECTION = 'beautyeffects';
async function createEffect(collection, effectData) {
    const defaultData = {
        type: BeautyEffectType.FILTER
    };
    const finalData = { ...defaultData, ...effectData };
    if (finalData.name) {
        finalData.name = finalData.name.toLowerCase().trim();
    }
    const doc = { ...finalData, createdAt: new Date(), updatedAt: new Date() };
    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
}
function findByName(collection, name) {
    return collection.findOne({ name: name.toLowerCase().trim() }, {
        projection: {
            name: 1,
            type: 1,
            icon: 1,
            img: 1,
            createdAt: 1,
            updatedAt: 1
        }
    });
}
function findByType(collection, type) {
    return collection.find({ type }, {
        projection: {
            name: 1,
            type: 1,
            icon: 1,
            img: 1,
            createdAt: 1,
            updatedAt: 1
        }
    }).sort({ name: 1 }).toArray();
}
function searchEffects(collection, query, limit = 50) {
    const searchRegex = new RegExp(query, 'i');
    return collection.find({
        name: { $regex: searchRegex }
    }, {
        projection: {
            name: 1,
            type: 1,
            icon: 1,
            img: 1,
            createdAt: 1,
            updatedAt: 1
        }
    })
        .sort({ name: 1 })
        .limit(limit)
        .toArray();
}
function getEffectStats(collection) {
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
function getEffectsByCategory(collection) {
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
async function updateName(collection, _id, newName) {
    const name = newName.toLowerCase().trim();
    return collection.findOneAndUpdate({ _id }, { $set: { name, updatedAt: new Date() } }, {
        returnDocument: 'after',
        projection: {
            name: 1,
            type: 1,
            icon: 1,
            img: 1,
            createdAt: 1,
            updatedAt: 1
        }
    });
}
async function updateType(collection, _id, newType) {
    return collection.findOneAndUpdate({ _id }, { $set: { type: newType, updatedAt: new Date() } }, {
        returnDocument: 'after',
        projection: {
            name: 1,
            type: 1,
            icon: 1,
            img: 1,
            createdAt: 1,
            updatedAt: 1
        }
    });
}
async function updateAssets(collection, _id, icon, img) {
    const updateData = {
        updatedAt: new Date()
    };
    if (icon !== undefined)
        updateData.icon = icon;
    if (img !== undefined)
        updateData.img = img;
    return collection.findOneAndUpdate({ _id }, { $set: updateData }, {
        returnDocument: 'after',
        projection: {
            name: 1,
            type: 1,
            icon: 1,
            img: 1,
            createdAt: 1,
            updatedAt: 1
        }
    });
}
function getDisplayName(effect) {
    return effect.name.charAt(0).toUpperCase() + effect.name.slice(1);
}
function hasBothAssets(effect) {
    return !!(effect.icon && effect.img);
}
class BeautyEffect extends BaseModel_1.BaseModel {
}
exports.BeautyEffect = BeautyEffect;
BeautyEffect.collectionName = 'beautyeffects';
