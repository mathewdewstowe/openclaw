#!/usr/bin/env python3
"""
Call Copilot — local backend.

Serves the single-page UI and provides three jobs:
  1. /api/transcribe  — turn a chunk of call audio into text (local Whisper)
  2. /api/suggest     — given your goal + the live transcript, suggest questions to ask
  3. /api/summarize   — when the call is closing, tell you how best to summarise it

Everything runs on your machine. The only thing that leaves it is the text of
the transcript sent to the Anthropic API to generate questions and the summary.
"""

import json
import os
import tempfile
import urllib.error
import urllib.request

from flask import Flask, jsonify, request, send_from_directory

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "config.local.json")

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"

# Fast model for the frequent live "what should I ask" calls, stronger model for
# the one-shot end-of-call summary. Both overridable in config.local.json.
DEFAULTS = {
    "anthropic_api_key": "",
    "suggest_model": "claude-haiku-4-5-20251001",
    "summary_model": "claude-sonnet-5",
    "whisper_model": "base.en",
}

app = Flask(__name__, static_folder="static", template_folder="templates")

_whisper = None          # lazily loaded WhisperModel
_whisper_error = None     # remembered import/load failure so we only try once loudly


# --------------------------------------------------------------------------- #
# Config                                                                       #
# --------------------------------------------------------------------------- #
def load_config():
    cfg = dict(DEFAULTS)
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH) as fh:
                cfg.update({k: v for k, v in json.load(fh).items() if v})
        except (OSError, json.JSONDecodeError):
            pass
    # Environment key wins if config has none, so the workspace .env still works.
    if not cfg.get("anthropic_api_key"):
        cfg["anthropic_api_key"] = os.environ.get("ANTHROPIC_API_KEY", "")
    return cfg


def save_config(updates):
    cfg = dict(DEFAULTS)
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH) as fh:
                cfg.update(json.load(fh))
        except (OSError, json.JSONDecodeError):
            pass
    cfg.update({k: v for k, v in updates.items() if v is not None})
    with open(CONFIG_PATH, "w") as fh:
        json.dump(cfg, fh, indent=2)
    return cfg


# --------------------------------------------------------------------------- #
# Whisper (local transcription)                                                #
# --------------------------------------------------------------------------- #
def get_whisper():
    """Load faster-whisper on first use. Cached; errors remembered."""
    global _whisper, _whisper_error
    if _whisper is not None or _whisper_error is not None:
        return _whisper
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        _whisper_error = (
            "faster-whisper is not installed. Run: pip install -r requirements.txt "
            f"(import error: {exc})"
        )
        return None
    try:
        size = load_config().get("whisper_model", "base.en")
        # int8 keeps it light and CPU-friendly; downloads the model on first run.
        _whisper = WhisperModel(size, device="cpu", compute_type="int8")
    except Exception as exc:  # noqa: BLE001 - surface any load failure to the UI
        _whisper_error = f"Could not load Whisper model: {exc}"
        return None
    return _whisper


