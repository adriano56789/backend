const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

(async () => {
  const c = new MongoClient('mongodb://admin:adriano123@localhost:27017/api?authSource=admin');
  await c.connect();
  const db = c.db('api');
  
  const users = await db.collection('users').find({ email: 'adrianomdk5@gmail.com' }).toArray();
  console.log('Users count:', users.length);
  users.forEach((u, i) => console.log(i, 'id:', u.id, 'hash:', u.password?.substring(0, 25)));
  
  const hash = await bcrypt.hash('123456', 10);
  console.log('New hash:', hash);
  
  await db.collection('users').updateMany(
    { email: 'adrianomdk5@gmail.com' },
    { $set: { password: hash } }
  );
  console.log('Updated all');
  
  for (const u of users) {
    const match = await bcrypt.compare('123456', hash);
    console.log('Verify for id', u.id, ':', match);
  }
  
  await c.close();
})();
