import {
  Filter, Document, UpdateResult, DeleteResult,
  AggregationCursor, OptionalUnlessRequiredId
} from 'mongodb';
import { getDb } from '../config/db';
import { QueryBuilder } from './QueryBuilder';
import { DocumentProxy } from './DocumentProxy';

export abstract class BaseModel<T extends Record<string, any> = any> {
  static collectionName: string;

  static find<T extends Record<string, any> = any>(filter: Filter<Document> = {}): QueryBuilder<T, DocumentProxy<T>[]> {
    const coll = getDb().collection((this as any).collectionName);
    return new QueryBuilder<T, DocumentProxy<T>[]>(coll, filter, 'find');
  }

  static findOne<T extends Record<string, any> = any>(filter: Filter<Document> = {}): QueryBuilder<T, DocumentProxy<T> | null> {
    const coll = getDb().collection((this as any).collectionName);
    return new QueryBuilder<T, DocumentProxy<T> | null>(coll, filter, 'findOne');
  }

  static findById<T extends Record<string, any> = any>(id: string): QueryBuilder<T, DocumentProxy<T> | null> {
    return (this as any).findOne({ id });
  }

  static async create<T extends Record<string, any> = any>(data: any): Promise<DocumentProxy<T>> {
    const coll = getDb().collection((this as any).collectionName);
    const doc = { ...data, createdAt: data.createdAt || new Date(), updatedAt: data.updatedAt || new Date() };
    const result = await coll.insertOne(doc as OptionalUnlessRequiredId<Document>);
    return new DocumentProxy<T>(coll, { _id: result.insertedId } as any, { _id: result.insertedId, ...doc } as any, false);
  }

  static async updateOne(filter: Filter<Document>, update: any): Promise<UpdateResult> {
    return getDb().collection((this as any).collectionName).updateOne(filter, update);
  }

  static async updateMany(filter: Filter<Document>, update: any): Promise<UpdateResult> {
    return getDb().collection((this as any).collectionName).updateMany(filter, update);
  }

  static async deleteOne(filter: Filter<Document>): Promise<DeleteResult> {
    return getDb().collection((this as any).collectionName).deleteOne(filter);
  }

  static async deleteMany(filter: Filter<Document>): Promise<DeleteResult> {
    return getDb().collection((this as any).collectionName).deleteMany(filter);
  }

  static async countDocuments(filter: Filter<Document> = {}): Promise<number> {
    return getDb().collection((this as any).collectionName).countDocuments(filter);
  }

  static async exists(filter: Filter<Document>): Promise<boolean> {
    const doc = await getDb().collection((this as any).collectionName).findOne(filter, { projection: { _id: 1 } });
    return doc !== null;
  }

  static aggregate(pipeline: Document[]): AggregationCursor {
    return getDb().collection((this as any).collectionName).aggregate(pipeline);
  }

  static async bulkWrite(ops: any[]): Promise<any> {
    return getDb().collection((this as any).collectionName).bulkWrite(ops);
  }

  static async insertMany(docs: any[]): Promise<any> {
    return getDb().collection((this as any).collectionName).insertMany(
      docs.map((d: any) => ({ ...d, createdAt: new Date(), updatedAt: new Date() }))
    );
  }

  static async findOneAndUpdate<T extends Record<string, any> = any>(
    filter: Filter<Document>,
    update: any,
    options: any = {},
  ): Promise<DocumentProxy<T> | null> {
    const coll = getDb().collection((this as any).collectionName);
    const opts: any = { returnDocument: 'after' };
    if (options.returnDocument === 'before') opts.returnDocument = 'before';
    if (options.projection) opts.projection = options.projection;
    if (options.upsert) opts.upsert = true;
    if (options.sort) opts.sort = options.sort;
    if (options.new === false) opts.returnDocument = 'before';
    if (options.new === true) opts.returnDocument = 'after';
    const doc = await coll.findOneAndUpdate(filter, update, opts);
    if (!doc) return null;
    return new DocumentProxy<T>(coll, filter as any, doc as any, false);
  }

  static async findOneAndDelete<T extends Record<string, any> = any>(
    filter: Filter<Document>,
  ): Promise<DocumentProxy<T> | null> {
    const coll = getDb().collection((this as any).collectionName);
    const doc = await coll.findOneAndDelete(filter);
    if (!doc) return null;
    return new DocumentProxy<T>(coll, filter as any, doc as any, false);
  }

  static async distinct(field: string, filter: Filter<Document> = {}): Promise<any[]> {
    return getDb().collection((this as any).collectionName).distinct(field, filter);
  }

  static async insertOne(data: any): Promise<any> {
    return getDb().collection((this as any).collectionName).insertOne(
      { ...data, createdAt: new Date(), updatedAt: new Date() }
    );
  }
}
