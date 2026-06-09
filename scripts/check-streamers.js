const { MongoClient } = require('mongodb');
const uri = 'mongodb://admin:adriano123@72.60.249.175:27017/api?authSource=admin';

(async () => {
  const c = new MongoClient(uri);
  await c.connect();
  const d = c.db('api');
  const streams = await d.collection('Streamer').find({}).toArray();
  console.log('Streamer count:', streams.length);
  streams.forEach(s => console.log('id:', s.id, '| hostId:', s.hostId, '| name:', s.name, '| isLive:', s.isLive));
  await c.close();
})();
