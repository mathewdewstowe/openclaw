#!/usr/bin/env python3
"""
LinkedIn CDP Scraper
Uses Chrome Remote Debugging Protocol to scrape LinkedIn via a live logged-in session.
Chrome must be running with --remote-debugging-port=9222

Usage:
  python3 cdp_scraper.py check
  python3 cdp_scraper.py profile "https://www.linkedin.com/in/username"
  python3 cdp_scraper.py search "CPO fintech London"
  python3 cdp_scraper.py connections [max_pages]
"""

import asyncio
import websockets
import json
import sys
import time
import urllib.request
import os
import re
from datetime import datetime

CHROME_HOST = "http://localhost:9222"
RESULTS_DIR = os.path.expanduser("~/.openclaw/linkedin/results")
os.makedirs(RESULTS_DIR, exist_ok=True)

# ── Helpers ────────────────────────────────────────────────────────────────────

def get_tabs():
    return json.loads(urllib.request.urlopen(f"{CHROME_HOST}/json").read())

def get_linkedin_tab():
    tabs = get_tabs()
    for t in tabs:
        url = t.get("url", "")
        if "linkedin.com/feed" in url or "linkedin.com/in/" in url or "linkedin.com/search" in url:
            return t
    # fallback: any linkedin tab
    for t in tabs:
        if "linkedin.com" in t.get("url", ""):
            return t
    return None

async def get_ws(tab_id=None):
    tabs = get_tabs()
    if tab_id:
        tab = next((t for t in tabs if t["id"] == tab_id), None)
    else:
        tab = get_linkedin_tab()
    if not tab:
        raise RuntimeError("No LinkedIn tab found. Open LinkedIn in the debug Chrome window.")
    return tab["webSocketDebuggerUrl"], tab["id"]

async def cdp(ws, method, params=None, msg_id=1):
    cmd = {"id": msg_id, "method": method, "params": params or {}}
    await ws.send(json.dumps(cmd))
    while True:
        raw = await ws.recv()
        msg = json.loads(raw)
        if msg.get("id") == msg_id:
            return msg.get("result", {})

async def navigate_and_wait(ws, url, wait=3):
    await cdp(ws, "Page.navigate", {"url": url}, msg_id=1)
    await asyncio.sleep(wait)

async def eval_js(ws, expression, msg_id=99):
    result = await cdp(ws, "Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True
    }, msg_id=msg_id)
    return result.get("result", {}).get("value")

async def scroll_to_bottom(ws, times=3, delay=1.5):
    for _ in range(times):
        await eval_js(ws, "window.scrollBy(0, 2000)")
        await asyncio.sleep(delay)

