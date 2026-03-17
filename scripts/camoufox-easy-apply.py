#!/usr/bin/env python3
"""
LinkedIn Easy Apply via Camoufox stealth browser.
Works within the search results page — clicks jobs in the left panel,
then clicks Easy Apply in the right detail pane.
"""

import json
import os
import random
import sys
import time
from datetime import datetime, timezone

PROFILE_DIR = os.path.expanduser("~/.stealth-browser/profiles/linkedin")
APPLY_LOG = os.path.expanduser("~/.openclaw/workspace/jobs/apply-log.json")
SCREENSHOT_DIR = os.path.expanduser("~/.openclaw/workspace/jobs/screenshots")

# Form answers
FORM_ANSWERS = {
    "phone": "+447572869043",
    "mobile": "+447572869043",
    "city": "Tenby",
    "location": "Tenby, Wales",
    "salary": "150000",
    "notice": "Immediately",
    "right_to_work": "Yes",
    "sponsor": "No",
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
    """Attempt to fill common Easy Apply form fields."""
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
                inputs = page.query_selector_all(f'input[aria-label*="{pattern}" i]')
                if not inputs:
                    # Try via label text
                    found = page.evaluate(f'''() => {{
                        const labels = [...document.querySelectorAll('label')];
                        for (const label of labels) {{
                            if (label.textContent.toLowerCase().includes("{pattern}")) {{
                                const id = label.getAttribute("for");
                                if (id) {{
                                    const input = document.getElementById(id);
                                    if (input && !input.value) {{ input.focus(); return id; }}
                                }}
                            }}
                        }}
                        return null;
                    }}''')
                    if found:
                        inp = page.query_selector(f"#{found}")
                        if inp:
                            inputs = [inp]

                if inputs:
                    for inp in inputs:
                        current_val = inp.evaluate("el => el.value")
                        if not current_val:
                            inp.click()
                            human_delay(0.2, 0.4)
                            inp.fill(value)
                            filled += 1
                            break
                    break
            except:
                continue

    # Handle select dropdowns
    try:
        selects = page.query_selector_all("select")
        for select in selects:
            label = (select.get_attribute("aria-label") or "").lower()
            options_text = select.evaluate("el => [...el.options].map(o => o.text)")
            
            if any(w in label for w in ["right to work", "authorized", "authorised", "legally", "eligible"]):
                for opt in options_text:
                    if "yes" in opt.lower():
                        select.select_option(label=opt)
                        filled += 1
                        break
            elif any(w in label for w in ["sponsor", "visa"]):
                for opt in options_text:
                    if "no" in opt.lower():
                        select.select_option(label=opt)
                        filled += 1
                        break
            elif not select.evaluate("el => el.value"):
                # Unknown select with no value — try selecting first non-empty option
                if len(options_text) > 1:
                    select.select_option(index=1)
                    filled += 1
    except:
        pass

    return filled


def process_easy_apply_modal(page, job_title, job_company):
    """Walk through the Easy Apply modal steps and submit."""
    max_steps = 10
    
    for step in range(max_steps):
        human_delay(1.5, 2.5)
        
        # Fill fields
        filled = try_fill_fields(page)
        if filled:
            print(f"    Filled {filled} field(s) on step {step + 1}")
        
        # Find action buttons in modal
        btn_info = page.evaluate('''() => {
            const modal = document.querySelector('[role="dialog"], .artdeco-modal, .jobs-easy-apply-modal');
            if (!modal) return {submit: false, review: false, next: false, error: null};
            
            const buttons = [...modal.querySelectorAll('button')];
            let submit = null, review = null, next = null, error = null;
            
            // Check for error messages
            const errors = modal.querySelectorAll('.artdeco-inline-feedback--error, [data-test-form-element-error]');
            if (errors.length) error = [...errors].map(e => e.textContent.trim()).join('; ');
            
            for (const btn of buttons) {
                const text = btn.textContent.trim().toLowerCase();
                const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                const combined = text + ' ' + aria;
                
                if (combined.includes('submit') && combined.includes('applic')) {
                    submit = true;
                } else if (combined.includes('submit')) {
                    submit = true;
                } else if (combined.includes('review')) {
                    review = true;
                } else if (combined.includes('next')) {
                    next = true;
                }
            }
            return {submit, review, next, error};
        }''')
        
        if btn_info.get("error"):
            print(f"    ⚠️  Form errors: {btn_info['error']}")
        
        if btn_info.get("submit"):
            print("  🚀 Submitting application...")
            page.evaluate('''() => {
                const modal = document.querySelector('[role="dialog"], .artdeco-modal');
                const buttons = [...modal.querySelectorAll('button')];
                const submit = buttons.find(b => {
                    const t = (b.textContent + ' ' + (b.getAttribute('aria-label') || '')).toLowerCase();
                    return t.includes('submit');
                });
                if (submit) submit.click();
            }''')
            human_delay(3, 5)
            
            # Take screenshot
            os.makedirs(SCREENSHOT_DIR, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe = "".join(c if c.isalnum() or c in " -_" else "" for c in job_title)[:50]
            screenshot_path = os.path.join(SCREENSHOT_DIR, f"{ts}_{safe}.png")
            page.screenshot(path=screenshot_path)
            print(f"  📸 Screenshot: {screenshot_path}")
            
            # Dismiss success modal
            try:
                page.evaluate('''() => {
                    const btn = document.querySelector('button[aria-label="Dismiss"], button[aria-label="Done"]');
                    if (btn) btn.click();
                }''')
            except:
                pass
            
            return True, screenshot_path
        
        elif btn_info.get("review"):
            print(f"  📋 Step {step + 1}: Review...")
            page.evaluate('''() => {
                const modal = document.querySelector('[role="dialog"], .artdeco-modal');
                const btn = [...modal.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('review'));
                if (btn) btn.click();
            }''')
        
        elif btn_info.get("next"):
            print(f"  ➡️  Step {step + 1}: Next...")
            page.evaluate('''() => {
                const modal = document.querySelector('[role="dialog"], .artdeco-modal');
                const btn = [...modal.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('next'));
                if (btn) btn.click();
            }''')
        
        else:
            print(f"  ⚠️  Step {step + 1}: no button found — may be stuck")
            os.makedirs(SCREENSHOT_DIR, exist_ok=True)
            debug_path = os.path.join(SCREENSHOT_DIR, f"debug_{int(time.time())}.png")
            page.screenshot(path=debug_path)
            print(f"    Debug: {debug_path}")
            
            # Try closing any unexpected dialogs
            try:
                page.evaluate('''() => {
                    const close = document.querySelector('[data-test-modal-close-btn], button[aria-label="Dismiss"]');
                    if (close) close.click();
                }''')
            except:
                pass
            return False, debug_path
    
    return False, None


def search_and_apply(max_applications=5):
    """Search and apply within the search results page."""
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from linkedin_browser import open_browser
    
    apply_log = load_apply_log()
    applied_ids = {e.get("jobId") for e in apply_log if e.get("status") == "Applied"}
    
    print(f"🦊 Starting Camoufox LinkedIn Easy Apply")
    print(f"   Target: {max_applications} applications")
    print(f"   Previously applied: {len(applied_ids)} jobs\n")
    
    with open_browser(headless=True) as browser:
        page = browser.new_page()
        
        search_url = (
            "https://www.linkedin.com/jobs/search/?"
            "keywords=VP%20Product%20OR%20Director%20Product%20OR%20Head%20Product%20OR%20Chief%20Product%20Officer"
            "&f_AL=true"
            "&f_E=4%2C5%2C6"
            "&sortBy=DD"
            "&f_TPR=r604800"
        )
        
        print("🔍 Searching LinkedIn Easy Apply jobs...")
        page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        human_delay(4, 6)
        
        if "login" in page.url:
            print("❌ Not logged in!")
            return []
        
        # Get all job cards from left panel
        job_cards = page.evaluate('''() => {
            // Find all li elements that contain a job link
            const allLi = document.querySelectorAll('li');
            const jobLis = [...allLi].filter(li => li.querySelector('a[href*="/jobs/view/"]'));
            
            return jobLis.map((li, idx) => {
                const link = li.querySelector('a[href*="/jobs/view/"]');
                const href = link?.href || '';
                const jobIdMatch = href.match(/view\\/(\\d+)/);
                const jobId = jobIdMatch ? jobIdMatch[1] : '';
                
                // Title is often the link text or an aria-label
                const title = link?.getAttribute('aria-label') 
                           || link?.textContent?.trim()?.split('\\n')[0]?.trim() 
                           || '';
                
                // Company - look for subtitle-like elements
                const companyEl = li.querySelector('.artdeco-entity-lockup__subtitle, .job-card-container__primary-description, [class*="company"]')
                               || li.querySelectorAll('span')[1];
                const company = companyEl?.textContent?.trim()?.split('\\n')[0]?.trim() || '';
                
                return { index: idx, jobId, title, company, href };
            }).filter(j => j.jobId);
        }''')
        
        print(f"📋 Found {len(job_cards)} job cards")
        
        # Filter already applied
        new_jobs = [j for j in job_cards if j["jobId"] not in applied_ids]
        print(f"🆕 {len(new_jobs)} not yet applied to\n")
        
        if not new_jobs:
            print("No new jobs to apply to!")
            return []
        
        successful = 0
        results = []
        
        for job in new_jobs:
            if successful >= max_applications:
                break
            
            job_id = job["jobId"]
            job_title = job["title"]
            job_company = job["company"]
            
            print(f"\n{'='*50}")
            print(f"📋 [{successful+1}/{max_applications}] {job_title} @ {job_company}")
            
            # Click the job card in the left panel to load it in the right pane
            clicked = page.evaluate(f'''() => {{
                const link = document.querySelector('a[href*="/jobs/view/{job_id}"]');
                if (link) {{ link.click(); return true; }}
                return false;
            }}''')
            
            if not clicked:
                print("  ⚠️  Could not click job card, skipping")
                continue
            
            human_delay(3, 5)
            
            # Find and click the Easy Apply button in the right detail pane
            ea_clicked = page.evaluate('''() => {
                const buttons = [...document.querySelectorAll('button')];
                const eaBtn = buttons.find(b => {
                    const text = b.textContent.trim().toLowerCase();
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    const isApply = (text.includes('easy apply') || aria.includes('easy apply'));
                    const isFilter = aria.includes('filter');
                    return isApply && !isFilter && b.offsetParent !== null;
                });
                if (eaBtn) { eaBtn.click(); return true; }
                return false;
            }''')
            
            if not ea_clicked:
                print("  ❌ No Easy Apply button — may not be Easy Apply or already applied")
                results.append({
                    "jobId": job_id, "title": job_title, "company": job_company,
                    "url": f"https://www.linkedin.com/jobs/view/{job_id}/",
                    "source": "LinkedIn",
                    "appliedAt": datetime.now(timezone.utc).isoformat(),
                    "status": "Failed", "notes": "No Easy Apply button found"
                })
                save_apply_log(load_apply_log() + [results[-1]])
                human_delay(2, 3)
                continue
            
            print("  ✅ Clicked Easy Apply")
            human_delay(2, 3)
            
            # Check modal
            has_modal = page.evaluate('''() => {
                return !!document.querySelector('[role="dialog"], .artdeco-modal, .jobs-easy-apply-modal');
            }''')
            
            if not has_modal:
                human_delay(1, 2)
                has_modal = page.evaluate('''() => {
                    return !!document.querySelector('[role="dialog"], .artdeco-modal');
                }''')
            
            if not has_modal:
                print("  ❌ Modal didn't open")
                entry = {
                    "jobId": job_id, "title": job_title, "company": job_company,
                    "url": f"https://www.linkedin.com/jobs/view/{job_id}/",
                    "source": "LinkedIn",
                    "appliedAt": datetime.now(timezone.utc).isoformat(),
                    "status": "Failed", "notes": "Easy Apply modal did not open"
                }
                apply_log = load_apply_log()
                apply_log.append(entry)
                save_apply_log(apply_log)
                results.append(entry)
                continue
            
            print("  📝 Easy Apply modal opened")
            
            # Process the modal
            success, screenshot = process_easy_apply_modal(page, job_title, job_company)
            
            entry = {
                "jobId": job_id,
                "title": job_title,
                "company": job_company,
                "url": f"https://www.linkedin.com/jobs/view/{job_id}/",
                "source": "LinkedIn",
                "appliedAt": datetime.now(timezone.utc).isoformat(),
                "status": "Applied" if success else "Failed",
                "notes": "Easy Apply via Camoufox" if success else "Easy Apply failed — Camoufox",
                "screenshot": screenshot,
            }
            
            if success:
                successful += 1
                print(f"  ✅ APPLICATION {successful}/{max_applications} SUBMITTED!")
            
            apply_log = load_apply_log()
            apply_log.append(entry)
            save_apply_log(apply_log)
            results.append(entry)
            
            human_delay(5, 10)
        
        print(f"\n{'='*50}")
        print(f"✅ Successfully applied: {successful}/{max_applications}")
        print(f"❌ Failed: {len(results) - successful}")
        
        for r in results:
            status = "✅" if r["status"] == "Applied" else "❌"
            print(f"  {status} {r['title']} @ {r['company']}")
            if r.get("screenshot"):
                print(f"     📸 {r['screenshot']}")
        
        return results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--max", type=int, default=5, help="Max applications")
    args = parser.parse_args()
    search_and_apply(args.max)
