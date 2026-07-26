"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopItem = exports.COLLECTION = void 0;
exports.createWithIdempotency = createWithIdempotency;
exports.seedItems = seedItems;
exports.findBasic = findBasic;
exports.findWithMedia = findWithMedia;
exports.findList = findList;
exports.findByCategory = findByCategory;
exports.findActive = findActive;
exports.findByPriceRange = findByPriceRange;
exports.findByIds = findByIds;
exports.findPaginated = findPaginated;
exports.getCategoryStats = getCategoryStats;
exports.searchItems = searchItems;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'shopitems';
async function createWithIdempotency(collection, itemData) {
    return collection.findOneAndUpdate({ id: itemData.id }, { $setOnInsert: itemData }, { upsert: true, returnDocument: 'after' });
}
async function seedItems(collection, items) {
    const operations = items.map(item => ({
        updateOne: {
            filter: { id: item.id },
            update: { $setOnInsert: item },
            upsert: true
        }
    }));
    return collection.bulkWrite(operations, { ordered: false });
}
async function findBasic(collection, limit) {
    const options = {
        projection: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        sort: { category: 1, name: 1 }
    };
    if (limit)
        options.limit = limit;
    return collection.find({ isActive: true }, options).toArray();
}
async function findWithMedia(collection, category, activeOnly = true) {
    const query = {};
    if (activeOnly)
        query.isActive = true;
    if (category)
        query.category = category;
    return collection.find(query, {
        projection: { id: 1, name: 1, category: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1 },
        sort: { category: 1, name: 1 }
    }).toArray();
}
async function findList(collection, category, activeOnly = true) {
    const query = {};
    if (activeOnly)
        query.isActive = true;
    if (category)
        query.category = category;
    return collection.find(query, {
        projection: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 },
        sort: { category: 1, name: 1 }
    }).toArray();
}
async function findByCategory(collection, category, activeOnly = true, projection = 'basic') {
    const query = { category };
    if (activeOnly)
        query.isActive = true;
    const projections = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 },
        full: { id: 1, name: 1, category: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1 }
    };
    return collection.find(query, { projection: projections[projection], sort: { name: 1 } }).toArray();
}
async function findActive(collection, projection = 'basic') {
    const projections = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 },
        full: { id: 1, name: 1, category: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1 }
    };
    return collection.find({ isActive: true }, { projection: projections[projection], sort: { category: 1, name: 1 } }).toArray();
}
async function findByPriceRange(collection, minPrice, maxPrice, activeOnly = true, projection = 'basic') {
    const query = { price: { $gte: minPrice, $lte: maxPrice } };
    if (activeOnly)
        query.isActive = true;
    const projections = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 }
    };
    return collection.find(query, { projection: projections[projection], sort: { price: 1, name: 1 } }).toArray();
}
async function findByIds(collection, ids, projection = 'basic') {
    const projections = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 },
        full: { id: 1, name: 1, category: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1 }
    };
    return collection.find({ id: { $in: ids } }, { projection: projections[projection], sort: { name: 1 } }).toArray();
}
async function findPaginated(collection, page = 1, limit = 20, filters, projection = 'basic') {
    const skip = (page - 1) * limit;
    const query = {};
    if (filters?.category)
        query.category = filters.category;
    if (filters?.activeOnly !== false)
        query.isActive = true;
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
        query.price = {};
        if (filters?.minPrice !== undefined)
            query.price.$gte = filters.minPrice;
        if (filters?.maxPrice !== undefined)
            query.price.$lte = filters.maxPrice;
    }
    const projections = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 },
        full: { id: 1, name: 1, category: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1 }
    };
    const [data, total] = await Promise.all([
        collection.find(query, { projection: projections[projection], sort: { category: 1, name: 1 }, skip, limit }).toArray(),
        collection.countDocuments(query)
    ]);
    return {
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
}
async function getCategoryStats(collection, activeOnly = true) {
    const query = activeOnly ? { isActive: true } : {};
    return collection.aggregate([
        { $match: query },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' }
            }
        },
        { $sort: { count: -1 } }
    ]).toArray();
}
async function searchItems(collection, searchText, activeOnly = true, projection = 'basic') {
    const query = {
        $or: [
            { name: { $regex: searchText, $options: 'i' } },
            { description: { $regex: searchText, $options: 'i' } }
        ]
    };
    if (activeOnly)
        query.isActive = true;
    const projections = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 }
    };
    return collection.find(query, { projection: projections[projection], sort: { name: 1 } }).toArray();
}
class ShopItem extends BaseModel_1.BaseModel {
}
exports.ShopItem = ShopItem;
ShopItem.collectionName = 'shopitems';
