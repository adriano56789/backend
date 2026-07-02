import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:adriano123@127.0.0.1:27017/api?authSource=admin';

  await mongoose.connect(mongoUri);
  console.log('Conectado ao MongoDB');

  const db = mongoose.connection.db!;
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
    sample.forEach((u: any) => {
      console.log(`  id: ${u.id}, name: ${u.name}, email: ${u.email}, identification: ${u.identification}`);
    });
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
