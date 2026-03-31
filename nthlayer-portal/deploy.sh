#!/bin/bash
set -euo pipefail

# ============================================================
# Nth Layer Signal Portal — Azure VM Deploy Script
# Run on a fresh Ubuntu 22.04/24.04 Azure VM
#
# Usage:
#   1. Create Ubuntu VM on Azure (Standard_B2s or better)
#   2. SSH in
#   3. curl -sL <this-script-url> | bash
#      OR copy this script and run: bash deploy.sh
#
# Prerequisites: none — script installs everything
# ============================================================

echo "═══════════════════════════════════════════"
echo " Nth Layer Signal Portal — Deploying..."
echo "═══════════════════════════════════════════"

# --- System packages ---
echo "[1/8] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq git curl build-essential

# --- Node.js 22 ---
echo "[2/8] Installing Node.js 22..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi
echo "  Node $(node -v), npm $(npm -v)"

# --- PostgreSQL ---
echo "[3/8] Installing and configuring PostgreSQL..."
if ! command -v psql &>/dev/null; then
  sudo apt-get install -y -qq postgresql postgresql-contrib
fi
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database + user
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='nthlayer'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER nthlayer WITH PASSWORD 'nthlayer';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='nthlayer'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE nthlayer OWNER nthlayer;"
echo "  PostgreSQL ready"

# --- Cloudflared ---
echo "[4/8] Installing cloudflared..."
if ! command -v cloudflared &>/dev/null; then
  curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
  sudo chmod +x /usr/local/bin/cloudflared
fi
echo "  $(cloudflared --version)"

# --- Clone repo ---
echo "[5/8] Cloning repository..."
APP_DIR="/opt/nthlayer-portal"
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git pull origin claude/nth-layer-signal-portal-6cumL
else
  git clone --branch claude/nth-layer-signal-portal-6cumL \
    https://github.com/mathewdewstowe/openclaw.git /tmp/openclaw-clone
  sudo cp -r /tmp/openclaw-clone/nthlayer-portal "$APP_DIR"
  rm -rf /tmp/openclaw-clone
fi
cd "$APP_DIR"

# --- Install dependencies ---
echo "[6/8] Installing Node dependencies..."
npm install --production=false 2>&1 | tail -3

# --- Environment ---
echo "[7/8] Configuring environment..."
if [ ! -f .env ]; then
  cat > .env << 'ENVEOF'
DATABASE_URL="postgresql://nthlayer:nthlayer@localhost:5432/nthlayer"
JWT_SECRET="CHANGE_ME_$(openssl rand -hex 16)"
ANTHROPIC_API_KEY=""
NODE_ENV="production"
ENVEOF
  # Generate a real random JWT secret
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s/CHANGE_ME_[a-f0-9]*/$(openssl rand -hex 32)/" .env
  echo "  .env created — ADD YOUR ANTHROPIC_API_KEY to $APP_DIR/.env"
else
  echo "  .env already exists, skipping"
fi

# --- Database ---
echo "[8/8] Pushing schema to database..."
npx prisma generate 2>&1 | tail -2
npx prisma db push 2>&1 | tail -3

# --- Build ---
echo "Building Next.js app..."
npm run build 2>&1 | tail -5

# --- Systemd service for the app ---
echo "Creating systemd service..."
sudo tee /etc/systemd/system/nthlayer.service > /dev/null << 'SVCEOF'
[Unit]
Description=Nth Layer Signal Portal
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nthlayer-portal
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/nthlayer-portal/.env

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable nthlayer
sudo systemctl restart nthlayer
echo "  App service started on port 3000"

# --- Cloudflare Tunnel ---
echo ""
echo "═══════════════════════════════════════════"
echo " App is running on port 3000"
echo "═══════════════════════════════════════════"
echo ""
echo " NEXT STEPS — Cloudflare Tunnel setup:"
echo ""
echo " 1. Authenticate (opens browser link):"
echo "    cloudflared tunnel login"
echo ""
echo " 2. Create tunnel:"
echo "    cloudflared tunnel create nthlayer-portal"
echo ""
echo " 3. Route DNS:"
echo "    cloudflared tunnel route dns nthlayer-portal portal.nthlayer.com"
echo ""
echo " 4. Create config:"
echo '    cat > ~/.cloudflared/config.yml << EOF'
echo '    tunnel: nthlayer-portal'
echo '    credentials-file: /root/.cloudflared/<TUNNEL_ID>.json'
echo '    ingress:'
echo '      - hostname: portal.nthlayer.com'
echo '        service: http://localhost:3000'
echo '      - service: http_status:404'
echo '    EOF'
echo ""
echo " 5. Install as service:"
echo "    cloudflared service install"
echo "    systemctl start cloudflared"
echo ""
echo " 6. Add your Anthropic API key:"
echo "    nano /opt/nthlayer-portal/.env"
echo "    systemctl restart nthlayer"
echo ""
echo " Portal will be live at: https://portal.nthlayer.com"
echo "═══════════════════════════════════════════"
