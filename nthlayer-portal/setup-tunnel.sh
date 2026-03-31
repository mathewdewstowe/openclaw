#!/bin/bash
set -euo pipefail

# ============================================================
# Cloudflare Tunnel Setup for portal.nthlayer.com
# Run AFTER deploy.sh completes
# ============================================================

echo "Setting up Cloudflare Tunnel for portal.nthlayer.com"
echo ""

# Step 1: Login
echo "[1/4] Authenticating with Cloudflare..."
echo "  A browser link will appear — open it, pick nthlayer.com zone"
cloudflared tunnel login

# Step 2: Create tunnel
echo "[2/4] Creating tunnel..."
TUNNEL_OUTPUT=$(cloudflared tunnel create nthlayer-portal 2>&1)
echo "$TUNNEL_OUTPUT"
TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | grep -oP 'Created tunnel nthlayer-portal with id \K[a-f0-9-]+')
echo "  Tunnel ID: $TUNNEL_ID"

# Step 3: Route DNS
echo "[3/4] Creating DNS route..."
cloudflared tunnel route dns nthlayer-portal portal.nthlayer.com

# Step 4: Config + service
echo "[4/4] Creating config and installing service..."
CRED_FILE=$(ls ~/.cloudflared/*.json 2>/dev/null | head -1)

cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: $CRED_FILE

ingress:
  - hostname: portal.nthlayer.com
    service: http://localhost:3000
  - service: http_status:404
EOF

echo "  Config written to ~/.cloudflared/config.yml"

# Install as system service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

echo ""
echo "═══════════════════════════════════════════"
echo " DONE! Portal is live at:"
echo " https://portal.nthlayer.com"
echo "═══════════════════════════════════════════"
