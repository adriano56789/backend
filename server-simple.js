"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const port = process.env.PORT || 3000;
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Servir arquivos estáticos
app.use(express_1.default.static('../dist'));
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});
// Fallback para API
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});
// Fallback para frontend
app.get('*', (req, res) => {
    res.sendFile('index.html', { root: '../dist' });
});
// WebSocket básico
io.on('connection', (socket) => {
    console.log(`🔌 New WebSocket connection: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`🔌 Socket ${socket.id} disconnected`);
    });
});
server.listen(port, () => {
    console.log(`🚀 API Server started on http://0.0.0.0:${port}`);
    console.log(`📱 Frontend acessível via celular: https://livego.store:3000`);
    console.log(`🔗 API endpoints: https://livego.store:${port}/api/*`);
    console.log(`🔌 WebSocket server rodando na mesma porta ${port}`);
});
const getIO = () => io;
exports.getIO = getIO;
