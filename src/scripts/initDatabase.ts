import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import * as models from '../models';

interface ModelInfo {
  name: string;
  collection: string;
}

function getModelInfo(): ModelInfo[] {
  const entries: ModelInfo[] = [];
  const modelNames = mongoose.modelNames();
  for (const name of modelNames) {
    const m = mongoose.model(name);
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
    await mongoose.connect(mongoUri, { dbName });
    console.log(`Conectado ao banco: ${dbName}\n`);

    const db = mongoose.connection.db!;
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
        } catch (err: any) {
          if (err.code === 48) {
            console.log(`  ~ Já existe: ${info.collection} (model: ${info.name})`);
          } else {
            console.error(`  ! Erro ao criar ${info.collection}: ${err.message}`);
          }
        }
      } else {
        console.log(`  ✓ Existe: ${info.collection} (model: ${info.name})`);
      }
    }

    console.log('\n=== SINCRONIZANDO ÍNDICES ===');
    try {
      await mongoose.syncIndexes();
      console.log('Índices sincronizados com sucesso para todos os modelos.');
    } catch (err: any) {
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
      } catch {
        console.log(`\n[${info.collection}] (não foi possível listar índices)`);
      }
    }

    console.log('\n=== RESUMO ===');
    console.log(`Modelos registrados: ${modelInfo.length}`);
    console.log(`Collections existentes: ${existingCollections.length}`);
    console.log(`Collections criadas: ${modelInfo.filter(m => !existingNames.has(m.collection)).length}`);

  } catch (err: any) {
    console.error('Erro na inicialização do banco:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado do MongoDB.');
  }
}

initDatabase();
