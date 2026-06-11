$VPS_IP = "2.25.192.154"
$VPS_USER = "root"
$LOCAL_DIR = "C:\Users\adria\OneDrive\Documentos\Área de Trabalho\backend"
$VPS_DIR = "/var/www/backend"

Write-Host "=== ENVIANDO BACKEND PARA VPS ===" -ForegroundColor Green

# 1. Criar diretorio na VPS
Write-Host "[1/5] Criando diretorio na VPS..."
ssh $VPS_USER@$VPS_IP "mkdir -p $VPS_DIR/dist $VPS_DIR/scripts"

# 2. Enviar scripts de deploy
Write-Host "[2/5] Enviando scripts..."
scp "$LOCAL_DIR\scripts\deploy-backend.sh" "$VPS_USER@$VPS_IP`:$VPS_DIR/scripts/"
scp "$LOCAL_DIR\scripts\setup-sdk.sh" "$VPS_USER@$VPS_IP`:$VPS_DIR/scripts/"
ssh $VPS_USER@$VPS_IP "chmod +x $VPS_DIR/scripts/*.sh"

# 3. Enviar dist/ (build)
Write-Host "[3/5] Enviando dist/ (build)..."
ssh $VPS_USER@$VPS_IP "mkdir -p $VPS_DIR/dist"
& scp -r "$LOCAL_DIR\dist\*" "$VPS_USER@$VPS_IP`:$VPS_DIR/dist/"

# 4. Enviar package.json, package-lock.json, tsconfig.json, .env
Write-Host "[4/5] Enviando arquivos de configuracao..."
scp "$LOCAL_DIR\package.json" "$VPS_USER@$VPS_IP`:$VPS_DIR/"
scp "$LOCAL_DIR\package-lock.json" "$VPS_USER@$VPS_IP`:$VPS_DIR/"
scp "$LOCAL_DIR\tsconfig.json" "$VPS_USER@$VPS_IP`:$VPS_DIR/"

# 5. Instalar deps e reiniciar
Write-Host "[5/5] Instalando dependencias e reiniciando..."
ssh $VPS_USER@$VPS_IP @"
    cd $VPS_DIR
    npm install --production --legacy-peer-deps
    pm2 stop livego-backend 2>/dev/null || true
    pm2 delete livego-backend 2>/dev/null || true
    pm2 start dist/server.js --name livego-backend --cwd $VPS_DIR
    pm2 save
" 

Write-Host ""
Write-Host "=== BACKEND ENVIADO COM SUCESSO ===" -ForegroundColor Green
