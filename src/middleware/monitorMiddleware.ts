import { Request, Response, NextFunction } from 'express';

// Middleware para lidar com requisições do monitor - SEM BYPASS
export const handleMonitorRequest = (req: Request, res: Response, next: NextFunction) => {
    // Apenas log requisições do monitor para debug
    const userAgent = req.headers['user-agent'] || '';
    const isMonitor = userAgent.includes('Mozilla') || req.path.includes('/monitor') || req.headers.origin === 'null';
    
    if (isMonitor) {
        console.log(`[MONITOR] ${req.method} ${req.path} - User-Agent: ${userAgent}`);
    }
    
    next();
};

// Middleware removido - monitor deve usar autenticação real
// export const bypassAuthForMonitor = (req: Request, res: Response, next: NextFunction) => {
//     // REMOVIDO - Monitor deve autenticar com token real
// };
