const http = require('http');
http.get('http://localhost:3000/api/rtc/ice-servers', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log(d));
});
