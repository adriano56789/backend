const fs = require('fs');

const path = '/app/frontend/components/StreamRoom.tsx';
let content = fs.readFileSync(path, 'utf8');
let modified = content;

// 1. Add import for useLiveKitChat
modified = modified.replace(
  "import { useLiveKit } from '../hooks/useLiveKit';",
  "import { useLiveKit } from '../hooks/useLiveKit';\nimport { useLiveKitChat } from '../hooks/useLiveKitChat';"
);

// 2. Add hook usage after useLiveKit() call (before the comment block)
const hookCode = [
  "  const {",
  "    connected: lkChatConnected,",
  "    sendMessage: lkChatSendMessage,",
  "    disconnect: disconnectLkChat,",
  "  } = useLiveKitChat({",
  "    streamId: streamer.id,",
  "    userId: currentUser.id,",
  "    onMessage: (data: any) => {",
  "      if (data.type === 'chat_message' || data.type === 'chat') {",
  "        setMessages(prev => {",
  "          if (prev.some(m => m.id === data.id)) return prev;",
  "          return [...prev, { ...data, type: 'chat' }];",
  "        });",
  "      }",
  "    },",
  "  });",
].join('\n');

modified = modified.replace(
  "    } = useLiveKit();\n\n    // LiveKit: apenas o broadcaster conecta automaticamente para gerenciar sala.",
  "    } = useLiveKit();\n\n" + hookCode + "\n\n    // LiveKit: apenas o broadcaster conecta automaticamente para gerenciar sala."
);

// 3. Add LiveKit Chat Channel send in handleSendMessage
modified = modified.replace(
  "        // Socket.IO: redund\u00e2ncia para garantir distribui\u00e7\u00e3o a TODOS os participantes\n        // (LiveKit SFU pode n\u00e3o estar roteando data channel entre participantes)",
  "        // LiveKit Chat Channel (live_{streamId}) — canal adicional do backend\n        if (lkChatConnected) {\n            lkChatSendMessage(safePayload);\n        }\n        // Socket.IO: redund\u00e2ncia para garantir distribui\u00e7\u00e3o a TODOS os participantes\n        // (LiveKit SFU pode n\u00e3o estar roteando data channel entre participantes)"
);

// 4. Add disconnectLkChat in cleanup
modified = modified.replace(
  "            disconnectLiveKit();",
  "            disconnectLiveKit();\n            disconnectLkChat();"
);

fs.writeFileSync(path, modified, 'utf8');

// Show diff summary
const oldLines = content.split('\n');
const newLines = modified.split('\n');
console.log('Original lines:', oldLines.length);
console.log('Modified lines:', newLines.length);
console.log('Lines added:', newLines.length - oldLines.length);

// Verify each edit was applied
const checks = [
  "import { useLiveKitChat } from '../hooks/useLiveKitChat';",
  "lkChatConnected",
  "lkChatSendMessage(safePayload)",
  "disconnectLkChat();",
];

for (const check of checks) {
  if (modified.includes(check)) {
    console.log('OK - found:', check);
  } else {
    console.log('MISSING:', check);
  }
}
