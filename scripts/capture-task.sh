#!/usr/bin/env bash
#
# capture-task.sh — register something so it can't be forgotten.
#
# Use this the moment a task is mentioned and left undone or deferred
# ("later", "remind me", "I should…", "we need to…"). It writes straight
# to the dashboard task board (SQLite), which the 8 AM reminder reads.
#
# Usage:
#   capture-task.sh "task text" [priority] [category]
#     priority : high | urgent | medium | low   (default: medium)
#     category : free text label                 (default: Captured)
#
# Dedup-safe: an identical still-open task is not inserted twice.
#
set -euo pipefail

WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
DB="$WORKSPACE/dashboard/data/dashboard.db"

TEXT="${1:?usage: capture-task.sh \"task text\" [priority] [category]}"
PRIORITY="${2:-medium}"
CATEGORY="${3:-Captured}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "capture-task: sqlite3 not found" >&2
  exit 1
fi
if [ ! -f "$DB" ]; then
  echo "capture-task: dashboard DB not found at $DB (is the dashboard running?)" >&2
  exit 1
fi

# Escape single quotes for SQL string literals.
esc() { printf "%s" "$1" | sed "s/'/''/g"; }
T="$(esc "$TEXT")"
P="$(esc "$PRIORITY")"
C="$(esc "$CATEGORY")"

sqlite3 "$DB" "
INSERT INTO tasks (id, text, done, priority, category, kanban_column, createdAt, updatedAt)
SELECT 'task-' || CAST(strftime('%s','now') AS TEXT) || CAST(abs(random()) % 1000 AS TEXT),
       '$T', 0, '$P', '$C', 'Triage',
       strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE text = '$T' AND done = 0);
"

# Report what happened.
if sqlite3 "$DB" "SELECT 1 FROM tasks WHERE text = '$T' AND done = 0 LIMIT 1;" | grep -q 1; then
  echo "captured: $TEXT  [$PRIORITY]"
else
  echo "capture-task: insert failed for: $TEXT" >&2
  exit 1
fi
