# OpenClaw Case Study: Building an AI-Native Operating System for a Founder
### Matthew Dewstowe — Fractional CPO, Founder of Umified/Sonesse, Nth Layer Consulting
### March 2026

---

## Executive Summary

Most AI assistants are reactive. They wait to be asked, answer a question, and forget everything by morning.

Matthew Dewstowe — a neurodivergent founder and fractional CPO running two businesses simultaneously — needed something different. He needed an agent that wakes up knowing who he is, what he's building, what happened yesterday, and what matters today. An agent that monitors, fixes, and acts — without being asked.

This is the story of how Matthew built that system using OpenClaw: an open, self-hosted AI agent platform. In a matter of weeks, he went from a blank workspace to a fully operational AI command centre with persistent memory, automated workflows, proactive monitoring, and a growing library of agents running 24 hours a day.

The goal is ambitious: an **approve-and-action model** where Matthew approves decisions and the agent executes everything else — targeting 80% automation of his operational work.

---

## Part 1: The Problem

Matthew is running three things simultaneously:

1. **Umified / Sonesse** — an infrastructure startup building the API layer for AI agents inside video meetings (Zoom, Teams, Google Meet)
2. **The Nth Layer** — a fractional CPO consultancy targeting PE-owned SaaS companies
3. **Daxtra** — day-job product strategy work on an AI recruitment platform

He is also neurodivergent — Autistic, ADHD, and OCD — which means he plans obsessively when engaged, struggles with repetitive or boring tasks, and burns energy quickly on low-value work.

The constraints were stark: **time and cashflow**, not ideas or capability. Every hour spent on manual outreach, email triage, status checks, or reporting was an hour not spent on building Sonesse or closing a consulting deal.

What he needed:

- A system that **remembers** everything across sessions
- Agents that **run on schedule** without being triggered
- Monitoring that **self-heals** when something breaks
- Automation that **surfaces intelligence** without dumping noise
- A single interface that works via **Slack**, from anywhere

---

## Part 2: The Platform — What OpenClaw Is

OpenClaw is a self-hosted AI agent runtime. Unlike cloud AI tools, it runs on Matthew's own machine (a Linux server inside WSL2 on Windows 11), giving him full control over data, costs, and behaviour.

The key architectural decisions that make it work:

### 2.1 Persistent Memory — The Foundation of Everything

Most AI sessions are stateless. You tell it your name, it forgets by the next conversation. OpenClaw solves this with a layered memory architecture that Matthew built deliberately:

**MEMORY.md — Long-Term Memory**
The central file that makes the agent feel like a person who knows you. It contains:
- Matthew's identity, location, neurodivergent profile
- Every business he's running (goals, ICPs, status)
- Financial reality (not paid since December, bridge cashflow needed)
- API keys and infrastructure credentials
- Personal context: his daughter Ava, his HYROX training, his commitment to stopping drinking
- Q1 goals with current status
- How he likes to be communicated with

This file is read at the start of every main session. The agent wakes up knowing who Matthew is.

**Daily Memory Files — Short-Term Working Memory**
`memory/YYYY-MM-DD.md` files capture what happened each day: decisions made, problems found, things to follow up. These are the agent's raw working notes — like a human's daily journal.

**Heartbeat State Files — Operational Continuity**
JSON files tracking when services were last checked, when check-ins were sent, uptime incident history. These survive session restarts and ensure no duplicate sends or missed checks.

**SQLite Database — Persistent Structured Data**
All tracking data is flushed to `workspace/data/openclaw.db` nightly:
- `uptime_incidents` — every service outage, cause, and restoration time
- `neuro_checkins` — morning and evening accountability messages
- `tasks` — open items with status
- `linkedin_interactions` — every prospect engagement logged
- `apollo_activity` — lead generation runs and results

This is the difference between an AI that forgets and one that builds an institutional memory over time.

### 2.2 The Heartbeat — Proactive Without Being Asked

Every 30 minutes, OpenClaw runs a heartbeat check. Rather than a simple ping, the heartbeat executes a prioritised checklist:

