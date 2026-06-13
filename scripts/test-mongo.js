const mongoose = require('mongoose');
console.log('mongoose version:', mongoose.version);
mongoose.connect('mongodb://admin:adriano123@127.0.0.1:27017/api?authSource=admin', {serverSelectionTimeoutMS: 5000})
  .then(() => console.log('OK'))
  .catch(e => console.log('ERR:', e.message));