# --------------------------------------------------------------------------- #
# Anthropic                                                                    #
# --------------------------------------------------------------------------- #
def call_claude(model, system, user_text, max_tokens=1024):
    cfg = load_config()
    key = cfg.get("anthropic_api_key")
    if not key:
        raise RuntimeError("No Anthropic API key set. Add one in Settings.")

    payload = json.dumps(
        {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user_text}],
        }
    ).encode()

    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=payload,
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": ANTHROPIC_VERSION,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise RuntimeError(f"Anthropic API error {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach Anthropic API: {exc.reason}") from exc

    parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
    return "".join(parts).strip()


def extract_json(text):
    """Pull the first JSON object out of a model reply, tolerating stray prose/fences."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if "```" in text[3:] else text
        text = text.lstrip("json").strip("`").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return None


# --------------------------------------------------------------------------- #
# Routes                                                                       #
# --------------------------------------------------------------------------- #
@app.route("/")
def index():
    return send_from_directory("templates", "index.html")


@app.route("/api/status")
def status():
    cfg = load_config()
    return jsonify(
        {
            "has_key": bool(cfg.get("anthropic_api_key")),
            "whisper_ready": get_whisper() is not None,
            "whisper_error": _whisper_error,
            "suggest_model": cfg.get("suggest_model"),
            "summary_model": cfg.get("summary_model"),
            "whisper_model": cfg.get("whisper_model"),
        }
    )


@app.route("/api/config", methods=["POST"])
def config():
    body = request.get_json(force=True, silent=True) or {}
    allowed = {k: body.get(k) for k in DEFAULTS if k in body}
    cfg = save_config(allowed)
    # If the whisper model changed, drop the cached one so it reloads next time.
    global _whisper, _whisper_error
    _whisper = None
    _whisper_error = None
    return jsonify({"ok": True, "has_key": bool(cfg.get("anthropic_api_key"))})


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "no audio uploaded"}), 400
    model = get_whisper()
    if model is None:
        return jsonify({"error": _whisper_error or "Whisper unavailable"}), 503

    blob = request.files["audio"]
    suffix = os.path.splitext(blob.filename or "")[1] or ".webm"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        blob.save(tmp.name)
        tmp.close()
        segments, _info = model.transcribe(
            tmp.name,
            vad_filter=True,                       # skip silence -> fewer hallucinations
            condition_on_previous_text=False,      # each chunk is independent
            beam_size=1,
        )
        text = " ".join(s.text.strip() for s in segments).strip()
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"transcription failed: {exc}"}), 500
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
    return jsonify({"text": text})


SUGGEST_SYSTEM = """You are a live meeting co-pilot listening to a Microsoft Teams call.
The user has a GOAL for this call and may have a list of PLANNED questions they want to
get answered. You see a rolling transcript. Lines are labelled by speaker: "You:" is the
user (the person you're helping), "Them:" is the other participant(s). The transcript is
rough auto-transcription, so read it charitably.

You have three jobs, in priority order:

1. TRACK THE PLANNED QUESTIONS. For each planned question, decide if the conversation has
   now ANSWERED it (the substance was covered, whether or not it was asked word-for-word).
   Return the indices (0-based) of every planned question you judge answered so far.

2. SAY WHAT TO ASK NEXT. Pick the single best thing for the user to ask right now to move
   toward the goal. Prefer the most relevant still-UNANSWERED planned question if one fits
   the moment; otherwise craft a fresh question. Put it in "next".

3. OFFER FOLLOW-UPS. Suggest up to 2 additional sharp questions ("questions") — follow-ups
   on what was just said, or gaps the goal needs. Favour ones that surface risks,
   commitments, numbers, owners, or deadlines.

Rules:
- Do NOT repeat anything in ALREADY ASKED / SUGGESTED.
- Keep every question short and speakable out loud.
- If nothing new is worth asking yet, set "next" to "" and "questions" to [].
- "covered" must reflect the WHOLE transcript so far, not just the latest lines.

Reply with ONLY a JSON object:
{"covered": [list of 0-based indices of answered planned questions],
 "next": "the single best question to ask right now, or empty string",
 "next_reason": "<=8 word reason for next",
 "next_source": "planned" or "fresh",
 "questions": [{"q": "another question", "why": "<=8 word reason"}],
 "note": "optional one-line read on where the call is"}"""


@app.route("/api/suggest", methods=["POST"])
def suggest():
    body = request.get_json(force=True, silent=True) or {}
    goal = (body.get("goal") or "").strip()
    transcript = (body.get("transcript") or "").strip()
    asked = body.get("asked") or []
    planned = [str(p).strip() for p in (body.get("planned") or []) if str(p).strip()]
    if not goal and not planned:
        return jsonify({"error": "a goal or at least one planned question is required"}), 400
    if len(transcript) < 40:
        return jsonify({"questions": [], "covered": [], "next": "", "note": ""})

    # Keep the prompt bounded: the tail of the call is what matters live.
    tail = transcript[-7000:]
    asked_block = "\n".join(f"- {a}" for a in asked[-25:]) or "(none yet)"
    planned_block = (
        "\n".join(f"[{i}] {q}" for i, q in enumerate(planned)) or "(none — improvise from the goal)"
    )
    user_text = (
        f"GOAL:\n{goal or '(none given — use the planned questions)'}\n\n"
        f"PLANNED QUESTIONS (index in brackets):\n{planned_block}\n\n"
        f"ALREADY ASKED / SUGGESTED (do not repeat):\n{asked_block}\n\n"
        f"TRANSCRIPT SO FAR (most recent at the end):\n{tail}"
    )
    try:
        cfg = load_config()
        reply = call_claude(cfg["suggest_model"], SUGGEST_SYSTEM, user_text, max_tokens=700)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    parsed = extract_json(reply) or {}

    # Follow-up questions.
    clean = []
    for item in parsed.get("questions") or []:
        if isinstance(item, dict) and item.get("q"):
            clean.append({"q": str(item["q"]).strip(), "why": str(item.get("why", "")).strip()})

    # Covered planned-question indices, bounded to the real list.
    covered = []
    for idx in parsed.get("covered") or []:
        try:
            i = int(idx)
        except (TypeError, ValueError):
            continue
        if 0 <= i < len(planned) and i not in covered:
            covered.append(i)

    return jsonify(
        {
            "next": str(parsed.get("next") or "").strip(),
            "next_reason": str(parsed.get("next_reason") or "").strip(),
            "next_source": str(parsed.get("next_source") or "").strip(),
            "covered": covered,
            "questions": clean[:2],
            "note": str(parsed.get("note") or "").strip(),
        }
    )


SUMMARY_SYSTEM = """You are helping the user wrap up a Microsoft Teams call. You are given \
their GOAL for the call, the questions they PLANNED to ask, and the full (rough, \
auto-transcribed) transcript. Transcript lines are labelled by speaker: "You:" is the \
user you're helping, "Them:" is the other participant(s).

Produce a clear, ready-to-use debrief. Return GitHub-flavoured Markdown with these sections \
in this order:

## TL;DR
2-3 sentences: what happened and whether the goal was met.

## Key points
Bullet list of the substantive things discussed.

## Decisions
Bullet list of decisions made (or "None recorded").

## Action items
Bullet list as "- [ ] owner — task — due" where known.

## Your planned questions
For each planned question, one line: the question, then "→ Answered: <the answer>" or \
"→ Not answered". Omit this whole section if no planned questions were given.

## Open questions
Anything left unresolved that still needs an answer (include any unanswered planned ones).

## How to summarise this call
Practical guidance: who to send a recap to, the tone to strike, what to lead with, \
and any follow-up you should send. Then give a short, copy-paste-ready recap message \
the user could send to the other participants.

Be concise and honest. If the transcript is too thin to know something, say so rather \
than inventing detail."""


@app.route("/api/summarize", methods=["POST"])
def summarize():
    body = request.get_json(force=True, silent=True) or {}
    goal = (body.get("goal") or "").strip() or "(no explicit goal given)"
    transcript = (body.get("transcript") or "").strip()
    planned = [str(p).strip() for p in (body.get("planned") or []) if str(p).strip()]
    if len(transcript) < 40:
        return jsonify({"error": "Not enough transcript captured yet to summarise."}), 400

    planned_block = "\n".join(f"- {q}" for q in planned) or "(none)"
    user_text = (
        f"GOAL:\n{goal}\n\n"
        f"PLANNED QUESTIONS:\n{planned_block}\n\n"
        f"FULL TRANSCRIPT:\n{transcript[-40000:]}"
    )
    try:
        cfg = load_config()
        reply = call_claude(cfg["summary_model"], SUMMARY_SYSTEM, user_text, max_tokens=2000)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502
    return jsonify({"summary": reply})


@app.route("/static/<path:path>")
def static_files(path):
    return send_from_directory("static", path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8777"))
    print(f"\n  Call Copilot running at  http://127.0.0.1:{port}\n")
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
