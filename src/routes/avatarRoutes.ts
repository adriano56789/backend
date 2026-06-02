import express from 'express';
import { User, PurchaseRecord } from '../models';
import { getAvatarUrl } from '../config/urls';

const router = express.Router();

// GET /users/:id/frames - Retorna os frames do usuário
router.get('/users/:id/frames', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ id });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Filtrar frames que não expiraram
    const now = new Date();
    const activeFrames = (user.ownedFrames || []).filter((frame: any) => {
      const expirationDate = new Date(frame.expirationDate);
      return expirationDate > now;
    });

    res.json({
      ownedFrames: activeFrames,
      activeFrameId: user.activeFrameId,
      diamonds: user.diamonds
    });
  } catch (error: any) {
    console.error('Erro ao buscar frames do usuário:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /users/:id/frames/buy - Compra um frame
router.post('/users/:id/frames/buy', async (req, res) => {
  try {
    const { id } = req.params;
    const { frameId, price, duration } = req.body;

    if (!frameId || !price || !duration) {
      return res.status(400).json({ error: 'frameId, price e duration são obrigatórios' });
    }

    const user = await User.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se usuário tem diamonds suficientes
    if (user.diamonds < price) {
      return res.status(400).json({ error: 'Diamonds insuficientes' });
    }

    // Verificar se já possui este frame
    const existingFrame = (user.ownedFrames || []).find((f: any) => f.frameId === frameId);
    if (existingFrame) {
      return res.status(400).json({ error: 'Você já possui este frame' });
    }

    // Adicionar frame ao usuário
    const expirationDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    
    if (!user.ownedFrames) {
      user.ownedFrames = [];
    }
    
    user.ownedFrames.push({
      frameId,
      expirationDate: expirationDate.toISOString()
    });

    // Deduzir diamonds do comprador + persistir atividade
    user.diamonds -= price;
    user.recentActivities = user.recentActivities || [];
    user.recentActivities.push({
        action: 'purchase',
        resource: 'avatar_frame',
        timestamp: new Date(),
        endpoint: '/api/avatar/users/:id/frames/buy'
    });
    // Manter apenas as últimas 50 atividades
    if (user.recentActivities.length > 50) {
        user.recentActivities = user.recentActivities.slice(-50);
    }

    // Adicionar diamonds à carteira ADM (avatar é meu produto)
    const ADM_EMAIL = process.env.ADM_EMAIL || 'adrianomdk5@gmail.com';
    const admUser = await User.findOneAndUpdate(
      { email: ADM_EMAIL },
      { $inc: { earnings: price } },
      { new: true }
    );

    await user.save();

    // Registrar compra de avatar no histórico
    await PurchaseRecord.create({
      id: `avatar_${frameId}_${user.id}_${Date.now()}`,
      userId: user.id,
      type: 'avatar_purchase',
      description: `Compra de avatar/frame ${frameId} - ${price} diamantes`,
      amountBRL: 0, // Compra interna, não envolve dinheiro real
      amountCoins: price,
      status: 'Concluído',
      timestamp: new Date()
    });

    // Registrar receita para ADM
    if (admUser) {
      await PurchaseRecord.create({
        id: `avatar_fee_${frameId}_${user.id}_${Date.now()}`,
        userId: admUser.id,
        type: 'avatar_sale_income',
        description: `Venda de avatar ${frameId} para ${user.name}: ${price} diamantes`,
        amountBRL: 0,
        amountCoins: price,
        status: 'Concluído',
        timestamp: new Date()
      });
    }

    // Emitir WebSocket para atualização em tempo real
    const io = req.app.get('io');
    if (io) {
      io.to(user.id).emit('avatar_purchased', {
        userId: user.id,
        frameId,
        price,
        newDiamonds: user.diamonds
      });

      // Notificar ADM sobre nova receita
      if (admUser) {
        io.to(admUser.id).emit('earnings_updated', {
          userId: admUser.id,
          earnings: admUser.earnings,
          change: price,
          source: 'avatar_sale',
          fromUser: user.name
        });
      }
    }

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        diamonds: user.diamonds,
        ownedFrames: user.ownedFrames,
        activeFrameId: user.activeFrameId
      }
    });
  } catch (error: any) {
    console.error('Erro ao comprar frame:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /users/:id/frames/equip - Equipa um frame
router.post('/users/:id/frames/equip', async (req, res) => {
  try {
    const { id } = req.params;
    const { frameId } = req.body;

    const user = await User.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se o usuário possui este frame
    const ownedFrame = (user.ownedFrames || []).find((f: any) => f.frameId === frameId);
    if (!ownedFrame) {
      return res.status(400).json({ error: 'Você não possui este frame' });
    }

    // Verificar se o frame não expirou
    const expirationDate = new Date(ownedFrame.expirationDate);
    if (expirationDate <= new Date()) {
      return res.status(400).json({ error: 'Este frame expirou' });
    }

    // Equipar o frame
    user.activeFrameId = frameId;
    await user.save();

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        activeFrameId: user.activeFrameId,
        ownedFrames: user.ownedFrames
      }
    });
  } catch (error: any) {
    console.error('Erro ao equipar frame:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /users/:id/frames/unequip - Desequipa um frame
router.post('/users/:id/frames/unequip', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Desequipar o frame
    user.activeFrameId = null;
    await user.save();

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        activeFrameId: user.activeFrameId,
        ownedFrames: user.ownedFrames
      }
    });
  } catch (error: any) {
    console.error('Erro ao desequipar frame:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /users/:id/avatar-upload - Upload de avatar
router.post('/users/:id/avatar-upload', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    }
    
    const user = await User.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Gerar URL da imagem (usar configuração dinâmica)
    const avatarUrl = getAvatarUrl(req.file.filename);
    
    // Adicionar ao array de avatarImages
    if (!user.avatarImages) {
      user.avatarImages = [];
    }
    user.avatarImages.push(avatarUrl);
    
    // Adicionar também ao array de fotos do perfil
    if (!user.photos) {
      user.photos = [];
    }
    user.photos.push(avatarUrl);
    
    // Atualizar avatarUrl (campo usado pelo feed /video e outras telas)
    user.avatarUrl = avatarUrl;
    
    // Definir como avatar principal se for o primeiro
    if (!user.avatar || user.avatar.trim() === '') {
      user.avatar = avatarUrl;
    }
    
    await user.save();
    
    // Emitir evento WebSocket para atualização em tempo real do avatar
    try {
      const { default: socketInit } = await import('./socket');
      const io = socketInit.getIO();
      if (io) {
        io.to(`user_${id}`).emit('user_avatar_updated', {
          userId: id,
          avatarUrl
        });
      }
    } catch (err) {
      console.error('Erro ao emitir evento de avatar:', err);
    }
    
    res.json({ 
      success: true, 
      avatarUrl,
      avatarImages: user.avatarImages,
      photos: user.photos
    });
  } catch (error: any) {
    console.error('Erro ao fazer upload de avatar:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /users/:id/avatars - Listar avatares do usuário
router.get('/users/:id/avatars', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ id }).select('avatar avatarImages');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json({ 
      avatar: user.avatar,
      avatarImages: user.avatarImages || []
    });
  } catch (error: any) {
    console.error('Erro ao buscar avatares:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /users/:id/avatar-main - Definir avatar principal
router.put('/users/:id/avatar-main', async (req, res) => {
  try {
    const { id } = req.params;
    const { avatarUrl } = req.body;
    
    if (!avatarUrl) {
      return res.status(400).json({ error: 'avatarUrl é obrigatório' });
    }
    
    const user = await User.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar se a imagem existe no array de avatares
    const hasAvatar = (user.avatarImages || []).includes(avatarUrl);
    if (!hasAvatar) {
      return res.status(400).json({ error: 'Avatar não encontrado na lista de avatares' });
    }
    
    user.avatar = avatarUrl;
    await user.save();
    
    res.json({ 
      success: true, 
      avatar: user.avatar
    });
  } catch (error: any) {
    console.error('Erro ao definir avatar principal:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /users/:id/avatars/:index - Remover avatar
router.delete('/users/:id/avatars/:index', async (req, res) => {
  try {
    const { id, index } = req.params;
    const user = await User.findOne({ id });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const avatarIndex = parseInt(index);
    if (isNaN(avatarIndex) || avatarIndex < 0 || !user.avatarImages || avatarIndex >= user.avatarImages.length) {
      return res.status(400).json({ error: 'Índice de avatar inválido' });
    }
    
    // Remover avatar do array
    user.avatarImages.splice(avatarIndex, 1);
    
    // Se o avatar removido era o principal, definir o próximo como principal
    if (user.avatar === user.avatarImages[avatarIndex]) {
      user.avatar = user.avatarImages.length > 0 ? user.avatarImages[0] : '';
    }
    
    await user.save();
    
    res.json({ 
      success: true, 
      avatarImages: user.avatarImages,
      avatar: user.avatar
    });
  } catch (error: any) {
    console.error('Erro ao remover avatar:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
