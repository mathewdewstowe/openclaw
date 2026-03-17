#!/usr/bin/env python3
"""
Lead Scoring Agent for Matthew Dewstowe
Scores ICPs in the dashboard DB using a weighted signal model.
Outputs updated scores + a Slack digest of hot leads.

Scoring model — two tracks:

SONESSE (meeting bot infrastructure)
  Company signals:
    - Uses Zoom/Teams/Meet at scale (>50 users)         +15
    - In regulated industry (finance/legal/health/gov)  +20
    - Already using Recall.ai or competitor             +25
    - Tech company / developer org                      +15
    - Enterprise (500+ employees)                       +10
    - SMB (<50 employees)                               -5

  Person signals:
    - Title: CTO / VP Eng / Head of Platform            +20
    - Title: Developer / Engineer / Architect           +15
    - Title: Head of AI / ML Lead                       +20
    - Title: CPO / Product Director (meeting AI)        +10
    - Title: Procurement / IT Director                  +5

  Engagement signals:
    - Has LinkedIn URL (enrichable)                     +5
    - Has email                                         +10
    - Has inbound note / reached out first              +20
    - Status: engaged / replied                         +25
    - Status: active                                    +15
    - Mentioned Recall.ai pain in notes                 +20
    - Mentioned self-hosted/on-premise                  +20
    - Mentioned Tavus or ElevenLabs                     +15

NTH LAYER (fractional CPO / AI product consulting)
  Company signals:
    - Series A/B/C scale-up (50-500 employees)          +20
    - PE/VC portfolio company                           +15
    - AI-native or AI transformation in progress        +20
    - No CPO / thin product team                        +25
    - Recent funding round                              +15

  Person signals:
    - Title: CEO / MD / Founder                         +25
    - Title: COO / CRO / Chief of Staff                 +15
    - Title: VP / Director of Product                   +10
    - Title: Head of Product (hiring signal)            +10
    - Mutual connection to Matthew                      +10

  Engagement signals:
    - Has email + LinkedIn                              +15
    - Inbound / referred                                +30
    - Status: engaged / replied                         +25
    - Status: active                                    +15
    - Mentioned "fractional" or "interim CPO"           +30
    - Mentioned "product strategy" need                 +20

Max theoretical: 100 (capped). Bands:
  80-100: 🔥 Hot — contact today
  60-79:  ♨️  Warm — nurture / sequence
  40-59:  🟡 Lukewarm — monitor
  0-39:   ❄️  Cold — low priority
"""

import sqlite3
import json
import requests
import os
import re
from datetime import datetime

DB_PATH = "/home/matthewdewstowe/.openclaw/workspace/dashboard/data/dashboard.db"
DASHBOARD_URL = "http://localhost:3737"
SLACK_CHANNEL = "#claw-tasks-reminders"

# JWT for dashboard API
import base64, time
JWT_SECRET = "md-dashboard-secret-2026-sonesse"

def make_jwt():
    import hmac, hashlib
    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b'=').decode()
    payload = base64.urlsafe_b64encode(
        json.dumps({"username": "MatthewDewstowe", "exp": int(time.time()) + 3600}).encode()
    ).rstrip(b'=').decode()
    sig_input = f"{header}.{payload}".encode()
    sig = hmac.new(JWT_SECRET.encode(), sig_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b'=').decode()
    return f"{header}.{payload}.{sig_b64}"

def login_dashboard():
    r = requests.post(f"{DASHBOARD_URL}/api/login", json={
        "username": "MatthewDewstowe", "password": "Launch2025!"
    }, timeout=10)
    return r.json().get("token")


