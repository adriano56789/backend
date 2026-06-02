const { MongoClient, ObjectId } = require('mongodb');
async function main() {
  const uri = 'mongodb://admin:adriano123@72.60.249.175:27017/api?authSource=admin';
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db('api');
    
    console.log('=== VERIFICAÇÃO FINAL DO BANCO DE DADOS ===\n');
    
    const cols = await db.listCollections().toArray();
    for (const c of cols) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`  ${c.name}: ${count}`);
    }
    
    console.log('\n--- BATALHAS DO PK ---');
    const battles = await db.collection('battles').find({}).toArray();
    for (const b of battles) {
      console.log(`  ID: ${b._id}`);
      console.log(`  StreamerA: ${b.streamerA}`);
      console.log(`  StreamerB: ${b.streamerB}`);
      console.log(`  Score: ${b.scoreA} x ${b.scoreB}`);
      console.log(`  Status: ${b.status}`);
      console.log(`  Winner: ${b.winner || 'N/A'}`);
      console.log(`  Duracao: ${b.durationSeconds}s`);
      console.log(`  Hearts: ${b.heartsA} x ${b.heartsB}`);
      console.log(`  Room: ${b.roomId}`);
      console.log('---');
    }

    console.log('\n--- USUÁRIOS ---');
    const users = await db.collection('users').find({}).toArray();
    for (const u of users) {
      console.log(`  ID: ${u.id}`);
      console.log(`  Nome: ${u.name}`);
      console.log(`  Email: ${u.email}`);
      console.log(`  Diamantes: ${u.diamonds}`);
      console.log(`  Ganhos: ${u.earnings}`);
      console.log('---');
    }

    console.log('\n--- PROFILEPHOTOS (após limpeza) ---');
    const photos = await db.collection('profilephotos').find({}).toArray();
    console.log(`  Total: ${photos.length}`);
    for (const p of photos) {
      console.log(`  userId:${p.userId} type:${p.photoType} isMain:${p.isMain} url:${(p.photoUrl || '').substring(0, 60)}`);
    }

    console.log('\n--- PROFILEUPDATES (vazio após correção) ---');
    const puCount = await db.collection('profileupdates').countDocuments();
    console.log(`  Documentos: ${puCount} (deveria ser 0 - limpo)`);

  } catch(e) { console.error('ERROR:', e.message); }
  finally { await client.close(); }
}
main();
