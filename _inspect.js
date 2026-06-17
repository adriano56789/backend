const { connectDB } = require('./dist/config/db');
async function main() {
  try {
    const conn = await connectDB();
    const db = conn.connection.db;

    // FULL document dump - Users
    const users = await db.collection('users').find().toArray();
    console.log('================== USERS (' + users.length + ') ==================');
    users.forEach((u, i) => {
      console.log('\n--- User ' + (i+1) + ' ---');
      console.log('  id:', u.id);
      console.log('  name:', u.name);
      console.log('  avatar:', u.avatar);
      console.log('  avatarUrl:', u.avatarUrl);
      console.log('  identification:', u.identification);
      console.log('  email:', u.email);
      console.log('  level:', u.level);
      console.log('  isLive:', u.isLive);
      console.log('  isOnline:', u.isOnline);
      console.log('  currentStreamId:', u.currentStreamId);
      console.log('  country:', u.country);
      console.log('  city:', u.city);
      console.log('  state:', u.state);
      console.log('  fans:', u.fans);
      console.log('  following:', u.following);
      console.log('  bio:', u.bio);
      console.log('  birthday:', u.birthday);
      console.log('  gender:', u.gender);
      console.log('  ALL FIELDS:', Object.keys(u).join(', '));
    });

    // FULL document dump - Streamers
    const streamers = await db.collection('streamers').find().toArray();
    console.log('\n================== STREAMERS (' + streamers.length + ') ==================');
    streamers.forEach((s, i) => {
      console.log('\n--- Streamer ' + (i+1) + ' ---');
      console.log('  id:', s.id);
      console.log('  hostId:', s.hostId);
      console.log('  name:', s.name);
      console.log('  avatar:', s.avatar);
      console.log('  isLive:', s.isLive);
      console.log('  streamStatus:', s.streamStatus);
      console.log('  title:', s.title);
      console.log('  category:', s.category);
      console.log('  country:', s.country);
      console.log('  viewers:', s.viewers);
      console.log('  streamKey:', s.streamKey);
      console.log('  ALL FIELDS:', Object.keys(s).join(', '));
    });

    // Check all other collections
    const allCollections = await db.listCollections().toArray();
    console.log('\n================== ALL COLLECTIONS ==================');
    for (const coll of allCollections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log('  ' + coll.name + ': ' + count + ' docs');
    }

    await conn.connection.close();
  } catch(e) { console.error('ERRO:', e.message); }
}
main();
