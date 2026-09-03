"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const models = __importStar(require("../models"));
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://admin:adriano123@127.0.0.1:27017/api?authSource=admin';
const API_JSON_DIR = path_1.default.resolve(__dirname, '../../../front-end/api.json');
const FILE_MAPPINGS = [
    { filename: 'api.appversions.json', modelName: 'AppVersion' },
    { filename: 'api.beautyeffects.json', modelName: 'BeautyEffect' },
    { filename: 'api.beautysettings.json', modelName: 'BeautySettings' },
    { filename: 'api.birthdays.json', modelName: 'Birthday' },
    { filename: 'api.chatmessages.json', modelName: 'ChatMessage' },
    { filename: 'api.conversations.json', modelName: 'Conversation' },
    { filename: 'api.followers.json', modelName: 'Followers' },
    { filename: 'api.frames.json', modelName: 'Frame' },
    { filename: 'api.gifts.json', modelName: 'Gift' },
    { filename: 'api.gifttransactions.json', modelName: 'GiftTransaction' },
    { filename: 'api.livestreammanual.json', modelName: 'ManualTransmissao' },
    { filename: 'api.notificationsettings.json', modelName: 'GiftNotificationSettings' },
    { filename: 'api.orders.json', modelName: 'Order' },
    { filename: 'api.profilephotos.json', modelName: 'ProfilePhoto' },
    { filename: 'api.streamers.json', modelName: 'Streamer' },
    { filename: 'api.streamkeys.json', modelName: 'Streamer' },
    { filename: 'api.userlevels.json', modelName: 'UserLevel' },
    { filename: 'api.users.json', modelName: 'User' },
    { filename: 'api.userstatuses.json', modelName: 'UserStatus' },
    { filename: 'api.visitors.json', modelName: 'Visitor' },
    { filename: 'api.zoomsettings.json', modelName: 'ZoomSettings' },
];
async function importAll() {
    console.log('Conectando ao MongoDB...');
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Conectado!\n');
    for (const mapping of FILE_MAPPINGS) {
        const filePath = path_1.default.join(API_JSON_DIR, mapping.filename);
        if (!fs_1.default.existsSync(filePath)) {
            console.log(`[SKIP] ${mapping.filename} — arquivo não encontrado`);
            continue;
        }
        const raw = fs_1.default.readFileSync(filePath, 'utf8').trim();
        if (!raw || raw === '[]' || raw === '{}') {
            console.log(`[SKIP] ${mapping.filename} — vazio`);
            continue;
        }
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch {
            console.log(`[SKIP] ${mapping.filename} — JSON inválido`);
            continue;
        }
        const model = models[mapping.modelName];
        if (!model) {
            console.log(`[SKIP] ${mapping.filename} — model '${mapping.modelName}' não encontrado`);
            continue;
        }
        const docs = Array.isArray(data) ? data : [data];
        if (docs.length === 0) {
            console.log(`[SKIP] ${mapping.filename} — sem documentos`);
            continue;
        }
        let imported = 0;
        for (const doc of docs) {
            const filter = {};
            if (doc._id)
                filter._id = doc._id;
            else if (doc.id)
                filter.id = doc.id;
            try {
                if (Object.keys(filter).length > 0) {
                    const exists = await model.findOne(filter);
                    if (exists)
                        continue;
                }
                await model.create(doc);
                imported++;
            }
            catch (err) {
                if (err.code === 11000)
                    continue;
                console.log(`  [WARN] ${mapping.filename}: ${err.message}`);
            }
        }
        console.log(`[OK] ${mapping.filename} → ${mapping.modelName}: ${imported} importados (${docs.length - imported} já existiam)`);
    }
    await mongoose_1.default.disconnect();
    console.log('\nImportação finalizada!');
}
importAll().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
