#!/bin/bash
echo "=== SRS ==="
curl -s http://127.0.0.1:1985/api/v1/versions 2>/dev/null
echo ""
echo "=== LiveKit ==="
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7880/twirp 2>&1
echo ""
echo "=== Backend ==="
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ 2>&1
echo ""
echo "=== Nginx livego ==="
curl -s -o /dev/null -w "%{http_code}" -H "Host: livego.store" http://127.0.0.1/ 2>&1
echo ""
echo "=== Nginx api ==="
curl -s -o /dev/null -w "%{http_code}" -H "Host: api.livego.store" http://127.0.0.1/ 2>&1
echo ""
echo "=== DNS sfu ==="
host sfu.livego.store 2>&1 | head -2
