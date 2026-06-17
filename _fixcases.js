const { connectDB } = require('./dist/config/db');
async function main() {
  try {
    const conn = await connectDB();
    const db = conn.connection.db;

    const users = await db.collection('users').find().toArray();
    console.log('Verificando users...');
    for (const u of users) {
      if (u.id !== u.name) {
        console.log(`MISMATCH: id="${u.id}" name="${u.name}"`);
      } else {
        console.log(`OK: id="${u.id}" name="${u.name}"`);
      }
    }

    // Fix: set id = name where they differ
    for (const u of users) {
      if (u.id !== u.name && u.name) {
        const oldId = u.id;
        const newId = u.name;
        console.log(`Corrigindo: id "${oldId}" -> "${newId}"`);
        await db.collection('users').updateOne(
          { id: oldId },
          { $set: { id: newId } }
        );
      }
    }

    // Also update streamers that reference the old id
    const streamers = await db.collection('streamers').find().toArray();
    for (const s of streamers) {
      if (s.hostId !== s.name && s.name) {
        console.log(`Streamer: hostId "${s.hostId}" name "${s.name}"`);
      }
    }

    console.log('\nVerificação final:');
    const usersAfter = await db.collection('users').find().toArray();
    for (const u of usersAfter) {
      console.log(`  ${u.id} | name: ${u.name}`);
    }

    await conn.connection.close();
  } catch(e) { console.error('ERRO:', e.message); }
}
main();
