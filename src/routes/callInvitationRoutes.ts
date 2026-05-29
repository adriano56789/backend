import express from 'express';
import { User, Streamer, CallInvitation } from '../models';
import { getUserIdFromToken } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const router = express.Router();

async function broadcastGuestList(roomId: string, io: any) {
  const activeGuests = await CallInvitation.find({ roomId, status: 'accepted' }).lean();
  io.to(roomId).emit('guest_list_update', {
    roomId,
    guests: activeGuests.map(g => ({
      id: g.guestId,
      name: g.guestName,
      hostId: g.hostId
    })),
    count: activeGuests.length
  });
}

// POST /api/call-invitation/invite
router.post('/invite', async (req, res) => {
  try {
    const hostId = getUserIdFromToken(req);
    if (!hostId) return res.status(401).json({ error: 'Unauthorized' });

    const { guestId, guestName, streamId } = req.body;
    if (!guestId || !streamId) {
      return res.status(400).json({ error: 'guestId e streamId são obrigatórios' });
    }

    const stream = await Streamer.findOne({ id: streamId, hostId, isLive: true, streamStatus: 'active' });
    if (!stream) {
      return res.status(404).json({ error: 'Stream não encontrada ou não está ativa' });
    }

    const guest = await User.findOne({ id: guestId });
    if (!guest) return res.status(404).json({ error: 'Usuário convidado não encontrado' });

    if (!/^[a-zA-Z0-9_]{4,30}$/.test(guestId)) {
      return res.status(400).json({ error: 'ID de usuário inválido' });
    }

    const existing = await CallInvitation.findOne({
      hostId, guestId, roomId: stream.roomId, status: 'pending'
    });
    if (existing) {
      return res.status(400).json({ error: 'Já existe um convite ativo para este usuário' });
    }

    const invitation = await CallInvitation.create({
      hostId,
      hostName: req.user?.name || 'Host',
      guestId,
      guestName: guestName || guest.name || 'Convidado',
      roomId: stream.roomId as string,
      streamId: stream.id as string,
      streamKey: stream.streamKey || '',
      status: 'pending'
    });

    await Promise.all([
      User.findOneAndUpdate({ id: hostId }, { $push: { recentActivities: { action: 'call_invite_sent', resource: 'video_call', timestamp: new Date(), endpoint: '/api/call-invitation/invite' } } }).catch(() => {}),
      User.findOneAndUpdate({ id: guestId }, { $push: { recentActivities: { action: 'call_invite_received', resource: 'video_call', timestamp: new Date(), endpoint: '/api/call-invitation/invite' } } }).catch(() => {})
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${guestId}`).emit('call_invitation', {
        type: 'invitation_received',
        invitation: {
          id: invitation._id.toString(),
          hostId: invitation.hostId,
          hostName: invitation.hostName,
          roomId: invitation.roomId,
          streamId: invitation.streamId,
          streamTitle: stream.name,
          guest: {
            id: guest.id, name: guest.name, avatarUrl: guest.avatarUrl || '',
            level: guest.level || 1, diamonds: guest.diamonds || 0,
            fans: guest.fans || 0, following: guest.following || 0,
            isVIP: guest.isVIP || false, isAvatarProtected: guest.isAvatarProtected || false
          }
        }
      });
      io.to(`user_${hostId}`).emit('call_invitation', {
        type: 'invitation_sent',
        invitation: { id: invitation._id.toString(), guestId, guestName: guestName || guest.name }
      });
      io.to(`user_${hostId}`).emit('guest_invitation_sent', {
        invitationId: invitation._id.toString(),
        guestId,
        guestName: guestName || guest.name,
        hostId,
        roomId: invitation.roomId,
        streamId: invitation.streamId
      });
    }

    console.log(`📞 [Call Invitation] Host ${hostId} convidou ${guestId} para a stream ${streamId}`);
    res.json({ success: true, invitationId: invitation._id.toString() });
  } catch (error: any) {
    console.error('❌ [Call Invitation] Erro ao enviar convite:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/call-invitation/respond
router.post('/respond', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { invitationId, response } = req.body;
    if (!invitationId || !response) {
      return res.status(400).json({ error: 'invitationId e response são obrigatórios' });
    }

    const invitation = await CallInvitation.findById(invitationId);
    if (!invitation) return res.status(404).json({ error: 'Convite não encontrado' });
    if (invitation.guestId !== userId) return res.status(403).json({ error: 'Você não pode responder a este convite' });
    if (invitation.status !== 'pending') return res.status(400).json({ error: 'Convite já foi respondido' });

    const newStatus = response === 'accept' ? 'accepted' : 'declined';
    invitation.status = newStatus as any;
    invitation.updatedAt = new Date();
    if (newStatus === 'accepted') {
      const webrtcUrl = `webrtc://livego.store/live/guest_${invitation.guestId}`;
      invitation.signalingUrl = webrtcUrl;
    }
    await invitation.save();

    await User.findOneAndUpdate({ id: userId }, { $push: { recentActivities: { action: response === 'accept' ? 'call_accepted' : 'call_declined', resource: 'video_call', timestamp: new Date(), endpoint: '/api/call-invitation/respond' } } }).catch(() => {});

    const io = req.app.get('io');

    if (response === 'accept' && io) {
      const guestUser = await User.findOne({ id: userId });
      const webrtcUrl = invitation.signalingUrl || `webrtc://livego.store/live/guest_${invitation.guestId}`;

      io.to(`user_${invitation.hostId}`).emit('call_invitation', {
        type: 'invitation_accepted',
        invitation: {
          id: invitation._id.toString(),
          guestId: invitation.guestId,
          guestName: invitation.guestName,
          guestAvatar: guestUser?.avatarUrl || '',
          roomId: invitation.roomId,
          webrtcUrl
        }
      });
      io.to(`user_${invitation.hostId}`).emit('guest_invitation_accepted', {
        invitationId: invitation._id.toString(),
        guestId: invitation.guestId,
        guestName: invitation.guestName,
        hostId: invitation.hostId,
        roomId: invitation.roomId,
        webrtcUrl
      });

      io.to(`user_${userId}`).emit('call_invitation', {
        type: 'call_joined',
        invitation: {
          id: invitation._id.toString(),
          roomId: invitation.roomId,
          streamId: invitation.streamId,
          webrtcUrl
        }
      });

      // Broadcast multi-guest
      await broadcastGuestList(invitation.roomId, io);
      io.to(`user_${invitation.hostId}`).emit('guest_joined', {
        guestId: invitation.guestId,
        guestName: invitation.guestName,
        hostId: invitation.hostId,
        roomId: invitation.roomId
      });
      io.to(`user_${userId}`).emit('guest_joined', {
        guestId: invitation.guestId,
        guestName: invitation.guestName,
        hostId: invitation.hostId,
        roomId: invitation.roomId
      });

      console.log(`✅ [Call Invitation] ${userId} aceitou o convite para a stream ${invitation.streamId}`);
    } else if (io) {
      io.to(`user_${invitation.hostId}`).emit('call_invitation', {
        type: 'invitation_declined',
        invitation: { id: invitation._id.toString(), guestId: invitation.guestId, guestName: invitation.guestName }
      });
      console.log(`❌ [Call Invitation] ${userId} recusou o convite para a stream ${invitation.streamId}`);
    }

    res.json({ success: true, status: invitation.status });
  } catch (error: any) {
    console.error('❌ [Call Invitation] Erro ao responder convite:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/call-invitation/end
router.post('/end', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { invitationId } = req.body;
    if (!invitationId) return res.status(400).json({ error: 'invitationId é obrigatório' });

    const invitation = await CallInvitation.findById(invitationId);
    if (!invitation) return res.status(404).json({ error: 'Convite não encontrado' });
    if (invitation.hostId !== userId && invitation.guestId !== userId) {
      return res.status(403).json({ error: 'Você não pode encerrar esta chamada' });
    }

    invitation.status = 'ended';
    invitation.updatedAt = new Date();
    await invitation.save();

    await Promise.all([
      User.findOneAndUpdate({ id: invitation.hostId }, { $push: { recentActivities: { action: 'call_ended', resource: 'video_call', timestamp: new Date(), endpoint: '/api/call-invitation/end' } } }).catch(() => {}),
      User.findOneAndUpdate({ id: invitation.guestId }, { $push: { recentActivities: { action: 'call_ended', resource: 'video_call', timestamp: new Date(), endpoint: '/api/call-invitation/end' } } }).catch(() => {})
    ]);

    const io = req.app.get('io');
    if (io) {
      [invitation.hostId, invitation.guestId].forEach(uid => {
        io.to(`user_${uid}`).emit('call_invitation', { type: 'call_ended', invitation: { id: invitation._id.toString(), endedBy: userId } });
      });

      // Remove from guest list and notify room
      io.to(invitation.roomId).emit('guest_left', {
        guestId: invitation.guestId,
        guestName: invitation.guestName,
        hostId: invitation.hostId,
        roomId: invitation.roomId
      });
      await broadcastGuestList(invitation.roomId, io);
    }

    console.log(`📞 [Call Invitation] Chamada ${invitationId} encerrada por ${userId}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [Call Invitation] Erro ao encerrar chamada:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/call-invitation/active/:userId
router.get('/active/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const invitations = await CallInvitation.find({
      $or: [{ hostId: userId }, { guestId: userId }],
      status: 'pending'
    }).sort({ createdAt: -1 }).lean();

    res.json({ success: true, invitations });
  } catch (error: any) {
    console.error('❌ [Call Invitation] Erro ao listar convites:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/call-invitation/guests/:roomId — listar guests ativos numa sala
router.get('/guests/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const guests = await CallInvitation.find({ roomId, status: 'accepted' })
      .select('guestId guestName hostId roomId createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, guests, count: guests.length });
  } catch (error: any) {
    console.error('❌ [Call Invitation] Erro ao listar guests:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
