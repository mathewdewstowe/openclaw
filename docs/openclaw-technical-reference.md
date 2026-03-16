# OpenClaw Technical Reference — Matthew Dewstowe
## A Complete Guide to Configuration, Architecture, and Everything Built

**Document version:** 1.0  
**Generated:** 16 March 2026  
**Author:** OpenClaw AI Agent  
**Purpose:** Exhaustive technical reference for the OpenClaw deployment built for Matthew Dewstowe — covering architecture, configuration, all workflows, the automation pipeline, memory systems, infrastructure, and the roadmap to 80% automation.

---

## Table of Contents

1. [What is OpenClaw?](#part-1-what-is-openclaw)
2. [The Workspace Structure](#part-2-the-workspace-structure)
3. [Memory Architecture — The Technical Detail](#part-3-memory-architecture)
4. [The Heartbeat System](#part-4-the-heartbeat-system)
5. [Infrastructure Deep Dive](#part-5-infrastructure-deep-dive)
6. [The Workflow Architecture](#part-6-the-workflow-architecture)
7. [The Automation Pipeline — Lead Gen to Deal](#part-7-the-automation-pipeline)
8. [SEO and Content Strategy](#part-8-seo-and-content-strategy)
9. [VC Portfolio Intelligence](#part-9-vc-portfolio-intelligence)
10. [The Meta-Agent Vision](#part-10-the-meta-agent-vision)
11. [Configuration Reference](#part-11-configuration-reference)
12. [What's Next — Blockers and Roadmap](#part-12-whats-next)

---

## Part 1: What is OpenClaw?

### Architecture Overview

OpenClaw is a self-hosted AI agent runtime. Unlike cloud-based AI tools where your data transits external servers, OpenClaw runs entirely on your own hardware — in this case, a Windows 11 machine running WSL2 (Windows Subsystem for Linux 2) with Ubuntu. The AI model itself (Anthropic Claude) is accessed via API, but all orchestration, memory, tooling, scheduling, and automation logic runs locally.

The architecture can be summarised in three layers:

```
┌─────────────────────────────────────────────────────┐
│  INTERFACE LAYER                                     │
│  Slack DM ←→ OpenClaw Gateway ←→ Claude API         │
├─────────────────────────────────────────────────────┤
│  AGENT LAYER                                         │
│  Session management, tool calls, memory reads,       │
│  cron scheduler, skill execution, subagents          │
├─────────────────────────────────────────────────────┤
│  INFRASTRUCTURE LAYER                                │
│  WSL2/Ubuntu, SQLite, Node.js dashboard,             │
│  Cloudflare tunnel, n8n, Google Workspace,           │
│  Apollo, Pipedrive, Readwise                         │
└─────────────────────────────────────────────────────┘
```

The **Gateway** is the persistent OpenClaw daemon that listens for incoming Slack messages, routes them to a new session, injects workspace context (SOUL.md, AGENTS.md, USER.md, injected workspace files), sends the message to the Claude API, streams the response back to Slack, and executes any tool calls returned in the response.

### How It Differs from Cloud AI Tools

| Feature | ChatGPT / Claude.ai | OpenClaw (self-hosted) |
|---|---|---|
| Data storage | On vendor servers | Local machine only |
| Context window | Fixed, no persistence | Memory files persist across all sessions |
| Scheduled tasks | Not available | Native cron scheduler |
| Custom tools | Limited plugins | Any shell/Python/Node tool |
| Integrations | Pre-built connectors | Any API you can script |
| Cost | Monthly subscription | Pay-per-token (API) only |
| Behaviour customisation | Prompt only | Full SOUL.md, AGENTS.md governance |
| Privacy | Vendor processes all data | Your hardware, your data |

### The Self-Hosted Advantage

**Data control:** Nothing about Matthew's business, prospects, deals, or communications is stored on a third-party AI platform. The Apollo prospect data, Pipedrive deals, LinkedIn interactions, and Readwise highlights all stay on the local machine.

**Cost at scale:** Cloud AI assistants charge per seat or per message at scale. At heavy usage (50+ Slack messages per day, 8 cron jobs, background agents), OpenClaw costs only the Anthropic API tokens consumed — typically a fraction of equivalent SaaS pricing.

**Customisation depth:** The agent's personality (SOUL.md), operating rules (AGENTS.md), long-term memory (MEMORY.md), and skill suite are all editable. You can change how the agent thinks, what it prioritises, and how it handles ambiguous situations — at the source level, not just through system prompts.

**Composability:** OpenClaw tools can call any shell command, Python script, Node.js service, or external API. There's no vendor lock-in for integrations.

### How Sessions Work

Every conversation in Slack creates a new **session**. A session is a stateless context window that includes:

1. The injected workspace files (SOUL.md, AGENTS.md, USER.md, TOOLS.md, IDENTITY.md — and MEMORY.md for main sessions)
2. The incoming message(s)
3. All tool call results from within that session
4. The agent's response stream

Sessions do **not** share memory with each other natively. This is why the file-based memory architecture exists — to give the agent continuity across sessions. Each session reads the memory files at the start, works within that context, and writes any important state back to files or SQLite before the session ends.

Cron jobs spawn **isolated sessions** — they don't carry main session history and run with a potentially different model or thinking configuration. This is intentional: isolation prevents cron jobs from being confused by conversational context.

Session files accumulate in the OpenClaw session store. The `prune-sessions.sh` script (and the Session Pruner cron job) trims files exceeding 300KB to prevent storage bloat.

### How the Slack Interface Connects

The flow is:

```
Matthew sends Slack DM
        ↓
Slack API → OpenClaw Gateway (running as Linux service)
        ↓
Gateway injects workspace context + routes to Claude
        ↓
Claude processes message, returns tool calls / text
        ↓
Gateway executes tool calls (shell, file read/write, API calls)
        ↓
Results fed back to Claude for final response
        ↓
Gateway streams response back to Slack DM
```

The gateway runs as a persistent systemd-style service. It uses the OpenClaw configuration at `~/.openclaw/openclaw.json` to know which Slack workspace to connect to, which model to use, and which plugins/tools are enabled.

---

## Part 2: The Workspace Structure

The workspace lives at `/home/matthewdewstowe/.openclaw/workspace`. Every file here is either read by the agent at session start, written during sessions, or both.

### Root-Level Files

#### `MEMORY.md`
The agent's long-term memory. Read at the start of every **main session** (direct Slack DMs with Matthew). Not loaded in subagents, cron jobs, or shared contexts — by design, to prevent personal context leaking into isolated tasks.

What belongs in MEMORY.md:
- Key facts about Matthew, his businesses, and his goals
- Active projects and their current status
- Decisions made and the reasoning behind them
- Lessons learned (e.g., "Apollo rate limits at 1 req/sec — always throttle")
- Blockers and their resolution status
- Standing preferences (communication style, tool preferences)
- Important context that would otherwise be lost between sessions

What does NOT belong:
- Raw logs (those go in daily notes)
- Secrets/credentials (those go in environment or config)
- Transient state (that goes in JSON files or SQLite)

The agent can read, edit, and update MEMORY.md freely during main sessions. It's treated as a living document — curated over time, not append-only.

#### `SOUL.md`
The agent's personality and behavioural constitution. Defines:
- Core values (genuinely helpful, opinionated, resourceful)
- Communication style (concise, no filler phrases, direct)
- Boundaries (what requires permission vs. what can be done freely)
- Vibe (not a corporate drone, not a sycophant)

SOUL.md is the highest-level behavioural instruction. If SOUL.md says "be direct and skip filler", that overrides any tendency to open with "Great question!".

#### `AGENTS.md`
The operating manual. Defines:
- Session startup sequence (read SOUL.md, USER.md, daily notes, MEMORY.md)
- Memory management rules (what to write where, when to update MEMORY.md)
- Heartbeat behaviour (when to reach out vs. stay quiet)
- Safety rules (trash > rm, ask before external actions)
- Group chat etiquette
- Tool usage principles

AGENTS.md is read at every session start and governs procedural behaviour — the *how* of working, as opposed to SOUL.md's *who*.

#### `TOOLS.md`
Environment-specific notes. Not skill logic (that's in the skills directory) but machine-specific details: SSH hosts, device names, API endpoint quirks, anything that would differ between deployments. Currently contains notes on the WSL2 environment and tool availability.

#### `IDENTITY.md`
The agent's identity configuration — name, creature type, vibe, emoji signature, avatar path. This is filled in during first-run setup and referenced when the agent introduces itself or signs off messages.

#### `USER.md`
Everything about Matthew:
- Name, pronouns, timezone (Europe/London, GMT/BST)
- Location (Tenby, Wales; travels to Cardiff weekly; also works from London)
- Professional context (founder, exited Innovantage → Bullhorn; AI-native product leader; building Sonesse/Umified; running Nth Layer consulting)
- Neurodivergent profile (Autistic, ADHD, OCD)
- Communication preferences (concise, structured, direct; values efficiency and execution over theory)

USER.md is loaded in main sessions so the agent can calibrate tone and context without asking every time.

#### `HEARTBEAT.md`
The always-on monitoring checklist. The agent receives a heartbeat message every ~30 minutes from OpenClaw's built-in heartbeat system. When it arrives, the agent reads HEARTBEAT.md and executes whatever is listed. Current checklist items include:
- Dashboard keep-alive ping
- Cloudflare tunnel health check
- n8n service health check
- Neuro accountability check-ins (time-triggered)
- Session file bloat check
- SQLite nightly flush

See Part 4 for the full heartbeat architecture.

### `memory/` Directory

#### `memory/YYYY-MM-DD.md` (Daily Notes)
Created fresh each day. These are the working notes of the session — raw logs of what was done, what was discussed, what was decided. More granular than MEMORY.md but scoped to a single day.

Written during sessions whenever:
- A task is completed
- A decision is made
- Something significant happens
- An error is encountered (with resolution notes)
- A context shift occurs

The agent reads today's and yesterday's daily notes at session start to establish recent context.

#### `memory/neuro-checkin.json`
Tracks the state of morning and evening neuro check-ins. Structure:

```json
{
  "date": "2026-03-16",
  "morning_sent": true,
  "morning_sent_at": "2026-03-16T07:30:00Z",
  "evening_sent": false,
  "evening_sent_at": null
}
```

This prevents duplicate check-ins if the heartbeat fires multiple times in the same morning/evening window.

#### `memory/uptime-log.json`
Tracks uptime incidents as they occur. JSON array of incident objects. This is the in-memory backing store for the `uptime_incidents` SQLite table — incidents are logged here first, then flushed to SQLite during the nightly cycle.

#### `memory/linkedin-alerts-queue.json`
A queue of pending LinkedIn post alerts that haven't been delivered to Matthew yet. The LinkedIn Post Monitor populates this queue; the heartbeat (or next main session) dequeues and sends alerts.

Structure:
```json
[
  {
    "contact_name": "Jane Smith",
    "contact_linkedin_url": "https://linkedin.com/in/janesmith",
    "post_url": "https://linkedin.com/posts/...",
    "post_snippet": "Excited to announce...",
    "queued_at": "2026-03-16T14:22:00Z",
    "alerted": false
  }
]
```

#### `memory/pipedrive-stages.json`
The Pipedrive pipeline configuration — stage IDs, stage names, and their order. Cached locally so the Apollo Sequence Poller can map stage names to IDs without an API call every time.

#### `memory/vc-sheet.json`
Results from the VC portfolio scraper. Contains the 499 firms scraped, their portfolio URLs, and the 131 portfolio companies successfully extracted. Used to feed the Google Sheet and track scraper progress.

### `data/` Directory

#### `data/openclaw.db`
The SQLite database — the persistent backbone of all tracking. See Part 3 for full schema documentation.

### `scripts/` Directory

#### `scripts/apollo-sequence-poller.py`
Polls Apollo sequences every 30 minutes, detects replies, creates Pipedrive deals for hot leads, and adds them to LinkedIn monitoring. Full pipeline covered in Part 7.

#### `scripts/linkedin-post-monitor.py`
Uses the Proxycurl API to check for new LinkedIn posts from monitored contacts. Compares against `linkedin_posts_seen` table, queues new posts to `memory/linkedin-alerts-queue.json`, and logs interactions to `linkedin_interactions` table.

#### `scripts/prune-sessions.sh`
Shell script that identifies OpenClaw session files exceeding 300KB and removes them. Prevents unbounded storage growth from long-running sessions.

```bash
#!/bin/bash
SESSION_DIR="${HOME}/.openclaw/sessions"
LIMIT_KB=300

find "$SESSION_DIR" -name "*.json" -size +${LIMIT_KB}k | while read f; do
  echo "Pruning: $f ($(du -k "$f" | cut -f1)KB)"
  rm "$f"
done
```

### `skills/` Directory

Six SEO/marketing skills installed from `coreyhainesco/marketingskills`. Each skill is a directory containing a `SKILL.md` file with full instructions the agent follows when that skill is invoked. See Part 8 for detail.

### `docs/` Directory

Documentation generated by the agent, including this document.

---

## Part 3: Memory Architecture — The Technical Detail

### Why Stateless AI Fails

Every Claude session starts with zero memory of previous sessions. If you tell Claude something important on Monday, it has no recollection on Tuesday. For a personal AI agent handling ongoing projects, this is catastrophic:

- The agent asks questions it's already been answered
- Context about working rules is lost
- Project status has to be re-explained constantly
- Decisions made in one session evaporate before the next

The file-based memory architecture is the solution. It creates four distinct memory layers, each serving a different purpose.

### Layer 1: Long-Term Memory (MEMORY.md)

**Purpose:** Curated facts, context, and lessons that should persist indefinitely.  
**When read:** Every main session (Slack DM with Matthew).  
**When written:** During main sessions when something significant warrants long-term retention.  
**Format:** Freeform Markdown, human-readable.  
**Size target:** Keep under ~2,000 tokens. Over time, review and compress — remove outdated facts, consolidate related items.

This is the agent's "brain" — not a log, but a distilled understanding of who Matthew is, what he's building, and what matters.

### Layer 2: Working Memory (Daily Files)

**Purpose:** Raw operational notes for today and yesterday.  
**When read:** Every session (reads today's + yesterday's files).  
**When written:** Throughout the day as work progresses.  
**Format:** Chronological Markdown diary.  
**Size target:** No strict limit — they're pruned after ~7-14 days.

Daily files capture the *what happened today* — completed tasks, tool outputs, API responses, errors encountered. They give the agent enough context to pick up where it left off mid-day without needing MEMORY.md to be updated constantly.

### Layer 3: Operational State (JSON Files)

**Purpose:** Machine-readable state for specific systems.  
**When read:** By the specific system that manages it (heartbeat for check-in state, pipeline scripts for queues).  
**When written:** Immediately when state changes.  
**Format:** JSON (structured, parseable by scripts and agent alike).

The JSON files are the operational nervous system. They prevent duplicate actions (don't send the morning check-in twice), queue work between sessions (LinkedIn alerts accumulate until the agent can deliver them), and cache remote data (Pipedrive stage IDs).

### Layer 4: Persistent Structured Data (SQLite)

**Purpose:** Queryable historical data for reporting, deduplication, and analytics.  
**When read:** On-demand via SQL queries.  
**When written:** Nightly flush + real-time writes from scripts.  
**Format:** Relational tables with typed columns and indexes.

SQLite is the institutional memory — the long-term record of everything that has happened. It answers questions like "How many Apollo contacts have replied this week?" or "Which LinkedIn posts has the agent already engaged with?" without needing to parse files.

Full schema:

```sql
-- Uptime incident tracking
CREATE TABLE uptime_incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL,
    down_at TEXT NOT NULL,       -- ISO 8601 timestamp
    restored_at TEXT,            -- NULL if still down
    cause TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Neuro check-in audit trail
CREATE TABLE neuro_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,          -- YYYY-MM-DD
    type TEXT NOT NULL,          -- 'morning' or 'evening'
    sent_at TEXT NOT NULL,
    notes TEXT
);

-- Task management
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, done, deferred
    source TEXT,                    -- 'heartbeat', 'cron', 'manual', etc.
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

-- LinkedIn engagement log
CREATE TABLE linkedin_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_name TEXT,
    prospect_linkedin_url TEXT,
    post_url TEXT,
    action TEXT,                 -- 'like', 'comment', 'share'
    comment_text TEXT,
    apollo_list TEXT,
    interacted_at TEXT DEFAULT (datetime('now'))
);

-- Apollo activity log
CREATE TABLE apollo_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_name TEXT,
    list_id TEXT,
    action TEXT,                 -- 'sequence_added', 'email_sent', etc.
    contact_count INTEGER,
    ran_at TEXT DEFAULT (datetime('now')),
    notes TEXT
);

-- Apollo sequence contacts → Pipedrive deal tracking
CREATE TABLE apollo_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence_id TEXT,
    sequence_name TEXT,
    contact_id TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_linkedin_url TEXT,
    company_name TEXT,
    status TEXT,                 -- Apollo sequence status
    replied INTEGER DEFAULT 0,   -- Boolean
    reply_sentiment TEXT,        -- 'positive', 'negative', 'neutral'
    pipedrive_deal_id TEXT,
    pipedrive_stage TEXT,
    added_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- LinkedIn monitoring list (prospects to watch)
CREATE TABLE linkedin_monitoring (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_name TEXT,
    contact_linkedin_url TEXT,
    company_name TEXT,
    apollo_contact_id TEXT,
    pipedrive_deal_id TEXT,
    monitoring_active INTEGER DEFAULT 1,  -- Boolean
    last_checked TEXT,
    last_post_url TEXT,
    added_at TEXT DEFAULT (datetime('now'))
);

-- Deduplication table for LinkedIn posts
CREATE TABLE linkedin_posts_seen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_linkedin_url TEXT,
    post_url TEXT UNIQUE,        -- Prevents duplicate alerts
    post_snippet TEXT,
    seen_at TEXT DEFAULT (datetime('now')),
    engaged INTEGER DEFAULT 0,
    engagement_type TEXT         -- 'like', 'comment', 'none'
);
```

### The Evening Flush Cycle

Every night at 11PM, the Daily Backup cron job runs. As part of this cycle:

1. Any JSON state that accumulated during the day is reconciled into SQLite
2. Completed tasks in `tasks` table are marked with `completed_at`
3. `linkedin_posts_seen` is deduped (any duplicates from the day cleaned out)
4. SQLite is vacuumed to reclaim fragmented space
5. The workspace git repo is committed with a timestamped message
6. Session files over 300KB are pruned

### Sunday Wash Day — Context Hygiene

Every Sunday at 10AM, the Sunday Wash Day workflow runs:

1. **Session prune:** All session files over 300KB deleted
2. **Memory compression:** Recent daily notes reviewed; significant items promoted to MEMORY.md; old daily notes (>14 days) deleted
3. **SQLite vacuum:** `VACUUM;` and `ANALYZE;` run on `data/openclaw.db`
4. **JSON cleanup:** Stale entries removed from queue files (alerts more than 7 days old, resolved incidents)
5. **git commit:** Full workspace committed with "Sunday wash day" message

This keeps the workspace lean and prevents context bloat from degrading session quality over time.

---

## Part 4: The Heartbeat System

### How Heartbeats Work Technically

OpenClaw's built-in heartbeat system sends a periodic message to the agent (approximately every 30 minutes). The message content is configurable — by default it instructs the agent to read HEARTBEAT.md and follow its checklist.

The heartbeat is not a cron job (those are scheduled tasks with fixed times). It's a continuous pulse — the agent's always-on awareness loop. The distinction matters: cron jobs are precision-timed, isolated tasks. The heartbeat is the agent keeping itself informed and the infrastructure healthy between human conversations.

When a heartbeat fires:
1. OpenClaw opens a new session
2. Workspace context is injected (SOUL.md, AGENTS.md, USER.md)
3. The heartbeat message is sent to Claude
4. Claude reads HEARTBEAT.md
5. Claude works through the checklist
6. If everything is healthy, replies `HEARTBEAT_OK` (no Slack notification)
7. If something needs attention, sends a Slack message to Matthew

The quiet default (`HEARTBEAT_OK`) is intentional — Matthew should not be pinged every 30 minutes unless there's something worth knowing.

### HEARTBEAT.md Checklist

```markdown
## Heartbeat Checklist

### Always check:
- [ ] Dashboard ping: GET https://82ebc6e5-eeae-4532-8331-325d82345028.cfargotunnel.com/health
  - If not 200: alert Matthew, attempt restart
- [ ] Cloudflare tunnel: `cloudflared tunnel info matthew-dashboard`
  - If tunnel not healthy: attempt `cloudflared tunnel run matthew-dashboard &`
- [ ] n8n: `curl -s http://localhost:5678/healthz`
  - If not healthy: alert Matthew

### Time-gated checks (do NOT repeat if already done today):
- 07:30 weekdays: Send morning neuro check-in (check memory/neuro-checkin.json first)
- 21:00 daily: Send evening debrief prompt (check neuro-checkin.json)
- 23:00 daily: Confirm session pruner ran; flush SQLite if needed

### Periodic (rotate, do 1-2 per heartbeat):
- Check email for urgent items (skip if checked <2h ago)
- Check calendar for events in next 24h
- Dequeue linkedin-alerts-queue.json and send any pending alerts
- Check uptime-log.json for unresolved incidents

### Night silence (23:00 - 08:00):
- Skip all outgoing Slack messages unless critical
- Infrastructure checks still run silently
```

### Dashboard Keep-Alive (Full Flow)

The Node.js dashboard on port 3737 can go idle or crash. The keep-alive flow:

```
Heartbeat fires
    ↓
Agent: GET https://[tunnel-url]/health
    ↓
If HTTP 200 → log "dashboard OK", continue
If timeout/error:
    ↓
    Agent: curl http://localhost:3737/health (direct, bypass tunnel)
    ↓
    If local 200 → tunnel issue, not dashboard
        → cloudflared tunnel restart
    If local error → dashboard is down
        → cd /path/to/dashboard && node server.js &
        → Wait 5 seconds
        → Retry health check
        → Alert Matthew if still down
```

### Cloudflare Tunnel Keep-Alive (Full Flow)

The tunnel runs as a persistent process. If it dies:

```
Heartbeat: cloudflared tunnel info matthew-dashboard
    ↓
If shows active connections → HEALTHY
If shows no connections / error:
    ↓
    Check: ps aux | grep cloudflared
    ↓
    If process running → possibly connectivity issue, log and monitor
    If process not running:
        → cloudflared tunnel run matthew-dashboard > /tmp/cloudflared.log 2>&1 &
        → Wait 10 seconds
        → Retry: cloudflared tunnel info matthew-dashboard
        → Alert Matthew if still not healthy
```

### Neuro Accountability Check-Ins

The heartbeat manages two daily check-ins for Matthew's neurodivergent accountability support:

**Morning (7:30AM weekdays):**
- Check `memory/neuro-checkin.json` — if `morning_sent: true` for today, skip
- If not sent: send Slack message with morning structure prompt
- Update `neuro-checkin.json` with `morning_sent: true, morning_sent_at: <timestamp>`
- Log to `neuro_checkins` SQLite table

**Evening (9PM daily):**
- Same logic for evening
- Evening prompt focuses on day review, what was accomplished, and planning for tomorrow

The check-in messages are designed for ADHD/autism support — structured, clear, non-judgmental, action-oriented.

### Session Bloat Monitor

Each heartbeat (or daily, via the 11PM cron) checks session file sizes:

```bash
find ~/.openclaw/sessions -name "*.json" -size +300k -exec ls -lh {} \;
```

Any files found are flagged. The session pruner (cron job at 11PM) handles deletion. If files are growing unusually large mid-day, the heartbeat can trigger an early prune.

### SQLite Flush

The nightly flush at 11PM:

```bash
sqlite3 ~/.openclaw/workspace/data/openclaw.db "VACUUM; ANALYZE;"
```

Plus any pending JSON → SQLite reconciliation (uptime incidents, task completions).

### The Self-Healing Principle

The heartbeat system embodies a self-healing design philosophy: the agent should detect and recover from common failures autonomously, only escalating to Matthew when human intervention is genuinely required. The hierarchy:

1. **Auto-recover silently:** Most service restarts
2. **Auto-recover + log:** Tunnel restarts, dashboard restarts
3. **Alert + attempt recovery:** Persistent failures after one retry
4. **Alert + wait for instructions:** Failures requiring infrastructure changes (DNS, Windows-side issues, API key expiry)

---

## Part 5: Infrastructure Deep Dive

### WSL2/Ubuntu Setup

OpenClaw runs on Ubuntu 22.04 LTS inside WSL2 on Windows 11. Key details:

- **WSL distro:** Ubuntu (accessible via `wsl -d Ubuntu`)
- **User:** matthewdewstowe
- **OpenClaw binary:** Installed globally via npm as `openclaw`
- **Service management:** OpenClaw gateway runs as a background process (not systemd — WSL2 doesn't support systemd by default)
- **Networking:** WSL2 uses a NAT'd network; localhost from Windows maps to WSL's localhost

**Critical WSL networking note:** LinkedIn browser automation requires a full WSL2 network stack reset if the networking gets into a broken state. Fix: run `wsl --shutdown` in Windows PowerShell. This restarts the entire WSL2 VM and resets networking. After shutdown, relaunch WSL, restart OpenClaw gateway, and restart Cloudflare tunnel.

**Starting OpenClaw after a WSL restart:**
```bash
# In WSL terminal:
openclaw gateway start

# Restart Cloudflare tunnel:
cloudflared tunnel run matthew-dashboard > /tmp/cloudflared.log 2>&1 &

# Verify n8n is running:
curl http://localhost:5678/healthz
```

### The Node.js Dashboard

A custom-built web dashboard running on port 3737 with JWT authentication and a SQLite backend.

**Features:**
- Real-time view of all SQLite tables
- Uptime incident log
- Task management board
- Apollo sequence tracker
- LinkedIn monitoring status
- Neuro check-in history

**Authentication:**
- JWT tokens with configurable expiry
- Login endpoint at `/auth/login`
- All API endpoints require `Authorization: Bearer <token>` header

**Key endpoints:**

```
GET  /health                  → {"status": "ok", "uptime": 12345}
POST /auth/login              → {"token": "eyJ..."}
GET  /api/tasks               → Paginated task list
POST /api/tasks               → Create task
PUT  /api/tasks/:id           → Update task status
GET  /api/uptime              → Uptime incidents
GET  /api/sequences           → Apollo sequences
GET  /api/linkedin/monitoring → LinkedIn monitoring contacts
GET  /api/linkedin/posts      → Posts seen log
```

**Public URL:**  
`https://82ebc6e5-eeae-4532-8331-325d82345028.cfargotunnel.com`

This is the raw Cloudflare tunnel URL. Once DNS is configured (see Part 12), it will also be accessible at `missioncontrol.nthlayer.co.uk`.

### Cloudflare Tunnel

Cloudflare Tunnel (cloudflared) creates an outbound-only tunnel from the WSL2 machine to Cloudflare's edge. No inbound ports need to be opened on the router or firewall.

**Tunnel details:**
- Tunnel name: `matthew-dashboard`
- Tunnel ID: `82ebc6e5-eeae-4532-8331-325d82345028`
- Config file: `~/.cloudflared/config.yml`

**Config file:**
```yaml
tunnel: 82ebc6e5-eeae-4532-8331-325d82345028
credentials-file: /home/matthewdewstowe/.cloudflared/82ebc6e5-eeae-4532-8331-325d82345028.json

ingress:
  - hostname: missioncontrol.nthlayer.co.uk
    service: http://localhost:3737
  - hostname: n8n.nthlayerbot.co.uk
    service: http://localhost:5678
  - service: http_status:404
```

**DNS setup required:**
Both `missioncontrol.nthlayer.co.uk` and `n8n.nthlayerbot.co.uk` need CNAME records pointing to the tunnel UUID at `cfargotunnel.com`. This requires the nthlayer.co.uk domain to be managed by Cloudflare (or have a CNAME added). The nthlayerbot.co.uk domain needs its nameservers pointed to Cloudflare — currently a blocker.

**Starting the tunnel:**
```bash
cloudflared tunnel run matthew-dashboard
# Or as background process:
cloudflared tunnel run matthew-dashboard > /tmp/cloudflared.log 2>&1 &
```

**Checking tunnel status:**
```bash
cloudflared tunnel info matthew-dashboard
cloudflared tunnel list
```

### n8n

n8n is an open-source workflow automation tool running on port 5678. It's the visual workflow layer — handling complex multi-step automations with error handling, retry logic, and branching.

**Installation:** n8n is installed via npm globally and runs as a persistent process.

**Starting n8n:**
```bash
n8n start
# Or in background:
n8n start > /tmp/n8n.log 2>&1 &
```

**Accessing n8n UI:**
- Local: `http://localhost:5678`
- Remote (once DNS is set): `https://n8n.nthlayerbot.co.uk`

**API access:**
```bash
# List all workflows
curl -H "X-N8N-API-KEY: n8n_api_2db515ffaad4360337c1706629a388d842eec93c" \
  http://localhost:5678/api/v1/workflows

# Activate a workflow
curl -X PATCH \
  -H "X-N8N-API-KEY: n8n_api_2db515ffaad4360337c1706629a388d842eec93c" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' \
  http://localhost:5678/api/v1/workflows/{workflow_id}
```

**Important:** No n8n workflows are currently active. Matthew's approval is required before activating any workflow. Review each workflow in the n8n UI at `http://localhost:5678` before enabling.

### Connected APIs

#### Google Workspace (via `gog` CLI)

The `gog` CLI provides access to Gmail, Calendar, Drive, Sheets, Contacts, and Docs. Authentication uses a stored keyring (password: `openclaw`).

**Common commands:**
```bash
# Gmail
GOG_KEYRING_PASSWORD=openclaw gog gmail list --account matthewdewstowe@gmail.com
GOG_KEYRING_PASSWORD=openclaw gog gmail send --to user@example.com --subject "..." --body "..."

# Calendar
GOG_KEYRING_PASSWORD=openclaw gog calendar list --days 7

# Sheets
GOG_KEYRING_PASSWORD=openclaw gog sheets read --id SHEET_ID

# Drive
GOG_KEYRING_PASSWORD=openclaw gog drive list
```

#### Apollo.io API

Apollo is the outbound sales platform — prospect database, email sequences, and engagement tracking.

**Base URL:** `https://api.apollo.io/v1`  
**Authentication:** API key in request header or body  
**Rate limit:** 1 request per second (strictly enforced — Apollo bans keys that exceed this)

**Key endpoints used:**
```bash
# List sequences
curl "https://api.apollo.io/v1/emailer_campaigns?api_key=V5ZsfKQ0dsCMCBum2wKEdA"

# Get sequence contacts
curl "https://api.apollo.io/v1/emailer_campaign_memberships?api_key=...&emailer_campaign_id=..."

# Get lists (labels)
curl "https://api.apollo.io/v1/labels?api_key=V5ZsfKQ0dsCMCBum2wKEdA"
```

**Prospect lists (18 total, key ones):**

| List Name | Contacts |
|---|---|
| CEO - SaaS Segment & Industries - UK | 647 |
| CEO - Hiring Product | 591 |
| Operating Partners & Value Creation UK | 484 |
| PE Portfolio Leadership | 296 |
| Umified - Conversational AI - CEO & Product | 268 |
| PE - Talent Partners - UK | 50 |
| Sonesse - Deloitte - Teams | 39 |

#### Readwise API

Readwise stores Matthew's book highlights, article annotations, and reading notes.

**Base URL:** `https://readwise.io/api/v2`  
**Authentication:** Token in Authorization header  
**Current data:** 130 highlights

```bash
curl -H "Authorization: Token mbQiKrmFxjmrymFwir29u050WFYF2EMhsvsJaFq1rjtRAFLmwl" \
  "https://readwise.io/api/v2/highlights/?page_size=20"
```

Used by the Readwise Daily Summary n8n workflow (7:30PM) to surface relevant highlights.

#### Pipedrive CRM API

Pipedrive is the CRM where hot leads (positive Apollo sequence replies) are tracked as deals.

**Status: API key EXPIRED — needs refresh**

The current key `404d1d1701fbe3462d0c5ba9626b6383e1ecdfa3` returns 401. To get a new key: go to Pipedrive → Settings → API → Generate new token.

**Base URL:** `https://api.pipedrive.com/v1`

**Key operations:**
```bash
# Create a deal
curl -X POST "https://api.pipedrive.com/v1/deals?api_token=NEW_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Company - Contact Name", "stage_id": STAGE_ID}'

# Update deal stage
curl -X PUT "https://api.pipedrive.com/v1/deals/DEAL_ID?api_token=NEW_KEY" \
  -d '{"stage_id": NEW_STAGE_ID}'
```

#### Proxycurl (Pending)

Proxycurl provides LinkedIn profile and post data via API. Currently not set up — API key needed from nubela.co. Required for the `linkedin-post-monitor.py` script to function.

Once active:
```bash
# Get recent posts from a LinkedIn profile
curl -H "Authorization: Bearer PROXYCURL_API_KEY" \
  "https://nubela.co/proxycurl/api/linkedin/company/posts?linkedin_profile_url=https://linkedin.com/in/..."
```

---

## Part 6: The Workflow Architecture

### OpenClaw Crons vs n8n — The Right Tool for Each Job

Both OpenClaw's native cron scheduler and n8n can run scheduled tasks. The design principle is:

**Use OpenClaw crons when:**
- The task needs the agent's intelligence (natural language understanding, decision-making)
- It's primarily a Slack interaction (briefings, debriefs, check-ins)
- Timing can be approximate (±5 minutes is fine)
- The task benefits from workspace context (SOUL.md, AGENTS.md)

**Use n8n when:**
- The task is purely mechanical (data transformation, API-to-API flows)
- Complex error handling and retry logic is needed
- Visual workflow debugging matters
- The task involves multiple external services with branching logic
- Exact timing is important

In practice, many workflows exist in both places during the current build phase. Once n8n workflows are reviewed and activated, some OpenClaw crons will be deprecated in favour of the n8n equivalent.

### OpenClaw Cron Jobs (Active)

Cron configuration lives at: `~/.openclaw/cron/jobs.json`

```json
[
  {
    "id": "daily-briefing",
    "schedule": "30 8 * * 1-5",
    "prompt": "Read HEARTBEAT.md. It's 8:30AM on a weekday. Deliver the morning briefing: summarise urgent emails, calendar for today, top 3 priorities from MEMORY.md. Keep it punchy.",
    "channel": "slack",
    "model": "anthropic/claude-sonnet-4-6"
  },
  {
    "id": "evening-debrief",
    "schedule": "0 21 * * *",
    "prompt": "It's 9PM. Deliver the evening debrief: what got done today (check today's daily notes), what's on tomorrow's agenda, any blockers to flag. Then ask Matthew how the day went.",
    "channel": "slack"
  },
  {
    "id": "daily-backup",
    "schedule": "0 23 * * *",
    "prompt": "Run the daily backup: prune session files over 300KB using scripts/prune-sessions.sh, vacuum SQLite at data/openclaw.db, then git add -A && git commit -m 'Daily backup [date]' in the workspace.",
    "channel": "slack"
  },
  {
    "id": "daily-job-agent",
    "schedule": "0 8 * * 1-5",
    "prompt": "Check for relevant fractional CPO / AI product leadership job opportunities. Search Google for 'fractional CPO UK site:linkedin.com OR site:otta.com OR site:workwithgusto.com' and summarise any strong matches for Matthew.",
    "channel": "slack"
  },
  {
    "id": "sonesse-seo-tutorial",
    "schedule": "0 9 * * 1-5",
    "prompt": "Use the seo-audit skill. Check if there are pending tutorial items for sonesse.ai. If so, run the next item from the tutorial queue. Otherwise, pick the highest-priority SEO action for sonesse.ai and execute it.",
    "channel": "slack"
  },
  {
    "id": "community-monitor",
    "schedule": "0 8 * * 1-5",
    "prompt": "Search for recent posts in AI/product communities relevant to Matthew's businesses (Sonesse, Nth Layer, Umified). Check Hacker News, Reddit r/artificial, ProductHunt. Summarise anything relevant in 3-5 bullets.",
    "channel": "slack"
  },
  {
    "id": "recipe-alert",
    "schedule": "0 11 * * *",
    "prompt": "Find and send a recipe suggestion for today. Consider what's seasonal, what Matthew might enjoy, and keep it practical — under 30 minutes if possible. Format as a brief recipe card.",
    "channel": "slack"
  },
  {
    "id": "session-pruner",
    "schedule": "0 23 * * *",
    "prompt": "Run: bash scripts/prune-sessions.sh. Report how many files were pruned and total space recovered.",
    "channel": "slack"
  }
]
```

### n8n Workflows — All 18 (Detail)

All workflows are **inactive** pending Matthew's approval. To activate: review in n8n UI at `http://localhost:5678`, then enable with the toggle or via API.

| # | Name | Schedule | Purpose |
|---|---|---|---|
| 1 | 📅 Daily Briefing | 8:30AM Weekdays | Morning briefing: email summary, calendar, priorities |
| 2 | 💪 Morning Workout Email | 7:00AM Daily | Send workout plan for the day to Gmail |
| 3 | 🧠 Neuro Morning Check-in | 7:30AM Weekdays | ADHD/autism accountability check-in via Slack |
| 4 | 📚 Readwise Daily Summary | 7:30PM Daily | Surface 3-5 highlights from Readwise relevant to current projects |
| 5 | 🌙 Evening Debrief | 9:00PM Daily | End-of-day review, tomorrow prep |
| 6 | 💾 Daily Backup | 11:00PM Daily | Git commit, SQLite vacuum, session prune |
| 7 | 🍽️ Daily Recipe Alert | 11:00AM Daily | Recipe suggestion |
| 8 | 💼 Daily Job Agent | 8:00AM Weekdays | Fractional CPO / AI product job search |
| 9 | 🔍 Community Monitor | 8:00AM Weekdays | AI/product community post monitoring |
| 10 | ✍️ Sonesse Content Engine | 9:00AM Weekdays | Generate/queue content for Sonesse.ai |
| 11 | 🎓 Sonesse SEO Tutorial | 9:00AM Weekdays | Execute next SEO action from tutorial queue |
| 12 | 🎯 Apollo Lead Gen | 9:00AM Weekdays | Pull new prospects from Apollo lists, add to sequences |
| 13 | 🔄 Apollo Sequence Monitor → Pipedrive | Every 30 min | Poll sequences for replies, create Pipedrive deals |
| 14 | 💼 LinkedIn Engagement Monitor | 10:00AM Weekdays | Check LinkedIn for engagement on Matthew's posts |
| 15 | 💼 LinkedIn Post Monitor | 9/11AM, 1/3/5PM Weekdays | Monitor prospects' LinkedIn posts via Proxycurl |
| 16 | 🟢 Uptime Monitor | Every 15 min | Ping dashboard + n8n + tunnel, log incidents |
| 17 | 🧹 Session Pruner | 11:00PM Daily | Prune session files > 300KB |
| 18 | 🧹 Sunday Wash Day | 10:00AM Sundays | Full context hygiene: sessions, memory, SQLite, git |

### The Apollo → Pipedrive → LinkedIn Pipeline

This is the core commercial automation. Full end-to-end:

```
Apollo prospect lists (18 lists, ~3,000 contacts)
         ↓
Apollo Sequence Monitor runs every 30 min
         ↓
apollo-sequence-poller.py:
  1. GET /emailer_campaign_memberships for each active sequence
  2. Compare against apollo_sequences SQLite table
  3. New contacts? Insert into apollo_sequences
  4. Status changed? Update apollo_sequences.status
  5. Reply detected? (status = 'replied')
         ↓
If replied AND sentiment = positive:
  6. POST /deals to Pipedrive → create deal
  7. Update apollo_sequences.pipedrive_deal_id
  8. INSERT into linkedin_monitoring (add to monitoring list)
         ↓
LinkedIn Post Monitor runs 5x per day (9am/11am/1pm/3pm/5pm):
  9. For each active contact in linkedin_monitoring:
     GET Proxycurl API → recent posts
  10. Compare against linkedin_posts_seen table
  11. New post? INSERT into linkedin_posts_seen
  12. Queue alert → memory/linkedin-alerts-queue.json
         ↓
Heartbeat / main session:
  13. Dequeue linkedin-alerts-queue.json
  14. Send Slack alert to Matthew with post link + draft comment options
         ↓
Matthew approves engagement:
  15. Agent executes: like / comment on LinkedIn post
  16. Log to linkedin_interactions table
  17. Update linkedin_posts_seen.engaged = 1
```

### The Approval-Before-Activation Rule

Nothing in n8n runs without Matthew's explicit approval. The workflow:

1. Agent or subagent builds the n8n workflow
2. Workflow is created via API but left **inactive**
3. Matthew is briefed on what the workflow does, what it costs (API calls), and what it touches
4. Matthew reviews in the n8n UI at `http://localhost:5678`
5. Matthew gives approval ("yes, activate that one")
6. Agent activates via API or Matthew enables in UI

This rule exists because activated workflows run autonomously. A workflow that sends emails to Apollo prospects or posts to LinkedIn cannot be unreviewed.

---

## Part 7: The Automation Pipeline — Lead Gen to Deal

### Apollo Search and Prospect Lists

Apollo.io is the prospecting database. The current 18 lists represent different ICP (Ideal Customer Profile) segments for Sonesse, Umified, and Nth Layer:

**For Sonesse (AI-powered language learning):**
- Deloitte Teams — specific enterprise accounts
- Conversational AI CEOs — industry peers and potential partners
- SaaS CEOs — potential customers scaling global teams

**For Nth Layer (consulting):**
- PE Portfolio Leadership — PE-backed companies needing fractional CPO
- Operating Partners — PE operating partners who recommend consultants
- PE Talent Partners — talent decision-makers at PE firms

**For general BD:**
- CEOs Hiring Product — companies actively building product teams (warm signal)

Apollo prospect lists are built using Apollo's search filters (job title, company size, location, industry, technologies used, funding stage). Lists are static at point of creation but can be refreshed.

### Sequence Polling and Reply Detection

The `apollo-sequence-poller.py` script runs via the n8n Apollo Sequence Monitor workflow every 30 minutes.

```python
import requests
import sqlite3
import time

APOLLO_API_KEY = "V5ZsfKQ0dsCMCBum2wKEdA"
DB_PATH = "/home/matthewdewstowe/.openclaw/workspace/data/openclaw.db"
RATE_LIMIT = 1  # seconds between requests

def get_sequences():
    resp = requests.get(
        "https://api.apollo.io/v1/emailer_campaigns",
        params={"api_key": APOLLO_API_KEY}
    )
    return resp.json().get("emailer_campaigns", [])

def get_sequence_contacts(sequence_id):
    time.sleep(RATE_LIMIT)  # Respect rate limit
    resp = requests.get(
        "https://api.apollo.io/v1/emailer_campaign_memberships",
        params={"api_key": APOLLO_API_KEY, "emailer_campaign_id": sequence_id}
    )
    return resp.json().get("emailer_campaign_memberships", [])

def upsert_contact(conn, contact, sequence):
    # Insert or update based on contact_id
    conn.execute("""
        INSERT INTO apollo_sequences 
        (sequence_id, sequence_name, contact_id, contact_name, contact_email,
         contact_linkedin_url, company_name, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(contact_id) DO UPDATE SET
            status = excluded.status,
            updated_at = excluded.updated_at
    """, (
        sequence["id"], sequence["name"],
        contact["contact"]["id"],
        contact["contact"]["name"],
        contact["contact"]["email"],
        contact["contact"].get("linkedin_url"),
        contact["contact"].get("organization_name"),
        contact["status"]
    ))

def check_for_replies(conn):
    # Find contacts who replied and don't have a Pipedrive deal yet
    cursor = conn.execute("""
        SELECT * FROM apollo_sequences 
        WHERE replied = 1 AND pipedrive_deal_id IS NULL
    """)
    return cursor.fetchall()
```

### Pipedrive Deal Creation Flow

When a positive reply is detected:

```python
def create_pipedrive_deal(contact_name, company_name, pipedrive_api_key):
    # Load stage config
    with open("/home/matthewdewstowe/.openclaw/workspace/memory/pipedrive-stages.json") as f:
        stages = json.load(f)
    
    qualified_stage_id = stages["qualified"]["id"]  # First real stage after inbound
    
    deal = requests.post(
        f"https://api.pipedrive.com/v1/deals?api_token={pipedrive_api_key}",
        json={
            "title": f"{company_name} — {contact_name}",
            "stage_id": qualified_stage_id,
            "status": "open"
        }
    ).json()
    
    return deal["data"]["id"]
```

### LinkedIn Monitoring and Post Alerting

Once a contact is in `linkedin_monitoring`, the post monitor watches for new posts:

```python
def check_linkedin_posts(contact_linkedin_url, proxycurl_key):
    resp = requests.get(
        "https://nubela.co/proxycurl/api/linkedin/person/posts",
        params={"linkedin_profile_url": contact_linkedin_url},
        headers={"Authorization": f"Bearer {proxycurl_key}"}
    )
    return resp.json().get("posts", [])

def queue_alert(contact_name, post_url, post_snippet):
    queue_path = "/home/matthewdewstowe/.openclaw/workspace/memory/linkedin-alerts-queue.json"
    
    with open(queue_path, "r") as f:
        queue = json.load(f)
    
    queue.append({
        "contact_name": contact_name,
        "post_url": post_url,
        "post_snippet": post_snippet[:200],
        "queued_at": datetime.now().isoformat(),
        "alerted": False
    })
    
    with open(queue_path, "w") as f:
        json.dump(queue, f, indent=2)
```

### The Approve-and-Action Engagement Model

No LinkedIn engagement happens autonomously. The flow:

1. Alert arrives in Slack: "Jane Smith posted: 'We're exploring conversational AI for our EMEA team...' — [View Post]"
2. Agent prepares 2-3 draft comment options
3. Matthew selects or edits
4. Agent executes the engagement
5. Logs to `linkedin_interactions` and updates `linkedin_posts_seen`

This preserves Matthew's voice and relationship integrity while eliminating the manual work of monitoring LinkedIn.

### Rate Limiting Strategy

| Platform | Limit | Implementation |
|---|---|---|
| LinkedIn (browser) | 20 actions/hour | Counter in SQLite; check before each action |
| Apollo API | 1 request/second | `time.sleep(1)` between all API calls |
| Browser automation | 2-8 second delays | Random sleep between page actions |
| Anthropic API | 1 concurrent session | OpenClaw enforces this natively |
| Proxycurl | Per plan limits | Check remaining credits before bulk runs |
| Pipedrive API | 80 req/2 min | Batch operations; check headers for remaining |

---

## Part 8: SEO and Content Strategy

### The marketingskills SEO Skill Suite

Six skills installed from the `coreyhainesco/marketingskills` repository into `workspace/skills/`. Each skill follows the OpenClaw AgentSkills spec — a `SKILL.md` file containing full operational instructions the agent reads and follows when the skill is invoked.

**Installation:**
```bash
cd /home/matthewdewstowe/.openclaw/workspace/skills
git clone https://github.com/coreyhainesco/marketingskills .
# Or copy individual skill directories
```

### The Six SEO Skills

#### `seo-audit`
Technical SEO diagnosis. When invoked, the agent:
1. Crawls the target URL using the browser tool
2. Checks meta tags, title tags, H1 structure
3. Tests page load speed (core web vitals)
4. Checks for broken links, duplicate content, canonical tags
5. Reviews robots.txt and sitemap.xml
6. Produces a prioritised issue list with fix instructions

**Invoke:** "Run an SEO audit on sonesse.ai"

#### `ai-seo`
Optimise for AI Overviews, ChatGPT, Perplexity, and other LLM-powered search. The shift: buyers increasingly ask AI assistants for recommendations rather than typing into Google. Being cited by LLMs requires:
- Clear, factual, structured content (not SEO-fluff)
- Schema markup that AI crawlers parse
- Being mentioned on authoritative third-party sites
- Answering specific questions in clear language

For Sonesse, this means: when a VP of Learning asks Perplexity "what's the best AI language learning tool for enterprises?", Sonesse should appear in the answer.

#### `programmatic-seo`
Build keyword-targeted pages at scale using templates and data. For Sonesse this could mean:
- "AI language learning for [industry]" pages (50+ industries)
- "[Language] learning for remote teams" pages
- Comparison pages: "Sonesse vs Duolingo for enterprise"

#### `site-architecture`
URL structure, navigation design, sitemaps, and internal linking. For Sonesse.ai: plan the page hierarchy so product pages, use-case pages, and blog content are properly interconnected for both users and crawlers.

#### `schema-markup`
Structured data implementation (JSON-LD). Rich results in Google — FAQ schema, product schema, review schema. Also critical for AI citation: LLMs parse structured data more reliably than prose.

#### `content-strategy`
Content planning: topic clusters, editorial calendar, pillar pages. For Sonesse: map the content needed to own the "enterprise language learning" topic space.

### Why AI SEO Matters for Sonesse

Sonesse's buyers (L&D leads, HR directors, CLOs) are early AI adopters. They already use ChatGPT and Perplexity to research tools. Traditional Google SEO (rank #1 for "enterprise language learning software") still matters, but AI search is growing faster than traditional search.

The practical implication: Sonesse needs to be **cited as a credible source** across the web — case studies, industry analyses, review sites — so that when an LLM synthesises an answer about enterprise language learning, Sonesse is in its training data and retrieval corpus.

### Content Engine: Sonesse Tutorial Queue

The Sonesse SEO Tutorial cron job (9AM weekdays) and the Sonesse Content Engine n8n workflow work together. The tutorial queue is a prioritised list of SEO actions for sonesse.ai, executed one per day.

Current planned audit targets:
- **sonesse.ai** — full technical SEO audit + AI SEO review
- **nthlayer.co.uk** — SEO presence for Nth Layer consulting

### Planned SEO Action Sequence

1. Technical audit: sonesse.ai (find and fix blocking issues)
2. AI SEO audit: is Sonesse cited by major LLMs?
3. Schema markup: add product + FAQ schema to sonesse.ai
4. Site architecture: plan content hub structure
5. Content strategy: identify 20 target topics with search volume
6. Programmatic SEO: build location/industry pages at scale
7. Repeat for nthlayer.co.uk

---

## Part 9: VC Portfolio Intelligence

### How the Scraper Works

The VC Portfolio Intelligence system builds a database of UK and European VC/PE portfolio companies for targeted outreach.

**Step 1: VC firm list via Apollo**
Apollo's investor database and company search returns VC/PE firms matching criteria (UK/Europe, stage, focus sector). These are exported to a Google Sheet (ID: `1Dh3Xx_IMm2i0xqmZLKuBJC-14DB-NcLBWFIPaXt7TqE`).

**Step 2: Portfolio company URLs via web scraping**
For each firm, the agent visits the firm's portfolio page (typically `/portfolio` or `/companies`) and extracts:
- Portfolio company names
- Website URLs
- Brief descriptions
- Sectors

**Step 3: Results stored**
Results in `memory/vc-sheet.json` and pushed back to the Google Sheet via `gog sheets`.

```python
# Simplified scraper logic
def scrape_portfolio(firm_url, browser_tool):
    portfolio_url = firm_url.rstrip('/') + '/portfolio'
    html = browser_tool.fetch(portfolio_url)
    
    # Extract company links using heuristics
    companies = []
    for link in extract_links(html):
        if is_portfolio_company_link(link):
            companies.append({
                "name": link.text,
                "url": link.href,
                "parent_firm": firm_url
            })
    
    return companies
```

### Scale: 499 Firms, 131 Portfolio Companies

- **499** VC/PE firms loaded into the Google Sheet
- **131** portfolio companies successfully scraped (26% yield)
- Target: ~1,000+ portfolio companies once JS-rendering issue is solved

The 26% yield is entirely explained by the JS-rendering bottleneck.

### Why JS-Rendering Is the Bottleneck

Most modern VC portfolio pages are built on React, Next.js, or similar frameworks. The actual company data is loaded via JavaScript after the initial HTML response. Simple HTTP fetch (`curl`, `requests`, `web_fetch`) only gets the shell — the JS hasn't run, so the portfolio companies never appear.

The browser tool (Playwright) can handle JS rendering, but it's slow (~5-10 seconds per page) and can't be parallelised easily without hitting bot detection.

### Puppeteer Upgrade Path

Full solution: a headless Puppeteer/Playwright scraper running as a Node.js service:

```javascript
// puppeteer-scraper.js (proposed)
const puppeteer = require('puppeteer');

async function scrapePortfolio(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set realistic headers
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...');
  
  await page.goto(url + '/portfolio', { waitUntil: 'networkidle2' });
  
  // Wait for portfolio grid to load
  await page.waitForSelector('.portfolio-company', { timeout: 10000 })
    .catch(() => null);  // Graceful if selector not found
  
  const companies = await page.$$eval('.portfolio-company', nodes =>
    nodes.map(n => ({
      name: n.querySelector('h3')?.textContent,
      url: n.querySelector('a')?.href,
      description: n.querySelector('p')?.textContent
    }))
  );
  
  await browser.close();
  return companies;
}
```

This would run as a background service exposed at `http://localhost:3800/scrape?url=...` and called by the agent when needed.

### Using This Data for Outreach

**For Sonesse:** VC portfolio companies are often scaling rapidly — hiring in new markets, expanding languages, building global teams. These are prime Sonesse prospects. Target: portfolio companies in the 50-500 employee range that recently raised or expanded internationally.

**For Nth Layer:** PE-backed portfolio companies actively need fractional CPO/product leadership during transition periods. The portfolio list, combined with LinkedIn data on current product org structure, identifies companies without a CPO — prime consulting targets.

The Google Sheet becomes the master outreach database:
1. Portfolio companies identified
2. Decision-maker LinkedIn profiles added (via Proxycurl)
3. Apollo sequences created for the relevant ICP
4. Pipeline flows automatically from here

---

## Part 10: The Meta-Agent Vision

### Current State: ~15% Automated

Of the total work involved in Matthew's day — briefings, lead gen, LinkedIn monitoring, content creation, SEO, deal tracking, research — approximately 15% currently runs autonomously. The rest still requires direct human initiation or completion.

What's running today:
- ✅ Daily briefings (automated delivery)
- ✅ Evening debrief (automated prompt)
- ✅ Session pruning and backup (automated)
- ✅ Recipe alerts (automated)
- ✅ Apollo sequence polling (automated, Pipedrive creation blocked by expired key)
- ⏳ LinkedIn monitoring (pending Proxycurl)
- ⏳ n8n workflows (built, pending activation approval)
- ❌ LinkedIn engagement (manual — approve-and-action)
- ❌ Content publishing (manual)
- ❌ Deal progression (manual)

### Target: 80% Automated

The 80% target doesn't mean fully autonomous. It means the agent handles the mechanical, repetitive, monitoring, and data-processing work — and Matthew only touches decision points.

| Category | Current | Target |
|---|---|---|
| Morning briefing | 100% auto | 100% auto |
| Email triage | 0% | 70% (summarise + draft replies) |
| LinkedIn monitoring | 0% | 100% auto |
| LinkedIn engagement | 0% | 80% (draft, Matthew approves) |
| Apollo prospecting | 40% | 90% |
| Pipedrive deal updates | 0% | 80% |
| Content drafting | 0% | 70% (draft + queue) |
| SEO execution | 10% | 60% |
| VC research | 20% | 80% |
| Deal progression | 0% | 50% (flag actions, Matthew approves) |

### The Approve-and-Action Model

The automation philosophy: the agent does the legwork, Matthew makes the calls.

This is not fully autonomous AI — it's AI-amplified human judgment. Matthew doesn't scale by working more hours; he scales by approving more actions per hour. The agent's job is to present well-researched, well-formatted, ready-to-execute options at decision points, not to make business decisions unilaterally.

Example flow (LinkedIn engagement):
1. Agent: "Jane Smith (CPO, Acme Corp — on Apollo sequence, replied positively last week) just posted about AI implementation challenges. Here are 3 comment options: [A] [B] [C]. Or reply 'skip'."
2. Matthew: "B"
3. Agent: Executes comment, logs to SQLite, continues monitoring.

Total Matthew time: 3 seconds. Total agent time: 2 minutes of research and drafting.

### What a Meta-Agent Orchestrator Looks Like

At full maturity, the orchestration layer manages multiple specialist subagents:

```
META-AGENT (main session)
├── BRIEFING AGENT (cron 8:30AM)
│   └── Email + Calendar + News synthesis
├── LEAD GEN AGENT (cron 9AM)
│   ├── Apollo sequence runner
│   └── New prospect research
├── LINKEDIN AGENT (5x daily)
│   ├── Post monitor (Proxycurl)
│   └── Engagement queue manager
├── CONTENT AGENT (cron 9AM)
│   ├── Sonesse blog drafts
│   └── SEO action executor
├── DEAL AGENT (every 30 min)
│   ├── Pipedrive stage tracker
│   └── Follow-up prompt generator
└── INFRASTRUCTURE AGENT (every 30 min)
    ├── Uptime monitor
    └── Cost/usage tracker
```

Each subagent is a short-lived session with a focused prompt. The meta-agent (main session) receives their outputs, presents consolidated summaries to Matthew, and coordinates approvals.

### The Feedback Loop: SQLite as Institutional Memory

SQLite is not just a log — it's the institutional memory that makes the system smarter over time.

**Example feedback loops:**

- `linkedin_interactions` → which comments get positive responses → inform future comment drafts
- `apollo_sequences` → which sequences get best reply rates → inform which lists to prioritise
- `tasks` + `completed_at` → Matthew's throughput patterns → better workload planning
- `uptime_incidents` → failure patterns → proactive infrastructure hardening

Over time, the agent can run queries like:
```sql
-- Which Apollo sequences have the best reply rate?
SELECT sequence_name, 
       COUNT(*) as total,
       SUM(replied) as replied,
       ROUND(100.0 * SUM(replied) / COUNT(*), 1) as reply_rate
FROM apollo_sequences
GROUP BY sequence_name
ORDER BY reply_rate DESC;

-- LinkedIn engagement success rate by action type
SELECT engagement_type,
       COUNT(*) as total_actions,
       SUM(CASE WHEN followed_up = 1 THEN 1 ELSE 0 END) as converted
FROM linkedin_interactions
GROUP BY engagement_type;
```

These insights feed back into sequence design, messaging strategy, and prioritisation.

### The Compounding Effect Over Time

Each week of data makes the system more valuable:
- Week 1: Basic automation running, data starts accumulating
- Month 1: Patterns emerge, first optimisations possible
- Month 3: Reply rate benchmarks established, content performance visible
- Month 6: Full feedback loops operational, system is self-tuning

By Q2 2026, with full activation, the system should be surfacing 10+ qualified leads per month with minimal manual input.

---

## Part 11: Configuration Reference

### openclaw.json Structure

The main OpenClaw configuration at `~/.openclaw/openclaw.json`:

```json
{
  "agent": {
    "model": "anthropic/claude-sonnet-4-6",
    "thinking": "adaptive",
    "workspace": "/home/matthewdewstowe/.openclaw/workspace"
  },
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "signingSecret": "...",
      "mainUser": "U0AKBPS9K5E"
    }
  },
  "gateway": {
    "bind": "0.0.0.0:8080",
    "publicUrl": "http://localhost:8080"
  },
  "plugins": {
    "cron": {
      "enabled": true,
      "configPath": "/home/matthewdewstowe/.openclaw/cron/jobs.json"
    },
    "heartbeat": {
      "enabled": true,
      "intervalMinutes": 30,
      "prompt": "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK."
    }
  },
  "tools": {
    "exec": { "enabled": true, "security": "allowlist" },
    "browser": { "enabled": true },
    "web_search": { "enabled": true },
    "web_fetch": { "enabled": true }
  },
  "keyring": {
    "password": "openclaw"
  }
}
```

### MEMORY.md Template and Best Practices

```markdown
# Memory — Matthew Dewstowe

## Matthew
- Founder, exited Innovantage → Bullhorn (2023)
- Building: Sonesse (AI language learning), Umified (conversational AI), Nth Layer (consulting)
- Location: Tenby, Wales. Travels Cardiff weekly, London occasionally.
- Neurodivergent: Autistic, ADHD, OCD. Needs structured, direct comms.
- Timezone: Europe/London (GMT/BST)

## Current Priorities (Q1 2026)
1. 10 hot leads for Sonesse
2. Close 1 Nth Layer deal
3. 100% LinkedIn post engagement with prospects
4. 100% infrastructure uptime

## Active Blockers
- Pipedrive API key expired — needs refresh at pipedrive.com
- Proxycurl key needed — nubela.co
- nthlayerbot.co.uk nameservers → Cloudflare

## Key Infrastructure
- Dashboard: https://82ebc6e5-eeae-4532-8331-325d82345028.cfargotunnel.com
- n8n: http://localhost:5678 (all workflows inactive, pending approval)
- SQLite: ~/workspace/data/openclaw.db

## Standing Rules
- Never activate n8n workflows without Matthew's approval
- Always rate-limit: Apollo 1 req/sec, LinkedIn 20/hr
- Unanswered questions → next day's task list
- Background agents for all long-running tasks

## Lessons Learned
- WSL networking breaks LinkedIn automation → fix: `wsl --shutdown` in PowerShell
- Apollo bans keys that exceed 1 req/sec — always sleep(1) between calls
- Cloudflare tunnel survives WSL restarts if restarted manually after
```

### HEARTBEAT.md Template

```markdown
## Heartbeat Checklist

### Infrastructure (every heartbeat)
- Ping dashboard: GET https://[tunnel-url]/health
- Check tunnel: cloudflared tunnel info matthew-dashboard
- Check n8n: curl http://localhost:5678/healthz

### Time-gated (check neuro-checkin.json first)
- 07:30 weekdays: morning check-in
- 21:00 daily: evening debrief
- 23:00 daily: confirm backup ran

### Rotate (1-2 per heartbeat, check lastChecks timestamps)
- Email check (skip if <2h ago)
- Calendar (upcoming in 24h)
- LinkedIn alert queue dequeue
- Uptime incident review

### Night silence: 23:00-08:00 (no Slack unless critical)
```

### Cron Job Format

Cron jobs in `~/.openclaw/cron/jobs.json` use standard 5-part cron expressions:

```
* * * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0=Sun, 1=Mon, ..., 5=Fri, 6=Sat)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)
```

Examples:
- `30 8 * * 1-5` — 8:30AM Monday to Friday
- `0 21 * * *` — 9PM every day
- `0 23 * * *` — 11PM every day
- `0 9 * * 0` — 9AM Sundays

Adding a new cron job:
```bash
# Edit the cron config
nano ~/.openclaw/cron/jobs.json

# Restart gateway to pick up changes
openclaw gateway restart
```

### n8n Workflow Creation via API

```bash
# Create a new workflow
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "X-N8N-API-KEY: n8n_api_2db515ffaad4360337c1706629a388d842eec93c" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New Workflow",
    "nodes": [...],
    "connections": {...},
    "settings": {},
    "active": false
  }'

# List all workflows and their active status
curl http://localhost:5678/api/v1/workflows \
  -H "X-N8N-API-KEY: n8n_api_2db515ffaad4360337c1706629a388d842eec93c" \
  | jq '.data[] | {id: .id, name: .name, active: .active}'

# Activate a specific workflow (Matthew must approve first)
curl -X PATCH http://localhost:5678/api/v1/workflows/WORKFLOW_ID \
  -H "X-N8N-API-KEY: n8n_api_2db515ffaad4360337c1706629a388d842eec93c" \
  -H "Content-Type: application/json" \
  -d '{"active": true}'

# Execute a workflow manually (one-shot test)
curl -X POST http://localhost:5678/api/v1/workflows/WORKFLOW_ID/execute \
  -H "X-N8N-API-KEY: n8n_api_2db515ffaad4360337c1706629a388d842eec93c"
```

---

## Part 12: What's Next — Blockers and Roadmap

### Active Blockers

#### 1. WSL Networking — LinkedIn Browser Automation

**Problem:** WSL2's virtual network interface periodically gets into a broken state. Browser automation (Playwright/Puppeteer) can't reach external sites.

**Symptoms:** Browser tool times out on LinkedIn. `curl` from WSL reaches external sites fine, but Playwright hangs.

**Fix:** Open PowerShell on Windows host and run:
```powershell
wsl --shutdown
```
Then relaunch WSL, restart OpenClaw gateway, and restart the Cloudflare tunnel.

**Permanent fix (pending):** Configure WSL2 to use a fixed DNS server (`nameserver 8.8.8.8` in `/etc/resolv.conf`) and prevent WSL from overwriting it:
```bash
# /etc/wsl.conf
[network]
generateResolvConf = false

# /etc/resolv.conf
nameserver 8.8.8.8
nameserver 1.1.1.1
```

#### 2. Pipedrive API Key Expired

**Problem:** The stored key returns 401 Unauthorized. All Pipedrive deal creation is blocked.

**Fix:**
1. Log in to Pipedrive at `app.pipedrive.com`
2. Go to: Settings → Personal preferences → API
3. Copy the existing token (or generate a new one)
4. Update `MEMORY.md` with the new key
5. Update `scripts/apollo-sequence-poller.py` line that sets `PIPEDRIVE_API_KEY`
6. Test: `curl "https://api.pipedrive.com/v1/deals?api_token=NEW_KEY&limit=1"`

**Impact of fixing:** Apollo → Pipedrive pipeline completes. Hot leads become trackable deals.

#### 3. Proxycurl API Key Needed

**Problem:** `linkedin-post-monitor.py` is built and ready but can't run without a Proxycurl API key.

**Fix:**
1. Go to `nubela.co/proxycurl`
2. Sign up / log in
3. Get API key from dashboard
4. Update `memory/proxycurl-config.json` (or set as environment variable)
5. Test: `curl -H "Authorization: Bearer KEY" "https://nubela.co/proxycurl/api/linkedin/person?linkedin_profile_url=..."`

**Cost:** Proxycurl charges per API call (~$0.01/profile lookup). With 50 monitored contacts checked 5x per day = ~$2.50/day. Budget accordingly.

**Impact of fixing:** LinkedIn post monitoring activates. The full Apollo → Pipedrive → LinkedIn pipeline completes.

#### 4. nthlayerbot.co.uk DNS

**Problem:** n8n is accessible at `http://localhost:5678` but not at `https://n8n.nthlayerbot.co.uk` because the domain's nameservers aren't pointing to Cloudflare.

**Fix:**
1. Log in to domain registrar for nthlayerbot.co.uk
2. Change nameservers to Cloudflare's:
   - `chad.ns.cloudflare.com`
   - `erin.ns.cloudflare.com`
3. In Cloudflare DNS, add CNAME: `n8n` → `82ebc6e5-eeae-4532-8331-325d82345028.cfargotunnel.com`
4. Propagation: 24-48 hours

**Impact:** n8n accessible remotely (not just localhost). Can manage workflows from mobile or remote machines.

### Granola Integration Options

Granola is Matthew's AI meeting notes tool. Integration options:

**Option A: Granola webhooks (if available)**
If Granola supports outbound webhooks, configure them to POST meeting summaries to the n8n webhook endpoint → process into daily notes and tasks.

**Option B: Email-based integration**
Configure Granola to email meeting notes to a dedicated Gmail label. The Daily Briefing workflow picks up and surfaces them.

**Option C: Manual import**
Matthew pastes Granola summaries into Slack; agent processes into structured notes and extracts action items → tasks table.

**Option D: Granola API (future)**
If Granola releases an API, build a dedicated n8n workflow to poll for new meeting notes.

### LinkedIn Automation Options

Three viable approaches:

**Browser automation (current plan for engagement):**
- Uses Playwright to control a real Chrome session
- Most authentic behaviour (real browser, real session)
- Slowest and most brittle
- Requires WSL networking fix
- Rate limit: 20 actions/hour

**Proxycurl (current plan for monitoring):**
- API-based post data retrieval
- No browser required, fast and reliable
- Can't post/comment — read-only
- Per-call cost

**PhantomBuster:**
- SaaS tool specifically for LinkedIn automation
- Built-in rate limiting and safety features
- Monthly cost (~$59-$139/month)
- Good for bulk connection + follow sequences
- Best option if browser automation proves too fragile

**Recommendation:** Use Proxycurl for monitoring + PhantomBuster for engagement sequences at scale. Keep browser automation as fallback for edge cases.

### The Full 80% Automation Roadmap

**Week 1 (immediate):**
- [ ] Refresh Pipedrive API key
- [ ] Get Proxycurl API key
- [ ] Fix WSL networking (add static DNS config)
- [ ] Review and activate top 5 n8n workflows

**Week 2:**
- [ ] Activate Apollo Sequence Monitor → Pipedrive
- [ ] Activate LinkedIn Post Monitor
- [ ] Fix nthlayerbot.co.uk DNS
- [ ] Test full lead gen pipeline end-to-end

**Month 1:**
- [ ] All 18 n8n workflows reviewed and activated (or rejected)
- [ ] LinkedIn engagement queue operational
- [ ] VC scraper Puppeteer upgrade
- [ ] Granola integration (email-based minimum)
- [ ] First 5 Pipedrive deals created via pipeline

**Month 2:**
- [ ] PhantomBuster evaluation for LinkedIn at scale
- [ ] Readwise integration into content strategy (use highlights in Sonesse content)
- [ ] SEO audit completed for sonesse.ai + nthlayer.co.uk
- [ ] Programmatic SEO pages planned and first batch built

**Month 3:**
- [ ] 80% automation target assessment
- [ ] SQLite analytics: reply rates, engagement success, uptime stats
- [ ] Pipeline optimisation based on 60 days of data
- [ ] Q2 goal setting with agent

### The Long-Term Vision

At full maturity, Matthew's daily OpenClaw touchpoints should be:
- **5 minutes, morning:** Review briefing, approve today's agent actions
- **5 minutes, midday:** Review LinkedIn alert queue, approve any comments
- **5 minutes, evening:** Review debrief, confirm anything that needs attention

Everything else — monitoring, prospecting, content drafting, SEO execution, deal tracking, research — runs in the background with outputs queued for approval.

This is the compounding value of a self-hosted AI agent: it gets better with every week of operation, every decision made, every piece of data written to SQLite. The system doesn't forget. Matthew does.

---

## Appendix A: Command Quick Reference

```bash
# OpenClaw gateway
openclaw gateway start
openclaw gateway stop
openclaw gateway restart
openclaw gateway status

# Cloudflare tunnel
cloudflared tunnel run matthew-dashboard
cloudflared tunnel info matthew-dashboard
cloudflared tunnel list

# n8n
n8n start
curl http://localhost:5678/healthz

# Dashboard
curl http://localhost:3737/health

# SQLite
sqlite3 ~/.openclaw/workspace/data/openclaw.db
sqlite3 ~/.openclaw/workspace/data/openclaw.db ".tables"
sqlite3 ~/.openclaw/workspace/data/openclaw.db "SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10;"
sqlite3 ~/.openclaw/workspace/data/openclaw.db "VACUUM; ANALYZE;"

# Google Workspace (gog CLI)
GOG_KEYRING_PASSWORD=openclaw gog gmail list --account matthewdewstowe@gmail.com
GOG_KEYRING_PASSWORD=openclaw gog calendar list --days 3
GOG_KEYRING_PASSWORD=openclaw gog sheets read --id 1Dh3Xx_IMm2i0xqmZLKuBJC-14DB-NcLBWFIPaXt7TqE

# Session prune
bash ~/.openclaw/workspace/scripts/prune-sessions.sh

# Git backup
cd ~/.openclaw/workspace && git add -A && git commit -m "Manual backup $(date +%Y-%m-%d)"
```

## Appendix B: File Locations Quick Reference

| File | Path | Purpose |
|---|---|---|
| Main config | `~/.openclaw/openclaw.json` | OpenClaw runtime config |
| Cron jobs | `~/.openclaw/cron/jobs.json` | Scheduled task definitions |
| Workspace | `~/.openclaw/workspace/` | All agent files |
| MEMORY.md | `workspace/MEMORY.md` | Long-term memory |
| SOUL.md | `workspace/SOUL.md` | Agent personality |
| AGENTS.md | `workspace/AGENTS.md` | Operating instructions |
| HEARTBEAT.md | `workspace/HEARTBEAT.md` | Heartbeat checklist |
| USER.md | `workspace/USER.md` | About Matthew |
| TOOLS.md | `workspace/TOOLS.md` | Environment notes |
| IDENTITY.md | `workspace/IDENTITY.md` | Agent identity |
| Daily notes | `workspace/memory/YYYY-MM-DD.md` | Daily working notes |
| Neuro check-in state | `workspace/memory/neuro-checkin.json` | Check-in dedup state |
| LinkedIn alert queue | `workspace/memory/linkedin-alerts-queue.json` | Pending alerts |
| Pipedrive stages | `workspace/memory/pipedrive-stages.json` | Stage ID cache |
| VC sheet data | `workspace/memory/vc-sheet.json` | Scraper results |
| SQLite database | `workspace/data/openclaw.db` | All structured data |
| Apollo poller | `workspace/scripts/apollo-sequence-poller.py` | Sequence monitoring |
| LinkedIn monitor | `workspace/scripts/linkedin-post-monitor.py` | Post monitoring |
| Session pruner | `workspace/scripts/prune-sessions.sh` | Session cleanup |
| SEO skills | `workspace/skills/` | marketingskills suite |
| Cloudflare config | `~/.cloudflared/config.yml` | Tunnel ingress config |

## Appendix C: API Credentials Summary

| Service | Key/Token | Status | Notes |
|---|---|---|---|
| Anthropic (Claude) | In openclaw.json | ✅ Active | claude-sonnet-4-6 |
| Google Workspace | In gog keyring | ✅ Active | gog CLI |
| Apollo.io | `V5ZsfKQ0dsCMCBum2wKEdA` | ✅ Active | 1 req/sec limit |
| Readwise | `mbQiKrmFxjmrymFwir29u050WFYF2EMhsvsJaFq1rjtRAFLmwl` | ✅ Active | 130 highlights |
| Pipedrive | `404d1d1701fbe3462d0c5ba9626b6383e1ecdfa3` | ❌ EXPIRED | Needs refresh |
| Proxycurl | Not yet obtained | ⏳ Pending | From nubela.co |
| n8n API | `n8n_api_2db515ffaad4360337c1706629a388d842eec93c` | ✅ Active | Local API |

---

*Document generated by OpenClaw AI Agent — 16 March 2026*  
*For updates, ask the agent: "Update the technical reference document with [changes]"*