1. **Dashboard keep-alive** — checks if the Node.js dashboard is running on port 3737. If not: diagnoses the cause from logs, restarts, confirms recovery, alerts Matthew in Slack with the reason, logs to SQLite
2. **Cloudflare tunnel keep-alive** — checks if the permanent tunnel is connected. Same auto-repair flow
3. **n8n keep-alive** — confirms the workflow platform is healthy
4. **Neuro accountability** — sends morning and evening check-in messages to #claw_neuro (Matthew's personal accountability channel) if not yet sent today
5. **Session bloat monitor** — flags and prunes session files exceeding 300KB
6. **SQLite flush** — evening heartbeats write pending data to the database
7. **Sunday wash day** — weekly context hygiene: prune sessions, compress old memory, vacuum SQLite

The key design principle: **Matthew doesn't manage the system; the system manages itself.** He gets alerts when something needs his attention. Everything else is handled.

### 2.3 The Working Rules — Guardrails for Safe Automation

As the system grew, Matthew established standing rules that govern all agent behaviour:

- **Unanswered questions rule**: Any question Matthew doesn't reply to within the same day gets added to tomorrow's task list automatically
- **Rate throttling**: All external APIs have mandatory delays — LinkedIn max 20 interactions/hour with randomised delays; Apollo max 1 req/sec; browser automation 2–8s between actions; Anthropic API max 1 concurrent call with 2–3s between chained calls
- **Wash day**: Every Sunday, context is pruned, old files compressed, DB vacuumed — keeps token costs lean
- **No silent failures**: Every service failure generates a Slack alert with the root cause, not just a restart notification

---

## Part 3: The Workflows — 12 Agents Running Daily

In March 2026, Matthew deployed n8n (a workflow automation platform) on the same machine and wired it to OpenClaw. The result: 12 scheduled workflows running autonomously.

```
┌─────────────────────────────────────────────────────────────────┐
│                    n8n WORKFLOW DASHBOARD                       │
│                  http://localhost:5678                          │
│                                                                 │
│  ⏰  Schedule          🤖  Workflow                  📊 Status  │
│  ─────────────────────────────────────────────────────────────  │
│  07:00 daily          💪 Morning Workout Email        ✅ Active  │
│  07:30 daily          🧠 Neuro Morning Check-in       ✅ Active  │
│  08:00 Mon-Fri        🔍 Community Monitor            ✅ Active  │
│  08:30 Mon-Fri        📅 Daily Briefing               ✅ Active  │
│  09:00 Mon-Fri        🎯 Apollo Lead Gen              ✅ Active  │
│  09:00 Mon-Fri        ✍️  Sonesse Content Engine      ✅ Active  │
│  10:00 Mon-Fri        💼 LinkedIn Engagement          ✅ Active  │
│  19:30 daily          📚 Readwise Daily Summary       ✅ Active  │
│  21:00 daily          🌙 Evening Debrief              ✅ Active  │
│  23:00 daily          💾 Daily Backup                 ✅ Active  │
│  Every 15 min         🟢 Uptime Monitor               ✅ Active  │
│  Sunday 10:00         🧹 Sunday Wash Day              ✅ Active  │
└─────────────────────────────────────────────────────────────────┘
```

### What Each Workflow Does

**💪 Morning Workout Email (7:00 AM)**
Sends Matthew a personalised workout for the day — structured for his training goals (HYROX on 4th May 2026, CrossFit, running). Adapts to his intermediate-advanced level, 45–60 minute sessions.

**🧠 Neuro Morning Check-in (7:30 AM)**
Posts to #claw_neuro on Slack — Matthew's private accountability channel. Includes 5 genuinely positive things about him (drawn from MEMORY.md, rotated daily), 3 practical improvements for today, and reminders of his commitments: move, eat well, read, no drinking, don't bite out. Designed for ADHD/Autism support — warm, direct, never harsh.

**🔍 Community Monitor (8:00 AM weekdays)**
Searches Reddit, Hacker News, and the web for signals about meeting bots, conversational AI, Tavus, Recall.ai, and related topics. Logs relevant posts — pain points, feature requests, competitor mentions — to a Google Sheet for Matthew to review and engage with.

**📅 Daily Briefing (8:30 AM weekdays)**
Comprehensive morning brief: calendar for the day, urgent emails, goal progress, infrastructure status, one priority action. Delivered to Slack.

