import express from 'express';
import { User, Streamer } from '../models';
import { getUserIdFromToken } from '../middleware/auth';
import { getIO } from '../socket';
import { findActiveByOwner, findItemById, createRouletteItem, updateRouletteItem, hardDeleteRouletteItem } from '../models/RouletteItem';
import { recordSpin, findSpinsByUser, findSpinsByStream } from '../models/RouletteSpin';
import { getDb } from '../config/db';

const router = express.Router();

console.log('[ROULETTE-ROUTES] Carregando rotas da roleta...');

// 🔒 Apenas o HOST (dono, identificado pelo JWT) pode cadastrar/alterar. O
// espectador NUNCA cadastra nem altera nada — só vê e gira.
function isHostOwner(req: any, ownerId: string): boolean {
    const tokenUserId = getUserIdFromToken(req);
    return !!tokenUserId && String(tokenUserId) === String(ownerId);
}

// 📡 Emite o estado atual da roleta para TODOS os espectadores da sala
// (io.to(ownerId) == sala da live), para que o que o host definir apareça
// imediatamente para todo mundo. Também emite para a sala pessoal do host
// (user_{ownerId}) como fallback de garantia.
async function broadcastRouletteUpdate(ownerId: string) {
    try {
        const items = await findActiveByOwner(ownerId);
        const userDoc = await User.findOne({ id: ownerId }).exec();
        const spinCost = userDoc && Number(userDoc.rouletteSpinCost) > 0 ? Number(userDoc.rouletteSpinCost) : 0;
        const payload = {
            ownerId,
            items: items.map((it: any) => JSON.parse(JSON.stringify(it && it.toObject ? it.toObject() : it))),
            spinCost,
            timestamp: new Date().toISOString(),
        };
        const io = getIO();
        // Envia para a sala da live (espectadores + host)
        io.to(ownerId).emit('roulette_updated', payload);
        // Fallback: também envia para a sala pessoal do host (user_{ownerId})
        io.to(`user_${ownerId}`).emit('roulette_updated', payload);
        console.log(`[ROULETTE-ROUTES] 📡 Broadcast roulette_updated para sala "${ownerId}" + user_${ownerId}: ${items.length} itens, ${spinCost}💎`);
    } catch (error: any) {
        console.error('[ROULETTE-ROUTES] Erro ao broadcast roulette_updated:', error?.message || error);
    }
}

// 📡 Envia o estado atual da roleta para um CLIENTE ESPECÍFICO (via socket).
// Usado quando um espectador abre a roleta ou reconecta — garante que ele
// recebe o estado EXATO que o host definiu, sem depender de timing de sala.
export async function sendRouletteStateToClient(socket: any, ownerId: string) {
    try {
        const items = await findActiveByOwner(ownerId);
        const userDoc = await User.findOne({ id: ownerId }).exec();
        const spinCost = userDoc && Number(userDoc.rouletteSpinCost) > 0 ? Number(userDoc.rouletteSpinCost) : 0;
        socket.emit('roulette_updated', {
            ownerId,
            items: items.map((it: any) => JSON.parse(JSON.stringify(it && it.toObject ? it.toObject() : it))),
            spinCost,
            timestamp: new Date().toISOString(),
        });
        console.log(`[ROULETTE-ROUTES] 📡 Estado da roleta enviado para socket ${socket.id} (ownerId=${ownerId}): ${items.length} itens, ${spinCost}💎`);
    } catch (error: any) {
        console.error('[ROULETTE-ROUTES] Erro ao enviar estado para socket:', error?.message || error);
    }
}

// ═══════════════════════════════════════════════════════════════════
// ROLETA EDITÁVEL — CRUD completo de itens cadastrados pela pessoa
// (dança, música, qualquer ação). Tudo persistido no banco.
// ═══════════════════════════════════════════════════════════════════

