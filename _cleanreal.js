const { connectDB } = require('./dist/config/db');
async function main() {
  try {
    const conn = await connectDB();
    const db = conn.connection.db;

    // Delete ALL streamers (any fake ones created by app during session)
    const delStreamers = await db.collection('streamers').deleteMany({});
    console.log('Streamers deletados:', delStreamers.deletedCount);

    // Delete fake users (keep only adriano and Adri)
    const realIds = ["adriano", "Adri"];
    const fakeUsers = await db.collection('users').find({ id: { $nin: realIds } }).toArray();
    console.log('Usuários fake encontrados:', fakeUsers.length);
    for (const u of fakeUsers) {
      await db.collection('users').deleteOne({ id: u.id });
      console.log('  Deletado:', u.id, '-', u.name);
    }

    // Reset real users
    await db.collection('users').updateOne(
      { id: "adriano" },
      { $set: { isLive: false, isOnline: false, currentStreamId: null } }
    );
    await db.collection('users').updateOne(
      { id: "Adri" },
      { $set: { isLive: false, isOnline: false, currentStreamId: null, avatarUrl: "" } }
    );

    // Clean other collections that may have fake data
    await db.collection('followers').deleteMany({});  // will be recreated by app
    await db.collection('follows').deleteMany({});
    await db.collection('userstatuses').deleteMany({ userId: { $nin: realIds } });

    console.log('\n=== DADOS REAIS RESTANTES ===');
    const users = await db.collection('users').find().toArray();
    users.forEach(u => console.log('  User:', u.id, '| name:', u.name, '| avatarUrl:', u.avatarUrl ? 'sim' : 'vazio'));

    const streamers = await db.collection('streamers').countDocuments();
    console.log('Streamers:', streamers);

    await conn.connection.close();
    console.log('\nPronto! Só dados reais no banco.');
  } catch(e) { console.error('ERRO:', e.message); }
}
main();
