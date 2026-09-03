"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const sharp_1 = __importDefault(require("sharp"));
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/api';
const DB_NAME = process.env.DB_NAME || 'api';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'gifts';
const OUTPUT_DIR = path_1.default.resolve(__dirname, '../../src/assets/gifts');
function ensureOutputDir() {
    if (!fs_1.default.existsSync(OUTPUT_DIR)) {
        fs_1.default.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}
function buildPollinationsUrl(name, icon) {
    const encodedName = encodeURIComponent(name);
    const encodedIcon = encodeURIComponent(icon);
    const prompt = `${encodedName}%20${encodedIcon},%20live%20stream%20gift%20asset,%20glossy%20smooth%20material,%20high%20resolution,%20isolated%20on%20a%20chroma%20key%20green%20screen%20background`;
    return `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true`;
}
function fetchImageBuffer(url) {
    return new Promise((resolve, reject) => {
        const doRequest = (reqUrl) => {
            https_1.default.get(reqUrl, (response) => {
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
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
        };
        doRequest(url);
    });
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function main() {
    console.log(`Conectando a MongoDB: ${MONGO_URI}`);
    const client = new mongodb_1.MongoClient(MONGO_URI);
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
        const filepath = path_1.default.join(OUTPUT_DIR, filename);
        if (fs_1.default.existsSync(filepath)) {
            console.log(`Presente ${gift.name} já existe, ignorando.`);
            success++;
            continue;
        }
        const url = buildPollinationsUrl(gift.name || '', gift.icon || '');
        try {
            const buffer = await fetchImageBuffer(url);
            await (0, sharp_1.default)(buffer).webp({ quality: 85 }).toFile(filepath);
            console.log(`Presente ${gift.name} gerado com sucesso!`);
            success++;
        }
        catch (err) {
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
