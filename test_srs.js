fetch('http://srs:1985/api/v1/streams/')
  .then(r => r.text())
  .then(t => console.log(t.substring(0, 200)))
  .catch(e => console.log('ERROR: ' + e.message));
