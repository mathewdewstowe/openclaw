#!/usr/bin/env python3
"""
Apollo: Find tech companies in Bristol/Cardiff with NO product leadership.
Strategy:
1. Get all people with product titles in Bristol/Cardiff → extract org NAMES
2. Get all tech companies in Bristol/Cardiff
3. Match by normalised company name — companies NOT matched = no product leader = targets
"""

import requests
import json
import time
import csv
import re
import sys
from datetime import datetime

API_KEY = "V5ZsfKQ0dsCMCBum2wKEdA"
HEADERS = {
    "Content-Type": "application/json",
    "X-Api-Key": API_KEY,
    "Cache-Control": "no-cache"
}

PRODUCT_TITLES = [
    "Chief Product Officer",
    "CPO",
    "VP of Product",
    "VP Product",
    "Vice President of Product",
    "Vice President Product",
    "Head of Product",
    "Director of Product",
    "Product Director",
    "Group Product Manager",
    "Senior Product Manager",
    "Principal Product Manager",
    "Product Manager",
    "Product Lead",
    "Product Owner",
]

# Industries to EXCLUDE — not software/product companies
EXCLUDE_INDUSTRIES = [
    "staffing & recruiting", "staffing and recruiting",
    "human resources", "executive search",
    "real estate",
    "government administration", "government relations",
    "nonprofit organization management",
    "hospital & health care", "medical practice", "health wellness and fitness",
    "primary/secondary education", "higher education", "education management",
    "environmental services",
    "logistics & supply chain",
    "animation", "motion pictures and film",
    "marketing and advertising", "public relations and communications",
    "management consulting",
    "legal services", "law practice",
    "civil engineering", "mechanical or industrial engineering",
    "accounting", "financial services",
    "construction", "building materials",
    "sports",
    "civic & social organization",
    "utilities", "oil & energy",
    "consumer goods", "retail",
    "food & beverages", "restaurants",
    "medical devices", "pharmaceuticals", "biotechnology",
    "telecommunications",
    "renewables & environment",
    "architecture & planning",
    "research",
]

EXCLUDE_NAME_KEYWORDS = [
    "recruit", " staffing", " talent ", "estate agent", "housing association",
    "council", "charity", "solicitor", "chartered accountant",
    "nhs", "health board", " nursing", " dental",
    " church ", "academy", "university", "college",
    "media agency", "creative agency", "design agency",
    "estate agents", "property management",
]

# These are definitely product companies — override industry exclusion
WHITELIST_KEYWORDS = [
    "software", "saas", "platform", "analytics", "ai", "data",
    "app", "digital", "tech", "fintech", "cybersec", "cloud",
    "api", "marketplace", "intelligence", "automation",
]


def normalise(name: str) -> str:
    """Normalise company name for matching."""
    name = name.lower()
    # Remove common suffixes
    name = re.sub(r'\b(ltd|limited|plc|llp|inc|corp|group|uk|b corp|b corp™|™|®)\b', '', name)
    # Remove punctuation
    name = re.sub(r'[^a-z0-9 ]', '', name)
    return ' '.join(name.split())


def api_search_people(titles, locations, page=1, per_page=100):
    payload = {
        "person_titles": titles,
        "person_locations": locations,
        "page": page,
        "per_page": per_page,
    }
    r = requests.post(
        "https://api.apollo.io/v1/mixed_people/api_search",
        headers=HEADERS,
        json=payload
    )
    return r.json()


def search_companies(location, page=1, per_page=25):
    payload = {
        "q_organization_keyword_tags": [
            "software", "saas", "b2b software", "technology platform",
            "enterprise software", "cloud software", "cloud computing",
            "fintech", "healthtech", "edtech", "proptech",
            "cybersecurity", "data analytics", "artificial intelligence",
            "developer tools", "api", "marketplace"
        ],
        "organization_locations": [location],
        "organization_num_employees_ranges": ["11,500"],
        "page": page,
        "per_page": per_page,
    }
    r = requests.post(
        "https://api.apollo.io/v1/organizations/search",
        headers=HEADERS,
        json=payload
    )
    return r.json()


def is_software_company(org):
    """Decide if this looks like a product/software company worth targeting."""
    industry = (org.get("industry") or "").lower()
    name = (org.get("name") or "").lower()
    desc = (org.get("short_description") or "").lower()
    tags = " ".join(org.get("keywords") or []).lower()

    combined = f"{name} {desc} {tags}"

    # Whitelist override — if it mentions software/product keywords, keep it
    for wk in WHITELIST_KEYWORDS:
        if wk in combined:
            return True, ""

    # Check excluded industries
    for ex in EXCLUDE_INDUSTRIES:
        if ex in industry:
            return False, f"Industry: {industry}"

    # Check name keywords
    for kw in EXCLUDE_NAME_KEYWORDS:
        if kw in f" {name} ":
            return False, f"Name: {kw}"

    return True, ""


