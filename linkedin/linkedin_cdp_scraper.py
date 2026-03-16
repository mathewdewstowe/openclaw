#!/usr/bin/env python3
"""
LinkedIn scraper that connects to your RUNNING Chrome via CDP.
Chrome must be launched with --remote-debugging-port=9222
Use: ~/Desktop/Chrome Debug Mode.bat to start Chrome in debug mode.

Usage:
  python3 linkedin_cdp_scraper.py check
  python3 linkedin_cdp_scraper.py profile "https://www.linkedin.com/in/username"
  python3 linkedin_cdp_scraper.py search "job title company name"
  python3 linkedin_cdp_scraper.py connections
"""
import asyncio
import sys
import os
import json
import time
import urllib.request

RESULTS_DIR = os.path.expanduser("~/.openclaw/linkedin/results")
os.makedirs(RESULTS_DIR, exist_ok=True)

# CDP endpoint - Chrome on Windows, accessed from WSL
CDP_URL = "http://host.docker.internal:9222"

def get_cdp_url():
    """Find the CDP endpoint - try localhost first, then Windows host IP."""
    candidates = [
        "http://localhost:9222",
        "http://host.docker.internal:9222",
        "http://172.17.0.1:9222",
    ]
    # In WSL2, Windows host is typically at the default gateway
    try:
        import subprocess
        result = subprocess.run(
            ["bash", "-c", "ip route show default | awk '{print $3}' | head -1"],
            capture_output=True, text=True, timeout=3
        )
        gateway = result.stdout.strip()
        if gateway:
            candidates.insert(0, f"http://{gateway}:9222")
    except:
        pass
    candidates.insert(0, "http://localhost:9222")
    return candidates

def check_cdp_available():
    """Check if Chrome is running with remote debugging."""
    for url in get_cdp_url():
        try:
            resp = urllib.request.urlopen(f"{url}/json/version", timeout=2)
            data = json.loads(resp.read())
            print(f"✅ Chrome debug found at: {url}")
            print(f"   Browser: {data.get('Browser', 'unknown')}")
            return url
        except:
            continue
    return None

