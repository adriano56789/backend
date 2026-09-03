"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePaymentAuth = requirePaymentAuth;
exports.validatePackageAmounts = validatePackageAmounts;
exports.preventOrderReuse = preventOrderReuse;
const diamondConversion_1 = require("../utils/diamondConversion");
const models_1 = require("../models");
function requirePaymentAuth(req, res, next) {
    const tokenUserId = req.user?.id;
    const bodyUserId = req.body?.userId;
    if (!tokenUserId) {
        return res.status(401).json({ error: 'Autenticação necessária para operações de pagamento' });
    }
    if (bodyUserId && bodyUserId !== tokenUserId) {
        return res.status(403).json({ error: 'userId no body não corresponde ao token de autenticação' });
    }
    req.body.userId = tokenUserId;
    next();
}
function validatePackageAmounts(req, res, next) {
    const { packageId, amount, diamonds } = req.body;
    if (!packageId || amount === undefined || diamonds === undefined) {
        return res.status(400).json({ error: 'packageId, amount e diamonds são obrigatórios' });
    }
    const pkg = diamondConversion_1.DIAMOND_PACKAGES.find(p => {
        const id = `pack${diamondConversion_1.DIAMOND_PACKAGES.indexOf(p) + 1}`;
        return id === packageId;
    });
    if (!pkg) {
        return res.status(400).json({ error: 'Pacote inválido' });
    }
    if (Math.abs(pkg.diamonds - Number(diamonds)) > 0.01 || Math.abs(pkg.brl - Number(amount)) > 0.01) {
        console.error(`[FRAUD] Valores manipulados: userId=${req.user?.id}, packageId=${packageId}, ` +
            `esperado={diamonds:${pkg.diamonds}, brl:${pkg.brl}}, recebido={diamonds:${diamonds}, amount:${amount}}`);
        return res.status(400).json({ error: 'Valores do pacote não conferem com o servidor' });
    }
    next();
}
async function preventOrderReuse(req, res, next) {
    const { orderId } = req.body;
    if (!orderId)
        return next();
    const order = await models_1.Order.findOne?.({ id: orderId });
    if (!order)
        return next();
    if (order.status === 'paid') {
        return res.status(400).json({
            error: 'Order já processada',
            details: 'Esta compra já foi confirmada anteriormente'
        });
    }
    if (order.userId !== req.user?.id) {
        return res.status(403).json({
            error: 'Esta ordem não pertence ao usuário autenticado'
        });
    }
    next();
}
