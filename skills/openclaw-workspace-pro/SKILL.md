---
name: openclaw-workspace-pro
description: Production-ready workspace setup for OpenClaw agents. Use when improving workspace structure, artifact organization, secrets handling, memory compaction practices, or long-running agent operating patterns.
---

# OpenClaw Workspace Pro

Use this skill to make a workspace cleaner, safer, and easier to operate over time.

## Focus areas

- artifact organization
- secrets handling
- memory compaction
- long-running agent patterns
- safer operational defaults

## Recommended workflow

### 1. Inspect the current workspace
Review the existing structure before changing it.

Check for:
- files scattered at the root
- plaintext secrets in tracked files
- no clear artifact directories
- growing memory with no archival pattern
- recurring maintenance tasks with no standard place

### 2. Standardize artifacts
Prefer a predictable structure such as:
- `artifacts/reports/`
- `artifacts/code/`
- `artifacts/data/`
- `artifacts/exports/`

Keep generated deliverables there instead of scattering them across the workspace.

### 3. Fix secret handling
Move secrets out of general notes and into safer locations such as `.env` or provider-managed config.
Reference secrets indirectly in docs when possible.

### 4. Add memory compaction habits
Use a light-touch pattern:
- daily files hold raw notes
- `MEMORY.md` holds curated durable context
- older raw material gets archived when no longer useful in active context

### 5. Support long-running work
For longer efforts, prefer:
- clear checkpoints
- intermediate artifacts
- resumable scripts or notes
- explicit review boundaries

## Rules

- do not create extra documentation files unless they are genuinely useful
- do not duplicate the same guidance across many files
- prefer small structural improvements over grand rewrites
- keep the workspace understandable to a future agent waking up cold

## Output options

Provide one or more of:
- proposed directory structure
- cleanup plan
- secrets migration plan
- memory compaction plan
- operational checklist for long-running work
