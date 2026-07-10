import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';

export interface AuthRequest extends Request {
    user?: { id: string, _id: string }; // Custom property to hold user info
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
    let token;

    // 🔍 LOG: verificar headers recebidos para debug do 401
    const authHeader = req.headers.authorization || '';
    const contentType = req.headers['content-type'] || '';
    console.log(`[AUTH] protect middleware: ${req.method} ${req.url}`);
    console.log(`[AUTH]   Content-Type: ${contentType}`);
    console.log(`[AUTH]   Authorization presente: ${authHeader ? 'SIM (length=' + authHeader.length + ')' : 'NÃO'}`);
    if (authHeader) {
        console.log(`[AUTH]   Authorization prefix: "${authHeader.substring(0, 20)}..."`);
    }

    if (authHeader && authHeader.toLowerCase().startsWith('bearer')) {
        try {
            token = authHeader.split(' ')[1];
            const decoded: any = jwt.verify(token, JWT_SECRET);
            req.user = { id: decoded.id, _id: decoded._id };
            console.log(`[AUTH] ✅ Token válido para usuário ${decoded.id}`);
            return next();
        } catch (error) {
            console.log(`[AUTH] ❌ Token inválido: ${error instanceof Error ? error.message : 'unknown error'}`);
            return res.status(401).json({ error: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        console.log(`[AUTH] ❌ Nenhum token encontrado no header Authorization`);
        return res.status(401).json({ error: 'Not authorized, no token' });
    }
};

export const getUserIdFromToken = (req: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        return decoded.id;
    } catch {
        return null;
    }
};

export const generateJWT = (userId: string, streamId?: string, streamKey?: string) => {
    return jwt.sign(
        { 
            id: userId, 
            streamId, 
            streamKey 
        }, 
        JWT_SECRET, 
        { expiresIn: '1h' }
    );
};
