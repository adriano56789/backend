const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URI = 'mongodb://admin:adriano123@72.60.249.175:27017/api?authSource=admin';
const DB_NAME = 'api';
const API_JSON_DIR = 'C:/Users/adria/OneDrive/Documentos/Área de Trabalho/front-end2/api.json';

function convertKeys(obj) {
  if (Array.isArray(obj)) return obj.map(convertKeys);
  if (obj === null || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (val.$oid) { result[key] = new ObjectId(val.$oid); continue; }
      if (val.$date) { result[key] = new Date(val.$date); continue; }
      if (val.$numberInt) { result[key] = parseInt(val.$numberInt, 10); continue; }
      if (val.$numberLong) { result[key] = parseInt(val.$numberLong, 10); continue; }
      if (val.$numberDouble) { result[key] = parseFloat(val.$numberDouble); continue; }
      if (val.$numberDecimal) { result[key] = parseFloat(val.$numberDecimal); continue; }
      if (val.$timestamp) { result[key] = new Date(val.$timestamp.t * 1000); continue; }
      if (val.$binary) { result[key] = Buffer.from(val.$binary.base64, 'base64'); continue; }
      if (val.$regularExpression) { result[key] = new RegExp(val.$regularExpression.pattern, val.$regularExpression.options || ''); continue; }
    }
    result[key] = convertKeys(val);
  }
  return result;
}

async function main() {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log('Conectado ao MongoDB');

    const files = fs.readdirSync(API_JSON_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const collectionName = file.replace('api.', '').replace('.json', '');
      const filePath = path.join(API_JSON_DIR, file);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        console.log(`  ${file}: erro ao parsear JSON - ${e.message}`);
        continue;
      }
      if (!Array.isArray(data)) data = [data];
      if (data.length === 0) { console.log(`  ${file}: vazio`); continue; }
      data = convertKeys(data);
      const col = db.collection(collectionName);
      await col.deleteMany({});
      try {
        await col.insertMany(data, { ordered: false });
        console.log(`  ${file} -> ${collectionName}: ${data.length} documentos`);
      } catch (e) {
        console.log(`  ${file} -> ${collectionName}: ${data.length} docs (${e.message.split('\n')[0]})`);
      }
    }
    console.log('Importação concluída!');
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.close();
  }
}

main();