**🎯 Apollo Lead Gen (9:00 AM weekdays)**
Queries Apollo's API against target lists (PE portfolio companies, Sonesse ICP — CTOs, VPs Engineering, Heads of AI), enriches with LinkedIn URLs, stages prospects in Pipedrive, and logs activity to SQLite.

**✍️ Sonesse Content Engine (9:00 AM weekdays)**
Writes and publishes one tutorial from a pre-built queue of 9 topics — targeting keywords like "Tavus Teams integration", "AI meeting notes API", "meeting bot Zoom". The first: Tavus + Teams.

**💼 LinkedIn Engagement Monitor (10:00 AM weekdays)**
Monitors Apollo prospect lists for new LinkedIn posts. Surfaces them to Matthew for approval before engaging. Max 20 interactions/hour with randomised delays to avoid detection. Logs all interactions to `linkedin_interactions` table.

**📚 Readwise Daily Summary (7:30 PM)**
Fetches Matthew's latest highlights from Readwise (130 highlights connected) and posts a curated summary to #claw-reading-list on Slack.

**🌙 Evening Debrief (9:00 PM)**
Posts to #claw_neuro: did you train? did you stay clean? how were you with people? Warm, non-judgmental. Also triggers the SQLite flush of the day's data.

**💾 Daily Backup (11:00 PM)**
Git commits all workspace changes with a timestamp. Ensures nothing is lost.

**🟢 Uptime Monitor (every 15 minutes)**
Checks dashboard health via HTTP. If down: notifies OpenClaw agent, which diagnoses, restarts, and alerts with cause.

**🧹 Sunday Wash Day (10:00 AM Sundays)**
Weekly maintenance: prune bloated session files, gzip memory files older than 7 days, vacuum SQLite. Keeps the system lean.

---

