import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.get('/definition', async (req, res) => {
  try {
    // Tentar múltiplos caminhos para o arquivo .proto
    const possiblePaths = [
      path.join(__dirname, '../../protobuf/livego.proto'),
      path.join(process.cwd(), 'protobuf/livego.proto'),
      path.join(process.cwd(), 'backend/protobuf/livego.proto'),
      '/app/protobuf/livego.proto',
      '/app/backend/protobuf/livego.proto',
    ];

    let content: string | null = null;
    let usedPath = '';

    for (const p of possiblePaths) {
      try {
        content = fs.readFileSync(p, 'utf-8');
        usedPath = p;
        break;
      } catch {
        continue;
      }
    }

    if (!content) {
      console.error('[Protobuf] Arquivo livego.proto nao encontrado nos caminhos:', possiblePaths);
      return res.status(404).json({ success: false, error: 'Protobuf definition not found' });
    }

    console.log(`[Protobuf] Definicao carregada de: ${usedPath}`);
    res.type('text/plain').send(content);
  } catch (error) {
    console.error('[Protobuf] Erro ao carregar definicao:', error);
    res.status(404).json({ success: false, error: 'Protobuf definition not found' });
  }
});

export default router;
