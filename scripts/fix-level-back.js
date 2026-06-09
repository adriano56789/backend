const { MongoClient } = require('mongodb');
const uri = 'mongodb://admin:adriano123@72.60.249.175:27017/api?authSource=admin';

(async () => {
  const c = new MongoClient(uri);
  await c.connect();
  const d = c.db('api');
  const r = await d.collection('users').updateOne(
    { id: 'adriano' },
    { $set: { level: 1 } }
  );
  console.log('Reverted level to 1. Modified:', r.modifiedCount);
  const user = await d.collection('users').findOne({ id: 'adriano' });
  console.log('Current level:', user?.level, '| identification:', user?.identification);
  await c.close();
})();
