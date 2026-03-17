#!/usr/bin/env python3
"""
LinkedIn Easy Apply — Learning Mode.
Screenshots every form step, asks for unknown answers.
Types humanistically with random delays.
"""

import json
import os
import random
import time
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright

CDP_URL = "http://localhost:9222"
APPLY_LOG = os.path.expanduser("~/.openclaw/workspace/jobs/apply-log.json")
SCREENSHOT_DIR = os.path.expanduser("~/.openclaw/workspace/jobs/screenshots")
ANSWERS_FILE = os.path.expanduser("~/.openclaw/workspace/jobs/learned-answers.json")

# Known answers
KNOWN_ANSWERS = {
    "phone": "+447572869043",
    "mobile": "+447572869043",
    "city": "Cardiff",
    "location": "Cardiff",
    "salary": "150000",
    "notice": "Immediately",
    "right to work": "Yes",
    "authorized": "Yes",
    "authorised": "Yes",
    "sponsor": "No",
    "visa": "No",
    "years": "15",
    "experience": "15",
    "linkedin": "https://www.linkedin.com/in/me/",
    "website": "https://nthlayer.co.uk",
}


def load_learned():
    if os.path.exists(ANSWERS_FILE):
        return json.load(open(ANSWERS_FILE))
    return {}

def save_learned(answers):
    os.makedirs(os.path.dirname(ANSWERS_FILE), exist_ok=True)
    with open(ANSWERS_FILE, "w") as f:
        json.dump(answers, f, indent=2)

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

def human_type(page, selector_or_element, text):
    """Type text character by character with human-like delays."""
    if isinstance(selector_or_element, str):
        el = page.query_selector(selector_or_element)
    else:
        el = selector_or_element
    if not el:
        return
    el.click()
    time.sleep(random.uniform(0.1, 0.3))
    # Clear existing value
    el.evaluate("el => el.value = ''")
    el.evaluate("el => el.dispatchEvent(new Event('input', {bubbles: true}))")
    for char in text:
        el.type(char, delay=random.randint(50, 150))
        # Occasional longer pause (thinking)
        if random.random() < 0.1:
            time.sleep(random.uniform(0.2, 0.5))


def screenshot_step(page, job_title, step_num):
    """Take a screenshot of current form step."""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe = "".join(c if c.isalnum() or c in " -_" else "" for c in job_title)[:40]
    path = os.path.join(SCREENSHOT_DIR, f"{ts}_step{step_num}_{safe}.png")
    page.screenshot(path=path)
    return path


def extract_form_fields(page):
    """Extract all visible form fields from the modal."""
    return page.evaluate("""() => {
        const modal = document.querySelector('[role="dialog"], .artdeco-modal');
        if (!modal) return [];
        
        const fields = [];
        
        // Text inputs and textareas
        const inputs = modal.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea');
        for (const inp of inputs) {
            if (!inp.offsetParent) continue; // skip hidden
            const label = inp.getAttribute('aria-label') || '';
            const placeholder = inp.getAttribute('placeholder') || '';
            const id = inp.id || '';
            const value = inp.value || '';
            const required = inp.hasAttribute('required') || inp.getAttribute('aria-required') === 'true';
            
            // Try to find label element
            let labelText = label;
            if (!labelText && id) {
                const labelEl = document.querySelector(`label[for="${id}"]`);
                if (labelEl) labelText = labelEl.textContent.trim();
            }
            if (!labelText) {
                const parent = inp.closest('.fb-dash-form-element, .jobs-easy-apply-form-element, [data-test-form-element]');
                if (parent) {
                    const lbl = parent.querySelector('label, .fb-dash-form-element__label, .artdeco-text-input--label');
                    if (lbl) labelText = lbl.textContent.trim();
                }
            }
            
            fields.push({
                type: 'input',
                inputType: inp.type || 'text',
                id: id,
                label: labelText || placeholder,
                placeholder: placeholder,
                value: value,
                required: required
            });
        }
        
        // Select dropdowns
        const selects = modal.querySelectorAll('select');
        for (const sel of selects) {
            if (!sel.offsetParent) continue;
            const label = sel.getAttribute('aria-label') || '';
            const id = sel.id || '';
            const value = sel.value || '';
            const options = [...sel.options].map(o => ({value: o.value, text: o.text.trim()}));
            
            let labelText = label;
            if (!labelText) {
                const parent = sel.closest('.fb-dash-form-element, .jobs-easy-apply-form-element, [data-test-form-element]');
                if (parent) {
                    const lbl = parent.querySelector('label');
                    if (lbl) labelText = lbl.textContent.trim();
                }
            }
            
            fields.push({
                type: 'select',
                id: id,
                label: labelText,
                value: value,
                options: options,
                required: sel.hasAttribute('required')
            });
        }
        
        // Radio buttons
        const radioGroups = {};
        const radios = modal.querySelectorAll('input[type="radio"]');
        for (const radio of radios) {
            const name = radio.name;
            if (!radioGroups[name]) {
                const parent = radio.closest('.fb-dash-form-element, [data-test-form-element], fieldset');
                const legend = parent?.querySelector('legend, label, .fb-dash-form-element__label');
                radioGroups[name] = {
                    type: 'radio',
                    name: name,
                    label: legend?.textContent?.trim() || name,
                    options: [],
                    selected: null
                };
            }
            const optLabel = radio.closest('label')?.textContent?.trim() || radio.value;
            radioGroups[name].options.push(optLabel);
            if (radio.checked) radioGroups[name].selected = optLabel;
        }
        fields.push(...Object.values(radioGroups));
        
        // Checkboxes
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
        for (const cb of checkboxes) {
            if (!cb.offsetParent) continue;
            const label = cb.closest('label')?.textContent?.trim() || cb.getAttribute('aria-label') || '';
            fields.push({
                type: 'checkbox',
                label: label,
                checked: cb.checked,
                id: cb.id || ''
            });
        }
        
        return fields;
    }""")


