import mongoose from 'mongoose';
import { ENV } from './env';

export const connectDB = async (): Promise<typeof mongoose> => {
  const uri = ENV.MONGODB_URI || process.env.MONGODB_URI;
  const dbName = ENV.MONGODB_NAME || process.env.MONGODB_NAME || 'api';

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  console.log(`🗄️ [DB] Tentando conectar ao MongoDB via Mongoose...`);

  try {
    const conn = await mongoose.connect(uri, {
      dbName: dbName,
      serverSelectionTimeoutMS: 5000,
    });

    const sanitizedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`✅ [DB] Mongoose Conectado: ${sanitizedUri} (Banco: ${dbName})`);

    return conn;
  } catch (error: any) {
    console.error(`❌ [DB] Falha na conexão com Mongoose: ${error.message}`);
    throw error;
  }
};

export const getDb = () => {
  if (!mongoose.connection.db) {
    throw new Error('🗄️ [DB] Tentativa de acessar banco antes da conexão ser estabelecida');
  }
  return mongoose.connection.db;
};

export const getCollection = (name: string) => {
  return getDb().collection(name);
};
