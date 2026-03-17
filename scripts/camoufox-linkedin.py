#!/usr/bin/env python3
"""
LinkedIn session manager using Camoufox stealth browser.
Usage:
  python3 scripts/camoufox-linkedin.py --login       # Interactive login (headed)
  python3 scripts/camoufox-linkedin.py --status       # Check if session is valid
  python3 scripts/camoufox-linkedin.py --url URL      # Fetch a page headless
"""

import argparse
import asyncio
import json
import os
import sys
import time

PROFILE_DIR = os.path.expanduser("~/.stealth-browser/profiles/linkedin")


def run_login():
    """Open a headed browser for interactive LinkedIn login."""
    from camoufox.sync_api import Camoufox

    os.makedirs(PROFILE_DIR, exist_ok=True)

    print("🦊 Opening Camoufox for LinkedIn login...")
    print("   Log in to LinkedIn, then press Enter here when done.")

    with Camoufox(
        headless=False,
        persistent_context=True,
        user_data_dir=PROFILE_DIR,
        humanize=True,
    ) as browser:
        page = browser.new_page()
        page.goto("https://www.linkedin.com/login", wait_until="networkidle")
        input("\n✅ Press Enter after you've logged in to save session...")
        page.goto("https://www.linkedin.com/feed/", wait_until="networkidle")
        if "feed" in page.url:
            print("✅ LinkedIn session saved successfully!")
        else:
            print(f"⚠️  May not be logged in. Current URL: {page.url}")


def check_status():
    """Check if the LinkedIn session is still valid."""
    from camoufox.sync_api import Camoufox

    if not os.path.exists(PROFILE_DIR):
        print("❌ No LinkedIn session found. Run with --login first.")
        return False

    print("🔍 Checking LinkedIn session...")

    with Camoufox(
        headless=True,
        persistent_context=True,
        user_data_dir=PROFILE_DIR,
        humanize=True,
    ) as browser:
        page = browser.new_page()
        page.goto("https://www.linkedin.com/feed/", wait_until="networkidle", timeout=30000)
        url = page.url
        title = page.title()

        if "login" in url or "signin" in url or "checkpoint" in url:
            print(f"❌ Session expired or not logged in. URL: {url}")
            return False
        elif "feed" in url:
            print(f"✅ LinkedIn session is valid! Title: {title}")
            return True
        else:
            print(f"⚠️  Unknown state. URL: {url}, Title: {title}")
            return False


def fetch_url(url, output_file=None, screenshot=None):
    """Fetch a URL using the saved session."""
    from camoufox.sync_api import Camoufox

    if not os.path.exists(PROFILE_DIR):
        print("❌ No LinkedIn session found. Run with --login first.")
        return

    with Camoufox(
        headless=True,
        persistent_context=True,
        user_data_dir=PROFILE_DIR,
        humanize=True,
    ) as browser:
        page = browser.new_page()
        page.goto(url, wait_until="networkidle", timeout=30000)
        time.sleep(2)  # Human-like delay

        if screenshot:
            page.screenshot(path=screenshot)
            print(f"📸 Screenshot saved: {screenshot}")

        content = page.content()
        if output_file:
            with open(output_file, "w") as f:
                f.write(content)
            print(f"💾 Saved to: {output_file}")
        else:
            print(content)


def main():
    parser = argparse.ArgumentParser(description="LinkedIn Camoufox session manager")
    parser.add_argument("--login", action="store_true", help="Interactive login (headed browser)")
    parser.add_argument("--status", action="store_true", help="Check if session is valid")
    parser.add_argument("--url", type=str, help="Fetch a URL using saved session")
    parser.add_argument("--output", type=str, help="Save HTML to file")
    parser.add_argument("--screenshot", type=str, help="Save screenshot to file")

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
