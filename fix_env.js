var fs = require('fs');
var c = fs.readFileSync('/app/dist/config/env.js', 'utf8');
c = c.replace(
  "SRS_API_URL: process.env.SRS_API_URL || 'http://localhost:1985'",
  "SRS_API_URL: process.env.SRS_API_URL || 'http://' + (process.env.SRS_HOST || 'localhost') + ':' + (process.env.SRS_API_PORT || '1985')"
);
fs.writeFileSync('/app/dist/config/env.js', c);
console.log('done');
