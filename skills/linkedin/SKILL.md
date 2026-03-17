---
name: linkedin
description: 'Search and scrape LinkedIn using Camoufox stealth browser. Use when the user asks to: look up a LinkedIn profile, find someone on LinkedIn, search LinkedIn for people or companies, get profile details, or any LinkedIn research task. Uses Camoufox (patched Firefox) with C++ level anti-bot evasion. Trigger on any mention of LinkedIn, looking up a contact, searching for people, or connection research.'
metadata:
  { "openclaw": { "emoji": "💼" } }
---

# LinkedIn (Camoufox Stealth Browser)

Uses **Camoufox** — a custom Firefox fork with C++ level stealth patches.
Persistent session stored at `~/.stealth-browser/profiles/linkedin/`.
No Windows Chrome dependency. Runs natively in WSL.

Script: `~/.openclaw/workspace/scripts/camoufox-linkedin.py`

---

## First-Time Setup

Login requires a **headed browser** (needs display — use WSLg or X11 forwarding):

```bash
python3 ~/.openclaw/workspace/scripts/camoufox-linkedin.py --login
```

Log into LinkedIn in the browser window, then press Enter to save the session.

---

## Check Session Status

```bash
python3 ~/.openclaw/workspace/scripts/camoufox-linkedin.py --status
```

---

## Fetch a LinkedIn Page

```bash
python3 ~/.openclaw/workspace/scripts/camoufox-linkedin.py --url "https://www.linkedin.com/in/someone" --output /tmp/profile.html
python3 ~/.openclaw/workspace/scripts/camoufox-linkedin.py --url "https://www.linkedin.com/feed/" --screenshot /tmp/feed.png
```

---

## Using Camoufox Directly in Python

```python
from camoufox.sync_api import Camoufox
import os

PROFILE = os.path.expanduser("~/.stealth-browser/profiles/linkedin")

with Camoufox(headless=True, persistent_context=True, user_data_dir=PROFILE, humanize=True) as browser:
    page = browser.new_page()
    page.goto("https://www.linkedin.com/feed/", wait_until="networkidle")
    # ... interact with page
```

---

## Run commands from WSL

### Check LinkedIn session
```bash
~/.openclaw/workspace/tools/browser/li.sh check
```

### Look up a profile
```bash
~/.openclaw/workspace/tools/browser/li.sh profile "https://www.linkedin.com/in/username"
```

### Search for people
```bash
~/.openclaw/workspace/tools/browser/li.sh search-people "keywords" "job title" "company" 10
```
Example:
```bash
~/.openclaw/workspace/tools/browser/li.sh search-people "conversational AI" "VP Customer Experience" "" 10
```

### Search for companies
```bash
~/.openclaw/workspace/tools/browser/li.sh search-companies "contact centre AI" 10
```

---

## How it works

- `Chrome Debug Mode.bat` launches Chrome with `--remote-debugging-port=9222` + dedicated profile
- `li.sh` calls Windows Node.js (`node.exe`) via WSL interop (`cmd.exe /c`)
- The Node.js script connects directly to Chrome on `127.0.0.1:9222` (Windows localhost)
- LinkedIn sees your real Chrome browser — same fingerprint, same session, no bot detection

---

## Troubleshooting

**"Could not connect to Chrome"**
→ Run `Chrome Debug Mode.bat` on your Desktop first

**"Not logged into LinkedIn"**
→ Open Chrome, go to linkedin.com, log in manually — session persists in `C:\Temp\chrome-debug`

**Session expired after Windows restart**
→ Run `Chrome Debug Mode.bat` again — cookies persist in the debug profile
