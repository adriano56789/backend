import express from 'express';
import { User, Photo, Birthday, ProfilePhoto } from '../models';
import { standardizeUserResponse } from '../utils/userResponse';

const router = express.Router();

// Função auxiliar para calcular signo
const calculateZodiacSign = (birthDate: Date): string => {
    const month = birthDate.getMonth() + 1;
    const day = birthDate.getDate();
    
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Áries';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Touro';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gêmeos';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Câncer';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leão';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgem';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Escorpião';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagitário';
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricórnio';
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquário';
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Peixes';
    
    return 'Desconhecido';
};

// Middleware para extrair usuário do token JWT
const getCurrentUserId = (req: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        console.log('❌ Nenhum token fornecido');
        return null;
    }
    
    try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me_in_prod';
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('✅ Token decodificado - userId:', decoded.id);
        return decoded.id;
    } catch (error) {
        console.log('❌ Erro ao decodificar token:', error);
        return null;
    }
};

router.get('/imagens', async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const photos = await ProfilePhoto.find({ userId, isActive: true }).sort({ createdAt: -1 });
        
        // Converter ProfilePhoto[] para Obra[] (formato que frontend espera)
        const obras = photos.map(photo => ({
            id: photo.obraId,
            url: photo.photoUrl
        }));
        
        res.json(obras);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/imagens/:id', async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        console.log(`🗑️ Tentando deletar foto ${req.params.id} do usuário ${userId}`);
        
        // Usar 'obraId' para compatibilidade com frontend
        const photo = await ProfilePhoto.findOneAndUpdate(
            { obraId: req.params.id, userId },
            { $set: { isActive: false } },
            { returnDocument: 'after' }
        );
        if (!photo) {
            console.log(`❌ Foto não encontrada: ${req.params.id}`);
            return res.status(404).json({ error: 'Photo not found' });
        }
        
        console.log(`✅ Foto deletada: ${photo.obraId}`);
        res.json({ success: true });
    } catch (error: any) {
        console.error('❌ Erro ao deletar foto:', error);
        res.status(500).json({ error: error.message });
    }
});

