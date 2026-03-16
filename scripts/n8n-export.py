#!/usr/bin/env python3
"""Export all n8n workflows to workspace/n8n-export/ directory."""
import sys, json, os

data = sys.stdin.read()
try:
    d = json.loads(data)
except Exception as e:
    print(f"Failed to parse n8n response: {e}", file=sys.stderr)
    sys.exit(1)

out_dir = "/home/matthewdewstowe/.openclaw/workspace/n8n-export"
os.makedirs(out_dir, exist_ok=True)

workflows = d.get("data", [])
for w in workflows:
    name = w.get("name", "unknown").replace("/", "-").replace(" ", "_")
    wid = w.get("id")
    # Strip emoji-unfriendly chars from filename
    safe_name = "".join(c for c in name if c.isascii() or c == "_").strip("_")
    fname = os.path.join(out_dir, f"{wid}_{safe_name}.json")
    with open(fname, "w") as f:
        json.dump(w, f, indent=2)

print(f"Exported {len(workflows)} n8n workflows to {out_dir}")
