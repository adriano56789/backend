const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

(async () => {
  const c = new MongoClient('mongodb://admin:adriano123@localhost:27017/api?authSource=admin');
  await c.connect();
  const db = c.db('api');
  const user = await db.collection('users').findOne({ email: 'adrianomdk5@gmail.com' });

  console.log('ID:', user?.id);
  console.log('Email:', user?.email);
  console.log('Hash:', user?.password);
  console.log('Hash length:', user?.password?.length);
  console.log('Other users same email:', await db.collection('users').countDocuments({ email: 'adrianomdk5@gmail.com' }));

  const match = await bcrypt.compare('123456', user?.password);
  console.log('Match 123456:', match);

  // Also check with bcrypt (not bcryptjs)
  try {
    const bcryptNative = require('bcrypt');
    const matchNative = await bcryptNative.compare('123456', user?.password);
    console.log('Match (native):', matchNative);
  } catch(e) {
    console.log('Native bcrypt not available');
  }

  await c.close(); 
})();
