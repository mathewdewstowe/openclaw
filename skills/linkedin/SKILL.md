---
name: linkedin
description: Search and review LinkedIn profiles, companies, and search results using the local Camoufox-based LinkedIn workflow. Use when the user asks to look up a person or company on LinkedIn, inspect a LinkedIn profile, search LinkedIn for prospects, or do LinkedIn research.
---

# LinkedIn

Use the local Camoufox workflow. Do not mix this skill with legacy Chrome remote-debugging instructions.

## Canonical Workflow

Primary script:
- `~/.openclaw/workspace/scripts/camoufox-linkedin.py`

Primary profile/session location:
- `~/.stealth-browser/profiles/linkedin/`

## First-Time Login

Login requires a headed browser session:

```bash
python3 ~/.openclaw/workspace/scripts/camoufox-linkedin.py --login
```

Then:
1. sign into LinkedIn in the opened browser
2. complete any checkpoint/CAPTCHA manually
3. press Enter when prompted so the session is saved

## Check Session Status

```bash
python3 ~/.openclaw/workspace/scripts/camoufox-linkedin.py --status
```

## Fetch a Profile or Page

```bash
python3 ~/.openclaw/workspace/scripts/camoufox-linkedin.py --url "https://www.linkedin.com/in/someone" --output /tmp/profile.html
python3 ~/.openclaw/workspace/scripts/camoufox-linkedin.py --url "https://www.linkedin.com/feed/" --screenshot /tmp/feed.png
```

## Convenience Wrapper

If present, use:

```bash
~/.openclaw/workspace/tools/browser/li.sh check
~/.openclaw/workspace/tools/browser/li.sh profile "https://www.linkedin.com/in/username"
~/.openclaw/workspace/tools/browser/li.sh search-people "keywords" "job title" "company" 10
~/.openclaw/workspace/tools/browser/li.sh search-companies "contact centre AI" 10
```

## Working Rules

- Run lightly; repeated aggressive LinkedIn automation triggers defenses
- Prefer one focused research pass over many repeated runs
- If CAPTCHA or checkpoint appears, stop and ask for manual intervention
- Keep output concise: person, role, company, location, notable signals

## Troubleshooting

**Not logged in**
- Run the login flow again and save the session

**Checkpoint / CAPTCHA**
- Complete it manually in the headed browser, then retry

**Session expired**
- Re-run `--login`

## Important

This skill is Camoufox-based. Ignore old Chrome debug mode guidance unless a future workflow explicitly reintroduces it.
