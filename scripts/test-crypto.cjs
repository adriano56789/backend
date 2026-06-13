try {
  const c = require('crypto');
  console.log('crypto OK', typeof c.randomBytes);
} catch (e) {
  console.log('ERR:', e.message);
}
