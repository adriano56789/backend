const { connectDB } = require('./dist/config/db');

async function poll() {
  try {
    const conn = await connectDB();
    const db = conn.connection.db;

    const streamers = await db.collection('streamers').find().toArray();
    const users = await db.collection('users').find().toArray();

    console.log('--- ' + new Date().toISOString() + ' ---');
    console.log('STREAMERS:', streamers.length);
    streamers.forEach(s => {
      console.log('  ' + s.id + ' | hostId:' + s.hostId + ' | isLive:' + s.isLive + ' | status:' + s.streamStatus);
    });

    console.log('USERS:');
    users.forEach(u => {
      console.log('  ' + u.id + ' | isLive:' + u.isLive + ' | streamId:' + (u.currentStreamId || '-') + ' | online:' + u.isOnline);
    });

    await conn.connection.close();

    if (streamers.length > 0 || users.some(u => u.isLive)) {
      console.log('\n*** DOCUMENTOS CRIADOS! Live detectada! ***');
    }
  } catch(e) {
    console.error('ERRO:', e.message);
  }
}

console.log('Observando banco a cada 3 segundos... Pressione Ctrl+C para parar.');
poll();
setInterval(poll, 3000);
