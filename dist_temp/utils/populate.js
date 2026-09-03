"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateOne = populateOne;
exports.populateMany = populateMany;
async function populateOne(collection, filter, refCollection, refField, targetField, projection) {
    const doc = await collection.findOne(filter);
    if (!doc)
        return null;
    const refValue = doc[refField];
    if (!refValue) {
        return { ...doc, [targetField]: null };
    }
    const refDoc = projection
        ? await refCollection.findOne({ id: refValue }, { projection })
        : await refCollection.findOne({ id: refValue });
    return { ...doc, [targetField]: refDoc || null };
}
async function populateMany(docs, refCollection, refField, targetField, projection) {
    const refIds = [...new Set(docs.map(d => d[refField]).filter(Boolean))];
    if (refIds.length === 0)
        return docs;
    const refDocs = projection
        ? await refCollection.find({ id: { $in: refIds } }, { projection }).toArray()
        : await refCollection.find({ id: { $in: refIds } }).toArray();
    const refMap = new Map(refDocs.map(d => [d.id, d]));
    return docs.map(d => ({
        ...d,
        [targetField]: refMap.get(d[refField]) || null,
    }));
}
