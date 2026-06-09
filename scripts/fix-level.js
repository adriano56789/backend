const { MongoClient } = require('mongodb');
const uri = 'mongodb://admin:adriano123@72.60.249.175:27017/api?authSource=admin';

(async () => {
  const c = new MongoClient(uri);
  await c.connect();
  const d = c.db('api');
  const r = await d.collection('users').updateOne(
    { id: 'adriano' },
    { $set: { level: 33 } }
  );
  console.log('Modified:', r.modifiedCount);
  if (r.modifiedCount === 0) {
    console.log('User not found or level already 33. Checking current data...');
    const user = await d.collection('users').findOne({ id: 'adriano' });
    console.log('Current level:', user?.level);
  }
  await c.close();
})();
