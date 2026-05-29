#!/bin/sh
set -e

# Garantir que uploads seed existam (não sobrescreve arquivos existentes)
if [ -d "/app/uploads-backup" ]; then
    echo "Sincronizando uploads seed (sem sobrescrever)..."
    mkdir -p /app/uploads
    cp -rn /app/uploads-backup/* /app/uploads/ 2>/dev/null || true
    echo "Uploads seed sincronizados"
fi

# Seed do banco (apenas na primeira execução)
if [ -f "/app/scripts/seed-once.js" ]; then
    echo "Verificando seed do banco de dados..."
    node /app/scripts/seed-once.js && echo "Seed concluído" || echo "Seed ignorado"
fi

# Iniciar servidor
exec node dist/server.js
