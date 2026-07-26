"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function getModelInfo() {
    const entries = [];
    const modelNames = mongoose_1.default.modelNames();
    for (const name of modelNames) {
        const m = mongoose_1.default.model(name);
        entries.push({
            name,
            collection: m.collection?.name || name.toLowerCase() + 's'
        });
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
}
async function initDatabase() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/api';
    const dbName = process.env.MONGODB_NAME || process.env.DB_NAME || 'api';
    try {
        console.log(`Conectando a ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}/${dbName}`);
        await mongoose_1.default.connect(mongoUri, { dbName });
        console.log(`Conectado ao banco: ${dbName}\n`);
        const db = mongoose_1.default.connection.db;
        const existingCollections = await db.listCollections().toArray();
        const existingNames = new Set(existingCollections.map(c => c.name));
        const modelInfo = getModelInfo();
        if (modelInfo.length === 0) {
            console.log('Nenhum modelo Mongoose encontrado.');
        }
        console.log('=== VERIFICAÇÃO DE COLLECTIONS ===');
        for (const info of modelInfo) {
            const exists = existingNames.has(info.collection);
            if (!exists) {
                try {
                    await db.createCollection(info.collection);
                    console.log(`  + Criada collection: ${info.collection} (model: ${info.name})`);
                }
                catch (err) {
                    if (err.code === 48) {
                        console.log(`  ~ Já existe: ${info.collection} (model: ${info.name})`);
                    }
                    else {
                        console.error(`  ! Erro ao criar ${info.collection}: ${err.message}`);
                    }
                }
            }
            else {
                console.log(`  ✓ Existe: ${info.collection} (model: ${info.name})`);
            }
        }
        console.log('\n=== SINCRONIZANDO ÍNDICES ===');
        try {
            await mongoose_1.default.syncIndexes();
            console.log('Índices sincronizados com sucesso para todos os modelos.');
        }
        catch (err) {
            console.error(`Erro ao sincronizar índices: ${err.message}`);
        }
        console.log('\n=== ÍNDICES POR COLLECTION ===');
        for (const info of modelInfo) {
            try {
                const indexes = await db.collection(info.collection).indexes();
                console.log(`\n[${info.collection}] (${indexes.length} índices):`);
                for (const idx of indexes) {
                    const fields = Object.keys(idx.key).join(', ');
                    const unique = idx.unique ? ' UNIQUE' : '';
                    const ttl = idx.expireAfterSeconds ? ` TTL:${idx.expireAfterSeconds}s` : '';
                    console.log(`  - ${fields}${unique}${ttl}`);
                }
            }
            catch {
                console.log(`\n[${info.collection}] (não foi possível listar índices)`);
            }
        }
        console.log('\n=== RESUMO ===');
        console.log(`Modelos registrados: ${modelInfo.length}`);
        console.log(`Collections existentes: ${existingCollections.length}`);
        console.log(`Collections criadas: ${modelInfo.filter(m => !existingNames.has(m.collection)).length}`);
    }
    catch (err) {
        console.error('Erro na inicialização do banco:', err);
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log('Desconectado do MongoDB.');
    }
}
initDatabase();