async def run(command, arg=None):
    from playwright.async_api import async_playwright

    # Find Chrome debug port
    cdp_base = check_cdp_available()
    if not cdp_base:
        print("❌ Chrome not found on debug port 9222.")
        print()
        print("Fix: Run 'Chrome Debug Mode.bat' on your Desktop to restart Chrome")
        print("     with remote debugging enabled.")
        print()
        print("     Or verify Chrome is running: http://localhost:9222/json")
        sys.exit(1)

    async with async_playwright() as p:
        # Connect to the running Chrome instance
        print(f"Connecting to Chrome at {cdp_base}...")
        browser = await p.chromium.connect_over_cdp(cdp_base)
        
        # Use existing context (with all your logged-in sessions)
        contexts = browser.contexts
        if not contexts:
            print("❌ No browser contexts found.")
            await browser.close()
            sys.exit(1)
        
        ctx = contexts[0]
        
        # Check LinkedIn session
        li_cookies = [c for c in await ctx.cookies() if 'linkedin' in c.get('domain','')]
        li_at = next((c['value'] for c in li_cookies if c['name'] == 'li_at'), None)
        
        if command == "check":
            print(f"LinkedIn cookies: {len(li_cookies)}")
            if li_at:
                print(f"✅ li_at found: {li_at[:40]}...")
                # Open a new tab and test
                page = await ctx.new_page()
                await page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=20000)
                await asyncio.sleep(2)
                url = page.url
                if "/feed" in url:
                    print("✅ Session VALID - logged into LinkedIn")
                else:
                    print(f"❌ Redirected to: {url}")
                await page.close()
            else:
                print("❌ No li_at cookie - not logged into LinkedIn in Chrome")
                print("   Open Chrome, go to linkedin.com, and log in manually.")
            await browser.close()
            return

        if not li_at:
            print("❌ Not logged into LinkedIn in Chrome.")
            print("   Open linkedin.com in Chrome and log in, then try again.")
            await browser.close()
            sys.exit(1)

        page = await ctx.new_page()

        if command == "profile":
            url = arg or input("Profile URL: ")
            print(f"Loading profile: {url}")
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)
            
            result = {"url": url, "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%S")}
            
            try:
                name = await page.inner_text("h1", timeout=5000)
                result["name"] = name.strip()
                print(f"Name: {result['name']}")
            except:
                print("Could not find name")
            
            try:
                headline = await page.inner_text(".text-body-medium.break-words", timeout=3000)
                result["headline"] = headline.strip()
                print(f"Headline: {result['headline']}")
            except:
                pass
            
            try:
                location = await page.inner_text(".text-body-small.inline.t-black--light.break-words", timeout=3000)
                result["location"] = location.strip()
                print(f"Location: {result['location']}")
            except:
                pass
            
            try:
                about = await page.inner_text("#about ~ div .full-width", timeout=3000)
                result["about"] = about.strip()[:500]
            except:
                pass
            
            # Save result
            fname = url.rstrip('/').split('/')[-1]
            out = os.path.join(RESULTS_DIR, f"profile_{fname}_{int(time.time())}.json")
            with open(out, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"\n✅ Saved to: {out}")
            print(json.dumps(result, indent=2))

        elif command == "search":
            query = arg or input("Search query: ")
            search_url = f"https://www.linkedin.com/search/results/people/?keywords={urllib.parse.quote(query)}"
            print(f"Searching: {query}")
            await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)
            
            results = []
            try:
                cards = await page.query_selector_all(".entity-result__item")
                for card in cards[:10]:
                    try:
                        name_el = await card.query_selector(".entity-result__title-text a")
                        name = await name_el.inner_text() if name_el else ""
                        link = await name_el.get_attribute("href") if name_el else ""
                        
                        snippet_el = await card.query_selector(".entity-result__primary-subtitle")
                        snippet = await snippet_el.inner_text() if snippet_el else ""
                        
                        results.append({"name": name.strip(), "link": link, "subtitle": snippet.strip()})
                        print(f"  - {name.strip()} | {snippet.strip()}")
                    except:
                        pass
            except Exception as e:
                print(f"Error scraping results: {e}")
            
            out = os.path.join(RESULTS_DIR, f"search_{int(time.time())}.json")
            with open(out, 'w') as f:
                json.dump({"query": query, "results": results}, f, indent=2)
            print(f"\n✅ {len(results)} results saved to: {out}")

        elif command == "connections":
            print("Loading connections...")
            await page.goto("https://www.linkedin.com/mynetwork/invite-connect/connections/", 
                          wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)
            
            connections = []
            cards = await page.query_selector_all(".mn-connection-card")
            for card in cards[:50]:
                try:
                    name_el = await card.query_selector(".mn-connection-card__name")
                    name = await name_el.inner_text() if name_el else ""
                    occ_el = await card.query_selector(".mn-connection-card__occupation")
                    occ = await occ_el.inner_text() if occ_el else ""
                    link_el = await card.query_selector("a.mn-connection-card__link")
                    link = await link_el.get_attribute("href") if link_el else ""
                    connections.append({"name": name.strip(), "occupation": occ.strip(), "link": link})
                    print(f"  - {name.strip()} | {occ.strip()}")
                except:
                    pass
            
            out = os.path.join(RESULTS_DIR, f"connections_{int(time.time())}.json")
            with open(out, 'w') as f:
                json.dump(connections, f, indent=2)
            print(f"\n✅ {len(connections)} connections saved to: {out}")

        await page.close()
        await browser.close()

if __name__ == "__main__":
    import urllib.parse
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    arg = sys.argv[2] if len(sys.argv) > 2 else None
    asyncio.run(run(cmd, arg))
