const { connectDB } = require('./dist/config/db');
async function main() {
  const conn = await connectDB();
  const db = conn.connection.db;

  // Revert Adri id back to lowercase
  await db.collection('users').updateOne(
    { name: 'Adri' },
    { $set: { id: 'adri' } }
  );

  // Give Adri an avatarUrl
  await db.collection('users').updateOne(
    { id: 'adri' },
    { $set: { avatarUrl: 'https://ui-avatars.com/api/?name=Adri&background=7C3AED&color=fff&size=200' } }
  );

  const users = await db.collection('users').find().toArray();
  users.forEach(u => console.log(u.id, '-', u.name, '| avatarUrl:', u.avatarUrl ? 'sim' : 'VAZIO'));

  await conn.connection.close();
  console.log('Revertido!');
}
main();
