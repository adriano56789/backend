const { connectDB } = require('./dist/config/db');
async function main() {
  try {
    const conn = await connectDB();
    const db = conn.connection.db;

    const fixes = [
      { old: "adri", new: "Adri" },
      { old: "ana_silva", new: "Ana Silva" },
      { old: "carlos_oliveira", new: "Carlos Oliveira" },
      { old: "julia_mendes", new: "Julia Mendes" },
      { old: "lucas_santos", new: "Lucas Santos" },
      { old: "maria_eduarda", new: "Maria Eduarda" },
      { old: "pedro_alves", new: "Pedro Alves" },
      { old: "laura_lima", new: "Laura Lima" },
      { old: "gabriel_rocha", new: "Gabriel Rocha" },
      { old: "isabela_costa", new: "Isabela Costa" },
      { old: "rafael_martins", new: "Rafael Martins" },
    ];

    for (const f of fixes) {
      // Streamers
      const sr = await db.collection('streamers').updateMany(
        { hostId: f.old },
        { $set: { hostId: f.new, id: f.new } }
      );
      if (sr.modifiedCount > 0) console.log(`Streamers ${f.old} -> ${f.new}: ${sr.modifiedCount}`);

      // Followers
      const fl = await db.collection('followers').updateMany(
        { followerId: f.old },
        { $set: { followerId: f.new } }
      );
      if (fl.modifiedCount > 0) console.log(`Followers (followerId) ${f.old} -> ${f.new}: ${fl.modifiedCount}`);

      const fl2 = await db.collection('followers').updateMany(
        { followingId: f.old },
        { $set: { followingId: f.new } }
      );
      if (fl2.modifiedCount > 0) console.log(`Followers (followingId) ${f.old} -> ${f.new}: ${fl2.modifiedCount}`);

      // UserStatuses
      const us = await db.collection('userstatuses').updateMany(
        { userId: f.old },
        { $set: { userId: f.new } }
      );
      if (us.modifiedCount > 0) console.log(`UserStatuses ${f.old} -> ${f.new}: ${us.modifiedCount}`);
    }

    // Also fix followers for users whose id changed
    // "adri" -> "Adri" in user, check followers
    const followers = await db.collection('followers').find().toArray();
    console.log('\n=== FOLLOWERS ===');
    followers.forEach(f => console.log(`  ${f.followerId} -> ${f.followingId}`));

    // Clean up extra adri streamers (keep only the main one)
    const adriStreamers = await db.collection('streamers').find({ hostId: "adri" }).toArray();
    if (adriStreamers.length > 0) {
      console.log(`\nAinda existem ${adriStreamers.length} streamers com hostId=adri (minúsculo)`);
    }

    // Show final streamers
    const streamers = await db.collection('streamers').find().toArray();
    console.log('\n=== STREAMERS FINAL ===');
    streamers.forEach(s => console.log(`  ${s.id} | hostId: ${s.hostId} | isLive: ${s.isLive} | status: ${s.streamStatus}`));

    await conn.connection.close();
  } catch(e) { console.error('ERRO:', e.message); }
}
main();
