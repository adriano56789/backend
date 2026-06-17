const { MongoClient } = require('mongodb');
const uri = 'mongodb://admin:adriano123@2.25.192.154:27017/api?authSource=admin';
(async () => {
  const c = new MongoClient(uri);
  await c.connect();
  const d = c.db('api');
  const cols = await d.listCollections().toArray();
  for (const ci of cols) {
    const docs = await d.collection(ci.name).find({}).toArray();
    for (const doc of docs) {
      const str = JSON.stringify(doc);
      if (str.includes('1780839155770')) {
        console.log('FOUND in', ci.name, ':', JSON.stringify(doc).substring(0, 300));
      }
    }
  }
  await c.close();
  console.log('Search complete');
})();
