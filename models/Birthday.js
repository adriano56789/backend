"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Birthday = exports.COLLECTION = void 0;
exports.calculateZodiacSign = calculateZodiacSign;
exports.upsertBirthday = upsertBirthday;
exports.findByUserId = findByUserId;
exports.getAge = getAge;
exports.getZodiacSign = getZodiacSign;
exports.findByMonth = findByMonth;
exports.deactivateBirthday = deactivateBirthday;
const BaseModel_1 = require("../db/BaseModel");
exports.COLLECTION = 'birthdays';
function calculateZodiacSign(birthDate) {
    const month = birthDate.getMonth() + 1;
    const day = birthDate.getDate();
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
        return '�ries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
        return 'Touro';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
        return 'G�meos';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
        return 'C�ncer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
        return 'Le�o';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
        return 'Virgem';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
        return 'Libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
        return 'Escorpi�o';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
        return 'Sagit�rio';
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
        return 'Capric�rnio';
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
        return 'Aqu�rio';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20))
        return 'Peixes';
    return 'Desconhecido';
}
async function upsertBirthday(collection, userId, birthDate) {
    if (!userId || !birthDate) {
        throw new Error('userId e birthDate s�o obrigat�rios');
    }
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const finalAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
    const zodiacSign = calculateZodiacSign(birthDate);
    return collection.findOneAndUpdate({ userId }, {
        $set: {
            birthDate,
            age: finalAge,
            zodiacSign,
            isActive: true,
            updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
    }, {
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
    });
}
async function findByUserId(collection, userId) {
    return collection.findOne({ userId, isActive: true }, {
        projection: {
            userId: 1,
            birthDate: 1,
            age: 1,
            zodiacSign: 1,
            isActive: 1,
            createdAt: 1,
            updatedAt: 1
        }
    });
}
async function getAge(collection, userId) {
    return collection.findOne({ userId, isActive: true }, { projection: { age: 1 } });
}
async function getZodiacSign(collection, userId) {
    return collection.findOne({ userId, isActive: true }, { projection: { zodiacSign: 1 } });
}
async function findByMonth(collection, month) {
    return collection.find({
        isActive: true,
        $expr: { $eq: [{ $month: '$birthDate' }, month - 1] }
    }, {
        projection: {
            userId: 1,
            birthDate: 1,
            age: 1,
            zodiacSign: 1
        }
    }).sort({ birthDate: 1 }).toArray();
}
async function deactivateBirthday(collection, userId) {
    return collection.findOneAndUpdate({ userId }, { $set: { isActive: false, updatedAt: new Date() } }, { returnDocument: 'after', projection: { userId: 1, isActive: 1, updatedAt: 1 } });
}
class Birthday extends BaseModel_1.BaseModel {
}
exports.Birthday = Birthday;
Birthday.collectionName = 'birthdays';
