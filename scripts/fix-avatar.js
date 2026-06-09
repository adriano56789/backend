const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb://admin:adriano123@72.60.249.175:27017/api?authSource=admin';

async function main() {
  const c = new MongoClient(MONGO_URI);
  await c.connect();
  const d = c.db('api');

  const photo = await d.collection('profilephotos').findOne({ userId: 'adriano', photoType: 'avatar', isMain: true });
  if (photo) {
    await d.collection('users').updateOne({ id: 'adriano' }, { $set: { avatarUrl: photo.photoUrl } });
    console.log('avatarUrl atualizado para:', photo.photoUrl);
  } else {
    console.log('nenhum avatar encontrado');
  }

  await c.close();
}

main().catch(console.error);
