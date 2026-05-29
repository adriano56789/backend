import { Collection, Filter, Document, Sort, FindOptions } from 'mongodb';
import { DocumentProxy } from './DocumentProxy';

export class QueryBuilder<T extends Record<string, any> = any, R = DocumentProxy<T>[]> {
  private _collection: Collection;
  private _filter: Filter<Document>;
  private _projection: Record<string, 1 | 0> = {};
  private _sort: Sort = {};
  private _limitValue: number = 0;
  private _skipValue: number = 0;
  private _mode: 'findOne' | 'find';

  constructor(collection: Collection, filter: Filter<Document>, mode: 'findOne' | 'find') {
    this._collection = collection;
    this._filter = filter;
    this._mode = mode;
  }

  select(fields: string | Record<string, 1 | 0>): this {
    if (typeof fields === 'string') {
      const parts = fields.split(/\s+/);
      for (const p of parts) {
        if (p.startsWith('-')) {
          this._projection[p.slice(1)] = 0;
        } else {
          this._projection[p] = 1;
        }
      }
    } else {
      Object.assign(this._projection, fields);
    }
    return this;
  }

  sort(sort: Sort): this {
    this._sort = sort;
    return this;
  }

  limit(n: number): this {
    this._limitValue = n;
    return this;
  }

  skip(n: number): this {
    this._skipValue = n;
    return this;
  }

  lean(): this {
    return this;
  }

  populate(field: string, select?: string): this {
    return this;
  }

  private _buildOptions(): FindOptions {
    const opts: FindOptions = {};
    if (Object.keys(this._projection).length > 0) opts.projection = this._projection;
    if (Object.keys(this._sort).length > 0) opts.sort = this._sort;
    if (this._limitValue > 0) opts.limit = this._limitValue;
    if (this._skipValue > 0) opts.skip = this._skipValue;
    return opts;
  }

  private _execFindOne(): Promise<DocumentProxy<T> | null> {
    const opts = this._buildOptions();
    return this._collection.findOne(this._filter, opts).then(doc => {
      if (!doc) return null;
      return new DocumentProxy<T>(this._collection, { _id: doc._id } as any, doc as any, false);
    });
  }

  private _execFind(): Promise<DocumentProxy<T>[]> {
    const opts = this._buildOptions();
    return this._collection.find(this._filter, opts).toArray().then(docs =>
      docs.map(d => new DocumentProxy<T>(this._collection, { _id: d._id } as any, d as any, false))
    );
  }

  then<TResult1 = R, TResult2 = never>(
    onfulfilled?: ((value: R) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const promise = this._mode === 'findOne'
      ? this._execFindOne() as Promise<any>
      : this._execFind() as Promise<any>;
    return promise.then(onfulfilled, onrejected);
  }

  exec(): Promise<R> {
    return (this._mode === 'findOne'
      ? this._execFindOne()
      : this._execFind()) as Promise<any>;
  }

  toArray(): Promise<DocumentProxy<T>[]> {
    return this._execFind();
  }
}
