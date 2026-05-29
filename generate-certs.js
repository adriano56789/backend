const fs = require('fs');
const { exec } = require('child_process');

// Tenta usar mkcert se disponível, senão usa openssl via WSL
const cmd = process.platform === 'win32' 
  ? 'wsl openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"'
  : 'openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"';

exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
  if (error) {
    console.error('Erro ao gerar certificado:', error);
    process.exit(1);
  }
  console.log('Certificado gerado com sucesso!');
  console.log('Files: key.pem, cert.pem');
});
