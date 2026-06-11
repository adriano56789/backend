#!/bin/bash
set -euo pipefail

SDK_REPO_URL="https://github.com/adriano56789/sdk-nodejs.git"
SDK_DIR="/var/www/sdk-nodejs"
SDK_BRANCH="master"

info()  { echo -e "\033[0;32m[INFO]\033[0m $1"; }
err()   { echo -e "\033[0;31m[ERR]\033[0m $1"; }
ok()    { echo -e "\033[0;32m[OK]\033[0m $1"; }

info "=================================================================="
info "  SETUP SDK MERCADO PAGO (sdk-nodejs)"
info "=================================================================="

[ "$EUID" = "0" ] || { err "Execute como root"; exit 1; }

info "[1/3] Clonando SDK ($SDK_BRANCH)..."
if [ -d "$SDK_DIR/.git" ]; then
    cd "$SDK_DIR"
    git fetch origin "$SDK_BRANCH"
    git reset --hard "origin/$SDK_BRANCH"
    git clean -fd
else
    rm -rf "$SDK_DIR"
    git clone --depth 1 -b "$SDK_BRANCH" "$SDK_REPO_URL" "$SDK_DIR"
fi
cd "$SDK_DIR"
ok "SDK clonado (commit: $(git log --oneline -1))"

info "[2/3] Instalando dependencias do SDK..."
npm install --legacy-peer-deps
ok "Dependencias do SDK instaladas"

info "[3/3] Buildando SDK..."
if grep -q '"build"' package.json 2>/dev/null; then
    npm run build
    ok "SDK buildado"
else
    ok "SDK nao tem script build — pulando"
fi

echo ""
info "=================================================================="
info "  SDK PRONTO em $SDK_DIR"
info "=================================================================="
