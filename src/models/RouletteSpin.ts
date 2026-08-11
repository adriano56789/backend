import { Db, Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';
import { getCollection } from '../config/db';

export interface IRouletteSpin {
  userId: string;
  streamId: string;
  // Item sorteado (cópia na hora do giro — mesmo que o item seja editado depois, o histórico permanece)
  itemLabel: string;
  itemId: string;
  itemType: string;
  itemAmount: number;
  // Custo do giro em diamantes
  cost: number;
  // Diamantes do usuário antes/depois (auditoria)
  diamondsBefore: number;
  diamondsAfter: number;
  createdAt: Date;
}

const COLLECTION_NAME = 'roulette_spins';

function getColl(db?: Db): Collection<IRouletteSpin> {
  if (db) return db.collection<IRouletteSpin>(COLLECTION_NAME);
  return getCollection<IRouletteSpin>(COLLECTION_NAME);
}

// Registrar giro
export async function recordSpin(data: any, db?: Db) {
  const coll = getColl(db);
  const finalData = {
    ...data,
    createdAt: new Date(),
  };
  const result = await coll.insertOne(finalData as any);
  return { _id: result.insertedId, ...finalData };
}

// Histórico de giros de um usuário (limitado)
export function findSpinsByUser(userId: string, limit = 50, db?: Db) {
  const coll = getColl(db);
  return coll.find(
    { userId },
    { sort: { createdAt: -1 }, limit }
  ).toArray();
}

// Histórico de giros de uma stream (limitado)
export function findSpinsByStream(streamId: string, limit = 100, db?: Db) {
  const coll = getColl(db);
  return coll.find(
    { streamId },
    { sort: { createdAt: -1 }, limit }
  ).toArray();
}

export class RouletteSpin extends BaseModel<IRouletteSpin> {
  static collectionName = COLLECTION_NAME;
  static getColl = getColl;
}