// Listar itens da roleta de um dono (streamer)
router.get('/roulette/items', async (req, res) => {
    try {
        const ownerId = (req.query.ownerId as string) || '';
        if (!ownerId) {
            return res.status(400).json({ error: 'ownerId é obrigatório' });
        }
        const items = await findActiveByOwner(ownerId);
        const list = items.map((it: any) => JSON.parse(JSON.stringify(it && it.toObject ? it.toObject() : it)));
        res.json(list);
    } catch (error: any) {
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
        // 🔒 Só o HOST (dono da roleta) cadastra itens — espectador NUNCA.
        if (!isHostOwner(req, ownerId)) {
            return res.status(403).json({ error: 'Só o host pode cadastrar itens na roleta.' });
        }
        const labelStr = String(label).trim();
        if (labelStr.length > 60) {
            return res.status(400).json({ error: 'O label deve ter no máximo 60 caracteres' });
        }
        const item = await createRouletteItem({
            ownerId,
            label: labelStr,
            icon: icon || '🎁',
            color: color || '#8b5cf6',
            textColor: textColor || '#ffffff',
            type: type || 'action',
            amount: Number(amount) || 0,
        });
        // 📡 Aparece LOGO para todos os espectadores na sala
        await broadcastRouletteUpdate(ownerId);
        res.status(201).json(JSON.parse(JSON.stringify(item)));
    } catch (error: any) {
        console.error('[ROULETTE-ROUTES] Erro ao criar item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Atualizar um item (editar label, ícone, cor etc.)
router.put('/roulette/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { label, icon, color, textColor, type, amount, isActive } = req.body || {};

        // 🔒 Só o HOST (dono do item) altera — o token precisa bater com o ownerId do item.
        const existing = await findItemById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }
        const itemOwner = String((existing as any).ownerId || '');
        const tokenUserId = getUserIdFromToken(req);
        if (!tokenUserId || String(tokenUserId) !== itemOwner) {
            return res.status(403).json({ error: 'Só o host pode alterar os itens da roleta.' });
        }

        const update: any = {};
        if (label !== undefined) update.label = String(label).trim();
        if (icon !== undefined) update.icon = icon;
        if (color !== undefined) update.color = color;
        if (textColor !== undefined) update.textColor = textColor;
        if (type !== undefined) update.type = type;
        if (amount !== undefined) update.amount = Number(amount) || 0;
        if (isActive !== undefined) update.isActive = !!isActive;

        const result = await updateRouletteItem(id, update);
        if (!result) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }
        // 📡 Aparece LOGO para todos os espectadores na sala
        await broadcastRouletteUpdate(itemOwner);
        res.json(JSON.parse(JSON.stringify(result)));
    } catch (error: any) {
        console.error('[ROULETTE-ROUTES] Erro ao atualizar item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remover um item (hard delete)
router.delete('/roulette/items/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 🔒 Só o HOST (dono do item) remove — o token precisa bater com o ownerId do item.
        const existing = await findItemById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }
        const itemOwner = String((existing as any).ownerId || '');
        const tokenUserId = getUserIdFromToken(req);
        if (!tokenUserId || String(tokenUserId) !== itemOwner) {
            return res.status(403).json({ error: 'Só o host pode remover itens da roleta.' });
        }

        const result = await hardDeleteRouletteItem(id);
        if (!result || !result.deletedCount) {
            return res.status(404).json({ error: 'Item não encontrado' });
        }
        // 📡 Aparece LOGO para todos os espectadores na sala
        await broadcastRouletteUpdate(itemOwner);
        res.json({ success: true, message: 'Item removido' });
    } catch (error: any) {
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
        const userDoc = await User.findOne({ id: ownerId }).exec();
        const spinCost = userDoc && Number(userDoc.rouletteSpinCost) > 0 ? Number(userDoc.rouletteSpinCost) : 0;
        res.json({ ownerId, spinCost });
    } catch (error: any) {
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
        // 🔒 Só o HOST define o custo — espectador NUNCA.
        if (!isHostOwner(req, ownerId)) {
            return res.status(403).json({ error: 'Só o host pode definir o custo da roleta.' });
        }
        const spinCost = Math.max(0, Math.floor(Number(cost) || 0));
        const result = await User.findOneAndUpdate(
            { id: ownerId },
            { $set: { rouletteSpinCost: spinCost } },
            { new: true, upsert: false }
        ).exec();
        if (!result) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        // 📡 Aparece LOGO para todos os espectadores na sala
        await broadcastRouletteUpdate(ownerId);
        res.json({ ownerId, spinCost });
    } catch (error: any) {
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
        if (!ownerId) {
            return res.status(400).json({ error: 'userId e ownerId são obrigatórios' });
        }
        // 🔒 O giro é feito SEMPRE pelo usuário autenticado (token) — nunca
        // confia no userId do body (evita girar/debitar na conta de terceiros).
        const tokenUserId = getUserIdFromToken(req);
        const spinningUserId = tokenUserId || (userId ? String(userId) : '');
        if (!spinningUserId) {
            return res.status(401).json({ error: 'Não autorizado. Faça login para girar a roleta.' });
        }

        // Buscar itens cadastrados do dono
        const items = await findActiveByOwner(ownerId);
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'A roleta ainda não tem itens cadastrados. Cadastre antes de girar.' });
        }

        // Sortear um item entre os CADASTRADOS (uniforme)
        const randomIndex = Math.floor(Math.random() * items.length);
        const rawItem: any = items[randomIndex];
        const item = rawItem && rawItem.toObject ? rawItem.toObject() : rawItem;

        // 💎 CUSTO FIXO DO GIRO = valor que a HOST definiu ("X DIAMANTES PRA RODAR"),
        // armazenado no perfil do dono (User.rouletteSpinCost). Cada giro custa esse
        // valor e os diamantes vão DIRETO para a host.
        const ownerDoc = await User.findOne({ id: ownerId }).exec();
        const cost = ownerDoc && Number(ownerDoc.rouletteSpinCost) > 0 ? Math.floor(Number(ownerDoc.rouletteSpinCost)) : 0;

        // 💎 DÉBITO ATÔMICO + BLOQUEIO POR SALDO NA MESMA OPERAÇÃO: o filtro
        // diamonds >= cost garante que o $inc só roda se o saldo cobrir o custo
        // NAQUELE instante. Se não cobrir, findOneAndUpdate retorna null →
        // giro BLOQUEADO com 400 e NADA é debitado. Resultado garantido:
        //  • só gira quem tem saldo suficiente;
        //  • o valor descontado é EXATAMENTE o custo fixo definido pela host;
        //  • o débito é imediato e nunca gera saldo negativo (sem clamp depois).
        let diamondsAfter: number | null = null;
        if (cost > 0 && spinningUserId) {
            const activity = {
                action: 'roulette_spin',
                resource: 'roulette',
                timestamp: new Date(),
                endpoint: '/api/roulette/spin'
            };
            const updated = await User.findOneAndUpdate(
                { id: spinningUserId, diamonds: { $gte: cost } },
                {
                    $inc: { diamonds: -cost },
                    $push: { recentActivities: { $each: [activity], $slice: -50 } },
                },
                { new: true }
            ).exec();
            if (!updated) {
                return res.status(400).json({ error: 'Diamantes insuficientes para girar esta roleta.' });
            }
            const after = Number(updated.diamonds);
            diamondsAfter = Number.isFinite(after) ? Math.max(0, after) : 0;
        }

        // 💎 OS DIAMANTES DO GIRO VÃO DIRETO PARA A HOST — FLUXO IDÊNTICO AO ENVIO
        // DE PRESENTES (giftRoutes): live + widget + stream session + earnings/receptores.
        if (cost > 0 && ownerId) {
            try {
                // Acumula na LIVE (doc da stream pelo streamId) — igual [LIVE GIFT]
                if (streamId && streamId !== 'unknown') {
                    await Streamer.findOneAndUpdate(
                        { id: streamId },
                        { $inc: { diamonds: cost } },
                        { upsert: true }
                    ).exec();

                    // 💾 STREAM SESSION: acumula moedas para o resumo da live (igual presentes)
                    try {
                        const { incrementCoins } = await import('../models/StreamSession');
                        const db = getDb();
                        await incrementCoins(db.collection('streamsessions') as any, streamId, cost);
                    } catch (sessionErr: any) {
                        console.warn(`⚠️ [ROULETTE] Erro ao salvar moedas no StreamSession: ${sessionErr?.message || sessionErr}`);
                    }
                }

                // Widget da host — igual gifts ([toUserId] == ownerId aqui)
                await Streamer.findOneAndUpdate(
                    { id: ownerId },
                    { $inc: { diamonds: cost } },
                    { upsert: true }
                ).exec();

                // 💎 Saldo REAL da host: earnings/receptores — MESMOS CAMPOS dos presentes
                await User.findOneAndUpdate(
                    { id: ownerId },
                    {
                        $inc: { earnings: cost, receptores: cost },
                        $set: { lastSeen: new Date().toISOString() }
                    },
                    { upsert: true }
                ).exec();
                console.log(`[ROULETTE-ROUTES] 💎 ${cost} diamantes do giro creditados na host ${ownerId} (fluxo de presentes).`);
            } catch (hostErr: any) {
                console.warn('[ROULETTE-ROUTES] Erro ao creditar diamantes na host (continuando):', hostErr.message);
            }
        }

        // 📡 EVENTOS EM TEMPO REAL — MESMOS DOS PRESENTES:
        //  • diamonds_updated → espectador vê o débito na hora
        //  • earnings_updated (GLOBAL) → carteira/saldo da host atualiza na hora
        //  • live_coins_updated (GLOBAL) → contador da live sobe na hora
        if (cost > 0) {
            try {
                const io = getIO();
                // 1) Espectador: novo saldo
                const spinnerDoc = await User.findOne({ id: spinningUserId }).select('diamonds enviados').lean();
                if (spinnerDoc) {
                    io.to(`user_${spinningUserId}`).emit('diamonds_updated', {
                        userId: spinningUserId,
                        diamonds: (spinnerDoc as any).diamonds,
                        enviados: (spinnerDoc as any).enviados,
                        change: -cost,
                        timestamp: new Date().toISOString(),
                        source: 'roulette_spin'
                    });
                }
                // 2) Host: eventos idênticos aos presentes
                const hostDoc = await User.findOne({ id: ownerId }).select('earnings receptores').lean();
                io.emit('earnings_updated', {
                    userId: ownerId,
                    diamonds: cost,
                    totalEarnings: Number((hostDoc as any)?.earnings ?? 0),
                    receptores: Number((hostDoc as any)?.receptores ?? 0),
                    timestamp: new Date().toISOString(),
                    source: 'roulette_spin',
                    fromUser: spinningUserId,
                    giftName: 'Roleta',
                    streamId: streamId || ''
                });
                if (streamId && streamId !== 'unknown') {
                    const updatedStream = await Streamer.findOne({ id: streamId }).select('diamonds').lean();
                    io.emit('live_coins_updated', {
                        streamId,
                        coins: cost,
                        totalCoins: (updatedStream as any)?.diamonds || 0,
                        timestamp: new Date().toISOString(),
                        fromUser: spinningUserId,
                        giftName: 'Roleta'
                    });
                }
                console.log(`[ROULETTE-ROUTES] 📡 Eventos emitidos (diamonds_updated/earnings_updated/live_coins_updated).`);
            } catch (emitErr: any) {
                console.warn('[ROULETTE-ROUTES] Erro ao emitir eventos:', emitErr.message);
            }
        }

        // Registrar o giro no histórico (cópia do item sorteado)
        await recordSpin({
            userId: spinningUserId,
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
            cost,
        });
    } catch (error: any) {
        console.error('[ROULETTE-ROUTES] Erro ao girar:', error);
        res.status(500).json({ error: error.message });
    }
});

// Histórico de giros de um usuário
router.get('/roulette/spins/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const spins = await findSpinsByUser(userId, limit);
        const list = spins.map((s: any) => JSON.parse(JSON.stringify(s && s.toObject ? s.toObject() : s)));
        res.json(list);
    } catch (error: any) {
        console.error('[ROULETTE-ROUTES] Erro ao listar giros do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// Histórico de giros de uma stream
router.get('/roulette/spins/stream/:streamId', async (req, res) => {
    try {
        const { streamId } = req.params;
        const limit = parseInt(req.query.limit as string) || 100;
        const spins = await findSpinsByStream(streamId, limit);
        const list = spins.map((s: any) => JSON.parse(JSON.stringify(s && s.toObject ? s.toObject() : s)));
        res.json(list);
    } catch (error: any) {
        console.error('[ROULETTE-ROUTES] Erro ao listar giros da stream:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
