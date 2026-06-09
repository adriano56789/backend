const { MongoClient } = require('mongodb');
const uri = 'mongodb://admin:adriano123@72.60.249.175:27017/api?authSource=admin';
(async () => {
  const c = new MongoClient(uri);
  await c.connect();
  const d = c.db('api');
  const users = await d.collection('users').find().toArray();
  users.forEach(u => console.log('id:', u.id, '| identification:', u.identification, '| name:', u.name, '| level:', u.level, '| avatarUrl:', (u.avatarUrl || '').substring(0, 60)));
  await c.close();
})();
