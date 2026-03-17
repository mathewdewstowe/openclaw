#!/usr/bin/env python3
"""
Job Enricher — Fetches full job descriptions and scores Matthew's fit using AI.
Adds two columns to the Google Sheet: "Score (Fit)" and "Why Good Fit"
Processes all rows, reprocessing existing entries.
"""

import os
import json
import time
import re
import sys
import requests
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────
SHEET_ID = '1Hv3Iccnhh81DbiJVHmHohwzg4CNDmEYbda8cwSnfpow'
ACCOUNT = 'matthewdewstowe@gmail.com'
GOG = f'GOG_KEYRING_PASSWORD=openclaw gog'
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')

# Matthew's profile — distilled from CV for scoring
MATTHEW_PROFILE = """
Matthew Dewstowe — AI Native Product Leader, exited founder (Innovantage → Bullhorn)

HEADLINE: 15+ years B2B SaaS product leadership. Founder + exit. Currently Fractional CPO.

CORE STRENGTHS:
- Product Strategy & Vision: 0→1 and 1→N, PE/VC-backed environments, exit-oriented
- Agentic AI / LLM products: built TalentFlow (end-to-end AI talent acquisition), conversational AI at scale
- Team building: hired & led product teams, defined operating models, cut time-to-market 80%
- Commercial outcomes: improved NRR, expansion revenue, unit economics, valuation uplift
- Technical: Computer Science & Maths (Nottingham), built NLP models, agentic workflows

RECENT ROLES:
- Fractional CPO | Marlin PE (Aug 2025–present): AI strategy for PE-backed SaaS companies
- Director of Product & AI | Daxtra Technologies (Jan 2024–June 2025): Built product org, launched TalentFlow agentic AI, 80% faster time-to-market
- Head of Product & AI | Distributed (Nov 2021–Dec 2023): Scaled marketplace to 10k+ members, £375k/mo additional revenue, 90% faster hiring
- Head of Product Delivery | Money Hub (May–Oct 2021): 300+ open banking APIs, £1m project on time
- Head of Product | Talent Crowd (Oct 2015–Mar 2020): Cold start to 5k global users, 30% higher transaction value

IDEAL ROLES: VP Product, Director of Product, Head of Product, CPO, Fractional CPO
IDEAL CONTEXT: AI-native companies, PE/VC-backed, B2B SaaS, talent/HR tech, marketplaces, platforms
LOCATION: Cardiff / Remote / Hybrid UK-wide
SALARY: £150k+ perm / £700-800/day contract

KEYWORDS HE MATCHES WELL: AI strategy, agentic AI, product-led growth, B2B SaaS, marketplace, 
enterprise product, roadmapping, go-to-market, PE-backed, scaling, NRR, commercialisation,
talent tech, hiring platforms, open banking, conversational AI
"""

import subprocess

def gog_read_sheet():
    """Read all rows from the sheet."""
    cmd = f'{GOG} sheets get {SHEET_ID} "Sheet1!A1:N500" --account {ACCOUNT} --json'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR reading sheet: {result.stderr[:200]}")
        return None
    data = json.loads(result.stdout)
    return data.get('values', [])


def gog_update_cell(row_num, col_letter, value):
    """Update a single cell using --values-json."""
    import tempfile
    cell = f"Sheet1!{col_letter}{row_num}"
    # Write JSON to temp file to avoid shell escaping nightmares
    data = json.dumps([[str(value)]])
    tmp = f"/tmp/gog_cell_{row_num}_{col_letter}.json"
    with open(tmp, 'w') as f:
        f.write(data)
    cmd = f'{GOG} sheets update {SHEET_ID} "{cell}" --values-json "$(cat {tmp})" --input USER_ENTERED --account {ACCOUNT} --no-input 2>/dev/null'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, executable='/bin/bash')
    return result.returncode == 0


def gog_update_row_cells(row_num, updates: dict):
    """Update multiple cells in a row. updates = {col_letter: value}"""
    for col, val in updates.items():
        success = gog_update_cell(row_num, col, val)
        if not success:
            # try plain command variant
            print(f"  ⚠ Cell update {col}{row_num} failed, retrying...")
            time.sleep(1)
            gog_update_cell(row_num, col, val)
        time.sleep(0.3)


def fetch_linkedin_description(job_id: str) -> str:
    """Fetch job description from LinkedIn Jobs API (unauthenticated)."""
    try:
        url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.5',
        }
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            # Extract text from HTML
            html = resp.text
            # Strip HTML tags roughly
            text = re.sub(r'<[^>]+>', ' ', html)
            text = re.sub(r'\s+', ' ', text).strip()
            # Grab the meaty section
            if len(text) > 100:
                return text[:3000]
        return ''
    except Exception as e:
        return ''


