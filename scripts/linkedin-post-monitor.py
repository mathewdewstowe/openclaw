#!/usr/bin/env python3
"""
LinkedIn Post Monitor using Proxycurl API
Checks for new posts from prospects in monitoring list
Surfaces them to Slack for Matthew to approve engagement
"""
import requests
import sqlite3
import json
import time
import os
from datetime import datetime

DB_PATH = "/home/matthewdewstowe/.openclaw/workspace/data/openclaw.db"
PROXYCURL_KEY = os.environ.get("PROXYCURL_API_KEY", "")  # Set when Matthew gets key
SLACK_CHANNEL = "U0AKBPS9K5E"  # Matthew's Slack user ID
ALERTS_QUEUE = "/home/matthewdewstowe/.openclaw/workspace/memory/linkedin-alerts-queue.json"


def get_monitoring_list():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT id, contact_name, contact_linkedin_url, company_name, pipedrive_deal_id 
        FROM linkedin_monitoring 
        WHERE monitoring_active=1 AND contact_linkedin_url IS NOT NULL AND contact_linkedin_url != ''
    """)
    contacts = c.fetchall()
    conn.close()
    return contacts


def get_recent_posts_proxycurl(linkedin_url):
    """Fetch recent posts via Proxycurl API"""
    if not PROXYCURL_KEY:
        print("No Proxycurl API key set — skipping")
        return []

    r = requests.get(
        "https://nubela.co/proxycurl/api/linkedin/person/posts",
        headers={"Authorization": f"Bearer {PROXYCURL_KEY}"},
        params={"linkedin_profile_url": linkedin_url, "type": "posts"}
    )
    time.sleep(3)  # Rate limit

    if r.status_code == 200:
        return r.json().get("posts", [])
    print(f"Proxycurl error: {r.status_code} {r.text[:200]}")
    return []


def check_already_seen(linkedin_url, post_url):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT id FROM linkedin_posts_seen WHERE contact_linkedin_url=? AND post_url=?",
        (linkedin_url, post_url)
    )
    result = c.fetchone()
    conn.close()
    return result is not None


def mark_seen(linkedin_url, post_url, snippet):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT OR IGNORE INTO linkedin_posts_seen (contact_linkedin_url, post_url, post_snippet)
        VALUES (?, ?, ?)
    """, (linkedin_url, post_url, snippet[:500]))
    conn.commit()
    conn.close()


def update_last_checked(monitoring_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE linkedin_monitoring SET last_checked=datetime('now') WHERE id=?", (monitoring_id,))
    conn.commit()
    conn.close()


def send_slack_alert(contact_name, company, post_url, snippet, deal_id):
    """Queue Slack notification for openclaw to deliver"""
    try:
        with open(ALERTS_QUEUE) as f:
            queue = json.load(f)
    except Exception:
        queue = []

    queue.append({
        "contact_name": contact_name,
        "company": company,
        "post_url": post_url,
        "snippet": snippet[:300],
        "deal_id": deal_id,
        "created_at": datetime.now().isoformat(),
        "sent": False
    })
    with open(ALERTS_QUEUE, "w") as f:
        json.dump(queue, f, indent=2)
    print(f"Alert queued for {contact_name}: {post_url}")


def main():
    # Ensure queue file exists
    if not os.path.exists(ALERTS_QUEUE):
        with open(ALERTS_QUEUE, "w") as f:
            json.dump([], f)

    contacts = get_monitoring_list()
    print(f"Monitoring {len(contacts)} contacts for LinkedIn posts")

    for (mon_id, name, linkedin_url, company, deal_id) in contacts:
        print(f"Checking: {name} ({company})")
        posts = get_recent_posts_proxycurl(linkedin_url)

        for post in posts[:3]:  # Only check 3 most recent
            post_url = post.get("url", "")
            text = post.get("text", "")

            if post_url and not check_already_seen(linkedin_url, post_url):
                mark_seen(linkedin_url, post_url, text)
                send_slack_alert(name, company, post_url, text, deal_id)
                print(f"  → New post found!")

        update_last_checked(mon_id)
        time.sleep(3)  # Rate limit

    print("LinkedIn monitoring complete.")


if __name__ == "__main__":
    main()
