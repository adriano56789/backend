import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import https from 'https';
import sharp from 'sharp';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/api';
const DB_NAME = process.env.DB_NAME || 'api';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'gifts';
const OUTPUT_DIR = path.resolve(__dirname, '../../src/assets/gifts');

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function buildPollinationsUrl(name: string, icon: string): string {
  const encodedName = encodeURIComponent(name);
  const encodedIcon = encodeURIComponent(icon);
  const prompt = `${encodedName}%20${encodedIcon},%20live%20stream%20gift%20asset,%20glossy%20smooth%20material,%20high%20resolution,%20isolated%20on%20a%20chroma%20key%20green%20screen%20background`;
  return `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true`;
}

function fetchImageBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl: string): void => {
      https.get(reqUrl, (response) => {
        const sc = response.statusCode;
        if (sc && sc >= 300 && sc < 400 && response.headers.location) {
          const redirectUrl = new URL(response.headers.location, reqUrl).toString();
          console.log(`  -> Redirect para ${redirectUrl}`);
          doRequest(redirectUrl);
          return;
        }
        if (sc !== 200) {
          reject(new Error(`HTTP ${sc} for ${reqUrl}`));
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    };
    doRequest(url);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log(`Conectando a MongoDB: ${MONGO_URI}`);
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Conectado com sucesso!\n');

  ensureOutputDir();

  const collection = client.db(DB_NAME).collection(COLLECTION_NAME);
  const gifts = await collection.find({}).toArray();
  console.log(`Total de presentes encontrados: ${gifts.length}\n`);

  let success = 0;
  let errors = 0;

  for (const gift of gifts) {
    const giftId = gift._id.toString();
    const filename = `${giftId}.webp`;
    const filepath = path.join(OUTPUT_DIR, filename);

    if (fs.existsSync(filepath)) {
      console.log(`Presente ${gift.name} já existe, ignorando.`);
      success++;
      continue;
    }

    const url = buildPollinationsUrl(gift.name || '', gift.icon || '');

    try {
      const buffer = await fetchImageBuffer(url);
      await sharp(buffer).webp({ quality: 85 }).toFile(filepath);
      console.log(`Presente ${gift.name} gerado com sucesso!`);
      success++;
    } catch (err: any) {
      console.error(`Erro ao gerar presente ${gift.name}: ${err.message}`);
      errors++;
    }

    await delay(1500);
  }

  console.log(`\nConcluído! ${success} sucessos, ${errors} erros.`);

  await client.close();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
