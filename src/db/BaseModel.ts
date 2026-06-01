import { getDb } from '../config/db';
import { QueryBuilder } from './QueryBuilder';
import { DocumentProxy } from './DocumentProxy';

export abstract class BaseModel<T extends Record<string, any> = any> {
  static collectionName: string;

  private static _coll() {
    return getDb().collection((this as any).collectionName) as any;
  }

  static find<T extends Record<string, any> = any>(filter: any = {}): QueryBuilder<T, DocumentProxy<T>[]> {
    const coll = (this as any)._coll();
    return new QueryBuilder<T, DocumentProxy<T>[]>(coll, filter, 'find');
  }

  static findOne<T extends Record<string, any> = any>(filter: any = {}): QueryBuilder<T, DocumentProxy<T> | null> {
    const coll = (this as any)._coll();
    return new QueryBuilder<T, DocumentProxy<T> | null>(coll, filter, 'findOne');
  }

  static findById<T extends Record<string, any> = any>(id: string): QueryBuilder<T, DocumentProxy<T> | null> {
    return (this as any).findOne({ id });
  }

  static async create<T extends Record<string, any> = any>(data: any): Promise<DocumentProxy<T>> {
    const coll = (this as any)._coll();
    const doc = { ...data, createdAt: data.createdAt || new Date(), updatedAt: data.updatedAt || new Date() };
    const result = await coll.insertOne(doc);
    return new DocumentProxy<T>(coll, { _id: result.insertedId } as any, { _id: result.insertedId, ...doc } as any, false);
  }

  static async updateOne(filter: any, update: any): Promise<any> {
    return (this as any)._coll().updateOne(filter, update);
  }

  static async updateMany(filter: any, update: any): Promise<any> {
    return (this as any)._coll().updateMany(filter, update);
  }

  static async deleteOne(filter: any): Promise<any> {
    return (this as any)._coll().deleteOne(filter);
  }

  static async deleteMany(filter: any): Promise<any> {
    return (this as any)._coll().deleteMany(filter);
  }

  static async countDocuments(filter: any = {}): Promise<number> {
    return (this as any)._coll().countDocuments(filter);
  }

  static async exists(filter: any): Promise<boolean> {
    const doc = await (this as any)._coll().findOne(filter, { projection: { _id: 1 } });
    return doc !== null;
  }

  static aggregate(pipeline: any[]): any {
    return (this as any)._coll().aggregate(pipeline);
  }

  static async bulkWrite(ops: any[]): Promise<any> {
    return (this as any)._coll().bulkWrite(ops);
  }

  static async insertMany(docs: any[]): Promise<any> {
    return (this as any)._coll().insertMany(
      docs.map((d: any) => ({ ...d, createdAt: new Date(), updatedAt: new Date() }))
    );
  }

  static async findOneAndUpdate<T extends Record<string, any> = any>(
    filter: any,
    update: any,
    options: any = {},
  ): Promise<DocumentProxy<T> | null> {
    const coll = (this as any)._coll();
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
    filter: any,
  ): Promise<DocumentProxy<T> | null> {
    const coll = (this as any)._coll();
    const doc = await coll.findOneAndDelete(filter);
    if (!doc) return null;
    return new DocumentProxy<T>(coll, filter as any, doc as any, false);
  }

  static async distinct(field: string, filter: any = {}): Promise<any[]> {
    return (this as any)._coll().distinct(field, filter);
  }

  static async insertOne(data: any): Promise<any> {
    return (this as any)._coll().insertOne(
      { ...data, createdAt: new Date(), updatedAt: new Date() }
    );
  }
}
