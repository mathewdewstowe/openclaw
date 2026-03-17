#!/usr/bin/env python3
"""
LinkedIn via Browserbase cloud browser.

Usage:
  python3 scripts/browserbase-linkedin.py --login       # Interactive login (opens live view URL)
  python3 scripts/browserbase-linkedin.py --status       # Check if session is valid
  python3 scripts/browserbase-linkedin.py --url URL      # Fetch a page
  python3 scripts/browserbase-linkedin.py --url URL --screenshot out.png
"""

import argparse
import json
import os
import sys
import time

BROWSERBASE_API_KEY = os.environ.get("BROWSERBASE_API_KEY", "bb_live_2iE9Ao0WCGYCSBRqMsCsqWmpvbA")
BROWSERBASE_PROJECT_ID = os.environ.get("BROWSERBASE_PROJECT_ID", "8c5d74d3-7d91-455b-9bdd-08e61aee0311")
CONTEXT_ID = os.environ.get("BROWSERBASE_CONTEXT_ID", "e8fa5ace-2a17-4190-be99-d1f6b3d9f187")


def get_bb():
    from browserbase import Browserbase
    return Browserbase(api_key=BROWSERBASE_API_KEY)


def create_session(bb, context_id=None):
    """Create a Browserbase session, optionally with a persistent context."""
    kwargs = {"project_id": BROWSERBASE_PROJECT_ID}
    if context_id:
        kwargs["browser_settings"] = {"context": {"id": context_id, "persist": True}}
    session = bb.sessions.create(**kwargs)
    return session


def run_login():
    """Create a session for interactive LinkedIn login via Browserbase live view."""
    bb = get_bb()
    session = create_session(bb, context_id=CONTEXT_ID)

    print(f"🌐 Browserbase session created: {session.id}")
    print(f"📺 Live view: https://www.browserbase.com/sessions/{session.id}")
    print(f"🔗 Connect URL: {session.connect_url}")
    print()

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(session.connect_url)
        context = browser.contexts[0]
        page = context.pages[0]

        page.goto("https://www.linkedin.com/login", wait_until="networkidle", timeout=30000)
        print(f"📄 Page loaded: {page.url}")
        print()
        print("👉 Open the live view URL above in your browser to log in.")
        print("   After logging in, press Enter here to save the session.")
        input("\n✅ Press Enter when done...")

        # Verify
        page.goto("https://www.linkedin.com/feed/", wait_until="networkidle", timeout=30000)
        if "feed" in page.url:
            print("✅ LinkedIn login saved to Browserbase context!")
        else:
            print(f"⚠️  May not be logged in. URL: {page.url}")

        browser.close()

    print(f"\n💾 Context {CONTEXT_ID} now has your LinkedIn cookies.")
    print("   Future sessions will reuse this login automatically.")


def check_status():
    """Check if the LinkedIn session/context is still valid."""
    bb = get_bb()
    session = create_session(bb, context_id=CONTEXT_ID)

    print(f"🔍 Checking LinkedIn session via Browserbase...")
    print(f"   Session: {session.id}")

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(session.connect_url)
        context = browser.contexts[0]
        page = context.pages[0]

        page.goto("https://www.linkedin.com/feed/", wait_until="networkidle", timeout=30000)
        url = page.url
        title = page.title()

        browser.close()

    if "login" in url or "signin" in url or "checkpoint" in url:
        print(f"❌ Not logged in. URL: {url}")
        print("   Run with --login to authenticate.")
        return False
    elif "feed" in url:
        print(f"✅ LinkedIn session is valid! Title: {title}")
        return True
    else:
        print(f"⚠️  Unknown state. URL: {url}, Title: {title}")
        return False


def fetch_url(url, output_file=None, screenshot=None):
    """Fetch a URL using the persisted context."""
    bb = get_bb()
    session = create_session(bb, context_id=CONTEXT_ID)

    print(f"🌐 Fetching: {url}")
    print(f"   Session: {session.id}")

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(session.connect_url)
        context = browser.contexts[0]
        page = context.pages[0]

        page.goto(url, wait_until="networkidle", timeout=30000)
        time.sleep(2)

        if screenshot:
            page.screenshot(path=screenshot, full_page=True)
            print(f"📸 Screenshot saved: {screenshot}")

        content = page.content()
        browser.close()

    if output_file:
        with open(output_file, "w") as f:
            f.write(content)
        print(f"💾 Saved to: {output_file}")
    else:
        print(content)


def main():
    parser = argparse.ArgumentParser(description="LinkedIn via Browserbase")
    parser.add_argument("--login", action="store_true", help="Interactive login via live view")
    parser.add_argument("--status", action="store_true", help="Check if LinkedIn session is valid")
    parser.add_argument("--url", type=str, help="Fetch a URL")
    parser.add_argument("--output", type=str, help="Save HTML to file")
    parser.add_argument("--screenshot", type=str, help="Save screenshot")

    args = parser.parse_args()

    if args.login:
        run_login()
    elif args.status:
        check_status()
    elif args.url:
        fetch_url(args.url, args.output, args.screenshot)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