## Part 4: The Infrastructure Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    MATTHEW'S STACK                          │
├─────────────────────────────────────────────────────────────┤
│  Windows 11 PC (Host)                                       │
│  └── WSL2 / Ubuntu (Linux)                                  │
│       ├── OpenClaw (AI agent runtime) — Slack interface     │
│       ├── Node.js Dashboard (port 3737)                     │
│       │    └── JWT auth, SQLite backend                     │
│       │    └── Live at: 82ebc6e5...cfargotunnel.com         │
│       ├── n8n (workflow platform) — port 5678               │
│       │    └── 12 active workflows                          │
│       │    └── Accessible via Cloudflare tunnel             │
│       ├── Cloudflare Tunnel (permanent, named)              │
│       │    └── matthew-dashboard tunnel                     │
│       │    └── Routes: missioncontrol.nthlayer.co.uk        │
│       │    └── Routes: n8n.nthlayerbot.co.uk (DNS pending)  │
│       └── SQLite DB: workspace/data/openclaw.db             │
├─────────────────────────────────────────────────────────────┤
│  External APIs Connected                                    │
│  ├── Google Workspace (Gmail, Calendar, Drive, Sheets)      │
│  ├── Apollo (lead search, enrichment, lists)                │
│  ├── Readwise (130 highlights)                              │
│  ├── Pipedrive (CRM pipeline)                               │
│  └── Anthropic Claude (via OpenClaw)                        │
├─────────────────────────────────────────────────────────────┤
│  Primary Interface: Slack DM                                │
│  Backup: Dashboard web UI                                   │
└─────────────────────────────────────────────────────────────┘
```

### The Cloudflare Tunnel
The dashboard and n8n are exposed publicly via a permanent Cloudflare tunnel — no dynamic IPs, no port forwarding, no VPN. Matthew can access his command centre from anywhere via a stable URL. The tunnel is monitored every heartbeat and auto-restarts if it drops.

### The Dashboard
A custom Node.js dashboard running at `missioncontrol.nthlayer.co.uk` provides:
- Briefings archive
- Task list with status
- Uptime incident log
- Goal progress tracker
- Quick-action buttons for common tasks

Secured with JWT authentication (login: MatthewDewstowe).

---

## Part 5: The Business Context — What This Is Actually For

This infrastructure isn't built for its own sake. It's built to solve a specific problem: Matthew needs to generate pipeline and close deals while simultaneously building a startup, with limited time and limited cashflow.

### The Q1 Goals This System is Driving

**1. 10 hot leads for Sonesse**
Sonesse is the API layer that lets AI agents join Zoom, Teams, and Google Meet as participants. The target buyers are CTOs and VPs Engineering at companies deploying conversational AI in regulated industries — financial services (MiFID II), healthcare (GDPR), legal, government. The Apollo lead gen agent, LinkedIn engagement monitor, and community tracker are all pointed at this goal.

**2. Close 1 Nth Layer deal**
The Nth Layer is Matthew's consulting practice — fractional CPO for PE-backed SaaS companies. The target is operating partners and value creation leads at PE firms who need a product leader to fix or accelerate a portfolio company. Apollo lists include 484 UK operating partners and value creation contacts, 296 PE portfolio leadership contacts.

**3. Interact with 100% of LinkedIn posts from prospects**
Every post from tracked prospects gets surfaced, every interaction gets logged. The goal is to be omnipresent in the feeds of the people Matthew needs to build relationships with — without spending hours manually scrolling LinkedIn.

**4. 100% uptime on all services**
The dashboard and tunnel are mission-critical. The heartbeat auto-repairs both. Every incident is logged with cause and resolution time to SQLite.

### The SEO Layer (Just Added)
Six SEO skills from the marketingskills framework were installed on 16 March 2026:
- `seo-audit` — technical SEO diagnosis
- `ai-seo` — optimise for Google AI Overviews, ChatGPT, Perplexity citations
- `programmatic-seo` — build keyword-targeted landing pages at scale
- `site-architecture`, `schema-markup`, `content-strategy`

These will be run against nthlayer.co.uk and sonesse.ai to improve discoverability, with a specific focus on AI search — where Sonesse's target buyers are increasingly searching.

---

## Part 6: The Meta-Agent Vision

The current system is approximately **15% automated**. The goal is **80%**.

The path there is what Matthew calls the **approve-and-action model**: every significant action the agent wants to take is surfaced to Matthew as a proposal. He approves (or modifies) with a single message. The agent executes.

The current bottlenecks:
- LinkedIn automation is blocked on WSL networking (fix: `wsl --shutdown`)
- Granola meeting notes integration pending (API access or local cache approach)
- Apollo → Pipedrive pipeline not yet fully closed
- Some n8n workflows trigger OpenClaw but the agent-to-agent handoff isn't fully wired

The next phase — currently in design — is a proper **meta-agent layer**: agents that spawn sub-agents, monitor their outputs, and synthesise results. Rather than Matthew managing 12 separate workflows, a single orchestrator agent would:

1. Monitor all pipeline sources (Apollo, LinkedIn, community signals)
2. Identify the highest-value prospect actions for the day
3. Draft outreach sequences, comments, and follow-ups
4. Surface a morning approval queue: "Here are 5 actions I want to take today. Approve?"
5. Execute approved actions, log results, learn from responses

The SQLite database is the foundation for this: every interaction, every signal, every outcome is captured and will eventually feed a feedback loop that improves suggestion quality over time.

---

## Closing Reflection

What Matthew has built in a few weeks is not a chatbot. It's an operating system for a founder who needs to multiply himself.

The key insight: **memory is the moat**. The reason this works — and why most AI tool setups fail — is that the agent carries context across time. It knows Matthew's goals, his constraints, his personality, his daughter's name, his HYROX date. It knows that he's not been paid since December and that cashflow is urgent. It doesn't ask the same question twice.

The second insight: **automation compounds**. Each workflow that runs without Matthew's involvement frees up attention for the work that genuinely needs him. Each SQLite record that gets written is a data point that will eventually make the agent smarter. Each incident that gets auto-repaired is a 2am wake-up call that never happened.

The third insight: **the interface matters**. Everything routes through Slack. Matthew doesn't need to learn a new tool, open a new tab, or change his behaviour. The intelligence meets him where he already is.

This is what AI-native operating looks like in practice. Not a chatbot. Not a co-pilot. A system that runs while you sleep — and briefs you when you wake up.

---

*Built with OpenClaw — self-hosted AI agent runtime*
*Infrastructure: WSL2/Ubuntu, Node.js, n8n, Cloudflare Tunnel, SQLite*
*AI: Anthropic Claude via OpenClaw*
*Deployed: March 2026*
*Current automation level: ~15% → Target: 80%*
