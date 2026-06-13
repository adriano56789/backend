try {
  const mongo = require('mongodb');
  console.log('mongodb loaded OK, version:', mongo.MongoClient.name);
  mongo.MongoClient.connect('mongodb://admin:adriano123@127.0.0.1:27017/api?authSource=admin', {serverSelectionTimeoutMS: 5000})
    .then(client => { console.log('CONNECTED!'); return client.close(); })
    .catch(e => console.log('Connect error:', e.message));
} catch (e) {
  console.log('Require error:', e.message);
  console.log('Stack:', e.stack.split('\n').slice(0,5).join('\n'));
}