def save_result(name, data):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe = re.sub(r'[^a-zA-Z0-9_-]', '_', name)[:40]
    path = os.path.join(RESULTS_DIR, f"{safe}_{ts}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    return path

# ── Commands ───────────────────────────────────────────────────────────────────

async def cmd_check():
    try:
        ws_url, tab_id = await get_ws()
        async with websockets.connect(ws_url) as ws:
            url = await eval_js(ws, "window.location.href")
            title = await eval_js(ws, "document.title", msg_id=100)
            if "linkedin.com" in (url or ""):
                print(f"Session valid ✓  —  {title}  ({url})")
            else:
                print(f"Not on LinkedIn: {url}")
    except Exception as e:
        print(f"Session check failed: {e}")

async def cmd_profile(profile_url):
    ws_url, tab_id = await get_ws()
    async with websockets.connect(ws_url) as ws:
        print(f"Navigating to {profile_url} ...")
        await navigate_and_wait(ws, profile_url, wait=4)
        await scroll_to_bottom(ws, times=4)

        js = """
        (() => {
            const txt = (sel) => {
                const el = document.querySelector(sel);
                return el ? el.innerText.trim() : null;
            };
            const all = (sel) => [...document.querySelectorAll(sel)].map(e => e.innerText.trim()).filter(Boolean);

            const name = txt('h1.text-heading-xlarge') || txt('h1');
            const headline = txt('.text-body-medium.break-words') || txt('.pv-text-details__left-panel .text-body-medium');
            const location = txt('.text-body-small.inline.t-black--light.break-words');
            const about = txt('#about ~ * .pv-shared-text-with-see-more span[aria-hidden="true"]')
                       || txt('.pv-about-section .pv-about__summary-text');

            // Experience
            const expItems = [...document.querySelectorAll('#experience ~ * li.artdeco-list__item')].slice(0,10);
            const experience = expItems.map(li => ({
                title: li.querySelector('.t-bold span[aria-hidden="true"]')?.innerText?.trim(),
                company: li.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.innerText?.trim(),
                duration: li.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]')?.innerText?.trim(),
            })).filter(e => e.title);

            // Education
            const eduItems = [...document.querySelectorAll('#education ~ * li.artdeco-list__item')].slice(0,5);
            const education = eduItems.map(li => ({
                school: li.querySelector('.t-bold span[aria-hidden="true"]')?.innerText?.trim(),
                degree: li.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.innerText?.trim(),
            })).filter(e => e.school);

            // Skills
            const skills = all('#skills ~ * .t-bold span[aria-hidden="true"]').slice(0,20);

            // Connections
            const connEl = document.querySelector('.pv-top-card--list .t-bold');
            const connections = connEl ? connEl.innerText.trim() : null;

            return { name, headline, location, about, connections, experience, education, skills, url: window.location.href, scraped_at: new Date().toISOString() };
        })()
        """
        result = await eval_js(ws, js)
        if not result or not result.get("name"):
            print("Warning: Could not extract profile data — LinkedIn may have changed its DOM.")
            print("Raw page title:", await eval_js(ws, "document.title", msg_id=200))
        else:
            path = save_result(f"profile_{result.get('name','unknown').replace(' ','_')}", result)
            print(json.dumps(result, indent=2))
            print(f"\nSaved to: {path}")

async def cmd_search(query):
    import urllib.parse
    encoded = urllib.parse.quote(query)
    search_url = f"https://www.linkedin.com/search/results/people/?keywords={encoded}"
    ws_url, tab_id = await get_ws()

    async with websockets.connect(ws_url) as ws:
        print(f"Searching: {query}")
        await navigate_and_wait(ws, search_url, wait=4)
        await scroll_to_bottom(ws, times=2)

        js = """
        (() => {
            const cards = [...document.querySelectorAll('[data-view-name="search-entity-result-universal-template"]')];
            return cards.map(card => {
                // Name: first aria-hidden span inside the profile link
                const nameEl = card.querySelector('a[href*="/in/"] span[aria-hidden="true"]');
                const name = nameEl ? nameEl.innerText.trim() : null;
                // Profile URL
                const linkEl = card.querySelector('a[href*="/in/"]');
                const profile_url = linkEl ? linkEl.href.split('?')[0] : null;
                // All t-14 spans for headline/location
                const subtitles = [...card.querySelectorAll('.t-14')].map(e => e.innerText.trim()).filter(s => s && !s.includes('degree connection') && !s.match(/^\\d+(st|nd|rd|th)$/));
                return { name, headline: subtitles[0] || null, location: subtitles[1] || null, profile_url };
            }).filter(r => r.name && r.profile_url);
        })()
        """
        results = await eval_js(ws, js)
        if not results:
            print("No results found.")
        else:
            data = {"query": query, "results": results, "scraped_at": datetime.now().isoformat()}
            path = save_result(f"search_{query.replace(' ','_')}", data)
            print(json.dumps(results, indent=2))
            print(f"\n{len(results)} results. Saved to: {path}")

async def cmd_connections(max_pages=5):
    ws_url, tab_id = await get_ws()
    async with websockets.connect(ws_url) as ws:
        print("Loading connections...")
        await navigate_and_wait(ws, "https://www.linkedin.com/mynetwork/invite-connect/connections/", wait=4)
        
        all_connections = []
        for page in range(max_pages):
            print(f"  Page {page+1}/{max_pages}...")
            await scroll_to_bottom(ws, times=3, delay=1.5)
            
            js = """
            (() => {
                const cards = [...document.querySelectorAll('.mn-connection-card')];
                return cards.map(c => ({
                    name: c.querySelector('.mn-connection-card__name')?.innerText?.trim(),
                    occupation: c.querySelector('.mn-connection-card__occupation')?.innerText?.trim(),
                    profile_url: c.querySelector('a.mn-connection-card__link')?.href?.split('?')[0],
                    connected_time: c.querySelector('.time-badge')?.innerText?.trim(),
                })).filter(r => r.name);
            })()
            """
            results = await eval_js(ws, js, msg_id=50+page)
            if results:
                # deduplicate
                seen = {c['profile_url'] for c in all_connections}
                new = [r for r in results if r.get('profile_url') not in seen]
                all_connections.extend(new)
                print(f"  Total so far: {len(all_connections)}")
            
            # click "Show more" if available
            show_more = await eval_js(ws, """
                (() => {
                    const btn = [...document.querySelectorAll('button')].find(b => b.innerText.includes('Show more'));
                    if (btn) { btn.click(); return true; }
                    return false;
                })()
            """, msg_id=80+page)
            if not show_more:
                break
            await asyncio.sleep(2)

        data = {"total": len(all_connections), "connections": all_connections, "scraped_at": datetime.now().isoformat()}
        path = save_result("connections", data)
        print(json.dumps(all_connections[:10], indent=2))
        print(f"\n... {len(all_connections)} total connections. Saved to: {path}")

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1].lower()

    if cmd == "check":
        asyncio.run(cmd_check())
    elif cmd == "profile":
        if len(sys.argv) < 3:
            print("Usage: cdp_scraper.py profile <linkedin_url>")
            sys.exit(1)
        asyncio.run(cmd_profile(sys.argv[2]))
    elif cmd == "search":
        if len(sys.argv) < 3:
            print("Usage: cdp_scraper.py search <query>")
            sys.exit(1)
        asyncio.run(cmd_search(" ".join(sys.argv[2:])))
    elif cmd == "connections":
        pages = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        asyncio.run(cmd_connections(pages))
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)

if __name__ == "__main__":
    main()
