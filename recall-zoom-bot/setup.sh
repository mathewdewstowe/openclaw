#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Linux VM setup for the Zoom bot
# Run once: sudo bash setup.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

echo "=== Installing system dependencies ==="
apt-get update
apt-get install -y \
  chromium-browser \
  xvfb \
  pulseaudio \
  dbus-x11 \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2 \
  libxshmfence1 \
  fonts-liberation \
  ffmpeg \
  v4l2loopback-dkms \
  v4l2loopback-utils

echo "=== Setting up virtual framebuffer (Xvfb) ==="
# Create a systemd service for Xvfb
cat > /etc/systemd/system/xvfb.service << 'EOF'
[Unit]
Description=Virtual framebuffer for headless Chromium
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb :99 -screen 0 1280x720x24 -ac
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable xvfb
systemctl start xvfb

echo "=== Setting up PulseAudio with virtual devices ==="
# PulseAudio config for virtual sink/source
mkdir -p /etc/pulse
cat > /etc/pulse/default.pa << 'PAEOF'
# Load default modules
load-module module-native-protocol-unix auth-anonymous=1 socket=/tmp/pulseaudio.socket
load-module module-always-sink

# Virtual speaker (captures what Chromium outputs = meeting audio)
load-module module-null-sink sink_name=virtual_speaker sink_properties=device.description="VirtualSpeaker"

# Virtual mic (what gets sent into the meeting as bot's mic)
load-module module-null-sink sink_name=virtual_mic sink_properties=device.description="VirtualMic"

# Make the monitor of virtual_mic available as a source (Chromium reads this as mic input)
load-module module-remap-source master=virtual_mic.monitor source_name=virtual_mic_source source_properties=device.description="VirtualMicSource"

# Set defaults
set-default-sink virtual_speaker
set-default-source virtual_mic_source
PAEOF

# PulseAudio systemd service (user-mode)
cat > /etc/systemd/system/pulseaudio-bot.service << 'EOF'
[Unit]
Description=PulseAudio for Zoom bot virtual audio
After=xvfb.service

[Service]
Type=simple
ExecStart=/usr/bin/pulseaudio --daemonize=no --system --disallow-exit --disallow-module-loading=0
Restart=always
RestartSec=3
Environment=DISPLAY=:99

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pulseaudio-bot
systemctl start pulseaudio-bot

echo "=== Loading v4l2loopback for virtual camera ==="
modprobe v4l2loopback devices=1 video_nr=10 card_label="BotCamera" exclusive_caps=1
echo "v4l2loopback" >> /etc/modules-load.d/v4l2loopback.conf
echo "options v4l2loopback devices=1 video_nr=10 card_label=BotCamera exclusive_caps=1" > /etc/modprobe.d/v4l2loopback.conf

echo ""
echo "=== Setup complete ==="
echo "Virtual display:  DISPLAY=:99"
echo "Virtual speaker:  virtual_speaker (captures meeting audio)"
echo "Virtual mic:      virtual_mic_source (bot mic input)"
echo "Virtual camera:   /dev/video10"
echo ""
echo "Next: cd /path/to/zoom-bot && npm install && npm start"
