---
name: cognitive-memory
description: Intelligent multi-store memory system for OpenClaw. Use when designing or improving memory architecture, recall policy, reflection workflows, memory decay rules, entity graphs, or audit trails across agent sessions.
---

# Cognitive Memory

Use this skill for deliberate memory system design, not routine day-to-day note taking.

## What it is for

Apply this skill when the user wants to:
- redesign how memory is structured
- introduce memory stores beyond flat files
- add reflection or consolidation workflows
- define remember / forget triggers
- build entity or relationship graphs
- add auditability to memory changes

For ordinary OpenClaw memory use, keep relying on `MEMORY.md`, daily notes, and `memory_search` / `memory_get`.

## Core model

Separate memory into four roles:
- **core**: durable facts that belong in `MEMORY.md`
- **episodic**: chronological daily logs
- **semantic**: entities, facts, and relationships
- **procedural**: reusable workflows and learned patterns
- **vault**: explicitly pinned items that should not decay automatically

Do not overcomplicate this if the user only needs better hygiene or recall quality.

## Recommended workflow

### 1. Start with the existing workspace
Check how memory already works before introducing new stores.

Review:
- `MEMORY.md`
- recent `memory/YYYY-MM-DD.md` files
- current recall behavior
- current pain points: noise, missed facts, stale info, token cost, unclear write policy

### 2. Define the problem precisely
Usually the real problem is one of:
- bad capture rules
- weak curation
- poor retrieval
- too much transient data
- no distinction between short-term and long-term memory

Fix the simplest layer that solves the problem.

### 3. Keep writes gated
Prefer:
- broad read access
- narrow write rules
- explicit review for high-impact memory changes

If multiple agents exist, let subagents propose memory changes rather than silently writing durable memory.

### 4. Use reflection carefully
Reflection should be opt-in or explicitly approved.
Do not auto-run expensive reflection loops just because they are possible.

### 5. Preserve auditability
When memory architecture is changed, make it easy to answer:
- what changed
- why it changed
- who changed it
- how to reverse it

## Practical guidance

### Durable vs transient
Store durable things such as:
- preferences
- relationships
- ongoing projects
- decisions
- recurring workflows
- lessons worth reusing

Avoid storing transient things such as:
- heartbeat acknowledgements
- temporary operational status
- repetitive service checks
- raw conversation noise that adds no future value

### Decay and consolidation
If using decay rules:
- decay low-value episodic material first
- never decay explicitly pinned memory without review
- consolidate repeated patterns into shorter summaries
- promote proven recurring knowledge into procedural or core memory

## Output standard

When helping with memory-system design, provide:
- the problem being solved
- the proposed memory model
- write/read rules
- decay or retention rules
- migration path from the current setup
- operational risks and safeguards

## Reference files

Read only when needed:
- `references/architecture.md`
- `references/routing-prompt.md`
- `references/reflection-process.md`
