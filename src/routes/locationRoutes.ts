
import express from 'express';
import { User } from '../models';
import { getUserIdFromToken } from '../middleware/auth';
import { standardizeUserResponse } from '../utils/userResponse';

const router = express.Router();

async function reverseGeocode(lat: number, lng: number): Promise<{ city: string; state: string; country: string; residence: string }> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&lang=pt`,
            { headers: { 'User-Agent': 'LiveApp/1.0' } }
        );
        if (!res.ok) return { city: '', state: '', country: '', residence: '' };
        const data = await res.json();
        const addr = data?.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        const state = addr.state || '';
        const country = addr.country || '';
        const residence = city && state ? `${city}, ${state}` : city || state || '';
        return { city, state, country, residence };
    } catch {
        return { city: '', state: '', country: '', residence: '' };
    }
}

// Atualizar localização do usuário
router.post('/update', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        const { city, state, country, residence } = await reverseGeocode(latitude, longitude);

        const user = await User.findOneAndUpdate(
            { id: userId },
            {
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
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, user: standardizeUserResponse(user) });
    } catch (error: any) {
        console.error('Error updating location:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Buscar usuários próximos
router.get('/nearby', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        const { latitude, longitude, maxDistance = 50000, limit = 20 } = req.query; // maxDistance em metros (padrão 50km)

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        const lat = parseFloat(latitude as string);
        const lng = parseFloat(longitude as string);
        const maxDist = parseInt(maxDistance as string);
        const limitUsers = parseInt(limit as string);

        // Persistir atividade de busca de usuários próximos
        if (userId) {
            await User.findOneAndUpdate(
                { id: userId },
                { 
                    $push: { 
                        recentActivities: {
                            action: 'nearby_users_searched',
                            resource: 'location_service',
                            timestamp: new Date(),
                            endpoint: '/api/location/nearby'
                        }
                    }
                }
            ).catch(console.error);
        }

        // Busca geoespacial
        const users = await User.find({
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
    } catch (error: any) {
        console.error('Error fetching nearby users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /location/user - Buscar localização do usuário atual
router.get('/user', async (req, res) => {
    try {
        const userId = getUserIdFromToken(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Persistir atividade de consulta de localização
        await User.findOneAndUpdate(
            { id: userId },
            { 
                $push: { 
                    recentActivities: {
                        action: 'location_viewed',
                        resource: 'location_service',
                        timestamp: new Date(),
                        endpoint: '/api/location/user'
                    }
                }
            }
        ).catch(console.error);

        const user = await User.findOne({ id: userId }).select('location locationPermission showLocation');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ 
            success: true,
            location: user.location,
            permission: user.locationPermission,
            showLocation: user.showLocation
        });
    } catch (error: any) {
        console.error('Error fetching user location:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /location/ip — geolocalização por IP
router.get('/ip', async (req, res) => {
  try {
    const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '127.0.0.1';

    // Usar ip-api.com (gratuito, sem chave, 45 req/min)
    const response = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,lat,lon,city,regionName,country,query&lang=pt`);
    const data = await response.json();

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
  } catch (error) {
    console.error('[Location/IP] Erro:', error);
    res.json({ success: false, data: null });
  }
});

export default router;
