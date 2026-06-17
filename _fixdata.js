const { connectDB } = require('./dist/config/db');
async function main() {
  try {
    const conn = await connectDB();
    const db = conn.connection.db;

    // 1. Create Streamer document for "adriano"
    const streamer = await db.collection('streamers').findOneAndUpdate(
      { id: "adriano" },
      {
        $set: {
          id: "adriano",
          hostId: "adriano",
          name: "adriano",
          avatar: "http://127.0.0.1:3000/uploads/avatars/avatar_adriano_1781593002789.jpg",
          location: "Brasil",
          time: "Ao Vivo",
          message: "Ao vivo!",
          tags: ["popular"],
          category: "popular",
          isLive: true,
          streamStatus: "active",
          startTime: new Date(),
          streamKey: "adriano",
          title: "Live do adriano",
          country: "Brasil",
          viewers: 0,
          city: "Juazeiro",
          state: "Bahia",
          latitude: -9.387466456721123,
          longitude: -40.42954790712112,
          language: "pt",
          chatEnabled: true,
          giftsEnabled: true,
          microphoneEnabled: true,
          soundEnabled: true,
          quality: "1080p",
          maxViewers: 1000
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('Streamer criado:', streamer?.id, '| isLive:', streamer?.isLive, '| status:', streamer?.streamStatus);

    // 2. Ensure User "adriano" has isLive:true and currentStreamId
    await db.collection('users').updateOne(
      { id: "adriano" },
      {
        $set: {
          isLive: true,
          isOnline: true,
          currentStreamId: "adriano"
        }
      }
    );
    console.log('User adriano atualizado: isLive=true, currentStreamId=adriano');

    // 3. Ensure User "adri" has avatarUrl set
    await db.collection('users').updateOne(
      { id: "adri" },
      {
        $set: {
          avatarUrl: "https://ui-avatars.com/api/?name=Adri&background=7C3AED&color=fff&size=200",
          isOnline: false
        }
      }
    );
    console.log('User adri atualizado com avatarUrl');

    // 4. Create a follow relationship: adri follows adriano
    await db.collection('followers').findOneAndUpdate(
      { followerId: "adri", followingId: "adriano" },
      { $set: { followerId: "adri", followingId: "adriano", isActive: true, createdAt: new Date() } },
      { upsert: true }
    );
    console.log('Follow criado: adri -> adriano');

    // 5. Verify
    const streamers = await db.collection('streamers').find().toArray();
    console.log('\n=== STREAMERS ===');
    streamers.forEach(s => console.log(' ', s.id, '| isLive:', s.isLive, '| status:', s.streamStatus));

    const users = await db.collection('users').find().toArray();
    console.log('\n=== USERS ===');
    users.forEach(u => console.log(' ', u.id, '| avatarUrl:', u.avatarUrl ? 'sim' : 'VAZIO', '| isLive:', u.isLive, '| online:', u.isOnline));

    await conn.connection.close();
    console.log('\n✅ Dados criados! Testa agora.');
  } catch(e) {
    console.error('ERRO:', e.message);
  }
}
main();
