#!/bin/bash
# prune-sessions.sh
# Safer OpenClaw session hygiene:
# - NEVER delete active or recent sessions
# - Archive stale oversized sessions instead of deleting them
# - Keep a recoverable gzip copy under workspace/memory/session-archive/
#
# Exit codes:
#   0 = success / nothing to do
#   1 = sessions directory missing

set -euo pipefail

SESSIONS_DIR="$HOME/.openclaw/agents/main/sessions"
ARCHIVE_DIR="$HOME/.openclaw/workspace/memory/session-archive"
LOG="$HOME/.openclaw/workspace/memory/session-pruner.log"
THRESHOLD_KB="${THRESHOLD_KB:-1024}"      # only archive sessions > 1MB
MIN_AGE_HOURS="${MIN_AGE_HOURS:-72}"      # only archive sessions untouched for 72h+
KEEP_RECENT_COUNT="${KEEP_RECENT_COUNT:-25}"  # always preserve the newest N sessions
ARCHIVED=0
SKIPPED=0

mkdir -p "$ARCHIVE_DIR"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1" | tee -a "$LOG"
}

log "=== Session pruner started (safe mode) ==="
log "Policy: archive-only | threshold=${THRESHOLD_KB}KB | min_age=${MIN_AGE_HOURS}h | keep_recent=${KEEP_RECENT_COUNT}"

if [ ! -d "$SESSIONS_DIR" ]; then
  log "Sessions directory not found: $SESSIONS_DIR"
  exit 1
fi

mapfile -t RECENT_BASENAMES < <(
  find "$SESSIONS_DIR" -maxdepth 1 -type f -name '*.jsonl' -printf '%T@ %f\n' \
    | sort -rn \
    | head -n "$KEEP_RECENT_COUNT" \
    | awk '{print $2}'
)

is_recently_protected() {
  local base="$1"
  for recent in "${RECENT_BASENAMES[@]:-}"; do
    if [ "$recent" = "$base" ]; then
      return 0
    fi
  done
  return 1
}

now_epoch=$(date -u +%s)

for SESSION_FILE in "$SESSIONS_DIR"/*.jsonl; do
  [ -f "$SESSION_FILE" ] || continue

  base="$(basename "$SESSION_FILE")"
  LOCK_FILE="${SESSION_FILE}.lock"

  if [ -f "$LOCK_FILE" ]; then
    log "SKIP active/locked: $base"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if is_recently_protected "$base"; then
    log "SKIP recent-protected: $base"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  size_kb=$(du -k "$SESSION_FILE" | cut -f1)
  mtime_epoch=$(stat -c %Y "$SESSION_FILE")
  age_hours=$(( (now_epoch - mtime_epoch) / 3600 ))

  if [ "$size_kb" -le "$THRESHOLD_KB" ]; then
    log "SKIP under-threshold: $base (${size_kb}KB, ${age_hours}h old)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [ "$age_hours" -lt "$MIN_AGE_HOURS" ]; then
    log "SKIP too-recent: $base (${size_kb}KB, ${age_hours}h old)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  archive_name="${base}.gz"
  archive_path="$ARCHIVE_DIR/$archive_name"

  gzip -c "$SESSION_FILE" > "$archive_path"
  touch -r "$SESSION_FILE" "$archive_path"
  rm -f "$SESSION_FILE"

  log "ARCHIVED stale oversized session: $base -> $archive_path (${size_kb}KB, ${age_hours}h old)"
  ARCHIVED=$((ARCHIVED + 1))
done

log "Done. Archived: $ARCHIVED | Skipped: $SKIPPED"
exit 0
