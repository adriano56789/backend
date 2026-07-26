"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function main() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:adriano123@127.0.0.1:27017/api?authSource=admin';
    await mongoose_1.default.connect(mongoUri);
    console.log('Conectado ao MongoDB');
    const db = mongoose_1.default.connection.db;
    const cols = await db.listCollections().toArray();
    console.log('Coleções encontradas:', cols.map(c => c.name));
    for (const col of cols) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`  ${col.name}: ${count} documentos`);
    }
    // Se a coleção users existir, mostrar amostra
    if (cols.find(c => c.name === 'users')) {
        const sample = await db.collection('users').find().limit(3).toArray();
        console.log('\nAmostra de usuários:');
        sample.forEach((u) => {
            console.log(`  id: ${u.id}, name: ${u.name}, email: ${u.email}, identification: ${u.identification}`);
        });
    }
    await mongoose_1.default.disconnect();
}
main().catch(err => {
    console.error('Erro:', err);
    process.exit(1);
});
