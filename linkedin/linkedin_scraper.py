"""
LinkedIn Scraper - Playwright + Stealth
Persistent session, rate limiting, human-like behaviour.
Usage:
  python3 linkedin_scraper.py login          # Run once to authenticate
  python3 linkedin_scraper.py profile <url>  # Scrape a profile
  python3 linkedin_scraper.py search <query> # Search people
  python3 linkedin_scraper.py connections    # Get your connections
"""

import asyncio
import json
import random
import sys
import time
from pathlib import Path
from datetime import datetime

from playwright.async_api import async_playwright
from playwright_stealth import Stealth

# ── Config ────────────────────────────────────────────────────────────────────
SESSION_DIR  = Path.home() / ".openclaw" / "linkedin" / "session"
RESULTS_DIR  = Path.home() / ".openclaw" / "linkedin" / "results"
SESSION_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

BROWSER_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--lang=en-GB",
]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# ── Helpers ───────────────────────────────────────────────────────────────────

async def human_delay(min_s=2.0, max_s=6.0):
    """Random delay to mimic human reading speed."""
    await asyncio.sleep(random.uniform(min_s, max_s))

async def human_scroll(page, steps=3):
    """Scroll down naturally."""
    for _ in range(steps):
        await page.mouse.wheel(0, random.randint(300, 700))
        await asyncio.sleep(random.uniform(0.4, 1.2))

async def make_browser(playwright, headless=True):
    """Create a persistent-context browser with stealth applied."""
    context = await playwright.chromium.launch_persistent_context(
        user_data_dir=str(SESSION_DIR),
        headless=headless,
        args=BROWSER_ARGS,
        user_agent=USER_AGENT,
        viewport={"width": 1280, "height": 800},
        locale="en-GB",
        timezone_id="Europe/London",
        color_scheme="light",
        ignore_https_errors=False,
    )
    return context

