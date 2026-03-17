#!/usr/bin/env python3
from camoufox.sync_api import Camoufox
import os, time, json

profile = os.path.expanduser("~/.stealth-browser/profiles/linkedin")

with Camoufox(headless=True, persistent_context=True, user_data_dir=profile, humanize=True) as browser:
    page = browser.new_page()
    page.goto(
        "https://www.linkedin.com/jobs/search/?keywords=Head%20of%20Product&f_AL=true&f_E=5%2C6&sortBy=DD&f_TPR=r604800",
        wait_until="domcontentloaded",
        timeout=30000,
    )
    time.sleep(6)

    # Scroll to trigger lazy load
    page.evaluate("window.scrollBy(0, 300)")
    time.sleep(2)

    # Extract all job links
    links = page.evaluate("""() => {
        const allLinks = document.querySelectorAll('a[href*="/jobs/view/"]');
        const seen = new Set();
        const results = [];
        for (const a of allLinks) {
            const href = a.href;
            const match = href.match(/view\\/(\\d+)/);
            if (match && !seen.has(match[1])) {
                seen.add(match[1]);
                const text = a.textContent.trim().split('\\n')[0].trim();
                const ariaLabel = a.getAttribute('aria-label') || '';
                results.push({
                    jobId: match[1],
                    title: ariaLabel || text,
                    href: href.substring(0, 100)
                });
            }
        }
        return results;
    }""")

    print(f"Found {len(links)} unique job links:")
    for l in links[:15]:
        print(f"  {l['jobId']}: {l['title'][:70]}")
