import { Collection, Filter, Document, WithId } from 'mongodb';

export async function populateOne<T extends Document, R extends Document>(
  collection: Collection<T>,
  filter: Filter<T>,
  refCollection: Collection<R>,
  refField: keyof T & string,
  targetField: string,
  projection?: Record<string, 1 | 0>,
): Promise<(WithId<T> & Record<string, R | null>) | null> {
  const doc = await collection.findOne(filter);
  if (!doc) return null as any;

  const refValue = (doc as any)[refField];
  if (!refValue) {
    return { ...doc, [targetField]: null } as any;
  }

  const refDoc = projection
    ? await refCollection.findOne({ id: refValue } as any, { projection })
    : await refCollection.findOne({ id: refValue } as any);

  return { ...doc, [targetField]: refDoc || null } as any;
}

export async function populateMany<T extends Document, R extends Document>(
  docs: T[],
  refCollection: Collection<R>,
  refField: keyof T & string,
  targetField: string,
  projection?: Record<string, 1 | 0>,
): Promise<(T & Record<string, R | null>)[]> {
  const refIds = [...new Set(docs.map(d => (d as any)[refField]).filter(Boolean))];
  if (refIds.length === 0) return docs as any;

  const refDocs = projection
    ? await refCollection.find({ id: { $in: refIds } } as any, { projection }).toArray()
    : await refCollection.find({ id: { $in: refIds } } as any).toArray();

  const refMap = new Map(refDocs.map(d => [(d as any).id, d]));

  return docs.map(d => ({
    ...d,
    [targetField]: refMap.get((d as any)[refField]) || null,
  })) as any;
}