def fetch_indeed_description(url: str) -> str:
    """Try to fetch Indeed job description."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
        }
        resp = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        if resp.status_code == 200:
            html = resp.text
            # Look for job description section
            match = re.search(r'jobDescription["\s]+[^>]*>(.*?)</div', html, re.DOTALL | re.IGNORECASE)
            if match:
                text = re.sub(r'<[^>]+>', ' ', match.group(1))
                text = re.sub(r'\s+', ' ', text).strip()
                return text[:3000]
            # Fallback: strip everything
            text = re.sub(r'<[^>]+>', ' ', html)
            text = re.sub(r'\s+', ' ', text).strip()
            return text[:2000]
        return ''
    except Exception as e:
        return ''


def score_fit_with_ai(job_title: str, company: str, location: str, salary: str, description: str) -> tuple[str, str]:
    """
    Use Claude to score Matthew's fit and generate a 'Why Good Fit' reason.
    Returns (score_1_to_5, fit_reason)
    """
    if not ANTHROPIC_API_KEY:
        # Fallback: rule-based scoring
        return rule_based_score(job_title, description, salary)

    prompt = f"""You are scoring job fit for Matthew Dewstowe (AI Native Product Leader, exited founder, Fractional CPO).

MATTHEW'S PROFILE:
{MATTHEW_PROFILE}

JOB TO EVALUATE:
Title: {job_title}
Company: {company}
Location: {location}
Salary: {salary}
Description: {description[:2000] if description else '(no description available)'}

Score Matthew's fit from 1-5:
5 = Perfect match (senior product leadership, AI/SaaS context, right seniority, good salary)
4 = Strong match (most criteria met, minor gaps)
3 = Decent match (relevant but some seniority/context mismatch)
2 = Weak match (possible but stretching)
1 = Not relevant

Then write a 1-2 sentence "Why Good Fit" reason specific to THIS job and Matthew's background. Be concrete — mention specific experiences or skills that match.

