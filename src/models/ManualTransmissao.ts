import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IManualTransmissao {
    titulo: string;
    secoes: Array<{
        titulo: string;
        itens: string[];
    }>;
    version?: number;
    isActive?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'manualtransmissaos';

export async function findActive(collection: Collection<IManualTransmissao>): Promise<IManualTransmissao | null> {
    return collection.findOne(
        { isActive: true },
        {
            projection: { titulo: 1, secoes: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
            sort: { version: -1 }
        }
    );
}

export async function findActiveMinimal(collection: Collection<IManualTransmissao>): Promise<IManualTransmissao | null> {
    return collection.findOne(
        { isActive: true },
        {
            projection: { titulo: 1, version: 1, isActive: 1, createdAt: 1 },
            sort: { version: -1 }
        }
    );
}

export async function findByVersion(collection: Collection<IManualTransmissao>, version: number): Promise<IManualTransmissao | null> {
    return collection.findOne(
        { version },
        {
            projection: { titulo: 1, secoes: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 }
        }
    );
}

export async function findAllVersions(collection: Collection<IManualTransmissao>): Promise<IManualTransmissao[]> {
    return collection.find(
        {},
        {
            projection: { titulo: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
            sort: { version: -1 }
        }
    ).toArray();
}

export async function findActiveVersions(collection: Collection<IManualTransmissao>): Promise<IManualTransmissao[]> {
    return collection.find(
        { isActive: true },
        {
            projection: { titulo: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
            sort: { version: -1 }
        }
    ).toArray();
}

export async function findByTitle(collection: Collection<IManualTransmissao>, titulo: string): Promise<IManualTransmissao[]> {
    const searchRegex = new RegExp(titulo, 'i');
    return collection.find(
        { titulo: { $regex: searchRegex } },
        {
            projection: { titulo: 1, secoes: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
            sort: { version: -1 }
        }
    ).toArray();
}

export async function findRecent(collection: Collection<IManualTransmissao>, limit: number = 10): Promise<IManualTransmissao[]> {
    return collection.find(
        {},
        {
            projection: { titulo: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
            sort: { createdAt: -1 },
            limit
        }
    ).toArray();
}

export async function createNewVersion(collection: Collection<IManualTransmissao>, manualData: any): Promise<IManualTransmissao | null> {
    if (!manualData.titulo || !manualData.secoes || manualData.secoes.length === 0) {
        throw new Error('titulo e secoes são obrigatórios');
    }
    return collection.findOneAndUpdate(
        { isActive: true },
        {
            $set: { isActive: false },
            $setOnInsert: { ...manualData, version: 1, isActive: true }
        },
        { upsert: true, returnDocument: 'after', sort: { version: -1 } }
    );
}

export async function createManual(collection: Collection<IManualTransmissao>, manualData: any): Promise<IManualTransmissao> {
    if (!manualData.titulo || !manualData.secoes || manualData.secoes.length === 0) {
        throw new Error('titulo e secoes são obrigatórios');
    }
    const { insertedId } = await collection.insertOne(manualData);
    return { ...manualData, _id: insertedId } as unknown as IManualTransmissao;
}

export async function getManualStats(collection: Collection<IManualTransmissao>): Promise<any[]> {
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

export async function findManualsByDateRange(collection: Collection<IManualTransmissao>, startDate: Date, endDate: Date): Promise<IManualTransmissao[]> {
    return collection.find(
        {
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        },
        {
            projection: { titulo: 1, secoes: 1, version: 1, isActive: 1, createdAt: 1, updatedAt: 1 },
            sort: { createdAt: -1 }
        }
    ).toArray();
}

export async function findManualsWithSection(collection: Collection<IManualTransmissao>, sectionTitle: string): Promise<IManualTransmissao[]> {
    const searchRegex = new RegExp(sectionTitle, 'i');
    return collection.find(
        { 'secoes.titulo': { $regex: searchRegex } },
        {
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
        }
    ).toArray();
}

export async function deactivateManual(collection: Collection<IManualTransmissao>, id: string): Promise<IManualTransmissao | null> {
    return collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { isActive: false } },
        { returnDocument: 'after' }
    );
}

export function isActiveVersion(doc: IManualTransmissao): boolean {
    return doc.isActive === true;
}
export class ManualTransmissao extends BaseModel<IManualTransmissao> {
  static collectionName = 'manualtransmissaos';
}
