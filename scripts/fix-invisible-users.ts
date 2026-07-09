import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { LiveMessage } from '../src/models/LiveMessage';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/api';

async function fixInvisibleUsers() {
  await mongoose.connect(MONGO_URI);
  console.log('[FIX] Conectado ao MongoDB');

  // Buscar usuários que estão com isNewUser = true mas nunca foram notificados
  const invisibleUsers = await User.find({
    isNewUser: true,
    newUserNotified: { $ne: true }
  }).select('id name createdAt').sort({ createdAt: -1 }).lean();

  console.log(`[FIX] Encontrados ${invisibleUsers.length} usuários invisíveis`);

  const GLOBAL_STREAM_ID = '__global__';
  const now = new Date();

  for (const user of invisibleUsers as any[]) {
    const welcomeText = `🎉 ${user.name || user.id} acabou de entrar no LiveGo. Dê as boas-vindas!`;

    // Inserir mensagem no feed global
    await LiveMessage.create({
      streamId: GLOBAL_STREAM_ID,
      userId: 'system',
      userName: 'Sistema',
      avatarUrl: '',
      level: 0,
      text: welcomeText,
      type: 'system',
      timestamp: now
    }).catch(err => console.warn(`[FIX] Erro ao salvar mensagem para ${user.id}:`, err.message));

    // Marcar como notificado
    await User.findOneAndUpdate(
      { id: user.id },
      { $set: { isNewUser: false, newUserNotified: true } }
    );

    console.log(`[FIX] Usuário ${user.name || user.id} (${user.id}) agora está visível`);
  }

  // Verificar também usuários que estão isOnline = true mas com dados inconsistentes
  const onlineUsers = await User.find({
    isNewUser: { $ne: true },
    newUserNotified: { $ne: true }
  }).limit(50).lean();

  if (onlineUsers.length > 0) {
    console.log(`[FIX] Corrigindo ${onlineUsers.length} usuários com flag de notificação pendente`);
    await User.updateMany(
      { isNewUser: { $ne: true }, newUserNotified: { $ne: true } },
      { $set: { newUserNotified: true } }
    );
  }

  console.log('[FIX] Finalizado');
  await mongoose.disconnect();
}

fixInvisibleUsers().catch(console.error);