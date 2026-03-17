# RESTORE.md — Disaster Recovery Guide

If something goes catastrophically wrong, this is how you get back up.

---

## What's Backed Up

Everything lives in Git: **github.com/mathewdewstowe/openclaw**

| What | Where in repo | Notes |
|------|--------------|-------|
| Dashboard (server + frontend) | `dashboard/` | Full Node.js app |
| Task data | `dashboard/data/tasks.json` | Source of truth |
| Daily task snapshots | `dashboard/data/tasks-YYYY-MM-DD.md` | Human-readable backups |
| Scripts | `scripts/` | Pruning, backup, etc. |
| Skills | `skills/` | Agent skills |
| Memory files | `memory/*.md`, `memory/*.json` | Daily logs, state |
| n8n workflows | `n8n-workflows-export.json` | All automation |
| Agent configs | `HEARTBEAT.md`, `SOUL.md`, `USER.md`, `AGENTS.md` | Core identity |

**Not in Git (sensitive/binary):**
- `MEMORY.md` — personal data, keep a manual copy somewhere safe
- SQLite `.db` files — rebuilt automatically from JSON on startup

---

## Full Restore (Fresh Machine)

### 1. Clone the repo

```bash
git clone git@github.com:mathewdewstowe/openclaw.git ~/.openclaw/workspace
cd ~/.openclaw/workspace
```

### 2. Install dashboard dependencies

```bash
cd dashboard
npm install
cd ..
```

### 3. Start the dashboard

```bash
cd dashboard
node server.js > /tmp/dashboard.log 2>&1 &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:3737
# Should return 200
```

SQLite will auto-rebuild from `tasks.json` on first boot.

### 4. Start n8n

```bash
# As systemd user service (preferred)
systemctl --user start n8n
systemctl --user enable n8n

# Or manual fallback:
N8N_BASIC_AUTH_ACTIVE=true \
N8N_BASIC_AUTH_USER=MatthewDewstowe \
N8N_BASIC_AUTH_PASSWORD='Launch2025!' \
N8N_PORT=5678 \
N8N_HOST=0.0.0.0 \
nohup n8n start > /tmp/n8n.log 2>&1 &
```

### 5. Restore n8n workflows

1. Open n8n: http://localhost:5678
2. Settings → Import from file → select `n8n-workflows-export.json`
3. Activate all workflows

### 6. Start Cloudflare tunnel

```bash
nohup cloudflared tunnel run matthew-dashboard > /tmp/cloudflared.log 2>&1 &
sleep 4
cloudflared tunnel info 82ebc6e5-eeae-4532-8331-325d82345028 2>&1 | grep -i connector
# Should show a CONNECTOR line
```

### 7. Restore MEMORY.md

Copy your backed-up `MEMORY.md` back to:
```
~/.openclaw/workspace/MEMORY.md
```

---

## Partial Restore (Just the Dashboard)

If the dashboard crashes but everything else is fine:

```bash
cd ~/.openclaw/workspace/dashboard
node server.js > /tmp/dashboard.log 2>&1 &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:3737
```

Check logs if it doesn't come up:
```bash
cat /tmp/dashboard.log | tail -30
```

---

## Partial Restore (Just n8n)

```bash
# Check if it's just stopped
systemctl --user status n8n

# Restart
systemctl --user restart n8n

# Check health
curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz
```

---

## Partial Restore (Just Cloudflare Tunnel)

```bash
nohup cloudflared tunnel run matthew-dashboard > /tmp/cloudflared.log 2>&1 &
sleep 4
cloudflared tunnel info 82ebc6e5-eeae-4532-8331-325d82345028 2>&1 | grep -i connector
```

---

## Data Safety Notes

- **Tasks** are triple-persisted: SQLite + `tasks.json` + daily `.md` snapshots
- If SQLite is lost, dashboard reconciles from `tasks.json` on startup — no data loss
- Daily memory files in `memory/` give you a full audit trail of what happened each day
- Git history means you can roll back to any previous state

---

## Key URLs After Restore

- Dashboard: https://missioncontrol.nthlayer.co.uk (or http://localhost:3737)
- n8n: https://n8n.nthlayer.co.uk (or http://localhost:5678)
- OpenClaw UI: http://localhost:18789

---

*Last updated: 2026-03-17*
