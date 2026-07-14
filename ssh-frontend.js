const { spawn } = require('child_process');

const password = 'MshrUfZrh09hWr#';
const args = [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'UserKnownHostsFile=/dev/null',
  '-o', 'PreferredAuthentications=keyboard-interactive,password',
  'root@2.25.192.154'
];

let resolved = false;

function connect() {
  return new Promise((resolve, reject) => {
    const proc = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    let passwordSent = false;
    let commandsSent = false;

    proc.stdout.on('data', d => {
      buf += d.toString();
    });
    
    proc.stderr.on('data', d => {
      buf += d.toString();
    });

    const checkBuf = setInterval(() => {
      if (resolved) return;
      
      if (!passwordSent && (buf.includes('assword') || buf.includes('assword:'))) {
        passwordSent = true;
        proc.stdin.write(password + '\n');
        return;
      }

      if (passwordSent && !commandsSent && (buf.includes('# ') || buf.includes('$ ') || buf.includes('~#') || buf.includes('~$'))) {
        commandsSent = true;
        const cmds = [
          'echo "=== FRONTEND DIR ==="',
          'ls -la /app/frontend/',
          'echo "=== SRC ==="',
          'ls -la /app/frontend/src/ 2>/dev/null || echo "NO_SRC_DIR"',
          'echo "=== PACKAGE ==="',
          'cat /app/frontend/package.json 2>/dev/null || echo "NO_PKG"',
          'echo "=== NAMES ==="',
          'ls /app/frontend/src/pages/ 2>/dev/null || echo "NO_PAGES"', 
          'ls /app/frontend/src/components/ 2>/dev/null || echo "NO_COMPONENTS"',
          'ls /app/frontend/src/services/ 2>/dev/null || echo "NO_SERVICES"',
          'echo "=== LIVEKIT/CHAT ==="',
          'find /app/frontend/src -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" 2>/dev/null | grep -iE "livekit|chat|stream" | head -20',
          'echo "=== DONE ==="',
        ];
        cmds.forEach(c => proc.stdin.write(c + '\n'));
        proc.stdin.write('exit\n');
        setTimeout(() => {
          resolved = true;
          clearInterval(checkBuf);
          resolve(buf);
          proc.kill();
        }, 3000);
        return;
      }
      
      if (buf.includes('Permission denied') && passwordSent) {
        resolved = true;
        clearInterval(checkBuf);
        reject(new Error('Permission denied after password'));
        proc.kill();
      }
    }, 100);

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        clearInterval(checkBuf);
        resolve(buf);
        proc.kill();
      }
    }, 20000);

    proc.on('error', e => {
      if (!resolved) {
        resolved = true;
        clearInterval(checkBuf);
        reject(e);
      }
    });
  });
}

connect()
  .then(output => {
    console.log(output);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
