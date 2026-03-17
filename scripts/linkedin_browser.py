#!/usr/bin/env python3
"""
Reusable LinkedIn browser helper with consistent fingerprint.
The key insight: each Camoufox() launch generates a NEW random fingerprint.
LinkedIn sees different fingerprint + same cookies = session invalidated.
Fix: generate fingerprint once, reuse it every time.
"""

import json
import os
import pickle
from browserforge.fingerprints import FingerprintGenerator, Fingerprint
from camoufox.sync_api import Camoufox

PROFILE_DIR = os.path.expanduser("~/.stealth-browser/profiles/linkedin")
FINGERPRINT_FILE = os.path.join(PROFILE_DIR, "fingerprint.pkl")


def get_or_create_fingerprint():
    """Load saved fingerprint or generate a new one."""
    if os.path.exists(FINGERPRINT_FILE):
        with open(FINGERPRINT_FILE, "rb") as f:
            fp = pickle.load(f)
            print(f"🔑 Loaded saved fingerprint")
            return fp
    
    fg = FingerprintGenerator()
    fp = fg.generate(browser="firefox", os="windows")
    
    os.makedirs(PROFILE_DIR, exist_ok=True)
    with open(FINGERPRINT_FILE, "wb") as f:
        pickle.dump(fp, f)
    os.chmod(FINGERPRINT_FILE, 0o600)
    print(f"🔑 Generated and saved new fingerprint")
    return fp


def open_browser(headless=True):
    """Open a Camoufox browser with consistent fingerprint and persistent profile."""
    fp = get_or_create_fingerprint()
    os.makedirs(PROFILE_DIR, exist_ok=True)
    
    return Camoufox(
        headless=headless,
        persistent_context=True,
        user_data_dir=PROFILE_DIR,
        humanize=True,
        fingerprint=fp,
        i_know_what_im_doing=True,
    )


def reset_fingerprint():
    """Delete saved fingerprint (use when you need to re-login)."""
    if os.path.exists(FINGERPRINT_FILE):
        os.remove(FINGERPRINT_FILE)
        print("🗑️ Fingerprint deleted. Will generate new one on next launch.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Reset fingerprint")
    parser.add_argument("--test", action="store_true", help="Test session")
    parser.add_argument("--login", action="store_true", help="Login (headed)")
    args = parser.parse_args()
    
    if args.reset:
        reset_fingerprint()
    elif args.login:
        import time
        # Delete old fingerprint + profile for clean start
        reset_fingerprint()
        import shutil
        if os.path.exists(PROFILE_DIR):
            shutil.rmtree(PROFILE_DIR)
        os.makedirs(PROFILE_DIR, exist_ok=True)
        
        print("🦊 Opening browser for login...")
        with open_browser(headless=False) as browser:
            page = browser.new_page()
            page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded", timeout=30000)
            print("👉 Log in, then press Enter")
            input()
            page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=30000)
            time.sleep(3)
            if "feed" in page.url:
                print("✅ Logged in and saved!")
            else:
                print(f"⚠️ URL: {page.url}")
        
        # Immediately verify headless
        print("\n🔍 Verifying headless works...")
        with open_browser(headless=True) as browser:
            page = browser.new_page()
            page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=30000)
            time.sleep(4)
            if "feed" in page.url:
                print("✅ Headless session confirmed!")
            else:
                print(f"❌ Headless failed: {page.url}")
    
    elif args.test:
        import time
        print("🔍 Testing headless session...")
        with open_browser(headless=True) as browser:
            page = browser.new_page()
            page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=30000)
            time.sleep(4)
            print(f"URL: {page.url}")
            print(f"Title: {page.title()}")
            if "feed" in page.url:
                print("✅ Session valid!")
            else:
                print("❌ Not logged in")