Respond in this exact JSON format:
{{"score": 4, "fit_reason": "Matthew's 5 years leading AI product at Daxtra and Distributed directly matches..."}}"""

    try:
        resp = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            json={
                'model': 'claude-haiku-4-5',
                'max_tokens': 300,
                'messages': [{'role': 'user', 'content': prompt}]
            },
            timeout=20
        )
        if resp.status_code == 200:
            content = resp.json()['content'][0]['text']
            # Parse JSON from response
            match = re.search(r'\{[^}]+\}', content, re.DOTALL)
            if match:
                data = json.loads(match.group())
                score = str(data.get('score', 3))
                reason = data.get('fit_reason', '')
                return score, reason
    except Exception as e:
        print(f"    AI scoring failed: {e}")

    return rule_based_score(job_title, description, salary)


def rule_based_score(title: str, description: str, salary: str) -> tuple[str, str]:
    """Fallback rule-based scoring."""
    t = f"{title} {description}".lower()
    s = salary.lower()
    score = 2

    senior_titles = ['head of product', 'director of product', 'vp of product', 'vp product',
                     'chief product', 'cpo', 'fractional', 'principal product', 'product director',
                     'head of ai', 'vp of ai', 'director of ai', 'interim cpo']
    if any(k in t for k in senior_titles):
        score += 2
    elif any(k in t for k in ['senior product', 'group product', 'lead product']):
        score += 1

    if any(k in t for k in ['ai', 'agentic', 'saas', 'platform', 'b2b']):
        score += 1
    if any(k in t for k in ['pe-backed', 'venture', 'series', 'backed', 'private equity']):
        score += 1

    score = min(5, score)

    reasons = []
    if 'ai' in t or 'agentic' in t:
        reasons.append("AI/agentic experience from Daxtra and Distributed")
    if any(k in t for k in ['saas', 'platform', 'marketplace']):
        reasons.append("B2B SaaS platform experience")
    if any(k in t for k in ['pe', 'private equity', 'backed', 'scale']):
        reasons.append("PE-backed scaling experience")
    if any(k in t for k in ['talent', 'hr', 'hiring', 'recruitment']):
        reasons.append("deep HR/talent tech domain expertise")

    reason = "Strong product leadership background with " + (", ".join(reasons) if reasons else "relevant SaaS experience") + "."
    return str(score), reason


def ensure_headers(headers: list) -> tuple[str, str]:
    """
    Ensure the sheet has 'Score (Fit)' and 'Why Good Fit' columns.
    Returns (score_col, fit_col) as column letters.
    """
    # Column letters A-N
    cols = list('ABCDEFGHIJKLMN')
    
    score_col = None
    fit_col = None
    
    for i, h in enumerate(headers):
        if h == 'Score (Fit)':
            score_col = cols[i]
        elif h == 'Why Good Fit':
            fit_col = cols[i]
    
    # Add missing headers
    next_col_idx = len(headers)
    
    if score_col is None:
        score_col = cols[next_col_idx]
        gog_update_cell(1, score_col, 'Score (Fit)')
        next_col_idx += 1
        print(f"  Added 'Score (Fit)' header at column {score_col}")
    
    if fit_col is None:
        fit_col = cols[next_col_idx]
        gog_update_cell(1, fit_col, 'Why Good Fit')
        print(f"  Added 'Why Good Fit' header at column {fit_col}")
    
    return score_col, fit_col


def main():
    print("=== Job Enricher ===")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Check for API key
    if not ANTHROPIC_API_KEY:
        print("⚠️  ANTHROPIC_API_KEY not set — falling back to rule-based scoring")

    # Read sheet
    print("\n📊 Reading sheet...")
    rows = gog_read_sheet()
    if not rows:
        print("ERROR: Could not read sheet")
        sys.exit(1)

    headers = rows[0]
    print(f"Found {len(rows)-1} job rows")
    print(f"Headers: {headers}")

    # Ensure our columns exist
    score_col, fit_col = ensure_headers(headers)
    print(f"Score column: {score_col} | Fit column: {fit_col}")

    # Re-read to get updated headers
    rows = gog_read_sheet()
    headers = rows[0]

    # Find column indices
    col_idx = {h: i for i, h in enumerate(headers)}

    processed = 0
    skipped = 0
    errors = 0

    for row_num_0, row in enumerate(rows[1:], start=2):
        # Pad row to headers length
        while len(row) < len(headers):
            row.append('')

        title = row[col_idx.get('Job Title', 1)] if col_idx.get('Job Title') is not None else row[1]
        company = row[col_idx.get('Company', 2)] if col_idx.get('Company') is not None else row[2]
        location = row[col_idx.get('Location', 3)] if col_idx.get('Location') is not None else row[3]
        salary = row[col_idx.get('Salary', 4)] if col_idx.get('Salary') is not None else row[4]
        source = row[col_idx.get('Source', 5)] if col_idx.get('Source') is not None else row[5]
        url = row[col_idx.get('URL', 8)] if col_idx.get('URL') is not None else row[8]
        li_id = row[col_idx.get('LinkedIn Job ID', 10)] if col_idx.get('LinkedIn Job ID') is not None else (row[10] if len(row) > 10 else '')

        # Check if already has fit score
        score_col_idx = col_idx.get('Score (Fit)')
        fit_col_idx = col_idx.get('Why Good Fit')
        
        existing_score = row[score_col_idx] if score_col_idx is not None and score_col_idx < len(row) else ''
        existing_fit = row[fit_col_idx] if fit_col_idx is not None and fit_col_idx < len(row) else ''

        if existing_score and existing_fit:
            print(f"  Row {row_num_0}: {title[:40]} — already scored, skipping")
            skipped += 1
            continue

        print(f"\n  Row {row_num_0}: {title[:50]} @ {company}")

        # Fetch description
        description = ''
        if li_id and not li_id.startswith('indeed_'):
            print(f"    Fetching LinkedIn desc for job ID: {li_id}")
            description = fetch_linkedin_description(li_id)
            if description:
                print(f"    Got {len(description)} chars")
            else:
                print(f"    No description from LinkedIn API")
        elif url and 'indeed' in url.lower():
            print(f"    Fetching Indeed desc...")
            description = fetch_indeed_description(url)
            if description:
                print(f"    Got {len(description)} chars")

        # Score with AI
        print(f"    Scoring fit...")
        score, fit_reason = score_fit_with_ai(title, company, location, salary, description)
        print(f"    Score: {score} | Fit: {fit_reason[:80]}...")

        # Update sheet
        updates = {
            score_col: score,
            fit_col: fit_reason,
        }
        gog_update_row_cells(row_num_0, updates)
        print(f"    ✅ Updated row {row_num_0}")

        processed += 1
        time.sleep(1.5)  # Rate limiting

    print(f"\n=== Done ===")
    print(f"Processed: {processed} | Skipped (already done): {skipped} | Errors: {errors}")
    print(f"Sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}")


if __name__ == '__main__':
    main()
