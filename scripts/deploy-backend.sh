#!/bin/bash
set -euo pipefail

REPO_URL="https://github.com/adriano56789/backend.git"
DEPLOY_DIR="/var/www/backend"
BRANCH="main"
VPS_IP=$(curl -s ifconfig.me)

info()  { echo -e "\033[0;32m[INFO]\033[0m $1"; }
err()   { echo -e "\033[0;31m[ERR]\033[0m $1"; }
ok()    { echo -e "\033[0;32m[OK]\033[0m $1"; }

info "=== DEPLOY BACKEND ==="

[ "$EUID" = "0" ] || { err "Execute como root"; exit 1; }

info "[1/7] Instalando dependencias do sistema..."
apt update -qq && apt install -y -qq git curl nodejs npm 2>/dev/null || true
# Garantir PM2 instalado
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
fi
ok "Dependencias OK"

info "[2/7] Clonando repositorio..."
if [ -d "$DEPLOY_DIR/.git" ]; then
    cd "$DEPLOY_DIR"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
    git clean -fd
else
    rm -rf "$DEPLOY_DIR"
    git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
fi
cd "$DEPLOY_DIR"
ok "Repositorio atualizado (commit: $(git log --oneline -1))"

info "[3/7] Clonando SDK do Mercado Pago (sdk-nodejs)..."
SDK_REPO_URL="https://github.com/adriano56789/sdk-nodejs.git"
SDK_DIR="/var/www/sdk-nodejs"
if [ -d "$SDK_DIR/.git" ]; then
    cd "$SDK_DIR"
    git fetch origin master
    git reset --hard "origin/master"
    git clean -fd
else
    rm -rf "$SDK_DIR"
    git clone --depth 1 -b master "$SDK_REPO_URL" "$SDK_DIR"
fi
cd "$SDK_DIR"
npm install --legacy-peer-deps
if grep -q '"build"' package.json 2>/dev/null; then
    npm run build
fi
cd "$DEPLOY_DIR"
ok "SDK instalado"

info "[4/7] Instalando dependencias do Node..."
npm install --legacy-peer-deps
ok "Dependencias Node OK"

info "[5/7] Buildando backend..."
npm run build
# Verificar se o build gerou o arquivo principal
if [ ! -f "dist/server.js" ] && [ ! -f "dist/index.js" ] && [ ! -f "dist/app.js" ]; then
    err "Build parece ter falhado — nenhum entrypoint encontrado em dist/"
    exit 1
fi
ok "Build concluido"

info "[6/7] Criando arquivo .env..."
cat > .env <<EOF
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
WS_PORT=3001
FRONTEND_URL=https://livego.store
BACKEND_URL=https://api.livego.store
API_URL=https://api.livego.store
CORS_ORIGIN=https://livego.store,https://www.livego.store,https://api.livego.store
MONGODB_URI=mongodb://admin:adriano123@127.0.0.1:27017/api?authSource=admin
JWT_SECRET=livego_jwt_secret_$(date +%s)
JWT_REFRESH_SECRET=livego_refresh_secret_$(date +%s)
TURN_SERVER=$VPS_IP
TURN_PORT=3478
STUN_SERVER=$VPS_IP
STUN_PORT=3478
WEBRTC_MIN_PORT=10000
WEBRTC_MAX_PORT=20000
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-8544166678866013-071608-5a99eb2e81c9d1321005f213a0ed2ce1-198663456
MERCADO_PAGO_PUBLIC_KEY=APP_USR-dac29668-9ab3-483f-ad46-8216c93786b2
MERCADO_PAGO_CLIENT_ID=8544166678866013
MERCADO_PAGO_CLIENT_SECRET=OvtQrTNHPFDNhptfkrldHwqQ9QjYzWhq
WEBHOOK_URL=https://api.livego.store/api/payments/webhook
NOTIFICATION_URL=https://api.livego.store/api/payments/notification
PLATFORM_FEE_PERCENTAGE=20
MIN_WITHDRAWAL_AMOUNT=5
EOF
ok ".env criado"

info "[7/7] Iniciando backend via PM2..."
# Determinar entrypoint
ENTRYPOINT="dist/server.js"
[ ! -f "$ENTRYPOINT" ] && ENTRYPOINT="dist/index.js"
[ ! -f "$ENTRYPOINT" ] && ENTRYPOINT="dist/app.js"

pm2 stop livego-backend 2>/dev/null || true
pm2 delete livego-backend 2>/dev/null || true
pm2 start "$ENTRYPOINT" --name livego-backend --cwd "$DEPLOY_DIR"
pm2 save
pm2 startup 2>/dev/null || true
ok "Backend rodando via PM2"

# Health check
sleep 3
if curl -sf http://127.0.0.1:3000/api/health > /dev/null 2>&1; then
    ok "Health check: API online"
else
    err "Health check falhou — backend pode estar iniciando ainda"
fi

echo ""
info "=== DEPLOY BACKEND CONCLUIDO ==="
info "API: https://api.livego.store"
info "PM2: pm2 list"
