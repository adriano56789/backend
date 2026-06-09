const { MongoClient } = require('mongodb');
const MONGO_URI = 'mongodb://admin:adriano123@72.60.249.175:27017/api?authSource=admin';

async function main() {
  const c = new MongoClient(MONGO_URI);
  await c.connect();
  const d = c.db('api');

  // Remove userstatuses that aren't adriano
  const r1 = await d.collection('userstatuses').deleteMany({ userId: { $ne: 'adriano' } });
  console.log('userstatuses removidos:', r1.deletedCount);

  // Remove chatmessages that aren't from/to adriano
  const r2 = await d.collection('chatmessages').deleteMany({ $or: [{ fromId: { $ne: 'adriano' } }, { toId: { $ne: 'adriano' } }] });
  console.log('chatmessages removidos:', r2.deletedCount);

  // Remove messages that aren't from/to adriano
  const r3 = await d.collection('messages').deleteMany({ $or: [{ from: { $ne: 'adriano' } }, { to: { $ne: 'adriano' } }] });
  console.log('messages removidos:', r3.deletedCount);

  // Remove followers not related to adriano
  const r4 = await d.collection('followers').deleteMany({ $or: [{ followerId: { $ne: 'adriano' } }, { followingId: { $ne: 'adriano' } }] });
  console.log('followers removidos:', r4.deletedCount);

  // Remove other collections data not related to adriano
  const r5 = await d.collection('beautysettings').deleteMany({ userId: { $ne: 'adriano' } });
  console.log('beautysettings removidos:', r5.deletedCount);
  
  const r6 = await d.collection('birthdays').deleteMany({ userId: { $ne: 'adriano' } });
  console.log('birthdays removidos:', r6.deletedCount);

  const r7 = await d.collection('notificationsettings').deleteMany({ userId: { $ne: 'adriano' } });
  console.log('notificationsettings removidos:', r7.deletedCount);

  const r8 = await d.collection('userlevels').deleteMany({ userId: { $ne: 'adriano' } });
  console.log('userlevels removidos:', r8.deletedCount);

  const r9 = await d.collection('zoomsettings').deleteMany({ userId: { $ne: 'adriano' } });
  console.log('zoomsettings removidos:', r9.deletedCount);

  const r10 = await d.collection('profilephotos').deleteMany({ userId: { $ne: 'adriano' } });
  console.log('profilephotos removidos:', r10.deletedCount);

  const r11 = await d.collection('streamkeys').deleteMany({ streamKey: { $ne: 'adriano' } });
  console.log('streamkeys removidos:', r11.deletedCount);

  // Remove gifted transactions not sent to/by adriano
  const r12 = await d.collection('gifttransactions').deleteMany({ $or: [{ fromUserId: { $ne: 'adriano' } }, { toUserId: { $ne: 'adriano' } }] });
  console.log('gifttransactions removidos:', r12.deletedCount);

  // Remove orders not from adriano
  const r13 = await d.collection('orders').deleteMany({ userId: { $ne: 'adriano' } });
  console.log('orders removidos:', r13.deletedCount);

  const remainingUsers = await d.collection('users').countDocuments();
  console.log('users restantes:', remainingUsers);

  await c.close();
  console.log('Limpeza concluída!');
}

main().catch(console.error);
