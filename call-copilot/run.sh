#!/usr/bin/env bash
# Call Copilot launcher (macOS / Linux)
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "First run — creating virtualenv and installing dependencies…"
  python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip
  ./.venv/bin/pip install -r requirements.txt
fi

# Open the browser shortly after the server starts.
( sleep 2; (command -v open >/dev/null && open http://127.0.0.1:8777) \
  || (command -v xdg-open >/dev/null && xdg-open http://127.0.0.1:8777) ) &

exec ./.venv/bin/python server.py
