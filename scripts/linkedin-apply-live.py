#!/usr/bin/env python3
"""
LinkedIn Easy Apply — single long-lived browser session.
Logs in, then applies to jobs, all in ONE browser instance.
No start/stop between login and apply.
"""

import json
import os
import random
import time
from datetime import datetime, timezone

PROFILE_DIR = os.path.expanduser("~/.stealth-browser/profiles/linkedin")
APPLY_LOG = os.path.expanduser("~/.openclaw/workspace/jobs/apply-log.json")
SCREENSHOT_DIR = os.path.expanduser("~/.openclaw/workspace/jobs/screenshots")

FORM_ANSWERS = {
    "phone": "+447572869043",
    "city": "Tenby",
    "salary": "150000",
    "notice": "Immediately",
    "years_experience": "15",
    "linkedin": "https://www.linkedin.com/in/me/",
    "website": "https://nthlayer.co.uk",
}


def load_apply_log():
    if os.path.exists(APPLY_LOG):
        return json.load(open(APPLY_LOG))
    return []


def save_apply_log(log):
    os.makedirs(os.path.dirname(APPLY_LOG), exist_ok=True)
    with open(APPLY_LOG, "w") as f:
        json.dump(log, f, indent=2)


def human_delay(min_s=1.5, max_s=3.5):
    time.sleep(random.uniform(min_s, max_s))


def try_fill_fields(page):
    filled = 0
    field_map = [
        (["phone", "mobile", "cell"], FORM_ANSWERS["phone"]),
        (["city", "location"], FORM_ANSWERS["city"]),
        (["salary", "compensation", "pay", "desired", "expected"], FORM_ANSWERS["salary"]),
        (["notice", "start date", "available", "availability"], FORM_ANSWERS["notice"]),
        (["years", "experience"], FORM_ANSWERS["years_experience"]),
        (["linkedin", "profile url"], FORM_ANSWERS["linkedin"]),
        (["website", "portfolio"], FORM_ANSWERS["website"]),
    ]
    for patterns, value in field_map:
        for pattern in patterns:
            try:
                found = page.evaluate("""(pattern) => {
                    const inputs = document.querySelectorAll('input, textarea');
                    for (const inp of inputs) {
                        const label = inp.getAttribute('aria-label') || '';
                        const placeholder = inp.getAttribute('placeholder') || '';
                        const id = inp.id || '';
                        const combined = (label + ' ' + placeholder + ' ' + id).toLowerCase();
                        if (combined.includes(pattern) && !inp.value) {
                            inp.focus();
                            inp.value = '';
                            return inp.id || 'found';
                        }
                    }
                    return null;
                }""", pattern)
                if found:
                    if found != 'found':
                        inp = page.query_selector(f"#{found}")
                    else:
                        inp = page.query_selector(f'input[aria-label*="{pattern}" i], textarea[aria-label*="{pattern}" i]')
                    if inp:
                        inp.fill(value)
                        filled += 1
                        break
            except:
                continue

    # Handle selects
    try:
        page.evaluate("""() => {
            const selects = document.querySelectorAll('select');
            for (const sel of selects) {
                if (sel.value) continue;
                const opts = [...sel.options];
                const yesOpt = opts.find(o => o.text.toLowerCase().includes('yes'));
                if (yesOpt) { sel.value = yesOpt.value; sel.dispatchEvent(new Event('change')); }
                else if (opts.length > 1) { sel.value = opts[1].value; sel.dispatchEvent(new Event('change')); }
            }
        }""")
    except:
        pass
    return filled


