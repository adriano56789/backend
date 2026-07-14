const fs = require('fs');
const p = '/app/backend/src/server.ts';
let c = fs.readFileSync(p, 'utf8');
const search = "// Broadcast para todos na sala do stream";
const startIndex = c.indexOf(search);

if (startIndex !== -1) {
  const endIndex = c.indexOf("            wsIo.to(streamId).emit('new_chat_message', chatData);\n") + 67;
  const replaced = c.substring(0, startIndex) + "// Broadcast via LiveKit Chat Channel (\u00fanico canal de distribui\u00e7\u00e3o)\n" + c.substring(endIndex + 1);
  fs.writeFileSync(p, replaced);
  console.log('OK');
} else {
  console.log('Not found');
}
