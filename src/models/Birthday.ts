import { Collection } from 'mongodb';
import { BaseModel } from '../db/BaseModel';

export interface IBirthday {
    userId: string;
    birthDate: Date;
    age: number;
    zodiacSign?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export const COLLECTION = 'birthdays';

export function calculateZodiacSign(birthDate: Date): string {
    const month = birthDate.getMonth() + 1;
    const day = birthDate.getDate();

    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Áries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Touro';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gêmeos';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Câncer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leão';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgem';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Escorpião';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagitário';
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricórnio';
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquário';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Peixes';

    return 'Desconhecido';
}

export async function upsertBirthday(collection: Collection<any>, userId: string, birthDate: Date) {
    if (!userId || !birthDate) {
        throw new Error('userId e birthDate são obrigatórios');
    }

    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const finalAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
    const zodiacSign = calculateZodiacSign(birthDate);

    return collection.findOneAndUpdate(
        { userId },
        {
            $set: {
                birthDate,
                age: finalAge,
                zodiacSign,
                isActive: true,
                updatedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date() }
        },
        {
            upsert: true,
            returnDocument: 'after',
            projection: {
                userId: 1,
                birthDate: 1,
                age: 1,
                zodiacSign: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    );
}

export async function findByUserId(collection: Collection<any>, userId: string) {
    return collection.findOne(
        { userId, isActive: true },
        {
            projection: {
                userId: 1,
                birthDate: 1,
                age: 1,
                zodiacSign: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    );
}

export async function getAge(collection: Collection<any>, userId: string) {
    return collection.findOne(
        { userId, isActive: true },
        { projection: { age: 1 } }
    );
}

export async function getZodiacSign(collection: Collection<any>, userId: string) {
    return collection.findOne(
        { userId, isActive: true },
        { projection: { zodiacSign: 1 } }
    );
}

export async function findByMonth(collection: Collection<any>, month: number) {
    return collection.find(
        {
            isActive: true,
            $expr: { $eq: [{ $month: '$birthDate' }, month - 1] }
        },
        {
            projection: {
                userId: 1,
                birthDate: 1,
                age: 1,
                zodiacSign: 1
            }
        }
    ).sort({ birthDate: 1 }).toArray();
}

export async function deactivateBirthday(collection: Collection<any>, userId: string) {
    return collection.findOneAndUpdate(
        { userId },
        { $set: { isActive: false, updatedAt: new Date() } },
        { returnDocument: 'after', projection: { userId: 1, isActive: 1, updatedAt: 1 } }
    );
}
export class Birthday extends BaseModel<IBirthday> {
  static collectionName = 'birthdays';
}
