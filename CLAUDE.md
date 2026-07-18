# CLAUDE.md

Guidance for Claude Code working in this workspace. The always-on agent reads
`AGENTS.md` + `HEARTBEAT.md`; this file makes **Claude Code sessions** follow the
same rules. When in doubt about workspace conventions, read `AGENTS.md`.

## 📌 Capture Every Task - Nothing Falls Through

Matthew (ADHD) drops tasks into chat and Claude Code and then forgets them.
**Catch every one at the moment it's mentioned** so it can't vanish.

The instant something is raised and left undone or deferred — "later",
"remind me", "I should…", "we need to…", "can you…", "don't let me forget…",
or you agree to do something and don't finish it this session — register it
**immediately and silently** (don't ask "should I add this?"):

```bash
bash scripts/capture-task.sh "the task, in Matthew's words" [priority] [category]
# priority: high | urgent | medium | low   (default medium)
```

- It's dedup-safe — capturing the same open task twice is harmless.
- It lands on the shared dashboard task board (`dashboard/data/dashboard.db`),
  the **same board** the chat agent uses.
- When a captured task actually gets done, mark it done so it drops off the
  reminder (`PATCH /api/tasks/:id {done:1}`, or via the dashboard).

**If in doubt, capture it.** A stray task on the board costs nothing; a
forgotten one costs Matthew.

## Daily 8 AM reminder

Both surfaces (chat agent + Claude Code) write to the one board. The always-on
agent's heartbeat (`HEARTBEAT.md` §8) reads open tasks back to Matthew once a
day at **08:00 Europe/London**, no matter where they were captured. Claude Code
doesn't need to send the reminder itself — it only needs to *capture*.

## House style

See `PREFERENCES.md`. In short: direct answers first; bullets over paragraphs;
no filler openers ("Great question", "Certainly"); concise.
