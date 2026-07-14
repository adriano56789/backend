"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const userResponse_1 = require("../utils/userResponse");
const httpClient_1 = require("../utils/httpClient");
const router = express_1.default.Router();
async function reverseGeocode(lat, lng) {
    try {
        const data = await httpClient_1.httpClient.get(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&lang=pt`, { headers: { 'User-Agent': 'LiveApp/1.0' } });
        const addr = data?.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        const state = addr.state || '';
        const country = addr.country || '';
        const residence = city && state ? `${city}, ${state}` : city || state || '';
        return { city, state, country, residence };
    }
    catch {
        return { city: '', state: '', country: '', residence: '' };
    }
}
// Atualizar localização do usuário
router.post('/update', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { latitude, longitude } = req.body;
        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        const { city, state, country, residence } = await reverseGeocode(latitude, longitude);
        const user = await models_1.User.findOneAndUpdate({ id: userId }, {
            $set: {
                location: { type: 'Point', coordinates: [longitude, latitude] },
                latitude,
                longitude,
                city,
                state,
                country,
                residence,
                locationPermission: 'granted',
                showLocation: true
            },
            $push: {
                recentActivities: {
                    action: 'location_updated',
                    resource: 'location_service',
                    timestamp: new Date(),
                    endpoint: '/api/location/update'
                }
            }
        }, { returnDocument: 'after' });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, user: (0, userResponse_1.standardizeUserResponse)(user) });
    }
    catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Buscar usuários próximos
router.get('/nearby', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        const { latitude, longitude, maxDistance = 50000, limit = 20 } = req.query; // maxDistance em metros (padrão 50km)
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const maxDist = parseInt(maxDistance);
        const limitUsers = parseInt(limit);
        // Persistir atividade de busca de usuários próximos
        if (userId) {
            await models_1.User.findOneAndUpdate({ id: userId }, {
                $push: {
                    recentActivities: {
                        action: 'nearby_users_searched',
                        resource: 'location_service',
                        timestamp: new Date(),
                        endpoint: '/api/location/nearby'
                    }
                }
            }).catch(console.error);
        }
        // Busca geoespacial
        const users = await models_1.User.find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    $maxDistance: maxDist
                }
            },
            id: { $ne: userId }, // Excluir o próprio usuário se estiver logado
            isOnline: true // Opcional: mostrar apenas online? Por enquanto vou deixar comentado se quiser todos
        })
            .limit(limitUsers)
            .select('id name avatarUrl distance location isLive isOnline level'); // Selecionar campos relevantes
        // Calcular distância aproximada para exibição (opcional, o $near já ordena)
        const usersWithDistance = users.map(u => {
            // Aqui poderíamos adicionar um campo virtual de distância se necessário
            return u.toObject();
        });
        res.json(usersWithDistance);
    }
    catch (error) {
        console.error('Error fetching nearby users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /location/user - Buscar localização do usuário atual
router.get('/user', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromToken)(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Persistir atividade de consulta de localização
        await models_1.User.findOneAndUpdate({ id: userId }, {
            $push: {
                recentActivities: {
                    action: 'location_viewed',
                    resource: 'location_service',
                    timestamp: new Date(),
                    endpoint: '/api/location/user'
                }
            }
        }).catch(console.error);
        const user = await models_1.User.findOne({ id: userId }).select('location locationPermission showLocation');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            location: user.location,
            permission: user.locationPermission,
            showLocation: user.showLocation
        });
    }
    catch (error) {
        console.error('Error fetching user location:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /location/ip — geolocalização por IP
router.get('/ip', async (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '127.0.0.1';
        const data = await httpClient_1.httpClient.get(`http://ip-api.com/json/${clientIp}?fields=status,lat,lon,city,regionName,country,query&lang=pt`);
        if (data.status !== 'success') {
            return res.json({ success: false, data: null });
        }
        res.json({
            success: true,
            data: {
                lat: data.lat,
                lon: data.lon,
                city: data.city || 'São Paulo',
                region: data.regionName || 'SP',
                country: data.country || 'Brasil'
            }
        });
    }
    catch (error) {
        console.error('[Location/IP] Erro:', error);
        res.json({ success: false, data: null });
    }
});
exports.default = router;
