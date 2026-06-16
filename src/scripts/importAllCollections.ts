import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import * as models from '../models';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://admin:adriano123@127.0.0.1:27017/api?authSource=admin';

const API_JSON_DIR = path.resolve(__dirname, '../../../front-end/api.json');

interface FileMapping {
  filename: string;
  modelName: keyof typeof models;
}

const FILE_MAPPINGS: FileMapping[] = [
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
  { filename: 'api.streamkeys.json', modelName: 'StreamKey' },
  { filename: 'api.userlevels.json', modelName: 'UserLevel' },
  { filename: 'api.users.json', modelName: 'User' },
  { filename: 'api.userstatuses.json', modelName: 'UserStatus' },
  { filename: 'api.visitors.json', modelName: 'Visitor' },
  { filename: 'api.zoomsettings.json', modelName: 'ZoomSettings' },
];

async function importAll() {
  console.log('Conectando ao MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Conectado!\n');

  for (const mapping of FILE_MAPPINGS) {
    const filePath = path.join(API_JSON_DIR, mapping.filename);
    if (!fs.existsSync(filePath)) {
      console.log(`[SKIP] ${mapping.filename} — arquivo não encontrado`);
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw || raw === '[]' || raw === '{}') {
      console.log(`[SKIP] ${mapping.filename} — vazio`);
      continue;
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      console.log(`[SKIP] ${mapping.filename} — JSON inválido`);
      continue;
    }

    const model = (models as any)[mapping.modelName];
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
      const filter: Record<string, any> = {};
      if (doc._id) filter._id = doc._id;
      else if (doc.id) filter.id = doc.id;

      try {
        if (Object.keys(filter).length > 0) {
          const exists = await model.findOne(filter);
          if (exists) continue;
        }
        await model.create(doc);
        imported++;
      } catch (err: any) {
        if (err.code === 11000) continue;
        console.log(`  [WARN] ${mapping.filename}: ${err.message}`);
      }
    }

    console.log(`[OK] ${mapping.filename} → ${mapping.modelName}: ${imported} importados (${docs.length - imported} já existiam)`);
  }

  await mongoose.disconnect();
  console.log('\nImportação finalizada!');
}

importAll().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
