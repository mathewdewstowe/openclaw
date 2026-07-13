#!/usr/bin/env bash
#
# open-tasks.sh — list every open (not-done) task, highest priority first.
# Used by the daily 8 AM reminder. Prints one task per line:
#   <emoji>  <column>  <text>
# Exit code 0 always; prints nothing if the board is clear.
#
set -euo pipefail

WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
DB="$WORKSPACE/dashboard/data/dashboard.db"

if ! command -v sqlite3 >/dev/null 2>&1 || [ ! -f "$DB" ]; then
  exit 0
fi

sqlite3 -separator '  ' "$DB" "
SELECT
  CASE lower(priority)
    WHEN 'blocked' THEN '🔴'
    WHEN 'urgent'  THEN '🔴'
    WHEN 'high'    THEN '🟠'
    WHEN 'medium'  THEN '🟡'
    WHEN 'low'     THEN '🟢'
    ELSE '⚪'
  END,
  '[' || kanban_column || ']',
  text
FROM tasks
WHERE done = 0
ORDER BY
  CASE lower(priority)
    WHEN 'blocked' THEN 0 WHEN 'urgent' THEN 0 WHEN 'high' THEN 1
    WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
  createdAt;
"
