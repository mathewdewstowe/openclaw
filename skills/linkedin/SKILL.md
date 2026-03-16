---
name: linkedin
description: 'Search and scrape LinkedIn using your real Chrome session via CDP. Use when the user asks to: look up a LinkedIn profile, find someone on LinkedIn, search LinkedIn for people or companies, get profile details, or any LinkedIn research task. Connects to running Chrome — no separate login, no 2FA, no bot detection. Trigger on any mention of LinkedIn, looking up a contact, searching for people, or connection research.'
metadata:
  { "openclaw": { "emoji": "💼" } }
---

# LinkedIn (Chrome CDP)

Connects to your **running Chrome browser** via remote debugging (CDP).
Uses your real LinkedIn session — no separate login, no 2FA, no bot detection.

Script lives at `C:\Temp\li-win\linkedin.js` (Windows Node.js).
WSL wrapper: `~/.openclaw/workspace/tools/browser/li.sh`

---

## Step 1 — Launch Chrome in debug mode (once per Windows session)

**Double-click `Chrome Debug Mode.bat` on your Desktop.**

This closes any existing Chrome and relaunches it with `--remote-debugging-port=9222`
using a dedicated debug profile at `C:\Temp\chrome-debug`.
All your cookies (including LinkedIn) are pre-loaded.

---

## Step 2 — Run commands from WSL

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
