import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { DIAMOND_PACKAGES } from '../utils/diamondConversion';
import { Order } from '../models';

export function requirePaymentAuth(req: AuthRequest, res: Response, next: NextFunction) {
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

export function validatePackageAmounts(req: AuthRequest, res: Response, next: NextFunction) {
    const { packageId, amount, diamonds } = req.body;

    if (!packageId || amount === undefined || diamonds === undefined) {
        return res.status(400).json({ error: 'packageId, amount e diamonds são obrigatórios' });
    }

    const pkg = DIAMOND_PACKAGES.find(p => {
        const id = `pack${DIAMOND_PACKAGES.indexOf(p) + 1}`;
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

export async function preventOrderReuse(req: AuthRequest, res: Response, next: NextFunction) {
    const { orderId } = req.body;
    if (!orderId) return next();

    const order = await (Order as any).findOne?.({ id: orderId });

    if (!order) return next();

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
