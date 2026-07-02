import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function cleanUsers() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/livego';

  try {
    await mongoose.connect(mongoUri);
    console.log('Conectado ao MongoDB:', mongoUri);

    const db = mongoose.connection.db!;

    // Deletar todos os documentos da coleção users
    const userResult = await db.collection('users').deleteMany({});
    console.log(`Usuários deletados: ${userResult.deletedCount}`);

    // Deletar todos os documentos da coleção counters (se existir)
    const collections = await db.listCollections().toArray();
    const colNames = collections.map(c => c.name);

    if (colNames.includes('counters')) {
      const counterResult = await db.collection('counters').deleteMany({});
      console.log(`Counters deletados: ${counterResult.deletedCount}`);
    }

    // Deletar todas as outras coleções relacionadas a usuários
    const relatedCollections = ['useractivities', 'streams', 'livesessions', 'messagens'];
    for (const col of relatedCollections) {
      if (colNames.includes(col)) {
        const result = await db.collection(col).deleteMany({});
        console.log(`${col} deletados: ${result.deletedCount}`);
      }
    }

    console.log('\nBanco de dados limpo com sucesso!');
  } catch (err) {
    console.error('Erro ao limpar banco de dados:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado do MongoDB');
  }
}

cleanUsers();
