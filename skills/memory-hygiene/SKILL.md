---
name: memory-hygiene
description: Audit, clean, and reduce OpenClaw memory and session bloat safely. Use when memory recall is noisy, context usage is creeping up, old session files are piling up, heartbeat maintenance needs tightening, or the user asks to prune/compact memory without losing important context.
---

# Memory Hygiene

Keep memory useful and boring. Prefer safer retention rules over destructive cleanup.

## Priorities

1. Stop destructive pruning first.
2. Reduce noisy inputs before deleting anything.
3. Preserve recent and high-value context.
4. Archive before removal whenever possible.

## What Usually Causes Bloat

- Oversized session files that get repeatedly reloaded
- Heartbeats logging low-value noise
- Old maintenance rules that delete by size alone
- Stale long-form notes never being distilled into `MEMORY.md`
- Broad recall of weak or transient memory entries

## Safe Cleanup Order

### 1. Fix pruning rules

When session cleanup is involved:
- Never delete active or locked sessions
- Never delete recent sessions just because they are large
- Preserve a recent working set
- Prefer gzip archival over deletion

Use `scripts/prune-sessions.sh` as the canonical session hygiene script.

### 2. Tighten heartbeat behavior

Heartbeat checks should:
- avoid logging repetitive "all clear" noise
- only alert on real issues
- avoid creating memory entries for transient status unless action was needed

### 3. Distill memory instead of hoarding it

When daily memory files grow noisy:
- keep raw notes in `memory/YYYY-MM-DD.md`
- move only durable facts, decisions, and preferences into `MEMORY.md`
- remove or ignore transient operational chatter

### 4. Review recall quality

If memory recall is returning junk:
- keep only durable facts and decisions in long-term memory
- avoid saving ephemeral runtime state
- prefer fewer high-signal entries over many low-signal ones

## Store This

- durable preferences
- recurring workflows
- important decisions
- contact/context worth reusing
- lessons that prevent future mistakes

## Do Not Store This

- heartbeat acknowledgements
- repetitive service health checks with no action
- temporary statuses
- raw message dumps already preserved elsewhere
- secrets unless explicitly required and safely handled

## Recommended Maintenance Pattern

Use an archive-first policy:
- active sessions: untouched
- recent sessions: untouched
- stale + very large sessions: archive
- long-term notes: curate into `MEMORY.md`

## When the User Says “Fix the Bloat”

Do this in order:
1. inspect current pruning and heartbeat rules
2. make cleanup non-destructive
3. remove stale/legacy memory instructions
4. trim noisy agent instructions
5. commit the changes

## Output Standard

Report:
- root cause
- what was made safer
- what was removed or archived
- what policy now prevents recurrence
