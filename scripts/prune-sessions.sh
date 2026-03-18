#!/bin/bash
# prune-sessions.sh
# Automatically deletes bloated OpenClaw session files to prevent context overload.
# Skips sessions that are currently locked (active).
# Runs via cron — no manual intervention needed.

SESSIONS_DIR="$HOME/.openclaw/agents/main/sessions"
THRESHOLD_KB=200  # Delete sessions larger than this
LOG="$HOME/.openclaw/workspace/memory/session-pruner.log"
TODAY=$(date -u +%Y-%m-%d)
PRUNED=0
SKIPPED=0

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG"
}

log "=== Session pruner started ==="

if [ ! -d "$SESSIONS_DIR" ]; then
  log "Sessions directory not found: $SESSIONS_DIR"
  exit 1
fi

# Find all .jsonl session files
for SESSION_FILE in "$SESSIONS_DIR"/*.jsonl; do
  [ -f "$SESSION_FILE" ] || continue

  # Skip if there's a matching .lock file (session is active)
  LOCK_FILE="${SESSION_FILE}.lock"
  if [ -f "$LOCK_FILE" ]; then
    log "SKIP (locked/active): $(basename $SESSION_FILE)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Get file size in KB
  SIZE_KB=$(du -k "$SESSION_FILE" | cut -f1)

  if [ "$SIZE_KB" -gt "$THRESHOLD_KB" ]; then
    log "PRUNE: $(basename $SESSION_FILE) — ${SIZE_KB}KB (over ${THRESHOLD_KB}KB threshold)"
    rm "$SESSION_FILE"
    PRUNED=$((PRUNED + 1))
  fi
done

log "Done. Pruned: $PRUNED | Skipped (active): $SKIPPED"

if [ "$PRUNED" -gt 0 ]; then
  log "Prune complete. No gateway restart needed."
fi

exit 0
