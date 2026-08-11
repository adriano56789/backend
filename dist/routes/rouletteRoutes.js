"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const RouletteItem_1 = require("../models/RouletteItem");
const RouletteSpin_1 = require("../models/RouletteSpin");
const router = express_1.default.Router();
console.log('[ROULETTE-ROUTES] Carregando rotas da roleta...');
// ═══════════════════════════════════════════════════════════════════
// ROLETA EDITÁVEL — CRUD completo de itens cadastrados pela pessoa
// (dança, música, qualquer ação). Tudo persistido no banco.
// ═══════════════════════════════════════════════════════════════════
// Listar itens da roleta de um dono (streamer)
router.get('/roulette/items', async (req, res) => {
    try {
        const ownerId = req.query.ownerId || '';
        if (!ownerId) {
            return res.status(400).json({ error: 'ownerId é obrigatório' });
        }
        const items = await (0, RouletteItem_1.findActiveByOwner)(ownerId);
        const list = items.map((it) => JSON.parse(JSON.stringify(it && it.toObject ? it.toObject() : it)));
        res.json(list);
    }
    catch (error) {
        console.error('[ROULETTE-ROUTES] Erro ao listar itens:', error);
        res.status(500).json({ error: error.message });
    }
});
// Criar um item editável na roleta (label = dança, música, etc.)
router.post('/roulette/items', async (req, res) => {
    try {
        const { ownerId, label, icon, color, textColor, type, amount } = req.body || {};
        if (!ownerId || !label || !String(label).trim()) {
            return res.status(400).json({ error: 'ownerId e label são obrigatórios' });
        }
        const labelStr = String(label).trim();
        if (labelStr.length > 60) {
            return res.status(400).json({ error: 'O label deve ter no máximo 60 caracteres' });
        }
        const item = await (0, RouletteItem_1.createRouletteItem)({
            ownerId,
            label: labelStr,
            icon: icon || '🎁',
            color: color || '#8b5cf6',
            textColor: textColor || '#ffffff',
            type: type || 'action',
            amount: Number(amount) || 0,
        });
        res.status(201).json(JSON.parse(JSON.stringify(item)));
    }
    catch (error) {
        console.error('[ROULETTE-ROUTES] Erro ao criar item:', error);
        res.status(500).json({ error: error.message });
    }
});
// Atualizar um item (editar label, ícone, cor etc.)
router.put('/roulette/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { label, icon, color, textColor, type, amount, isActive } = req.body || {};
        const update = {};
        if (label !== undefined)
            update.label = String(label).trim();
        if (icon !== undefined)
            update.icon = icon;
        if (color !== undefined)
            update.color = color;
        if (textColor !== undefined)
            update.textColor = textColor;
        if (type !== undefined)
            update.type = type;
        if (amount !== undefined)
            update.amount = Number(amount) || 0;
        if (isActive !== undefined)
            update.isActive = !!isActive;
        const result = await (0, RouletteItem_1.updateRouletteItem)(id, update);
        if (!result) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }
        res.json(JSON.parse(JSON.stringify(result)));
    }
    catch (error) {
        console.error('[ROULETTE-ROUTES] Erro ao atualizar item:', error);
        res.status(500).json({ error: error.message });
    }
});
// Remover um item (hard delete)
router.delete('/roulette/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, RouletteItem_1.hardDeleteRouletteItem)(id);
        if (!result || !result.deletedCount) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }
        res.json({ success: true, message: 'Item removido' });
    }
    catch (error) {
        console.error('[ROULETTE-ROUTES] Erro ao remover item:', error);
        res.status(500).json({ error: error.message });
    }
});
// ═══════════════════════════════════════════════════════════════════
// CUSTO FIXO PARA GIRAR — a HOST define UM valor "X DIAMANTES PRA RODAR".
// Cada giro custa esse valor fixo (o setor sorteado é só o PRÊMIO).
// ═══════════════════════════════════════════════════════════════════
// Buscar o custo fixo do dono da roleta
router.get('/roulette/cost/:ownerId', async (req, res) => {
    try {
        const { ownerId } = req.params;
        const userDoc = await models_1.User.findOne({ id: ownerId }).exec();
        const spinCost = userDoc && Number(userDoc.rouletteSpinCost) > 0 ? Number(userDoc.rouletteSpinCost) : 0;
        res.json({ ownerId, spinCost });
    }
    catch (error) {
        console.error('[ROULETTE-ROUTES] Erro ao buscar custo:', error);
        res.status(500).json({ error: error.message });
    }
});
// Definir o custo fixo da roleta (só o dono/host)
router.put('/roulette/cost', async (req, res) => {
    try {
        const { ownerId, cost } = req.body || {};
        if (!ownerId) {
            return res.status(400).json({ error: 'ownerId é obrigatório' });
        }
        const spinCost = Math.max(0, Math.floor(Number(cost) || 0));
        const result = await models_1.User.findOneAndUpdate({ id: ownerId }, { $set: { rouletteSpinCost: spinCost } }, { new: true, upsert: false }).exec();
        if (!result) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json({ ownerId, spinCost });
    }
    catch (error) {
        console.error('[ROULETTE-ROUTES] Erro ao salvar custo:', error);
        res.status(500).json({ error: error.message });
    }
});
// ═══════════════════════════════════════════════════════════════════
// GIRO — registra o giro no banco e retorna o item sorteado
// O QUE APARECER NA ROLETA É EXATAMENTE O QUE A PESSOA CADASTROU.
// ═══════════════════════════════════════════════════════════════════
router.post('/roulette/spin', async (req, res) => {
    try {
        const { userId, streamId, ownerId } = req.body || {};
        if (!userId || !ownerId) {
            return res.status(400).json({ error: 'userId e ownerId são obrigatórios' });
        }
        // Buscar itens cadastrados do dono
        const items = await (0, RouletteItem_1.findActiveByOwner)(ownerId);
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'A roleta ainda não tem itens cadastrados. Cadastre antes de girar.' });
        }
        // Sortear um item entre os CADASTRADOS (uniforme)
        const randomIndex = Math.floor(Math.random() * items.length);
        const rawItem = items[randomIndex];
        const item = rawItem && rawItem.toObject ? rawItem.toObject() : rawItem;
        // 💎 CUSTO FIXO DO GIRO = valor que a HOST definiu ("X DIAMANTES PRA RODAR"),
        // armazenado no perfil do dono (User.rouletteSpinCost). Cada giro custa esse
        // valor e os diamantes vão DIRETO para a host.
        const ownerDoc = await models_1.User.findOne({ id: ownerId }).exec();
        const cost = ownerDoc && Number(ownerDoc.rouletteSpinCost) > 0 ? Math.floor(Number(ownerDoc.rouletteSpinCost)) : 0;
        // 💎 Bloqueia giro com saldo insuficiente ANTES de debitar (400 → o app
        // abre a mesma carteira de diamantes usada nos presentes)
        if (cost > 0) {
            const userDoc = await models_1.User.findOne({ id: userId }).exec();
            const balance = userDoc ? Number(userDoc.diamonds) || 0 : 0;
            if (balance < cost) {
                return res.status(400).json({ error: 'Diamantes insuficientes para girar esta roleta.' });
            }
        }
        // Débito dos diamantes do usuário — ATÔMICO ($inc) + clamp em 0
        let diamondsAfter = null;
        if (cost > 0 && userId) {
            try {
                const activity = {
                    action: 'roulette_spin',
                    resource: 'roulette',
                    timestamp: new Date(),
                    endpoint: '/api/roulette/spin'
                };
                const updated = await models_1.User.findOneAndUpdate({ id: userId }, {
                    $inc: { diamonds: -cost },
                    $push: { recentActivities: { $each: [activity], $slice: -50 } },
                }, { new: true }).exec();
                if (updated) {
                    let after = Number(updated.diamonds);
                    if (!Number.isFinite(after))
                        after = 0;
                    if (after < 0) {
                        // Nunca deixar saldo negativo
                        await models_1.User.updateOne({ id: userId }, { $set: { diamonds: 0 } }).exec();
                        after = 0;
                    }
                    diamondsAfter = after;
                }
            }
            catch (userErr) {
                console.warn('[ROULETTE-ROUTES] Erro ao debitar diamantes (continuando):', userErr.message);
            }
        }
        // 💎 OS DIAMANTES DO GIRO VÃO DIRETO PARA A HOST — o espectador paga e
        // quem criou a roleta (a host) recebe TUDO. Sem outra parada.
        if (cost > 0 && ownerId) {
            try {
                // Widget da host (mesmo padrão dos presentes recebidos)
                await models_1.Streamer.findOneAndUpdate({ id: ownerId }, { $inc: { diamonds: cost } }, { upsert: true }).exec();
                // Ganhos da host na carteira (mesmo padrão dos presentes recebidos)
                await models_1.User.findOneAndUpdate({ id: ownerId }, { $inc: { earnings: cost, receptores: cost } }, { upsert: false }).exec();
                console.log(`[ROULETTE-ROUTES] 💎 ${cost} diamantes do giro creditados direto para a host ${ownerId}.`);
            }
            catch (hostErr) {
                console.warn('[ROULETTE-ROUTES] Erro ao creditar diamantes na host (continuando):', hostErr.message);
            }
        }
        // Registrar o giro no histórico (cópia do item sorteado)
        await (0, RouletteSpin_1.recordSpin)({
            userId,
            streamId: streamId || '',
            itemLabel: item.label || 'Item',
            itemId: String(item._id || ''),
            itemType: item.type || 'action',
            itemAmount: item.amount || 0,
            cost,
            diamondsAfter,
        });
        res.json({
            success: true,
            item: JSON.parse(JSON.stringify(item)),
            diamondsAfter,
        });
    }
    catch (error) {
        console.error('[ROULETTE-ROUTES] Erro ao girar:', error);
        res.status(500).json({ error: error.message });
    }
});
// Histórico de giros de um usuário
router.get('/roulette/spins/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const spins = await (0, RouletteSpin_1.findSpinsByUser)(userId, limit);
        const list = spins.map((s) => JSON.parse(JSON.stringify(s && s.toObject ? s.toObject() : s)));
        res.json(list);
    }
    catch (error) {
        console.error('[ROULETTE-ROUTES] Erro ao listar giros do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});
// Histórico de giros de uma stream
router.get('/roulette/spins/stream/:streamId', async (req, res) => {
    try {
        const { streamId } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        const spins = await (0, RouletteSpin_1.findSpinsByStream)(streamId, limit);
        const list = spins.map((s) => JSON.parse(JSON.stringify(s && s.toObject ? s.toObject() : s)));
        res.json(list);
    }
    catch (error) {
        console.error('[ROULETTE-ROUTES] Erro ao listar giros da stream:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
