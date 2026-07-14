"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateJWT = exports.getUserIdFromToken = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.user = { id: decoded.id, _id: decoded._id };
            return next();
        }
        catch (error) {
            return res.status(401).json({ error: 'Not authorized, token failed' });
        }
    }
    if (!token) {
        return res.status(401).json({ error: 'Not authorized, no token' });
    }
};
exports.protect = protect;
const getUserIdFromToken = (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token)
        return null;
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded.id;
    }
    catch {
        return null;
    }
};
exports.getUserIdFromToken = getUserIdFromToken;
const generateJWT = (userId, streamId, streamKey) => {
    return jsonwebtoken_1.default.sign({
        id: userId,
        streamId,
        streamKey
    }, JWT_SECRET, { expiresIn: '1h' });
};
exports.generateJWT = generateJWT;