def process_modal(page, job_title):
    for step in range(10):
        human_delay(1.5, 2.5)
        filled = try_fill_fields(page)
        if filled:
            print(f"    Filled {filled} field(s)")

        btn_info = page.evaluate("""() => {
            const modal = document.querySelector('[role="dialog"], .artdeco-modal');
            if (!modal) return {submit: false, review: false, next: false};
            const buttons = [...modal.querySelectorAll('button')];
            let result = {submit: false, review: false, next: false};
            for (const btn of buttons) {
                const t = (btn.textContent + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
                if (t.includes('submit')) result.submit = true;
                else if (t.includes('review')) result.review = true;
                else if (t.includes('next')) result.next = true;
            }
            return result;
        }""")

        if btn_info.get("submit"):
            print("  🚀 Submitting...")
            page.evaluate("""() => {
                const modal = document.querySelector('[role="dialog"], .artdeco-modal');
                const btn = [...modal.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('submit'));
                if (btn) btn.click();
            }""")
            human_delay(3, 5)
            os.makedirs(SCREENSHOT_DIR, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe = "".join(c if c.isalnum() or c in " -_" else "" for c in job_title)[:50]
            path = os.path.join(SCREENSHOT_DIR, f"{ts}_{safe}.png")
            page.screenshot(path=path)
            # Dismiss
            try:
                page.evaluate('() => { const b = document.querySelector(\'button[aria-label="Dismiss"], button[aria-label="Done"]\'); if (b) b.click(); }')
            except:
                pass
            return True, path

        elif btn_info.get("review"):
            print(f"  📋 Step {step+1}: Review...")
            page.evaluate("""() => {
                const modal = document.querySelector('[role="dialog"], .artdeco-modal');
                const btn = [...modal.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('review'));
                if (btn) btn.click();
            }""")
        elif btn_info.get("next"):
            print(f"  ➡️  Step {step+1}: Next...")
            page.evaluate("""() => {
                const modal = document.querySelector('[role="dialog"], .artdeco-modal');
                const btn = [...modal.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('next'));
                if (btn) btn.click();
            }""")
        else:
            os.makedirs(SCREENSHOT_DIR, exist_ok=True)
            path = os.path.join(SCREENSHOT_DIR, f"debug_{int(time.time())}.png")
            page.screenshot(path=path)
            print(f"  ⚠️  Stuck at step {step+1}. Debug: {path}")
            try:
                page.evaluate('() => { const b = document.querySelector(\'[data-test-modal-close-btn], button[aria-label="Dismiss"]\'); if (b) b.click(); }')
            except:
                pass
            return False, path

    return False, None


def main(max_apps=5):
    from camoufox.sync_api import Camoufox

    apply_log = load_apply_log()
    applied_ids = {e.get("jobId") for e in apply_log if e.get("status") == "Applied"}

    print(f"🦊 Starting LinkedIn Easy Apply (single session)")
    print(f"   Target: {max_apps} applications")
    print(f"   Previously applied: {len(applied_ids)} jobs")
    print()
    print("   Browser will open — log in if needed, then it will search & apply.")
    print()

    os.makedirs(PROFILE_DIR, exist_ok=True)

    with Camoufox(headless=False, persistent_context=True, user_data_dir=PROFILE_DIR, humanize=True) as browser:
        page = browser.new_page()

        # Check if logged in
        page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=30000)
        time.sleep(4)
        if "login" in page.url or "authwall" in page.url:
            print("🔒 Not logged in. Please log in in the browser window.")
            print("   Press Enter when done...")
            input()
            page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=30000)
            time.sleep(3)

        if "feed" not in page.url:
            print(f"❌ Still not logged in: {page.url}")
            return

        print("✅ Logged in!")

        # Search Easy Apply jobs
        search_url = (
            "https://www.linkedin.com/jobs/search/?"
            "keywords=VP%20Product%20OR%20Director%20Product%20OR%20Head%20Product%20OR%20Chief%20Product%20Officer"
            "&f_AL=true&f_E=4%2C5%2C6&sortBy=DD&f_TPR=r604800"
        )
        print("\n🔍 Searching...")
        page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(6)

        # Extract jobs from links
        jobs = page.evaluate("""() => {
            const links = document.querySelectorAll('a[href*="/jobs/view/"]');
            const seen = new Set();
            const results = [];
            for (const a of links) {
                const m = a.href.match(/view\\/(\\d+)/);
                if (m && !seen.has(m[1])) {
                    seen.add(m[1]);
                    const title = a.getAttribute('aria-label') || a.textContent.trim().split('\\n')[0].trim();
                    results.push({jobId: m[1], title: title, href: a.href});
                }
            }
            return results;
        }""")

        print(f"📋 Found {len(jobs)} jobs")
        new_jobs = [j for j in jobs if j["jobId"] not in applied_ids]
        print(f"🆕 {len(new_jobs)} not yet applied to\n")

        successful = 0
        results = []

        for job in new_jobs:
            if successful >= max_apps:
                break

            job_id = job["jobId"]
            job_title = job["title"]

            print(f"\n{'='*50}")
            print(f"📋 [{successful+1}/{max_apps}] {job_title[:70]}")

            # Click the job link
            clicked = page.evaluate(f"""() => {{
                const link = document.querySelector('a[href*="/jobs/view/{job_id}"]');
                if (link) {{ link.click(); return true; }}
                return false;
            }}""")

            if not clicked:
                print("  ⚠️  Could not click job")
                continue

            human_delay(3, 5)

            # Click Easy Apply
            ea = page.evaluate("""() => {
                const buttons = [...document.querySelectorAll('button')];
                const btn = buttons.find(b => {
                    const t = b.textContent.toLowerCase();
                    const a = (b.getAttribute('aria-label') || '').toLowerCase();
                    return (t.includes('easy apply') || a.includes('easy apply')) && !a.includes('filter') && b.offsetParent;
                });
                if (btn) { btn.click(); return true; }
                return false;
            }""")

            if not ea:
                print("  ❌ No Easy Apply button")
                continue

            print("  ✅ Clicked Easy Apply")
            human_delay(2, 3)

            # Check modal
            has_modal = page.evaluate('() => !!document.querySelector("[role=dialog], .artdeco-modal")')
            if not has_modal:
                human_delay(1.5, 2)
                has_modal = page.evaluate('() => !!document.querySelector("[role=dialog], .artdeco-modal")')
            if not has_modal:
                print("  ❌ Modal didn't open")
                continue

            print("  📝 Modal opened")
            success, screenshot = process_modal(page, job_title)

            entry = {
                "jobId": job_id,
                "title": job_title,
                "company": "",
                "url": f"https://www.linkedin.com/jobs/view/{job_id}/",
                "source": "LinkedIn",
                "appliedAt": datetime.now(timezone.utc).isoformat(),
                "status": "Applied" if success else "Failed",
                "notes": "Easy Apply via Camoufox" if success else "Failed",
                "screenshot": screenshot,
            }

            if success:
                successful += 1
                print(f"  ✅ APPLICATION {successful}/{max_apps} SUBMITTED!")

            apply_log.append(entry)
            save_apply_log(apply_log)
            results.append(entry)
            human_delay(5, 10)

        print(f"\n{'='*50}")
        print(f"✅ Applied: {successful}/{max_apps}")
        for r in results:
            s = "✅" if r["status"] == "Applied" else "❌"
            print(f"  {s} {r['title'][:60]}")
            if r.get("screenshot"):
                print(f"     📸 {r['screenshot']}")

        return results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--max", type=int, default=5)
    args = parser.parse_args()
    main(args.max)
