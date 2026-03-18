# HEARTBEAT.md

Keep heartbeats useful and low-noise.
- Do the checks.
- Only message Matthew when action was needed, something is genuinely important, or a scheduled neuro check-in is due.
- Do not create memory noise for routine all-clear states.
- If nothing needs attention, reply `HEARTBEAT_OK`.

## 1. Dashboard Keep-Alive

Run: `ss -tlnp | grep 3737`

If port 3737 is not listening:
1. Diagnose: `journalctl -u dashboard 2>/dev/null | tail -20 || cat /tmp/dashboard.log 2>/dev/null | tail -20 || echo "No log found"`
2. Restart: `cd /home/matthewdewstowe/.openclaw/workspace/dashboard && node server.js > /tmp/dashboard.log 2>&1 &`
3. Confirm: `sleep 3 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3737`
4. Alert Matthew: `⚠️ Dashboard was down — restarted. Cause: [reason]`
5. Log only the incident and action taken
6. Write to SQLite: `sqlite3 /home/matthewdewstowe/.openclaw/workspace/data/openclaw.db "INSERT INTO uptime_incidents (service, down_at, restored_at, cause) VALUES ('dashboard', '<down_at>', '<restored_at>', '<cause>');"`

If listening: no message, no memory entry.

## 2. Cloudflare Tunnel Keep-Alive

Run: `bash /home/matthewdewstowe/.openclaw/workspace/scripts/service-healthcheck.sh cloudflared`

If no CONNECTOR line appears:
1. Diagnose: `journalctl --user -u matthew-dashboard.service -n 30 --no-pager 2>/dev/null || echo "No log found"`
2. Restart: `systemctl --user restart matthew-dashboard.service`
3. Confirm: `cloudflared tunnel info 82ebc6e5-eeae-4532-8331-325d82345028 2>&1 | grep -i connector`
4. Alert Matthew: `⚠️ Cloudflare tunnel was down — restarted. Cause: [reason]`
5. Log only the incident and action taken
6. Write to SQLite: `sqlite3 /home/matthewdewstowe/.openclaw/workspace/data/openclaw.db "INSERT INTO uptime_incidents (service, down_at, restored_at, cause) VALUES ('cloudflare_tunnel', '<down_at>', '<restored_at>', '<cause>');"`

If healthy: no message, no memory entry.

---

## 3. Neuro Accountability — #claw_neuro Daily Check-ins

Matthew uses #claw_neuro as his accountability channel.

### Morning check-in
If between 07:00–09:00 UTC and not yet sent today:
- check `memory/neuro-checkin.json`
- send one motivating message to `#claw_neuro`
- remind him of his commitments: move, eat well, read, no drinking, don't bite out
- include 5 real strengths drawn from durable memory
- include 3 practical things to improve today
- keep it punchy
- update `lastMorning`

### Evening check-in
If between 19:00–21:00 UTC and not yet sent today:
- check `memory/neuro-checkin.json`
- send one warm debrief prompt to `#claw_neuro`
- ask whether he trained, stayed clean, and how he was with people
- update `lastEvening`

Format:
```json
{ "lastMorning": "2026-03-15", "lastEvening": "2026-03-15" }
```

---

## 4. Session Bloat Monitor

Run: `du -k ~/.openclaw/agents/main/sessions/*.jsonl 2>/dev/null | sort -rn | head -5`

If any unlocked session exceeds 700KB:
- alert Matthew: `⚠️ Large session detected: [filename] is [size]KB. I will only archive stale sessions — not touch active or recent ones.`
- run: `bash /home/matthewdewstowe/.openclaw/workspace/scripts/prune-sessions.sh`
- log only if the pruner actually archived something or if intervention was required

Safety rules:
- never delete a session just because it is large
- the pruner is archive-only
- only archive sessions that are both stale (72h+) and very large (>1MB)
- always preserve locked sessions and the most recent 25 sessions

If all sessions are under 700KB: no message.

---

## 5. n8n Keep-Alive

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz`

If response is not 200:
1. Diagnose: `cat /tmp/n8n.log 2>/dev/null | tail -20`
2. Restart: `N8N_BASIC_AUTH_ACTIVE=true N8N_BASIC_AUTH_USER=MatthewDewstowe N8N_BASIC_AUTH_PASSWORD='Launch2025!' N8N_PORT=5678 N8N_HOST=0.0.0.0 nohup n8n start > /tmp/n8n.log 2>&1 &`
3. Confirm: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz`
4. Alert Matthew: `⚠️ n8n was down — restarted. Cause: [reason]`
5. Write to SQLite: `sqlite3 /home/matthewdewstowe/.openclaw/workspace/data/openclaw.db "INSERT INTO uptime_incidents (service, down_at, restored_at, cause) VALUES ('n8n', '<down_at>', '<restored_at>', '<cause>');"`

If healthy: no message, no memory entry.

---

## 6. SQLite Flush (Evening)

On evening heartbeats (19:00–23:00 UTC), flush pending operational data to SQLite if needed:
- neuro check-ins from `memory/neuro-checkin.json`
- uptime incidents from `memory/uptime-log.json`
- any clearly open tasks from today's memory file

Use: `sqlite3 /home/matthewdewstowe/.openclaw/workspace/data/openclaw.db`

Only record real new items.

---

## 7. Sunday Wash Day

On Sundays (`date +%u` returns `7`):
1. Run: `bash /home/matthewdewstowe/.openclaw/workspace/scripts/prune-sessions.sh`
2. Archive memory files older than 7 days: `cd /home/matthewdewstowe/.openclaw/workspace/memory && for f in $(ls *.md | sort | head -n -7); do gzip "$f"; done`
3. Vacuum SQLite: `sqlite3 /home/matthewdewstowe/.openclaw/workspace/data/openclaw.db "VACUUM;"`
4. Alert Matthew: `🧹 Sunday wash done — sessions pruned, old memory compressed, DB vacuumed.`
5. Log one concise note in today's memory file
