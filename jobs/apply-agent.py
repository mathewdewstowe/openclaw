#!/usr/bin/env python3
"""LinkedIn Easy Apply Agent - connects to Chrome CDP and applies to jobs"""

import json
import os
import time
import random
import re
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, Page, ElementHandle

SCREENSHOT_DIR = Path("/home/matthewdewstowe/.openclaw/workspace/jobs/screenshots")
APPLY_LOG = Path("/home/matthewdewstowe/.openclaw/workspace/jobs/apply-log.json")
CDP_URL = "http://localhost:9222"

SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

# All job IDs to skip (already applied or in skip list)
SKIP_IDS = {
    "4385923362", "4384468882", "4385902292", "4386767048",
    "4384473029", "4384473015", "4384453863", "4385694141",
    # Also skip ones already successfully applied
    "4386313963", "4374713221", "4373556372", "4374574017", "4382202574",
}

KNOWN_ANSWERS = {
    "email": "matthewdewstowe@gmail.com",
    "phone": "+447572869043",
    "location": "Cardiff",
    "city": "Cardiff",
    "right_to_work": "Yes",
    "sponsorship": "No",
    "notice_period": "Immediately",
    "hybrid": "Yes",
    "remote": "Yes",
    "linkedin": "https://www.linkedin.com/in/me/",
    "website": "https://nthlayer.co.uk",
    "saas_experience": "25",
    "ppm_experience": "15",
}

