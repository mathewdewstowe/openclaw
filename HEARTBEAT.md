# HEARTBEAT.md

## 1. Dashboard Keep-Alive

On every heartbeat, check if the dashboard is running:

Run: `ss -tlnp | grep 3737`

**If port 3737 is NOT listening:**
1. Diagnose why: run `journalctl -u dashboard 2>/dev/null | tail -20 || cat /tmp/dashboard.log 2>/dev/null | tail -20 || echo "No log found"`
2. Restart: `cd /home/matthewdewstowe/.openclaw/workspace/dashboard && node server.js > /tmp/dashboard.log 2>&1 &`
3. Confirm it's back: `sleep 3 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3737`
4. Alert Matthew in Slack: "⚠️ Dashboard was down — restarted. Cause: [reason from logs]"
5. Log the restart + cause in today's memory file
6. Write to SQLite: `sqlite3 /home/matthewdewstowe/.openclaw/workspace/data/openclaw.db "INSERT INTO uptime_incidents (service, down_at, restored_at, cause) VALUES ('dashboard', '<down_at>', '<restored_at>', '<cause>');"`

**If port 3737 IS listening:** no action needed.

## 2. Cloudflare Tunnel Keep-Alive

On every heartbeat, check if the cloudflared tunnel is connected:

Run: `bash /home/matthewdewstowe/.openclaw/workspace/scripts/service-healthcheck.sh cloudflared`

**If no CONNECTOR line appears (tunnel not running):**
1. Diagnose why: run `journalctl --user -u matthew-dashboard.service -n 30 --no-pager 2>/dev/null || echo "No log found"`
2. Restart: `systemctl --user restart matthew-dashboard.service`
3. Wait 4 seconds, confirm connector appears: `cloudflared tunnel info 82ebc6e5-eeae-4532-8331-325d82345028 2>&1 | grep -i connector`
4. Alert Matthew in Slack: "⚠️ Cloudflare tunnel was down — restarted. Cause: [reason from logs]"
5. Log the restart + cause in today's memory file
6. Write to SQLite: `sqlite3 /home/matthewdewstowe/.openclaw/workspace/data/openclaw.db "INSERT INTO uptime_incidents (service, down_at, restored_at, cause) VALUES ('cloudflare_tunnel', '<down_at>', '<restored_at>', '<cause>');"`

**If connector is present:** no action needed.

---

## 3. Neuro Accountability — #claw_neuro Daily Check-ins

Matthew uses #claw_neuro as his personal accountability channel (ADHD + Autism support).

**Morning (if between 07:00–09:00 UTC and not yet sent today):**
- Check `memory/neuro-checkin.json` for `lastMorning` date
- If not today, send a motivating morning message to Slack channel #claw_neuro:
  - Remind him of his commitments: move, eat well, read, no drinking, don't bite out
  - Include **5 things that are genuinely good about Matthew** (draw from MEMORY.md — his achievements, traits, strengths; rotate/vary these daily)
  - Include **3 things to improve today** (practical, kind, direct — not harsh)
  - Keep it punchy and energising
  - Update `lastMorning` in `memory/neuro-checkin.json`

**Evening (if between 19:00–21:00 UTC and not yet sent today):**
- Check `memory/neuro-checkin.json` for `lastEvening` date
- If not today, send an evening debrief prompt to #claw_neuro:
  - Ask: did you train? did you stay clean? how were you with people?
  - Keep it warm and non-judgmental
  - Update `lastEvening` in `memory/neuro-checkin.json`

**Format for neuro-checkin.json:**
```json
{ "lastMorning": "2026-03-15", "lastEvening": "2026-03-15" }
```

---

## 4. Session Bloat Monitor

On every heartbeat, check for unusually large session files:

Run: `du -k ~/.openclaw/agents/main/sessions/*.jsonl 2>/dev/null | sort -rn | head -5`

**If any unlocked session exceeds 700KB:**
- Alert Matthew in this channel: "⚠️ Large session detected: [filename] is [size]KB. I will only archive stale sessions — not touch active or recent ones."
- Run: `bash /home/matthewdewstowe/.openclaw/workspace/scripts/prune-sessions.sh`
- Log the event in today's memory file

**Important safety rule:**
- Never delete a session just because it is large.
- The pruner is archive-only.
- Only archive sessions that are BOTH stale (72h+) and very large (>1MB).
- Always preserve locked sessions and the most recent 25 sessions.

**If all sessions are under 700KB:** no action needed.

---

## 5. n8n Keep-Alive

On every heartbeat, check if n8n is running:

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz`

**If response is NOT 200:**
1. Diagnose: `cat /tmp/n8n.log 2>/dev/null | tail -20`
2. Restart: `N8N_BASIC_AUTH_ACTIVE=true N8N_BASIC_AUTH_USER=MatthewDewstowe N8N_BASIC_AUTH_PASSWORD='Launch2025!' N8N_PORT=5678 N8N_HOST=0.0.0.0 nohup n8n start > /tmp/n8n.log 2>&1 &`
3. Wait 10 seconds, confirm: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz`
4. Alert Matthew: "⚠️ n8n was down — restarted. Cause: [reason]"
5. Log to SQLite: `sqlite3 /home/matthewdewstowe/.openclaw/workspace/data/openclaw.db "INSERT INTO uptime_incidents (service, down_at, restored_at, cause) VALUES ('n8n', '<down_at>', '<restored_at>', '<cause>');"`

**If 200:** no action needed.

---

## 6. SQLite Flush (Evening)

On evening heartbeats (19:00–23:00 UTC), flush any pending data to SQLite:

- Neuro check-ins from `memory/neuro-checkin.json` → `neuro_checkins` table (if not already recorded today)
- Uptime incidents from `memory/uptime-log.json` → `uptime_incidents` table (new entries only)
- Any open tasks from today's memory file → `tasks` table

Use: `sqlite3 /home/matthewdewstowe/.openclaw/workspace/data/openclaw.db`

---

## 6. Sunday Wash Day (Context Hygiene)

On heartbeats where `date +%u` returns `7` (Sunday):

1. Run: `bash /home/matthewdewstowe/.openclaw/workspace/scripts/prune-sessions.sh`
2. Archive memory files older than 7 days: `cd /home/matthewdewstowe/.openclaw/workspace/memory && for f in $(ls *.md | sort | head -n -7); do gzip "$f"; done`
3. Vacuum SQLite: `sqlite3 /home/matthewdewstowe/.openclaw/workspace/data/openclaw.db "VACUUM;"`
4. Alert Matthew: "🧹 Sunday wash done — sessions pruned, old memory compressed, DB vacuumed."
5. Log in today's memory file