def find_known_answer(label):
    """Check if we have a known answer for this field label."""
    label_lower = label.lower()
    for key, value in KNOWN_ANSWERS.items():
        if key in label_lower:
            return value
    return None


def get_modal_buttons(page):
    """Get available buttons in the modal."""
    return page.evaluate("""() => {
        const modal = document.querySelector('[role="dialog"], .artdeco-modal');
        if (!modal) return {submit: false, review: false, next: false, discard: false};
        const buttons = [...modal.querySelectorAll('button')];
        let result = {submit: false, review: false, next: false, discard: false};
        for (const btn of buttons) {
            const t = (btn.textContent + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
            if (t.includes('submit')) result.submit = true;
            else if (t.includes('review')) result.review = true;
            else if (t.includes('next')) result.next = true;
            else if (t.includes('discard')) result.discard = true;
        }
        return result;
    }""")


def click_modal_button(page, button_text):
    """Click a button in the modal by text."""
    page.evaluate(f"""() => {{
        const modal = document.querySelector('[role="dialog"], .artdeco-modal');
        const btn = [...modal.querySelectorAll('button')].find(b => b.textContent.toLowerCase().includes('{button_text}'));
        if (btn) btn.click();
    }}""")


def fill_field(page, field, value):
    """Fill a form field with human-like typing."""
    if field["type"] == "input":
        sel = f"#{field['id']}" if field["id"] else f'input[aria-label*="{field["label"]}" i]'
        el = page.query_selector(sel)
        if el:
            human_type(page, el, value)
            return True
    elif field["type"] == "select":
        sel = f"#{field['id']}" if field["id"] else f'select[aria-label*="{field["label"]}" i]'
        el = page.query_selector(sel)
        if el:
            # Find best matching option
            for opt in field.get("options", []):
                if value.lower() in opt["text"].lower():
                    el.select_option(value=opt["value"])
                    return True
            # Try by index if value is a number
            try:
                idx = int(value)
                if 0 < idx <= len(field.get("options", [])):
                    el.select_option(index=idx)
                    return True
            except:
                pass
    elif field["type"] == "radio":
        # Click the radio with matching label
        page.evaluate(f"""() => {{
            const radios = document.querySelectorAll('input[type="radio"][name="{field["name"]}"]');
            for (const r of radios) {{
                const label = r.closest('label')?.textContent?.trim() || r.value;
                if (label.toLowerCase().includes('{value.lower()}')) {{ r.click(); return; }}
            }}
        }}""")
        return True
    return False


def process_step(page, job_title, step_num, results_queue):
    """Process one step of the Easy Apply form. Returns (action, screenshot, unknown_fields)."""
    
    # Screenshot the step
    ss = screenshot_step(page, job_title, step_num)
    
    # Extract fields
    fields = extract_form_fields(page)
    
    unknown_fields = []
    
    for field in fields:
        if not field.get("label"):
            continue
        
        # Skip already filled
        if field.get("value") and field["type"] in ("input",):
            continue
        if field.get("selected") and field["type"] == "radio":
            continue
        if field.get("checked") and field["type"] == "checkbox":
            continue
            
        # Check known answers
        answer = find_known_answer(field["label"])
        
        if answer:
            fill_field(page, field, answer)
            human_delay(0.5, 1.0)
        else:
            # Unknown field — collect for asking
            unknown_fields.append(field)
    
    # Get available buttons
    buttons = get_modal_buttons(page)
    
    return ss, unknown_fields, buttons


def main():
    """Run interactive Easy Apply with learning."""
    apply_log = load_apply_log()
    applied_ids = {e.get("jobId") for e in apply_log if e.get("status") == "Applied"}
    
    print("EASY_APPLY_START")
    
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(CDP_URL)
        context = browser.contexts[0]
        page = context.new_page()
        
        search_url = (
            "https://www.linkedin.com/jobs/search/?"
            "keywords=VP%20Product%20OR%20Director%20Product%20OR%20Head%20Product%20OR%20Chief%20Product%20Officer"
            "&f_AL=true&f_E=4%2C5%2C6&sortBy=DD&f_TPR=r604800"
        )
        page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(6)
        
        if "login" in page.url or "authwall" in page.url:
            print("NOT_LOGGED_IN")
            page.close()
            return
        
        # Extract jobs
        jobs = page.evaluate(r"""() => {
            const links = document.querySelectorAll('a[href*="/jobs/view/"]');
            const seen = new Set();
            const results = [];
            for (const a of links) {
                const m = a.href.match(/view\/(\d+)/);
                if (m && !seen.has(m[1])) {
                    seen.add(m[1]);
                    const title = a.getAttribute('aria-label') || a.textContent.trim().split('\n')[0].trim();
                    results.push({jobId: m[1], title: title});
                }
            }
            return results;
        }""")
        
        new_jobs = [j for j in jobs if j["jobId"] not in applied_ids]
        
        # Output job list as JSON for the agent to process
        print("JOBS:" + json.dumps(new_jobs[:10]))
        page.close()


if __name__ == "__main__":
    main()