def score_icp(icp: dict, track: str = "sonesse") -> tuple[int, list]:
    """
    Score an ICP. Returns (score: int, reasons: list[str])
    track: "sonesse" | "nth_layer" | "auto" (auto-detect from notes/title)
    """
    score = 0
    reasons = []

    name = (icp.get("name") or "").lower()
    title = (icp.get("title") or "").lower()
    company = (icp.get("company") or "").lower()
    notes = (icp.get("notes") or "").lower()
    status = (icp.get("status") or "new").lower()
    email = icp.get("email") or ""
    linkedin = icp.get("linkedin") or ""

    # Auto-detect track if needed
    if track == "auto":
        nth_signals = ["ceo", "md", "founder", "fractional", "interim cpo", "no cpo",
                       "portfolio", "series a", "series b", "series c", "pe ", "vc "]
        son_signals = ["recall", "meeting bot", "zoom", "teams", "self-host", "on-prem",
                       "tavus", "elevenlabs", "developer", "engineer", "cto"]
        nth_count = sum(1 for s in nth_signals if s in title + notes + company)
        son_count = sum(1 for s in son_signals if s in title + notes + company)
        track = "nth_layer" if nth_count > son_count else "sonesse"

    if track == "sonesse":
        # --- Company signals ---
        if any(w in company + notes for w in ["zoom", "microsoft teams", "google meet", "webex"]):
            score += 15; reasons.append("Uses video conferencing platform (+15)")
        if any(w in company + notes for w in ["bank", "financ", "insurance", "nhs", "health", "legal", "law", "government", "gov.uk", "defence"]):
            score += 20; reasons.append("Regulated industry (+20)")
        if any(w in notes for w in ["recall.ai", "recall api", "otter", "fireflies", "grain", "fathom"]):
            score += 25; reasons.append("Using competitor — hot switch signal (+25)")
        if any(w in company + notes for w in ["tech", "software", "saas", "api", "developer", "platform", "devops"]):
            score += 15; reasons.append("Tech / developer company (+15)")
        if any(w in notes for w in ["enterprise", "500+", "1000+", "global", "multinational"]):
            score += 10; reasons.append("Enterprise scale (+10)")

        # --- Person signals ---
        if any(t in title for t in ["cto", "vp eng", "head of engineering", "head of platform", "chief technology"]):
            score += 20; reasons.append("Technical decision-maker (+20)")
        if any(t in title for t in ["developer", "engineer", "architect", "devrel"]):
            score += 15; reasons.append("Technical implementer (+15)")
        if any(t in title for t in ["head of ai", "ai lead", "machine learning", "ml lead", "vp ai"]):
            score += 20; reasons.append("AI leader (+20)")
        if any(t in title for t in ["cpo", "product director", "vp product", "head of product"]):
            score += 10; reasons.append("Product leader with AI context (+10)")

        # --- Engagement signals ---
        if any(w in notes for w in ["self-host", "self hosted", "on-prem", "on premise", "data sovereignty", "gdpr", "data residency"]):
            score += 20; reasons.append("Self-hosted / data sovereignty need (+20)")
        if any(w in notes for w in ["tavus", "elevenlabs", "avatar", "ai avatar", "voice agent"]):
            score += 15; reasons.append("Mentioned Tavus/ElevenLabs use case (+15)")
        if any(w in notes for w in ["recall", "competitor", "alternative to", "switching from"]):
            score += 20; reasons.append("Competitor migration intent (+20)")

    elif track == "nth_layer":
        # --- Company signals ---
        if any(w in notes + company for w in ["series a", "series b", "series c", "seed", "funded"]):
            score += 15; reasons.append("Funded scale-up (+15)")
        if any(w in notes + company for w in ["pe ", "private equity", "portfolio", "vc ", "venture"]):
            score += 15; reasons.append("PE/VC portfolio (+15)")
        if any(w in notes for w in ["ai transformation", "ai strategy", "ai native", "llm", "gpt", "generative"]):
            score += 20; reasons.append("AI transformation underway (+20)")
        if any(w in notes for w in ["no cpo", "no product director", "no head of product", "product gap", "thin product"]):
            score += 25; reasons.append("No product leader — buying signal (+25)")
        if any(w in notes for w in ["raised", "just raised", "announced funding", "new funding"]):
            score += 15; reasons.append("Recent funding (budget available) (+15)")

        # --- Person signals ---
        if any(t in title for t in ["ceo", "chief executive", "md", "managing director", "founder", "co-founder"]):
            score += 25; reasons.append("CEO/Founder — decision maker (+25)")
        if any(t in title for t in ["coo", "cro", "chief of staff", "chief operating"]):
            score += 15; reasons.append("C-suite operator (+15)")
        if any(t in title for t in ["vp product", "director of product", "head of product"]):
            score += 10; reasons.append("Product leader (peer / referrer) (+10)")

        # --- Engagement signals ---
        if any(w in notes for w in ["fractional", "interim cpo", "part-time cpo", "cpo needed", "product leadership"]):
            score += 30; reasons.append("Explicit fractional CPO need (+30)")
        if any(w in notes for w in ["product strategy", "product vision", "product roadmap help", "need product"]):
            score += 20; reasons.append("Product strategy need stated (+20)")
        if any(w in notes for w in ["referred", "inbound", "reached out", "contacted us", "warm intro"]):
            score += 30; reasons.append("Inbound / referred — highest intent (+30)")

    # --- Universal engagement signals ---
    if email:
        score += 10; reasons.append("Email known (+10)")
    if linkedin:
        score += 5; reasons.append("LinkedIn URL known (+5)")
    if status in ["engaged", "replied", "meeting booked"]:
        score += 25; reasons.append(f"Status: {status} (+25)")
    elif status == "active":
        score += 15; reasons.append("Status: active (+15)")
    elif status in ["contacted", "in sequence"]:
        score += 8; reasons.append(f"Status: {status} (+8)")

    # Cap at 100
    return min(100, score), reasons


