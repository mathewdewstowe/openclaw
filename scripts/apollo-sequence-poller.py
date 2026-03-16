#!/usr/bin/env python3
"""
Apollo Sequence Poller
Polls Apollo for sequence activity, detects replies, creates Pipedrive deals
"""
import requests
import sqlite3
import json
import time
from datetime import datetime

APOLLO_KEY = "V5ZsfKQ0dsCMCBum2wKEdA"
PIPEDRIVE_KEY = "404d1d1701fbe3462d0c5ba9626b6383e1ecdfa3"
DB_PATH = "/home/matthewdewstowe/.openclaw/workspace/data/openclaw.db"
STAGES_FILE = "/home/matthewdewstowe/.openclaw/workspace/memory/pipedrive-stages.json"


def get_apollo_sequences():
    """Get all sequences from Apollo"""
    r = requests.post(
        "https://api.apollo.io/v1/emailer_campaigns/search",
        headers={"X-Api-Key": APOLLO_KEY, "Content-Type": "application/json"},
        json={"page": 1, "per_page": 25}
    )
    time.sleep(1)
    if r.status_code == 200:
        return r.json().get("emailer_campaigns", [])
    print(f"Apollo sequences error: {r.status_code} {r.text[:200]}")
    return []


def get_sequence_contacts(sequence_id):
    """Get contacts in a specific sequence"""
    r = requests.get(
        f"https://api.apollo.io/v1/emailer_campaigns/{sequence_id}/emailer_campaign_emails",
        headers={"X-Api-Key": APOLLO_KEY},
        params={"page": 1, "per_page": 100}
    )
    time.sleep(1)
    if r.status_code == 200:
        return r.json().get("emailer_campaign_emails", [])
    return []


def create_pipedrive_deal(contact_name, company_name, contact_email, linkedin_url, pipeline_id, stage_id):
    """Create a deal in Pipedrive"""
    payload = {
        "title": f"{contact_name} - {company_name}",
        "pipeline_id": pipeline_id,
        "stage_id": stage_id,
    }
    r = requests.post(
        f"https://api.pipedrive.com/v1/deals?api_token={PIPEDRIVE_KEY}",
        json=payload
    )
    if r.status_code in (200, 201):
        return r.json().get("data", {}).get("id")
    print(f"Pipedrive deal error: {r.status_code} {r.text[:200]}")
    return None


def add_to_linkedin_monitoring(contact_name, linkedin_url, company_name, contact_id, deal_id):
    """Add contact to LinkedIn monitoring list"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT OR IGNORE INTO linkedin_monitoring 
        (contact_name, contact_linkedin_url, company_name, apollo_contact_id, pipedrive_deal_id)
        VALUES (?, ?, ?, ?, ?)
    """, (contact_name, linkedin_url, company_name, contact_id, str(deal_id)))
    conn.commit()
    conn.close()


def main():
    # Load stage config
    try:
        with open(STAGES_FILE) as f:
            stages = json.load(f)
        pipeline_id = stages.get("pipeline_id")
        stage_replied = stages.get("stages", {}).get("Replied - Interested")
        stage_in_sequence = stages.get("stages", {}).get("In Sequence")
    except Exception as e:
        print(f"Could not load stages: {e}")
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    sequences = get_apollo_sequences()
    print(f"Found {len(sequences)} sequences")

    for seq in sequences:
        seq_id = seq.get("id")
        seq_name = seq.get("name", "Unknown")
        print(f"Checking sequence: {seq_name}")

        contacts = get_sequence_contacts(seq_id)
        for contact in contacts:
            email_status = contact.get("status", "")
            contact_data = contact.get("contact", {})
            contact_id = contact_data.get("id", "")
            contact_name = contact_data.get("name", "Unknown")
            contact_email = contact_data.get("email", "")
            linkedin_url = contact_data.get("linkedin_url", "")
            company_name = contact_data.get("organization_name", "")

            # Check if we already have this in DB
            c.execute(
                "SELECT id, replied, pipedrive_deal_id FROM apollo_sequences WHERE contact_id=? AND sequence_id=?",
                (contact_id, seq_id)
            )
            existing = c.fetchone()

            if not existing:
                # New contact in sequence
                c.execute("""
                    INSERT INTO apollo_sequences (sequence_id, sequence_name, contact_id, contact_name, 
                    contact_email, contact_linkedin_url, company_name, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
                """, (seq_id, seq_name, contact_id, contact_name, contact_email, linkedin_url, company_name))
                conn.commit()
                print(f"  + Added: {contact_name} ({company_name})")

            elif "replied" in email_status.lower() and existing[1] == 0:
                # NEW REPLY DETECTED
                print(f"  ✅ REPLY DETECTED: {contact_name} ({company_name})")

                # Create Pipedrive deal
                deal_id = create_pipedrive_deal(
                    contact_name, company_name, contact_email,
                    linkedin_url, pipeline_id, stage_replied
                )

                if deal_id:
                    print(f"  → Created Pipedrive deal: {deal_id}")

                    # Update DB
                    c.execute("""
                        UPDATE apollo_sequences 
                        SET replied=1, reply_sentiment='interested', pipedrive_deal_id=?, 
                        pipedrive_stage='Replied - Interested', updated_at=datetime('now')
                        WHERE contact_id=? AND sequence_id=?
                    """, (str(deal_id), contact_id, seq_id))
                    conn.commit()

                    # Add to LinkedIn monitoring
                    if linkedin_url:
                        add_to_linkedin_monitoring(contact_name, linkedin_url, company_name, contact_id, deal_id)
                        print(f"  → Added to LinkedIn monitoring: {linkedin_url}")

        time.sleep(1)  # Rate limit between sequences

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
