"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMonitorRequest = void 0;
// Middleware para lidar com requisições do monitor - SEM BYPASS
const handleMonitorRequest = (req, res, next) => {
    // Apenas log requisições do monitor para debug
    const userAgent = req.headers['user-agent'] || '';
    const isMonitor = userAgent.includes('Mozilla') || req.path.includes('/monitor') || req.headers.origin === 'null';
    if (isMonitor) {
        console.log(`[MONITOR] ${req.method} ${req.path} - User-Agent: ${userAgent}`);
    }
    next();
};
exports.handleMonitorRequest = handleMonitorRequest;
// Middleware removido - monitor deve usar autenticação real
// export const bypassAuthForMonitor = (req: Request, res: Response, next: NextFunction) => {
//     // REMOVIDO - Monitor deve autenticar com token real
// };
