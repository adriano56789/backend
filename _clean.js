const { connectDB } = require('./dist/config/db');
async function main() {
  try {
    const conn = await connectDB();
    const db = conn.connection.db;

    // Delete test streamers
    const delResult = await db.collection('streamers').deleteMany({});
    console.log('Streamers deletados:', delResult.deletedCount);

    // Reset users
    const updResult = await db.collection('users').updateMany(
      {},
      { $set: { isLive: false, currentStreamId: null, isOnline: false } }
    );
    console.log('Users resetados:', updResult.modifiedCount);

    // Verify
    const streamers = await db.collection('streamers').countDocuments();
    const users = await db.collection('users').find().toArray();
    console.log('Streamers no banco:', streamers);
    users.forEach(u => console.log('User:', u.id, '| isLive:', u.isLive, '| currentStreamId:', u.currentStreamId));

    await conn.connection.close();
    console.log('Banco limpo! Pronto pra testar.');
  } catch(e) {
    console.error('ERRO:', e.message);
  }
}
main();
