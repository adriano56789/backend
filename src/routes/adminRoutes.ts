// @ts-nocheck
import express from 'express';
import { PurchaseRecord, User } from '../models';

const router = express.Router();

router.post('/withdrawal-method', async (req, res) => {
    try {
        const { userId } = req.body;
        
        // Persistir atividade administrativa se userId fornecido
        if (userId) {
            await pushRecentActivity(userId, {
                action: 'admin_withdrawal_method',
                resource: 'administrative_action',
                endpoint: '/api/admin/withdrawal-method'
            });
        }
        
        res.json({ success: true, user: {} as any });
    } catch (error) {
        console.error('Error in withdrawal-method:', error);
        res.json({ success: true, user: {} as any });
    }
});
router.post('/withdraw', async (req, res) => {
    try {
        const { userId } = req.body;
        
        // Persistir atividade administrativa se userId fornecido
        if (userId) {
            await pushRecentActivity(userId, {
                action: 'admin_withdraw_request',
                resource: 'administrative_action',
                endpoint: '/api/admin/withdraw'
            });
        }
        
        res.json({ success: true, message: 'Requested' });
    } catch (error) {
        console.error('Error in withdraw:', error);
        res.json({ success: true, message: 'Requested' });
    }
});
router.get('/history', async (req, res) => {
    try {
        // Extrair userId do token JWT
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId: string | null = null;
        
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
                const decoded = jwt.verify(token, JWT_SECRET);
                userId = decoded.id;
            } catch {
                return res.status(401).json({ error: 'Unauthorized' });
            }
        }
        
        if (!userId) {
            return res.status(401).json({ error: 'User ID required' });
        }
        
        // Buscar histórico apenas do usuário específico
        const history = await PurchaseRecord.find({ 
            userId: userId,
            status: req.query.status as string 
        }).sort({ createdAt: -1 });

        // Persistir atividade de consulta de histórico
        await pushRecentActivity(userId, {
            action: 'admin_history_check',
            resource: 'administrative_action',
            endpoint: '/api/admin/history'
        });
        
        res.json(history);
    } catch (error: any) {
        console.error('Error fetching purchase history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

