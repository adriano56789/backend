import { Db, Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';
import { getCollection } from '../config/db';

export interface IRouletteItem {
  // Texto editável cadastrado pela pessoa (ex.: "Dança", "Música", "Cantar", etc.)
  label: string;
  // Emoji/ícone opcional exibido no setor da roleta
  icon: string;
  // Cor do setor (hex)
  color: string;
  // Texto claro do setor (hex)
  textColor: string;
  // Dono do item (userId/streamerId que cadastrou)
  ownerId: string;
  // Tipo: 'action' | 'gift' | 'diamonds' | 'vip' | 'surprise' (flexível)
  type: string;
  // Valor extra (ex.: quantidade de diamantes, multiplicador etc.) — 0 se não aplicável
  amount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'roulette_items';

function getColl(db?: Db): Collection<IRouletteItem> {
  if (db) return db.collection<IRouletteItem>(COLLECTION_NAME);
  return getCollection<IRouletteItem>(COLLECTION_NAME);
}

// Listar itens ativos de um dono (ordem de criação)
export function findActiveByOwner(ownerId: string, db?: Db) {
  const coll = getColl(db);
  return coll.find(
    { ownerId, isActive: true },
    { sort: { createdAt: 1 } }
  ).toArray();
}

// Buscar um item por id
export async function findItemById(id: string, db?: Db) {
  const coll = getColl(db);
  let query: any = {};
  try {
    query = { _id: new ObjectId(id) };
  } catch {
    query = { id };
  }
  return coll.findOne(query);
}

// Criar item (com timestamps automáticos)
export async function createRouletteItem(data: any, db?: Db) {
  const coll = getColl(db);
  const now = new Date();
  const finalData = {
    isActive: true,
    type: 'action',
    amount: 0,
    color: '#8b5cf6',
    textColor: '#ffffff',
    icon: '🎁',
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  const result = await coll.insertOne(finalData as any);
  return { _id: result.insertedId, ...finalData };
}

// Atualizar item por id
export async function updateRouletteItem(id: string, update: any, db?: Db) {
  const coll = getColl(db);
  let query: any = {};
  try {
    query = { _id: new ObjectId(id) };
  } catch {
    query = { id };
  }
  return coll.findOneAndUpdate(
    query,
    { $set: { ...update, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
}

// Remover (soft delete) item por id
export async function deactivateRouletteItem(id: string, db?: Db) {
  const coll = getColl(db);
  let query: any = {};
  try {
    query = { _id: new ObjectId(id) };
  } catch {
    query = { id };
  }
  return coll.findOneAndUpdate(
    query,
    { $set: { isActive: false, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
}

// Remover (hard delete) item por id
export async function hardDeleteRouletteItem(id: string, db?: Db) {
  const coll = getColl(db);
  let query: any = {};
  try {
    query = { _id: new ObjectId(id) };
  } catch {
    query = { id };
  }
  return coll.deleteOne(query);
}

export class RouletteItem extends BaseModel<IRouletteItem> {
  static collectionName = COLLECTION_NAME;
  static getColl = getColl;
}
