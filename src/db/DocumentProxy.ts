import { Collection, Filter, Document } from 'mongodb';

export class DocumentProxy<T extends Record<string, any> = any> {
  [key: string]: any;

  private _collection: Collection;
  private _filter: Filter<Document> | null;
  private _isNew: boolean;

  constructor(
    collection: Collection,
    filter: Filter<Document> | null,
    data: T & { _id?: any },
    isNew: boolean = false,
  ) {
    this._collection = collection;
    this._filter = filter;
    this._isNew = isNew;
    Object.assign(this, data);
  }

  private _getData(): Record<string, any> {
    const data: Record<string, any> = {};
    for (const key of Object.keys(this)) {
      if (!key.startsWith('_')) {
        data[key] = this[key];
      }
    }
    return data;
  }

  async save(): Promise<this> {
    if (this._isNew) {
      const data = this._getData();
      await this._collection.insertOne(data as any);
      this._isNew = false;
      this._filter = { id: data.id } as any;
    } else if (this._filter) {
      await this._collection.updateOne(this._filter, { $set: this._getData() });
    }
    return this;
  }

  toObject(): T {
    return this._getData() as unknown as T;
  }
}
