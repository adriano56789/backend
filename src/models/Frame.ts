import { Db, Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';
import { getCollection } from '../config/db';

export interface IFrame {
  name: string;
  price: number;
  duration: number;
  description: string;
  icon: string;
  image: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'frames';

function getColl(db?: Db): Collection<IFrame> {
  if (db) return db.collection<IFrame>(COLLECTION_NAME);
  return getCollection<IFrame>(COLLECTION_NAME);
}

export function findActive(db?: Db) {
  const coll = getColl(db);
  return coll.find(
    { isActive: true },
    { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { price: 1 } }
  ).toArray();
}

export function findByName(name: string, db?: Db) {
  const coll = getColl(db);
  return coll.findOne(
    { name, isActive: true },
    { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 } }
  );
}

export async function createFrame(frameData: any, db?: Db) {
  const coll = getColl(db);
  const finalData = { isActive: true, ...frameData };
  const result = await coll.insertOne(finalData as any);
  return { _id: result.insertedId, ...finalData };
}

export function findByPriceRange(minPrice: number, maxPrice: number, db?: Db) {
  const coll = getColl(db);
  return coll.find(
    { isActive: true, price: { $gte: minPrice, $lte: maxPrice } },
    { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { price: 1 } }
  ).toArray();
}

export function findByDuration(minDays: number, maxDays?: number, db?: Db) {
  const coll = getColl(db);
  const query: any = { isActive: true, duration: { $gte: minDays } };
  if (maxDays) query.duration.$lte = maxDays;
  return coll.find(
    query,
    { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { duration: 1 } }
  ).toArray();
}

export function findMostExpensive(limit: number = 10, db?: Db) {
  const coll = getColl(db);
  return coll.find(
    { isActive: true },
    { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { price: -1 }, limit }
  ).toArray();
}

export function findCheapest(limit: number = 10, db?: Db) {
  const coll = getColl(db);
  return coll.find(
    { isActive: true },
    { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { price: 1 }, limit }
  ).toArray();
}

export function findRecent(limit: number = 10, db?: Db) {
  const coll = getColl(db);
  return coll.find(
    { isActive: true },
    { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 }, sort: { createdAt: -1 }, limit }
  ).toArray();
}

export async function deactivateFrame(frameId: string, db?: Db) {
  const coll = getColl(db);
  return coll.findOneAndUpdate(
    { _id: frameId as any },
    { $set: { isActive: false } },
    { projection: { name: 1, price: 1, duration: 1, isActive: 1, updatedAt: 1 }, returnDocument: 'after' }
  );
}

export function findByIdWithProjection(frameId: string, db?: Db) {
  const coll = getColl(db);
  return coll.findOne(
    { _id: frameId as any, isActive: true },
    { projection: { name: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1, createdAt: 1, updatedAt: 1, _id: 0 } }
  );
}

export function countActiveFrames(db?: Db) {
  const coll = getColl(db);
  return coll.countDocuments({ isActive: true });
}

export class Frame extends BaseModel<IFrame> {
  static collectionName = COLLECTION_NAME;
  static getColl = getColl;
}