def screenshot(page: Page, name: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = re.sub(r'[^\w\-]', '_', name)[:60]
    path = str(SCREENSHOT_DIR / f"{ts}_{safe_name}.png")
    page.screenshot(path=path)
    print(f"[screenshot] {path}")
    return path

def human_delay(min_ms=1000, max_ms=3000):
    time.sleep(random.uniform(min_ms/1000, max_ms/1000))

def type_slowly(page: Page, selector: str, text: str):
    """Type text character by character with random delays"""
    el = page.locator(selector).first
    el.click()
    time.sleep(0.3)
    el.fill("")
    for char in text:
        el.type(char)
        time.sleep(random.uniform(0.05, 0.15))

def load_apply_log():
    if APPLY_LOG.exists():
        return json.loads(APPLY_LOG.read_text())
    return []

def save_apply_log(log):
    APPLY_LOG.write_text(json.dumps(log, indent=2))

def log_application(log, job_id, title, company, url, status, notes="", screenshot_path=None):
    entry = {
        "jobId": job_id,
        "title": title,
        "url": url,
        "source": "LinkedIn",
        "appliedAt": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "notes": notes,
        "screenshot": screenshot_path,
    }
    if company:
        entry["company"] = company
    log.append(entry)
    save_apply_log(log)
    print(f"[log] {status} — {title} at {company}")

def get_already_applied_ids(log):
    applied = set()
    for entry in log:
        if entry.get("status") == "Applied":
            applied.add(str(entry["jobId"]))
    return applied

def handle_easy_apply_modal(page: Page, job_id: str, title: str, company: str, url: str, log: list) -> bool:
    """Handle the Easy Apply modal - fill all form steps and submit"""
    print(f"\n[apply] Starting application for: {title}")
    
    max_steps = 10
    step = 0
    ss_path = None
    
    while step < max_steps:
        step += 1
        human_delay(1500, 3000)
        
        # Take screenshot of current state
        ss_path = screenshot(page, f"step{step}_{job_id}_{title[:30]}")
        
        # Check if we're done (success message)
        if page.locator("text=Application submitted").count() > 0 or \
           page.locator("text=Your application was sent").count() > 0 or \
           page.locator("[data-test-modal] h2:has-text('sent')").count() > 0:
            print(f"[apply] SUCCESS - Application submitted for {title}")
            log_application(log, job_id, title, company, url, "Applied", 
                          "Easy Apply via Chrome CDP", ss_path)
            # Close the modal
            close_btn = page.locator("button[aria-label='Dismiss']").first
            if close_btn.count() > 0:
                close_btn.click()
            return True
        
        # Fill in form fields
        fill_form_fields(page)
        
        # Check for Next button
        next_btn = page.locator("button:has-text('Next')").first
        review_btn = page.locator("button:has-text('Review')").first
        submit_btn = page.locator("button:has-text('Submit application')").first
        
        if submit_btn.is_visible():
            print("[apply] Clicking Submit application")
            submit_btn.click()
            human_delay(2000, 4000)
            continue
            
        if review_btn.is_visible():
            print("[apply] Clicking Review")
            review_btn.click()
            human_delay(2000, 4000)
            continue
            
        if next_btn.is_visible():
            print("[apply] Clicking Next")
            next_btn.click()
            human_delay(2000, 4000)
            continue
        
        # Check for unsubmit state (already applied?)
        if page.locator("text=already applied").count() > 0:
            print(f"[apply] Already applied to {title}")
            log_application(log, job_id, title, company, url, "Already Applied", 
                          "Already applied previously")
            return False
        
        print(f"[apply] No navigation buttons found at step {step}, checking state...")
        # Try to find any button in modal
        modal_buttons = page.locator(".jobs-easy-apply-modal button").all()
        print(f"[apply] Found {len(modal_buttons)} buttons in modal")
        for btn in modal_buttons:
            txt = btn.inner_text().strip()
            print(f"  Button: '{txt}'")
        
        break
    
    print(f"[apply] Failed to complete application for {title}")
    log_application(log, job_id, title, company, url, "Failed", 
                  "Could not complete Easy Apply flow", ss_path)
    return False

def fill_form_fields(page: Page):
    """Fill all known form fields on the current page"""
    
    # Handle radio buttons for sponsorship questions
    # "Will you now or in the future require sponsorship?" -> No
    sponsorship_patterns = [
        "sponsorship", "visa", "work authorization", "right to work"
    ]
    
    # Find all fieldsets/form groups
    try:
        # Handle "No" for sponsorship radio buttons
        labels = page.locator("label").all()
        for label in labels:
            try:
                text = label.inner_text().strip().lower()
                if any(p in text for p in sponsorship_patterns):
                    # Look for sibling "No" radio
                    parent = label.locator("xpath=ancestor::fieldset").first
                    if parent.count() > 0:
                        no_radio = parent.locator("input[type='radio']").filter(
                            has=page.locator("xpath=following-sibling::label[contains(text(),'No')]")
                        ).first
                        # Try different approach - find No option in the same group
                        no_label = parent.locator("label:has-text('No')").first
                        if no_label.count() > 0:
                            radio_id = no_label.get_attribute("for")
                            if radio_id:
                                radio = page.locator(f"#{radio_id}").first
                                if radio.count() > 0 and not radio.is_checked():
                                    radio.click()
                                    print(f"[fill] Selected No for: {text[:50]}")
                                    human_delay(500, 1000)
            except Exception:
                pass

        # Handle select dropdowns
        selects = page.locator("select").all()
        for sel in selects:
            try:
                # Get the label for this select
                sel_id = sel.get_attribute("id") or ""
                label_el = page.locator(f"label[for='{sel_id}']").first if sel_id else None
                label_text = label_el.inner_text().lower() if label_el and label_el.count() > 0 else ""
                
                # Get current value
                current_val = sel.input_value()
                if current_val and current_val != "Select an option":
                    continue  # Already filled
                
                # Determine what to select based on label
                if any(p in label_text for p in sponsorship_patterns):
                    sel.select_option(label="No")
                    print(f"[fill] Set dropdown to No for: {label_text[:50]}")
                elif "hybrid" in label_text:
                    sel.select_option(label="Yes")
                    print(f"[fill] Set dropdown to Yes for: {label_text[:50]}")
                elif "remote" in label_text:
                    sel.select_option(label="Yes")
                    print(f"[fill] Set dropdown to Yes for: {label_text[:50]}")
                elif "notice" in label_text:
                    # Try "Immediately" or "0 months" or similar
                    options = sel.locator("option").all()
                    for opt in options:
                        opt_text = opt.inner_text().lower()
                        if "immediate" in opt_text or opt_text in ["0", "< 1 month", "less than 1"]:
                            sel.select_option(value=opt.get_attribute("value"))
                            print(f"[fill] Set notice period")
                            break
            except Exception as e:
                print(f"[fill] Select error: {e}")
        
        # Handle text inputs
        inputs = page.locator("input[type='text'], input[type='email'], input[type='tel']").all()
        for inp in inputs:
            try:
                inp_id = inp.get_attribute("id") or ""
                inp_type = inp.get_attribute("type") or "text"
                label_el = page.locator(f"label[for='{inp_id}']").first if inp_id else None
                label_text = label_el.inner_text().lower() if label_el and label_el.count() > 0 else ""
                placeholder = (inp.get_attribute("placeholder") or "").lower()
                
                current_val = inp.input_value()
                if current_val:
                    continue  # Already filled
                
                fill_val = None
                if inp_type == "email" or "email" in label_text or "email" in placeholder:
                    fill_val = KNOWN_ANSWERS["email"]
                elif inp_type == "tel" or "phone" in label_text or "mobile" in label_text:
                    fill_val = KNOWN_ANSWERS["phone"]
                elif "city" in label_text or "location" in label_text:
                    fill_val = KNOWN_ANSWERS["city"]
                elif "linkedin" in label_text or "linkedin" in placeholder:
                    fill_val = KNOWN_ANSWERS["linkedin"]
                elif "website" in label_text or "portfolio" in label_text:
                    fill_val = KNOWN_ANSWERS["website"]
                
                if fill_val:
                    inp.click()
                    time.sleep(0.3)
                    for char in fill_val:
                        inp.type(char)
                        time.sleep(random.uniform(0.05, 0.15))
                    print(f"[fill] Typed '{fill_val[:30]}' for: {label_text[:30] or placeholder[:30]}")
                    human_delay(300, 700)
            except Exception as e:
                print(f"[fill] Input error: {e}")
        
        # Handle radio button groups for Yes/No questions
        fieldsets = page.locator("fieldset").all()
        for fs in fieldsets:
            try:
                legend = fs.locator("legend").first
                legend_text = legend.inner_text().lower() if legend.count() > 0 else ""
                
                if not legend_text:
                    continue
                
                # Check if any radio is already selected
                checked = fs.locator("input[type='radio']:checked").count()
                if checked > 0:
                    continue  # Already answered
                
                # Determine answer
                answer = None
                if any(p in legend_text for p in sponsorship_patterns):
                    answer = "No"
                elif "hybrid" in legend_text:
                    answer = "Yes"
                elif "remote" in legend_text:
                    answer = "Yes"
                elif "right to work" in legend_text or "work in the uk" in legend_text:
                    answer = "Yes"
                elif "currently live" in legend_text or "based in" in legend_text:
                    answer = "Yes"
                
                if answer:
                    target_label = fs.locator(f"label:has-text('{answer}')").first
                    if target_label.count() > 0:
                        radio_id = target_label.get_attribute("for")
                        if radio_id:
                            radio = page.locator(f"#{radio_id}").first
                            if radio.count() > 0:
                                radio.click()
                                print(f"[fill] Selected '{answer}' for: {legend_text[:60]}")
                                human_delay(300, 700)
            except Exception as e:
                print(f"[fill] Fieldset error: {e}")
                
    except Exception as e:
        print(f"[fill] General error: {e}")

def find_and_apply_jobs(page: Page, log: list, applied_ids: set, target_count: int = 5):
    """Find Easy Apply jobs on the current search results page and apply"""
    applied = 0
    
    # Navigate to the search results if not already there
    current_url = page.url
    print(f"[search] Current URL: {current_url}")
    
    # Try to get job listings
    search_url = "https://www.linkedin.com/jobs/search/?keywords=Product%20Director%20OR%20Head%20of%20Product%20OR%20VP%20Product&location=United%20Kingdom&f_AL=true&f_WT=2"
    
    if "jobs/search" not in current_url and "jobs/collections" not in current_url:
        print(f"[search] Navigating to job search...")
        page.goto(search_url)
        human_delay(3000, 5000)
        screenshot(page, "search_results")
    
    # Keep scrolling and applying
    attempts = 0
    max_attempts = 30
    
    while applied < target_count and attempts < max_attempts:
        attempts += 1
        
        # Find all job cards with Easy Apply
        job_cards = page.locator(".jobs-search-results__list-item").all()
        
        if not job_cards:
            job_cards = page.locator("[data-occludable-job-id]").all()
        
        print(f"[search] Found {len(job_cards)} job cards")
        
        found_new = False
        for card in job_cards:
            try:
                job_id_attr = card.get_attribute("data-occludable-job-id") or \
                              card.get_attribute("data-job-id") or ""
                
                if not job_id_attr:
                    # Try to extract from link
                    link = card.locator("a[href*='/jobs/view/']").first
                    if link.count() > 0:
                        href = link.get_attribute("href") or ""
                        m = re.search(r'/jobs/view/(\d+)', href)
                        if m:
                            job_id_attr = m.group(1)
                
                if not job_id_attr or str(job_id_attr) in applied_ids or str(job_id_attr) in SKIP_IDS:
                    continue
                
                # Check if this job has Easy Apply
                easy_apply_badge = card.locator("text=Easy Apply").count()
                if easy_apply_badge == 0:
                    # Check within the card for Easy Apply indicator
                    li_easy = card.locator(".job-card-container__apply-method").inner_text() \
                        if card.locator(".job-card-container__apply-method").count() > 0 else ""
                    if "easy apply" not in li_easy.lower():
                        continue
                
                # Get job title and company
                title_el = card.locator(".artdeco-entity-lockup__title, .job-card-list__title, h3").first
                title = title_el.inner_text().strip() if title_el.count() > 0 else "Unknown"
                
                company_el = card.locator(".artdeco-entity-lockup__subtitle, .job-card-container__company-name, h4").first
                company = company_el.inner_text().strip() if company_el.count() > 0 else "Unknown"
                
                job_url = f"https://www.linkedin.com/jobs/view/{job_id_attr}/"
                
                print(f"\n[search] Found: {title} at {company} (ID: {job_id_attr})")
                found_new = True
                
                # Click on the job to open it
                card.click()
                human_delay(2000, 4000)
                
                screenshot(page, f"job_detail_{job_id_attr}")
                
                # Look for Easy Apply button
                ea_btn = page.locator("button:has-text('Easy Apply')").first
                if ea_btn.count() == 0:
                    ea_btn = page.locator(".jobs-apply-button").first
                
                if ea_btn.count() == 0:
                    print(f"[search] No Easy Apply button found for {title}")
                    applied_ids.add(str(job_id_attr))
                    continue
                
                # Click Easy Apply
                ea_btn.click()
                human_delay(2000, 3000)
                
                # Handle the modal
                success = handle_easy_apply_modal(page, str(job_id_attr), title, company, job_url, log)
                
                applied_ids.add(str(job_id_attr))
                if success:
                    applied += 1
                    print(f"[search] Applied to {applied}/{target_count} jobs")
                
                if applied >= target_count:
                    break
                    
                # Wait between applications
                human_delay(3000, 6000)
                
            except Exception as e:
                print(f"[search] Error processing card: {e}")
                continue
        
        if applied >= target_count:
            break
            
        if not found_new:
            # Scroll down to load more jobs
            print("[search] Scrolling to load more jobs...")
            page.evaluate("window.scrollBy(0, 600)")
            human_delay(2000, 3000)
            
            # Try next page
            next_btn = page.locator("button[aria-label='Next']").first
            if next_btn.count() > 0 and next_btn.is_enabled():
                next_btn.click()
                human_delay(3000, 5000)
                screenshot(page, f"search_page_{attempts}")
            else:
                print("[search] No more pages")
                break
    
    return applied


def finish_current_application(page: Page, log: list):
    """Finish the currently open application modal"""
    print("[current] Checking for open application modal...")
    
    # Check if Easy Apply modal is open
    modal = page.locator(".jobs-easy-apply-modal, [data-test-modal]").first
    if modal.count() == 0:
        print("[current] No modal open")
        return False
    
    print("[current] Modal is open, finishing application...")
    screenshot(page, "current_app_state")
    
    # Get job info from page
    title = "Product Director – Rapidly Scaling SaaS"
    company = "Areti Group"
    job_id = "4386313963"  # Based on task description
    url = f"https://www.linkedin.com/jobs/view/{job_id}/"
    
    # Try to get from page
    try:
        title_el = page.locator(".jobs-easy-apply-modal h2").first
        if title_el.count() > 0:
            title = title_el.inner_text().strip()
    except:
        pass
    
    # Fill in sponsorship = No
    print("[current] Looking for sponsorship question...")
    fill_form_fields(page)
    
    human_delay(1000, 2000)
    screenshot(page, "after_fill")
    
    # Try Review button first
    review_btn = page.locator("button:has-text('Review')").first
    if review_btn.is_visible():
        print("[current] Clicking Review...")
        review_btn.click()
        human_delay(2000, 3000)
        screenshot(page, "after_review")
    
    # Try Submit
    submit_btn = page.locator("button:has-text('Submit application')").first
    if submit_btn.is_visible():
        print("[current] Clicking Submit application...")
        submit_btn.click()
        human_delay(2000, 3000)
        screenshot(page, "after_submit")
    
    # Check success
    if page.locator("text=Application submitted, text=Your application was sent").count() > 0:
        print("[current] Application submitted successfully!")
        ss = screenshot(page, f"success_{job_id}")
        log_application(log, job_id, title, company, url, "Applied", 
                       "Easy Apply via Chrome CDP - finished open modal", ss)
        # Dismiss
        try:
            page.locator("button[aria-label='Dismiss']").first.click()
        except:
            pass
        return True
    
    # Run the full modal handler
    return handle_easy_apply_modal(page, job_id, title, company, url, log)


def main():
    print("=== LinkedIn Easy Apply Agent ===")
    print(f"Time: {datetime.now().isoformat()}")
    
    log = load_apply_log()
    applied_ids = get_already_applied_ids(log)
    applied_ids.update(SKIP_IDS)
    
    print(f"[init] Already applied to {len(applied_ids)} jobs")
    
    with sync_playwright() as p:
        print(f"[init] Connecting to Chrome CDP at {CDP_URL}...")
        browser = p.chromium.connect_over_cdp(CDP_URL)
        
        context = browser.contexts[0]
        pages = context.pages
        
        print(f"[init] Found {len(pages)} open pages")
        for i, pg in enumerate(pages):
            print(f"  Page {i}: {pg.url[:80]}")
        
        # Find the LinkedIn page (preferably the one with the modal)
        linkedin_page = None
        for pg in pages:
            if "linkedin.com" in pg.url:
                # Prefer pages with job modal open
                if pg.locator(".jobs-easy-apply-modal").count() > 0:
                    linkedin_page = pg
                    print(f"[init] Found LinkedIn page with modal: {pg.url[:80]}")
                    break
        
        if not linkedin_page:
            # Just find any LinkedIn page
            for pg in pages:
                if "linkedin.com" in pg.url:
                    linkedin_page = pg
                    print(f"[init] Found LinkedIn page: {pg.url[:80]}")
                    break
        
        if not linkedin_page:
            print("[error] No LinkedIn page found!")
            return
        
        page = linkedin_page
        
        # Step 1: Finish any open application
        applied_count = 0
        has_modal = page.locator(".jobs-easy-apply-modal").count() > 0 or \
                    page.locator("[data-test-modal]").count() > 0
        
        if has_modal:
            print("[main] Open modal detected, finishing current application...")
            success = finish_current_application(page, log)
            if success:
                applied_count += 1
        else:
            print("[main] No modal detected, proceeding to search...")
        
        # Step 2: Apply to more jobs
        target_remaining = 5 - applied_count
        if target_remaining > 0:
            print(f"\n[main] Need to apply to {target_remaining} more jobs...")
            new_applied = find_and_apply_jobs(page, log, applied_ids, target_remaining)
            applied_count += new_applied
        
        print(f"\n=== DONE ===")
        print(f"Applied to {applied_count} jobs in this session")
        
        # Print summary
        recent = [e for e in log if e.get("status") == "Applied"][-5:]
        print("\nRecent applications:")
        for e in recent:
            print(f"  ✓ {e['title']} at {e.get('company', 'Unknown')} ({e['appliedAt']})")
        
        browser.close()

if __name__ == "__main__":
    main()