def band(score):
    if score >= 80: return "🔥 Hot"
    if score >= 60: return "♨️  Warm"
    if score >= 40: return "🟡 Lukewarm"
    return "❄️  Cold"


def run():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Lead Scorer starting...")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    icps = cur.execute("SELECT * FROM icps").fetchall()
    print(f"  Scoring {len(icps)} ICPs...")

    results = []
    for row in icps:
        icp = dict(row)
        score, reasons = score_icp(icp, track="auto")
        old_score = icp.get("score") or 0

        # Update DB
        cur.execute(
            "UPDATE icps SET score = ?, updatedAt = ? WHERE id = ?",
            (score, datetime.now().isoformat(), icp["id"])
        )

        # Build scoring note
        score_note = f"[Scored {datetime.now().strftime('%Y-%m-%d')}] {'; '.join(reasons)}"
        existing_notes = icp.get("notes") or ""
        # Remove any previous scoring note
        existing_notes = re.sub(r'\[Scored \d{4}-\d{2}-\d{2}\][^\n]*\n?', '', existing_notes).strip()
        new_notes = f"{score_note}\n{existing_notes}".strip() if existing_notes else score_note
        cur.execute("UPDATE icps SET notes = ? WHERE id = ?", (new_notes, icp["id"]))

        results.append({
            "id": icp["id"],
            "name": icp.get("name", "Unknown"),
            "title": icp.get("title", ""),
            "company": icp.get("company", ""),
            "score": score,
            "old_score": old_score,
            "band": band(score),
            "reasons": reasons,
        })

        delta = score - old_score
        if delta != 0:
            print(f"  {icp.get('name','?'):30} {old_score:3} → {score:3} ({'+' if delta>0 else ''}{delta}) {band(score)}")

    conn.commit()
    conn.close()

    # Sort by score desc
    results.sort(key=lambda x: x["score"], reverse=True)

    # Build Slack digest
    hot = [r for r in results if r["score"] >= 80]
    warm = [r for r in results if 60 <= r["score"] < 80]
    cold = [r for r in results if r["score"] < 40]

    lines = ["*🎯 Lead Score Update*\n"]
    lines.append(f"Scored {len(results)} ICPs — {len(hot)} hot, {len(warm)} warm, {len(cold)} cold\n")

    if hot:
        lines.append("\n*🔥 Hot Leads — Action Today:*")
        for r in hot[:5]:
            name_str = r['name']
            title_str = f" · {r['title']}" if r['title'] else ""
            co_str = f" @ {r['company']}" if r['company'] else ""
            top_reason = r['reasons'][0] if r['reasons'] else ""
            lines.append(f"  • *{name_str}*{title_str}{co_str} — `{r['score']}/100` {r['band']}")
            if top_reason:
                lines.append(f"    ↳ {top_reason.split(' (+')[0]}")

    if warm:
        lines.append("\n*♨️  Warm — Nurture:*")
        for r in warm[:3]:
            lines.append(f"  • {r['name']} — `{r['score']}/100`")

    lines.append(f"\n_Full scores updated in dashboard → ICP tab_")

    slack_msg = "\n".join(lines)
    print("\n" + slack_msg)

    # Try to post to Slack via dashboard API
    try:
        token = login_dashboard()
        if token:
            headers = {"Authorization": f"Bearer {token}"}
            # Post as a briefing
            requests.post(f"{DASHBOARD_URL}/api/briefings", headers=headers, json={
                "title": f"Lead Scores — {datetime.now().strftime('%d %b %Y')}",
                "content": slack_msg,
                "type": "lead-score"
            }, timeout=10)
    except Exception as e:
        print(f"  Dashboard post failed: {e}")

    # Output JSON for n8n to consume
    output = {
        "scored_at": datetime.now().isoformat(),
        "total": len(results),
        "hot": len(hot),
        "warm": len(warm),
        "cold": len(cold),
        "top_leads": results[:10],
        "slack_digest": slack_msg
    }
    out_path = f"/tmp/lead-scores-{datetime.now().strftime('%Y-%m-%d')}.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n  Output: {out_path}")
    print(f"  Hot: {len(hot)} | Warm: {len(warm)} | Cold: {len(cold)}")
    return output


if __name__ == "__main__":
    run()
