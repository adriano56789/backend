"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
router.get('/definition', async (req, res) => {
    try {
        // Tentar múltiplos caminhos para o arquivo .proto
        const possiblePaths = [
            path_1.default.join(__dirname, '../../protobuf/livego.proto'),
            path_1.default.join(process.cwd(), 'protobuf/livego.proto'),
            path_1.default.join(process.cwd(), 'backend/protobuf/livego.proto'),
            '/app/protobuf/livego.proto',
            '/app/backend/protobuf/livego.proto',
        ];
        let content = null;
        let usedPath = '';
        for (const p of possiblePaths) {
            try {
                content = fs_1.default.readFileSync(p, 'utf-8');
                usedPath = p;
                break;
            }
            catch {
                continue;
            }
        }
        if (!content) {
            console.error('[Protobuf] Arquivo livego.proto nao encontrado nos caminhos:', possiblePaths);
            return res.status(404).json({ success: false, error: 'Protobuf definition not found' });
        }
        console.log(`[Protobuf] Definicao carregada de: ${usedPath}`);
        res.type('text/plain').send(content);
    }
    catch (error) {
        console.error('[Protobuf] Erro ao carregar definicao:', error);
        res.status(404).json({ success: false, error: 'Protobuf definition not found' });
    }
});
exports.default = router;
