#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Sonesse Zoom Bot — Full VM Setup
# Run on Ubuntu 22.04 Azure VM
# ─────────────────────────────────────────────────────────────
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "=== 1. System packages ==="
apt-get update -qq
apt-get install -y -qq \
  curl git xvfb pulseaudio dbus-x11 ffmpeg \
  chromium-browser \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2 libxshmfence1 fonts-liberation

echo "=== 2. Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs

echo "=== 3. Xvfb service ==="
cat > /etc/systemd/system/xvfb.service << 'EOF'
[Unit]
Description=Virtual framebuffer
After=network.target
[Service]
ExecStart=/usr/bin/Xvfb :99 -screen 0 1280x720x24 -ac
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now xvfb

echo "=== 4. PulseAudio virtual devices ==="
mkdir -p /etc/pulse
cat > /etc/pulse/default.pa << 'PAEOF'
load-module module-native-protocol-unix auth-anonymous=1 socket=/tmp/pulseaudio.socket
load-module module-always-sink
load-module module-null-sink sink_name=virtual_speaker sink_properties=device.description="VirtualSpeaker"
load-module module-null-sink sink_name=virtual_mic sink_properties=device.description="VirtualMic"
load-module module-remap-source master=virtual_mic.monitor source_name=virtual_mic_source source_properties=device.description="VirtualMicSource"
set-default-sink virtual_speaker
set-default-source virtual_mic_source
PAEOF

cat > /etc/systemd/system/pulseaudio-bot.service << 'EOF'
[Unit]
Description=PulseAudio for Zoom bot
After=xvfb.service
[Service]
Type=simple
ExecStart=/usr/bin/pulseaudio --daemonize=no --system --disallow-exit
Restart=always
Environment=DISPLAY=:99
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now pulseaudio-bot

echo "=== 5. Clone repo and install ==="
cd /opt
git clone https://github.com/mathewdewstowe/openclaw.git || true
cd /opt/openclaw/recall-zoom-bot
git checkout claude/recall-zoom-integration-9UKqx
npm install

echo "=== 6. Create .env ==="
cat > /opt/openclaw/recall-zoom-bot/.env << 'EOF'
PORT=3000
TAVUS_API_KEY=REPLACE_WITH_YOUR_KEY
ANTHROPIC_API_KEY=REPLACE_WITH_YOUR_KEY
DISPLAY=:99
PULSE_SERVER=unix:/tmp/pulseaudio.socket
CHROME_PATH=/usr/bin/chromium-browser
VIDEO_DEVICE=/dev/video10
EOF

echo "=== 7. Create systemd service ==="
cat > /etc/systemd/system/zoom-bot.service << 'EOF'
[Unit]
Description=Sonesse Zoom Bot API
After=xvfb.service pulseaudio-bot.service network.target
[Service]
Type=simple
WorkingDirectory=/opt/openclaw/recall-zoom-bot
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
Environment=DISPLAY=:99
Environment=PULSE_SERVER=unix:/tmp/pulseaudio.socket
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now zoom-bot

echo "=== 8. Open firewall ==="
ufw allow 22/tcp 2>/dev/null || true
ufw allow 3000/tcp 2>/dev/null || true

echo ""
echo "=== SETUP COMPLETE ==="
echo "Bot API: http://$(curl -s ifconfig.me):3000"
echo "Health:  http://$(curl -s ifconfig.me):3000/api/health"
echo ""
echo "NEXT: Edit /opt/openclaw/recall-zoom-bot/.env and add your TAVUS_API_KEY"
echo "Then: systemctl restart zoom-bot"
