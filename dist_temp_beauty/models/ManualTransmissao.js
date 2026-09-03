"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualTransmissao = exports.COLLECTION = void 0;
exports.findActive = findActive;
exports.findActiveMinimal = findActiveMinimal;
exports.findByVersion = findByVersion;
exports.findAllVersions = findAllVersions;
exports.findActiveVersions = findActiveVersions;
exports.findByTitle = findByTitle;
exports.findRecent = findRecent;
exports.createNewVersion = createNewVersion;
exports.createManual = createManual;
exports.getManualStats = getManualStats;
exports.findManualsByDateRange = findManualsByDateRange;
exports.findManualsWithSection = findManualsWithSection;
exports.deactivateManual = deactivateManual;
exports.isActiveVersion = isActiveVersion;
const mongodb_1 = require("mongodb");
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'manualtransmissaos';
async function findActive(collection) {
    return collection.findOne({ isActive: true }, {
        projection: { titulo: 1, secoes: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
        sort: { version: -1 }
    });
}
async function findActiveMinimal(collection) {
    return collection.findOne({ isActive: true }, {
        projection: { titulo: 1, version: 1, isActive: 1, createdAt: 1 },
        sort: { version: -1 }
    });
}
async function findByVersion(collection, version) {
    return collection.findOne({ version }, {
        projection: { titulo: 1, secoes: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
    });
}
async function findAllVersions(collection) {
    return collection.find({}, {
        projection: { titulo: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
        sort: { version: -1 }
    }).toArray();
}
async function findActiveVersions(collection) {
    return collection.find({ isActive: true }, {
        projection: { titulo: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
        sort: { version: -1 }
    }).toArray();
}
async function findByTitle(collection, titulo) {
    const searchRegex = new RegExp(titulo, 'i');
    return collection.find({ titulo: { $regex: searchRegex } }, {
        projection: { titulo: 1, secoes: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
        sort: { version: -1 }
    }).toArray();
}
async function findRecent(collection, limit = 10) {
    return collection.find({}, {
        projection: { titulo: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
        sort: { createdAt: -1 },
        limit
    }).toArray();
}
async function createNewVersion(collection, manualData) {
    if (!manualData.titulo || !manualData.secoes || manualData.secoes.length === 0) {
        throw new Error('titulo e secoes são obrigatórios');
    }
    return collection.findOneAndUpdate({ isActive: true }, {
        $set: { isActive: false },
        $setOnInsert: { ...manualData, version: 1, isActive: true }
    }, { upsert: true, returnDocument: 'after', sort: { version: -1 } });
}
async function createManual(collection, manualData) {
    if (!manualData.titulo || !manualData.secoes || manualData.secoes.length === 0) {
        throw new Error('titulo e secoes são obrigatórios');
    }
    const { insertedId } = await collection.insertOne(manualData);
    return { ...manualData, _id: insertedId };
}
async function getManualStats(collection) {
    return collection.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
                inactive: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } },
                avgSectionsPerManual: { $avg: { $size: '$secoes' } },
                maxVersion: { $max: '$version' },
                minVersion: { $min: '$version' }
            }
        },
        {
            $project: {
                _id: 0,
                total: 1,
                active: 1,
                inactive: 1,
                activePercentage: { $multiply: [{ $divide: ['$active', '$total'] }, 100] },
                avgSectionsPerManual: { $round: ['$avgSectionsPerManual', 2] },
                maxVersion: 1,
                minVersion: 1,
                versionRange: { $subtract: ['$maxVersion', '$minVersion'] }
            }
        }
    ]).toArray();
}
async function findManualsByDateRange(collection, startDate, endDate) {
    return collection.find({
        createdAt: {
            $gte: startDate,
            $lte: endDate
        }
    }, {
        projection: { titulo: 1, secoes: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
        sort: { createdAt: -1 }
    }).toArray();
}
async function findManualsWithSection(collection, sectionTitle) {
    const searchRegex = new RegExp(sectionTitle, 'i');
    return collection.find({ 'secoes.titulo': { $regex: searchRegex } }, {
        projection: {
            titulo: 1,
            secoes: {
                $filter: {
                    input: '$secoes',
                    as: 'secao',
                    cond: { $regexMatch: { input: '$$secao.titulo', regex: searchRegex } }
                }
            },
            version: 1,
            isActive: 1,
            createdAt: 1,
            updatedAt: 1
        },
        sort: { version: -1 }
    }).toArray();
}
async function deactivateManual(collection, id) {
    return collection.findOneAndUpdate({ _id: new mongodb_1.ObjectId(id) }, { $set: { isActive: false } }, { returnDocument: 'after' });
}
function isActiveVersion(doc) {
    return doc.isActive === true;
}
class ManualTransmissao extends BaseModel_1.BaseModel {
}
exports.ManualTransmissao = ManualTransmissao;
ManualTransmissao.collectionName = 'manualtransmissaos';
