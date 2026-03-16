#!/bin/bash
# =============================================================
# RESTORE SCRIPT - Run this on a fresh machine after git clone
# Usage: bash scripts/restore.sh
# =============================================================

set -e
WORKSPACE="$HOME/.openclaw/workspace"
echo "=== OpenClaw Restore ==="
echo "Workspace: $WORKSPACE"

# 1. Start dashboard
echo ""
echo "[1/4] Starting dashboard..."
nohup node "$WORKSPACE/dashboard/server.js" > /tmp/dashboard.log 2>&1 &
sleep 2
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3737 2>/dev/null || echo "000")
echo "  Dashboard: $STATUS"

# 2. Start Cloudflare tunnel
echo ""
echo "[2/4] Starting Cloudflare tunnel..."
nohup cloudflared tunnel run matthew-dashboard > /tmp/cloudflared.log 2>&1 &
sleep 4
TUNNEL=$(cloudflared tunnel info 82ebc6e5-eeae-4532-8331-325d82345028 2>&1 | grep -i connector | wc -l)
echo "  Tunnel connectors: $TUNNEL"

# 3. Start n8n
echo ""
echo "[3/4] Starting n8n..."
N8N_BASIC_AUTH_ACTIVE=true \
N8N_BASIC_AUTH_USER=MatthewDewstowe \
N8N_BASIC_AUTH_PASSWORD='Launch2025!' \
N8N_PORT=5678 \
N8N_HOST=0.0.0.0 \
nohup n8n start > /tmp/n8n.log 2>&1 &
echo "  Waiting 15s for n8n to start..."
sleep 15
N8N_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz 2>/dev/null || echo "000")
echo "  n8n: $N8N_STATUS"

# 4. Import n8n workflows
echo ""
echo "[4/4] Importing n8n workflows..."
if [ "$N8N_STATUS" = "200" ]; then
  IMPORTED=0
  for f in "$WORKSPACE/n8n-export"/*.json; do
    NAME=$(basename "$f")
    RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST \
      -H "X-N8N-API-KEY: n8n_api_2db515ffaad4360337c1706629a388d842eec93c" \
      -H "Content-Type: application/json" \
      -d @"$f" \
      "http://localhost:5678/api/v1/workflows" 2>/dev/null || echo "000")
    echo "  $NAME → $RESULT"
    IMPORTED=$((IMPORTED + 1))
  done
  echo "  Imported $IMPORTED workflows"
else
  echo "  SKIPPED — n8n not ready (status: $N8N_STATUS)"
  echo "  Run manually: for f in $WORKSPACE/n8n-export/*.json; do curl -X POST -H 'X-N8N-API-KEY: ...' -H 'Content-Type: application/json' -d @\$f http://localhost:5678/api/v1/workflows; done"
fi

echo ""
echo "=== Restore complete ==="
echo "Dashboard: http://localhost:3737"
echo "n8n:       http://localhost:5678"
echo "Tunnel:    https://82ebc6e5-eeae-4532-8331-325d82345028.cfargotunnel.com"