router.put('/imagens/ordenar', async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { orderedIds } = req.body;
        
        console.log(`🔄 Ordenando fotos: ${orderedIds.join(', ')}`);
        
        // Update order of photos - usar 'id' em vez de '_id'
        const updatePromises = orderedIds.map((photoId: string, index: number) => 
            Photo.findOneAndUpdate(
                { id: photoId, userId },
                { $set: { order: index } },
                { returnDocument: 'after' }
            )
        );
        
        const updatedPhotos = await Promise.all(updatePromises);
        console.log(`✅ ${updatedPhotos.length} fotos ordenadas`);
        res.json({ success: true, images: updatedPhotos });
    } catch (error: any) {
        console.error('❌ Erro ao ordenar fotos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rotas para cada campo individual do perfil
// Aceitam tanto autenticação via JWT quanto via query param userId para compatibilidade com frontend
const singleValueRoutes = [
    { route: 'apelido', field: 'name' },
    { route: 'genero', field: 'gender' },
    { route: 'aniversario', field: 'birthday' },
    { route: 'apresentacao', field: 'bio' },
    { route: 'residencia', field: 'residence' },
    { route: 'pais', field: 'country' },
    { route: 'estado-emocional', field: 'emotional_status' },
    { route: 'tags', field: 'tags' },
    { route: 'profissao', field: 'profession' }
];

// Helper para obter userId: prioriza query param, depois JWT, depois body
function resolveUserId(req: any): string | null {
    // 1. Query param userId
    if (req.query.userId) return req.query.userId;
    // 2. Body userId
    if (req.body.userId) return req.body.userId;
    // 3. JWT token
    return getCurrentUserId(req);
}

singleValueRoutes.forEach(({ route, field }) => {
    router.get(`/${route}`, async (req, res) => {
        try {
            const userId = resolveUserId(req);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized - forneça userId via query, body ou token' });
            }
            
            const user = await User.findOne({ id: userId }).lean();
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.json({ 
                userId: user.id,
                value: (user as any)[field] || '' 
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put(`/${route}`, async (req, res) => {
        try {
            const userId = resolveUserId(req);
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized - forneça userId via query, body ou token' });
            }
            
            const { value } = req.body;
            
            if (value === undefined || value === null) {
                return res.status(400).json({ error: 'value é obrigatório' });
            }
            
            // Atualizar o campo específico no User
            const updateData: any = {};
            updateData[field] = value;
            
            const user = await User.findOneAndUpdate(
                { id: userId }, 
                { 
                    $set: {
                        ...updateData,
                        updatedAt: new Date()
                    },
                    $push: { 
                        recentActivities: {
                            action: 'profile_update',
                            resource: 'user_profile',
                            timestamp: new Date(),
                            endpoint: `/api/perfil/${route}` 
                        }
                    }
                }, 
                { returnDocument: 'after' }
            );
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const io = (req as any).app.get('io');

            // Se for aniversário, salvar também no modelo Birthday
            if (field === 'birthday' && value) {
                const parts = value.split('/');
                if (parts.length === 3) {
                    const [day, month, year] = parts.map(Number);
                    const birthDate = new Date(year, month - 1, day);
                    const age = new Date().getFullYear() - birthDate.getFullYear();
                    const zodiacSign = calculateZodiacSign(birthDate);
                    
                    await Birthday.findOneAndUpdate(
                        { userId },
                        { $set: {
                            userId,
                            birthDate,
                            age,
                            zodiacSign,
                            isActive: true,
                            updatedAt: new Date()
                        }},
                        { upsert: true, returnDocument: 'after' }
                    );
                    
                    await User.findOneAndUpdate(
                        { id: userId },
                        { $set: { age, zodiacSign, birthDate } }
                    );
                    
                    if (io) {
                        io.emit('user_profile_updated', {
                            userId,
                            profile: { age, birthDate, zodiacSign, birthday: value },
                            timestamp: new Date()
                        });
                    }
                }
            }

            // Se for país, notificar em tempo real
            if (field === 'country' && value && io) {
                io.emit('user_country_updated', {
                    userId,
                    country: value,
                    timestamp: new Date().toISOString()
                });
                console.log(`[PROFILE] País atualizado para usuário ${userId}: ${value}`);
            }

            // Se for residência, notificar em tempo real
            if (field === 'residence' && value && io) {
                io.emit('user_residence_updated', {
                    userId,
                    residence: value,
                    timestamp: new Date().toISOString()
                });
                console.log(`[PROFILE] Residência atualizada para usuário ${userId}: ${value}`);
            }
            
            res.json({ success: true, user: standardizeUserResponse(user), field, value: (user as any)[field] });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });
});

// ====== ENDPOINTS DEDICADOS COM userId NA URL ======
// GET /api/perfil/pais/:userId - Buscar país de um usuário específico
router.get('/pais/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findOne({ id: userId }).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ userId: user.id, country: user.country || 'br', flagUrl: `https://flagcdn.com/w40/${(user.country || 'br').toLowerCase()}.png` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/perfil/pais/:userId - Atualizar país de um usuário específico
router.put('/pais/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { value, country } = req.body;
        const countryValue = value || country;
        
        if (!countryValue) {
            return res.status(400).json({ error: 'value ou country é obrigatório' });
        }

        const user = await User.findOneAndUpdate(
            { id: userId },
            { 
                $set: { 
                    country: countryValue.toLowerCase(),
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const io = (req as any).app.get('io');
        if (io) {
            io.emit('user_country_updated', {
                userId,
                country: countryValue.toLowerCase(),
                timestamp: new Date().toISOString()
            });
        }

        console.log(`[PROFILE] País atualizado via endpoint dedicado: ${userId} -> ${countryValue}`);

        res.json({ 
            success: true, 
            userId: user.id, 
            country: user.country,
            flagUrl: `https://flagcdn.com/w40/${(user.country || 'br').toLowerCase()}.png`
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/perfil/residencia/:userId - Buscar residência de um usuário específico
router.get('/residencia/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findOne({ id: userId }).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ userId: user.id, residence: user.residence || '', city: user.city || '', state: user.state || '' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/perfil/residencia/:userId - Atualizar residência de um usuário específico
router.put('/residencia/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { value, residence, city, state } = req.body;
        const residenceValue = value || residence;

        const updateFields: any = { updatedAt: new Date() };
        if (residenceValue !== undefined) updateFields.residence = residenceValue;
        if (city !== undefined) updateFields.city = city;
        if (state !== undefined) updateFields.state = state;

        const user = await User.findOneAndUpdate(
            { id: userId },
            { $set: updateFields },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const io = (req as any).app.get('io');
        if (io) {
            io.emit('user_residence_updated', {
                userId,
                residence: residenceValue,
                city,
                state,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`[PROFILE] Residência atualizada via endpoint dedicado: ${userId}`);

        res.json({ success: true, userId: user.id, residence: user.residence, city: user.city, state: user.state });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
