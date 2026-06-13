const { MongoClient } = require('mongodb');
console.log('Testing mongodb native driver connection...');
MongoClient.connect('mongodb://admin:adriano123@127.0.0.1:27017/api?authSource=admin', { serverSelectionTimeoutMS: 5000 })
  .then(client => {
    console.log('CONNECTED via native driver!');
    return client.db('api').admin().ping();
  })
  .then(r => console.log('Ping result:', JSON.stringify(r)))
  .catch(e => console.log('ERR:', e.message));