def get_companies_with_product_people(locations):
    """Return normalised set of company names that have product leaders."""
    print("📋 Step 1: Finding companies with product leadership in target cities...", flush=True)
    names_with_product = {}  # normalised_name -> {original_name, title}

    for location in locations:
        print(f"  → {location}...", flush=True)
        for page in range(1, 8):
            data = api_search_people(PRODUCT_TITLES, [location], page=page, per_page=100)
            people = data.get("people", [])
            total = data.get("total_entries", 0)

            if not people:
                break

            for p in people:
                org = p.get("organization") or {}
                org_name = org.get("name", "")
                title = p.get("title", "")
                if org_name:
                    norm = normalise(org_name)
                    if norm and norm not in names_with_product:
                        names_with_product[norm] = {
                            "original": org_name,
                            "title": title
                        }

            print(f"    Page {page}/{(total//100)+1}: {len(people)} people | {len(names_with_product)} unique companies with product leaders", flush=True)

            if page * 100 >= total:
                break
            time.sleep(0.4)

    print(f"  ✅ {len(names_with_product)} companies confirmed to have product leaders\n", flush=True)
    return names_with_product


def get_all_tech_companies(locations):
    """Get all tech/software companies."""
    print("🏢 Step 2: Fetching tech companies...", flush=True)
    all_companies = {}

    for location in locations:
        for page in range(1, 6):
            print(f"  → {location} page {page}...", flush=True)
            data = search_companies(location, page=page, per_page=25)
            orgs = data.get("organizations", [])

            if not orgs:
                break

            for org in orgs:
                oid = org.get("id")
                if not oid or oid in all_companies:
                    continue

                is_product_co, exclude_reason = is_software_company(org)
                all_companies[oid] = {
                    "id": oid,
                    "name": org.get("name", ""),
                    "normalised_name": normalise(org.get("name", "")),
                    "website": org.get("website_url", ""),
                    "industry": org.get("industry", ""),
                    "employees": org.get("estimated_num_employees") or 0,
                    "city": org.get("city", ""),
                    "country": org.get("country", ""),
                    "linkedin": org.get("linkedin_url", ""),
                    "short_description": (org.get("short_description") or "")[:150],
                    "tags": ", ".join((org.get("keywords") or [])[:6]),
                    "founded": org.get("founded_year", ""),
                    "is_product_co": is_product_co,
                    "exclude_reason": exclude_reason,
                }

            time.sleep(0.5)

            pagination = data.get("pagination", {})
            if page >= pagination.get("total_pages", 1):
                break

    print(f"  ✅ {len(all_companies)} unique companies fetched\n", flush=True)
    return all_companies


def run():
    locations = ["Bristol, United Kingdom", "Cardiff, United Kingdom"]

    names_with_product = get_companies_with_product_people(locations)
    all_companies = get_all_tech_companies(locations)

    print("🔍 Step 3: Cross-referencing by company name...\n", flush=True)

    targets = []
    has_product = []
    excluded = []

    for oid, org in all_companies.items():
        if not org["is_product_co"]:
            excluded.append(org)
            continue

        norm = org["normalised_name"]
        if norm in names_with_product:
            org["product_leader"] = names_with_product[norm]["title"]
            org["opportunity"] = "Has product leadership"
            has_product.append(org)
        else:
            org["product_leader"] = "None found in Apollo"
            org["opportunity"] = "🎯 Target — no product leader found"
            targets.append(org)

    targets.sort(key=lambda x: x.get("employees") or 0, reverse=True)

    # Write CSV
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    outfile = f"/home/matthewdewstowe/.openclaw/workspace/scripts/apollo_targets_{timestamp}.csv"

    fieldnames = [
        "name", "website", "city", "industry", "employees",
        "short_description", "tags", "founded", "linkedin",
        "product_leader", "opportunity"
    ]

    with open(outfile, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for org in targets:
            writer.writerow(org)

    print(f"\n{'='*65}")
    print(f"📊 RESULTS")
    print(f"{'='*65}")
    print(f"Total companies:                {len(all_companies)}")
    print(f"Excluded (non-product cos):     {len(excluded)}")
    print(f"Have product leaders:           {len(has_product)}")
    print(f"🎯 TARGETS (no product leader): {len(targets)}")
    print(f"\nCSV: {outfile}")

    print(f"\n🏆 TOP 30 TARGETS (sorted by size):")
    print(f"{'Company':<38} {'City':<10} {'Emp':<6} {'Industry'}")
    print("-" * 80)
    for org in targets[:30]:
        print(f"{org['name'][:36]:<38} {org['city'][:8]:<10} {str(org['employees']):<6} {org['industry'][:24]}")

    print(f"\n✅ Companies confirmed WITH product leaders:")
    for org in has_product[:15]:
        print(f"  {org['name']:<35} → {org['product_leader']}")

    return outfile, targets


if __name__ == "__main__":
    outfile, targets = run()
    print(f"\nDone. {len(targets)} targets. CSV: {outfile}")
    sys.exit(0)
