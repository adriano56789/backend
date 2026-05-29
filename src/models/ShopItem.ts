import { Collection, ObjectId } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IShopItemBasic {
    id: string;
    name: string;
    category: string;
    price: number;
    isActive: boolean;
}

export interface IShopItemWithMedia {
    id: string;
    name: string;
    category: string;
    price: number;
    duration?: number;
    description: string;
    icon: string;
    image: string;
    isActive: boolean;
}

export interface IShopItemList {
    id: string;
    name: string;
    category: string;
    price: number;
    icon: string;
    isActive: boolean;
}

export interface IShopItemFull extends IShopItem {
}

export interface IShopItem {
  id: string;
  name: string;
  category: 'mochila' | 'quadro' | 'carro' | 'bolha' | 'anel' | 'avatar';
  price: number;
  duration?: number;
  description: string;
  icon: string;
  image: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const COLLECTION = 'shopitems';

export async function createWithIdempotency(collection: Collection<IShopItem>, itemData: any): Promise<IShopItem | null> {
    return collection.findOneAndUpdate(
        { id: itemData.id },
        { $setOnInsert: itemData },
        { upsert: true, returnDocument: 'after' }
    );
}

export async function seedItems(collection: Collection<IShopItem>, items: any[]) {
    const operations = items.map(item => ({
        updateOne: {
            filter: { id: item.id },
            update: { $setOnInsert: item },
            upsert: true
        }
    }));
    return collection.bulkWrite(operations, { ordered: false });
}

export async function findBasic(collection: Collection<IShopItem>, limit?: number): Promise<IShopItemBasic[]> {
    const options: any = {
        projection: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        sort: { category: 1, name: 1 }
    };
    if (limit) options.limit = limit;
    return collection.find({ isActive: true }, options).toArray();
}

export async function findWithMedia(collection: Collection<IShopItem>, category?: string, activeOnly: boolean = true): Promise<IShopItemWithMedia[]> {
    const query: any = {};
    if (activeOnly) query.isActive = true;
    if (category) query.category = category;
    return collection.find(query, {
        projection: { id: 1, name: 1, category: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1 },
        sort: { category: 1, name: 1 }
    }).toArray();
}

export async function findList(collection: Collection<IShopItem>, category?: string, activeOnly: boolean = true): Promise<IShopItemList[]> {
    const query: any = {};
    if (activeOnly) query.isActive = true;
    if (category) query.category = category;
    return collection.find(query, {
        projection: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 },
        sort: { category: 1, name: 1 }
    }).toArray();
}

export async function findByCategory(collection: Collection<IShopItem>, category: string, activeOnly: boolean = true, projection: 'basic' | 'list' | 'full' = 'basic'): Promise<any[]> {
    const query: any = { category };
    if (activeOnly) query.isActive = true;
    const projections: Record<string, any> = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 },
        full: { id: 1, name: 1, category: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1 }
    };
    return collection.find(query, { projection: projections[projection], sort: { name: 1 } }).toArray();
}

export async function findActive(collection: Collection<IShopItem>, projection: 'basic' | 'list' | 'full' = 'basic'): Promise<any[]> {
    const projections: Record<string, any> = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 },
        full: { id: 1, name: 1, category: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1 }
    };
    return collection.find({ isActive: true }, { projection: projections[projection], sort: { category: 1, name: 1 } }).toArray();
}

export async function findByPriceRange(collection: Collection<IShopItem>, minPrice: number, maxPrice: number, activeOnly: boolean = true, projection: 'basic' | 'list' = 'basic'): Promise<any[]> {
    const query: any = { price: { $gte: minPrice, $lte: maxPrice } };
    if (activeOnly) query.isActive = true;
    const projections: Record<string, any> = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 }
    };
    return collection.find(query, { projection: projections[projection], sort: { price: 1, name: 1 } }).toArray();
}

export async function findByIds(collection: Collection<IShopItem>, ids: string[], projection: 'basic' | 'list' | 'full' = 'basic'): Promise<any[]> {
    const projections: Record<string, any> = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 },
        full: { id: 1, name: 1, category: 1, price: 1, duration: 1, description: 1, icon: 1, image: 1, isActive: 1 }
    };
    return collection.find({ id: { $in: ids } }, { projection: projections[projection], sort: { name: 1 } }).toArray();
}

export async function findPaginated(
    collection: Collection<IShopItem>,
    page: number = 1,
    limit: number = 20,
    filters?: { category?: string; activeOnly?: boolean; minPrice?: number; maxPrice?: number },
    projection: 'basic' | 'list' | 'full' = 'basic'
): Promise<{ data: any[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    const skip = (page - 1) * limit;
    const query: any = {};
    if (filters?.category) query.category = filters.category;
    if (filters?.activeOnly !== false) query.isActive = true;
    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
        query.price = {};
        if (filters?.minPrice !== undefined) query.price.$gte = filters.minPrice;
        if (filters?.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }
    const projections: Record<string, any> = {
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

export async function getCategoryStats(collection: Collection<IShopItem>, activeOnly: boolean = true): Promise<any[]> {
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

export async function searchItems(collection: Collection<IShopItem>, searchText: string, activeOnly: boolean = true, projection: 'basic' | 'list' = 'basic'): Promise<any[]> {
    const query: any = {
        $or: [
            { name: { $regex: searchText, $options: 'i' } },
            { description: { $regex: searchText, $options: 'i' } }
        ]
    };
    if (activeOnly) query.isActive = true;
    const projections: Record<string, any> = {
        basic: { id: 1, name: 1, category: 1, price: 1, isActive: 1 },
        list: { id: 1, name: 1, category: 1, price: 1, icon: 1, isActive: 1 }
    };
    return collection.find(query, { projection: projections[projection], sort: { name: 1 } }).toArray();
}
export class ShopItem extends BaseModel<IShopItem> {
  static collectionName = 'shopitems';
}
