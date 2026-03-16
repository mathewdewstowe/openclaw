"""
LinkedIn Cookie Login
─────────────────────
Imports your LinkedIn session cookies so the scraper can run headlessly.

HOW TO GET YOUR COOKIES:
1. Open Chrome/Edge on Windows and log in to LinkedIn
2. Press F12 → Application → Cookies → https://www.linkedin.com
3. Find and copy:
   - li_at      (long string, required)
   - JSESSIONID (starts with "ajax:", required)
4. Run: python3 linkedin_login.py --li_at "YOUR_COOKIE" --jsessionid "YOUR_COOKIE"
"""

import asyncio
import argparse
import json
from pathlib import Path
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

SESSION_DIR = Path.home() / ".openclaw" / "linkedin" / "session"
COOKIE_FILE = Path.home() / ".openclaw" / "linkedin" / "cookies.json"
SESSION_DIR.mkdir(parents=True, exist_ok=True)

BROWSER_ARGS = [
    "--no-sandbox", "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
]

async def import_cookies(li_at: str, jsessionid: str):
    """Inject cookies into the persistent session and verify login."""
    print("Importing cookies into session...")

    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            user_data_dir=str(SESSION_DIR),
            headless=True,
            args=BROWSER_ARGS,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        )
        page = await ctx.new_page()
        stealth = Stealth()
        await stealth.apply_stealth_async(page)

        # First visit LinkedIn to set the domain context
        await page.goto("https://www.linkedin.com/", wait_until="domcontentloaded")

        # Inject cookies
        cookies = [
            {
                "name": "li_at",
                "value": li_at,
                "domain": ".linkedin.com",
                "path": "/",
                "httpOnly": True,
                "secure": True,
                "sameSite": "None",
            },
            {
                "name": "JSESSIONID",
                "value": jsessionid,
                "domain": ".linkedin.com",
                "path": "/",
                "httpOnly": False,
                "secure": True,
                "sameSite": "None",
            },
        ]
        await ctx.add_cookies(cookies)

        # Save cookies to file as backup
        COOKIE_FILE.write_text(json.dumps(cookies, indent=2))

        # Reload and verify
        await page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded")
        await asyncio.sleep(3)

        url = page.url
        if "feed" in url:
            print("Login SUCCESSFUL! Session saved.")
            print(f"Session stored at: {SESSION_DIR}")
            name = await page.query_selector("h1") or await page.query_selector(".t-bold")
            if name:
                n = await name.inner_text()
                print(f"Logged in as: {n.strip()}")
        elif "authwall" in url or "login" in url:
            print("Login FAILED - cookies may be expired or invalid.")
            print("Tip: Make sure you're still logged in on your Windows browser,")
            print("     then re-copy fresh cookies.")
        else:
            print(f"Unexpected URL: {url}")
            print("Session may still be valid - try running: python3 linkedin_scraper.py check")

        await ctx.close()

async def show_stored_cookies():
    """Display what cookies are currently stored."""
    if COOKIE_FILE.exists():
        cookies = json.loads(COOKIE_FILE.read_text())
        for c in cookies:
            val = c['value']
            print(f"  {c['name']}: {val[:20]}...{val[-10:]}")
    else:
        print("No cookies stored yet.")

def main():
    parser = argparse.ArgumentParser(description="Import LinkedIn cookies")
    parser.add_argument("--li_at", help="Value of li_at cookie")
    parser.add_argument("--jsessionid", help="Value of JSESSIONID cookie")
    parser.add_argument("--show", action="store_true", help="Show stored cookies")
    args = parser.parse_args()

    if args.show:
        asyncio.run(show_stored_cookies())
    elif args.li_at and args.jsessionid:
        asyncio.run(import_cookies(args.li_at, args.jsessionid))
    else:
        print(__doc__)
        print("\nStored cookies:")
        asyncio.run(show_stored_cookies())

if __name__ == "__main__":
    main()
