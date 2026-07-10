
import express from 'express';
import { User } from '../models';
import { getUserIdFromToken } from '../middleware/auth';
import { standardizeUserResponse } from '../utils/userResponse';
import { httpClient } from '../utils/httpClient';

const router = express.Router();

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'brasil': 'br', 'brazil': 'br',
  'portugal': 'pt',
  'argentina': 'ar',
  'méxico': 'mx', 'mexico': 'mx',
  'colômbia': 'co', 'colombia': 'co',
  'chile': 'cl',
  'peru': 'pe',
  'venezuela': 've',
  'espanha': 'es', 'spain': 'es',
  'itália': 'it', 'italy': 'it',
  'frança': 'fr', 'france': 'fr',
  'alemanha': 'de', 'germany': 'de',
  'reino unido': 'gb', 'united kingdom': 'gb',
  'canadá': 'ca', 'canada': 'ca',
  'japão': 'jp', 'japan': 'jp',
  'coreia do sul': 'kr', 'south korea': 'kr',
  'índia': 'in', 'india': 'in',
  'angola': 'ao',
  'moçambique': 'mz', 'mozambique': 'mz',
  'cabo verde': 'cv',
  'estados unidos': 'us', 'united states': 'us',
};

function normalizeCountryName(name: string): string {
  if (!name) return 'br';
  const trimmed = name.trim().toLowerCase();
  return COUNTRY_NAME_TO_CODE[trimmed] || trimmed;
}

interface NominatimResponse {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

interface IpApiResponse {
  status: string;
  lat: number;
  lon: number;
  city: string;
  regionName: string;
  country: string;
  query: string;
}

async function reverseGeocode(lat: number, lng: number): Promise<{ city: string; state: string; country: string; residence: string }> {
    try {
        const data = await httpClient.get<NominatimResponse>(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&lang=pt`,
            { headers: { 'User-Agent': 'LiveApp/1.0' } }
        );
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

        const { city, state, country: rawCountry, residence } = await reverseGeocode(latitude, longitude);
        const country = normalizeCountryName(rawCountry || req.body.country || '');

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
                $push: { recentActivities: { $each: [{
                        action: 'location_updated',
                        resource: 'location_service',
                        timestamp: new Date(),
                        endpoint: '/api/location/update'
                    }], $slice: -50 } }
            },
            { returnDocument: 'after' }
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
                    $push: { recentActivities: { $each: [{
                            action: 'nearby_users_searched',
                            resource: 'location_service',
                            timestamp: new Date(),
                            endpoint: '/api/location/nearby'
                        }], $slice: -50 } }
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
                $push: { recentActivities: { $each: [{
                        action: 'location_viewed',
                        resource: 'location_service',
                        timestamp: new Date(),
                        endpoint: '/api/location/user'
                    }], $slice: -50 } }
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

    const data = await httpClient.get<IpApiResponse>(`http://ip-api.com/json/${clientIp}?fields=status,lat,lon,city,regionName,country,query&lang=pt`);

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