async def apply_stealth(page):
    """Apply all stealth patches to a page."""
    stealth = Stealth()
    await stealth.apply_stealth_async(page)
    # Extra: hide navigator.webdriver
    await page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en'] });
        window.chrome = { runtime: {} };
    """)

def is_logged_in_check(url):
    return "linkedin.com/feed" in url or "linkedin.com/in/" in url

def save_result(filename, data):
    path = RESULTS_DIR / filename
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Saved: {path}")
    return path

# ── Login (run once, headed) ──────────────────────────────────────────────────

async def do_login():
    """Open LinkedIn in a headed browser for manual login. Session is saved."""
    print("Opening LinkedIn for login. Sign in manually, then close the browser.")
    print("Your session will be saved and reused automatically.\n")

    async with async_playwright() as p:
        ctx = await make_browser(p, headless=False)
        page = await ctx.new_page()
        await apply_stealth(page)

        await page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")

        # Wait until the user reaches the feed (logged in)
        print("Waiting for you to log in...")
        try:
            await page.wait_for_url("**/feed/**", timeout=300_000)  # 5 min timeout
            print("Login detected! Saving session...")
        except Exception:
            print("Timed out waiting for login.")

        await ctx.close()
    print("Session saved to:", SESSION_DIR)

# ── Scrape Profile ─────────────────────────────────────────────────────────────

async def scrape_profile(profile_url: str):
    """Scrape a LinkedIn profile page."""
    async with async_playwright() as p:
        ctx = await make_browser(p, headless=True)
        page = await ctx.new_page()
        await apply_stealth(page)

        # Warm up via feed first to avoid redirect loops
        print("Warming up session via feed...")
        try:
            await page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=20000)
            await human_delay(1, 2)
        except Exception as e:
            print(f"  Feed warmup warning: {e}")

        if "login" in page.url or "authwall" in page.url:
            print("ERROR: Not logged in. Run: python3 linkedin_scraper.py login")
            await ctx.close()
            return None

        print(f"Loading profile: {profile_url}")
        try:
            await page.goto(profile_url, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            print(f"Navigation error: {e}")
            await ctx.close()
            return None
        await human_delay(2, 4)

        # Check still logged in
        if "authwall" in page.url or "login" in page.url:
            print("ERROR: Not logged in. Run: python3 linkedin_scraper.py login")
            await ctx.close()
            return None

        await human_scroll(page, steps=4)
        await human_delay(1, 2)

        data = await page.evaluate("""() => {
            const getText = (sel) => {
                const el = document.querySelector(sel);
                return el ? el.innerText.trim() : null;
            };
            const getAll = (sel) => [...document.querySelectorAll(sel)].map(e => e.innerText.trim());

            return {
                name: getText('h1.text-heading-xlarge'),
                headline: getText('.text-body-medium.break-words'),
                location: getText('.text-body-small.inline.t-black--light.break-words'),
                about: getText('#about ~ div .full-width span[aria-hidden="true"]'),
                connections: getText('.t-bold span'),
                experience: getAll('li.artdeco-list__item .t-bold span[aria-hidden="true"]'),
                education: getAll('.education__list .t-bold span[aria-hidden="true"]'),
                skills: getAll('.skill-categories-taxonomy__category .t-bold'),
                url: window.location.href,
                scraped_at: new Date().toISOString(),
            };
        }""")

        filename = f"profile_{int(time.time())}.json"
        save_result(filename, data)
        await ctx.close()
        return data

# ── Search People ──────────────────────────────────────────────────────────────

async def search_people(query: str, max_results=10):
    """Search LinkedIn for people matching a query."""
    async with async_playwright() as p:
        ctx = await make_browser(p, headless=True)
        page = await ctx.new_page()
        await apply_stealth(page)

        search_url = f"https://www.linkedin.com/search/results/people/?keywords={query.replace(' ', '%20')}&origin=GLOBAL_SEARCH_HEADER"
        # Warm up via feed first
        try:
            await page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=20000)
            await human_delay(1, 2)
        except Exception as e:
            print(f"  Feed warmup warning: {e}")

        if "login" in page.url or "authwall" in page.url:
            print("ERROR: Not logged in. Run: python3 linkedin_scraper.py login")
            await ctx.close()
            return []

        print(f"Searching: {query}")
        try:
            await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            print(f"Navigation error: {e}")
            await ctx.close()
            return []
        await human_delay(2, 4)

        if "authwall" in page.url or "login" in page.url:
            print("ERROR: Not logged in. Run: python3 linkedin_scraper.py login")
            await ctx.close()
            return []

        await human_scroll(page, steps=3)
        await human_delay(1, 2)

        results = await page.evaluate("""(maxResults) => {
            const cards = [...document.querySelectorAll('.reusable-search__result-container')].slice(0, maxResults);
            return cards.map(card => ({
                name: card.querySelector('.entity-result__title-text a span[aria-hidden="true"]')?.innerText?.trim(),
                headline: card.querySelector('.entity-result__primary-subtitle')?.innerText?.trim(),
                location: card.querySelector('.entity-result__secondary-subtitle')?.innerText?.trim(),
                profile_url: card.querySelector('.entity-result__title-text a')?.href,
            })).filter(r => r.name);
        }""", max_results)

        filename = f"search_{query.replace(' ', '_')}_{int(time.time())}.json"
        save_result(filename, {"query": query, "results": results, "count": len(results)})
        await ctx.close()
        return results

# ── Get Connections ────────────────────────────────────────────────────────────

async def get_connections(max_pages=5):
    """Scrape your 1st-degree connections list."""
    async with async_playwright() as p:
        ctx = await make_browser(p, headless=True)
        page = await ctx.new_page()
        await apply_stealth(page)

        print("Loading connections...")
        await page.goto("https://www.linkedin.com/mynetwork/invite-connect/connections/", wait_until="domcontentloaded")
        await human_delay(2, 4)

        if "authwall" in page.url or "login" in page.url:
            print("ERROR: Not logged in. Run: python3 linkedin_scraper.py login")
            await ctx.close()
            return []

        all_connections = []
        for page_num in range(max_pages):
            await human_scroll(page, steps=5)
            await human_delay(2, 4)

            connections = await page.evaluate("""() => {
                const cards = [...document.querySelectorAll('li.mn-connection-card')];
                return cards.map(card => ({
                    name: card.querySelector('.mn-connection-card__name')?.innerText?.trim(),
                    occupation: card.querySelector('.mn-connection-card__occupation')?.innerText?.trim(),
                    profile_url: card.querySelector('a.mn-connection-card__link')?.href,
                    connected_time: card.querySelector('.time-badge')?.innerText?.trim(),
                })).filter(c => c.name);
            }""")

            new = [c for c in connections if c not in all_connections]
            if not new:
                break
            all_connections.extend(new)
            print(f"  Page {page_num + 1}: {len(all_connections)} connections so far")

            # Try to go to next page
            next_btn = await page.query_selector('button[aria-label="Next"]')
            if not next_btn:
                break
            await next_btn.click()
            await human_delay(3, 6)

        filename = f"connections_{int(time.time())}.json"
        save_result(filename, {"connections": all_connections, "count": len(all_connections)})
        await ctx.close()
        return all_connections

# ── Check Session ──────────────────────────────────────────────────────────────

async def check_session():
    """Verify the saved session is still valid."""
    async with async_playwright() as p:
        ctx = await make_browser(p, headless=True)
        page = await ctx.new_page()
        await apply_stealth(page)
        await page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded")
        await human_delay(1, 2)
        logged_in = "feed" in page.url and "login" not in page.url
        await ctx.close()
        return logged_in

# ── CLI ────────────────────────────────────────────────────────────────────────

async def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return

    cmd = args[0]

    if cmd == "login":
        await do_login()

    elif cmd == "check":
        ok = await check_session()
        print("Session valid ✓" if ok else "Session expired — run: python3 linkedin_scraper.py login")

    elif cmd == "profile":
        if len(args) < 2:
            print("Usage: python3 linkedin_scraper.py profile <linkedin-url>")
            return
        data = await scrape_profile(args[1])
        if data:
            print(json.dumps(data, indent=2))

    elif cmd == "search":
        if len(args) < 2:
            print("Usage: python3 linkedin_scraper.py search <query>")
            return
        query = " ".join(args[1:])
        results = await search_people(query)
        print(json.dumps(results, indent=2))

    elif cmd == "connections":
        max_pages = int(args[1]) if len(args) > 1 else 5
        conns = await get_connections(max_pages=max_pages)
        print(f"\nTotal connections scraped: {len(conns)}")

    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)

if __name__ == "__main__":
    asyncio.run(main())
