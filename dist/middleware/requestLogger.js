"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
// Middleware para capturar requisições reais e enviar para o monitor
const requestLogger = (io) => (req, res, next) => {
    const startTime = Date.now();
    // Capturar o response original
    const originalSend = res.send;
    const originalJson = res.json;
    let responseData;
    let statusCode;
    // Interceptar res.json
    res.json = function (data) {
        responseData = data;
        statusCode = res.statusCode;
        return originalJson.call(this, data);
    };
    // Interceptar res.send
    res.send = function (data) {
        if (!responseData) {
            responseData = data;
            statusCode = res.statusCode;
        }
        return originalSend.call(this, data);
    };
    // Quando a resposta terminar, enviar para o monitor
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        // Apenas logar requisições de API (ignorar arquivos estáticos, health checks, etc.)
        if (req.path.startsWith('/api/') &&
            !req.path.includes('/monitor') &&
            req.method !== 'OPTIONS' &&
            !req.path.includes('/health')) {
            const requestData = {
                type: 'api_request',
                method: req.method,
                url: req.path,
                status: statusCode,
                responseTime: responseTime,
                payload: req.body,
                response: responseData,
                timestamp: new Date().toISOString(),
                userAgent: req.headers['user-agent'],
                ip: req.ip || req.socket.remoteAddress
            };
            // Enviar para todos os clientes conectados ao monitor
            io.emit('api_request', requestData);
            console.log(`📊 [API-LOGGER] ${req.method} ${req.path} - ${statusCode} (${responseTime}ms)`);
        }
    });
    next();
};
exports.requestLogger = requestLogger;
