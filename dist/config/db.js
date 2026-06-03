"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollection = exports.getDb = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const connectDB = async () => {
    const uri = env_1.ENV.MONGODB_URI || process.env.MONGODB_URI;
    const dbName = env_1.ENV.MONGODB_NAME || process.env.MONGODB_NAME || 'api';
    if (!uri) {
        throw new Error('MONGODB_URI is not defined in environment variables');
    }
    console.log(`🗄️ [DB] Tentando conectar ao MongoDB via Mongoose...`);
    try {
        const conn = await mongoose_1.default.connect(uri, {
            dbName: dbName,
            serverSelectionTimeoutMS: 5000,
        });
        const sanitizedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
        console.log(`✅ [DB] Mongoose Conectado: ${sanitizedUri} (Banco: ${dbName})`);
        return conn;
    }
    catch (error) {
        console.error(`❌ [DB] Falha na conexão com Mongoose: ${error.message}`);
        throw error;
    }
};
exports.connectDB = connectDB;
const getDb = () => {
    if (!mongoose_1.default.connection.db) {
        throw new Error('🗄️ [DB] Tentativa de acessar banco antes da conexão ser estabelecida');
    }
    return mongoose_1.default.connection.db;
};
exports.getDb = getDb;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getCollection = (name) => {
    return (0, exports.getDb)().collection(name);
};
exports.getCollection = getCollection;
