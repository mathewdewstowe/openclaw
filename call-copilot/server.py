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
The user has a GOAL for this call. You see a rolling transcript (it may be rough, \
auto-transcribed, and mix multiple speakers without labels).

Your job: suggest the 1-3 MOST useful questions the user could ask RIGHT NOW to move \
toward their goal. Favour questions that:
- fill a gap the goal needs but the conversation hasn't covered,
- follow up sharply on something just said,
- surface risks, commitments, numbers, owners, or deadlines.

Do NOT repeat questions already listed as asked/suggested. If nothing new is worth \
asking yet, return an empty list. Keep each question short and speakable out loud.

Reply with ONLY a JSON object:
{"questions": [{"q": "the question", "why": "<=8 word reason"}], "note": "optional one-line read on where the call is"}"""


@app.route("/api/suggest", methods=["POST"])
def suggest():
    body = request.get_json(force=True, silent=True) or {}
    goal = (body.get("goal") or "").strip()
    transcript = (body.get("transcript") or "").strip()
    asked = body.get("asked") or []
    if not goal:
        return jsonify({"error": "goal is required"}), 400
    if len(transcript) < 40:
        return jsonify({"questions": [], "note": ""})

    # Keep the prompt bounded: the tail of the call is what matters live.
    tail = transcript[-6000:]
    asked_block = "\n".join(f"- {a}" for a in asked[-25:]) or "(none yet)"
    user_text = (
        f"GOAL:\n{goal}\n\n"
        f"ALREADY ASKED / SUGGESTED (do not repeat):\n{asked_block}\n\n"
        f"TRANSCRIPT SO FAR (most recent at the end):\n{tail}"
    )
    try:
        cfg = load_config()
        reply = call_claude(cfg["suggest_model"], SUGGEST_SYSTEM, user_text, max_tokens=600)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    parsed = extract_json(reply) or {}
    questions = parsed.get("questions") or []
    clean = []
    for item in questions:
        if isinstance(item, dict) and item.get("q"):
            clean.append({"q": str(item["q"]).strip(), "why": str(item.get("why", "")).strip()})
    return jsonify({"questions": clean[:3], "note": parsed.get("note", "")})


SUMMARY_SYSTEM = """You are helping the user wrap up a Microsoft Teams call. You are given \
their GOAL for the call and the full (rough, auto-transcribed) transcript.

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

## Open questions
Anything left unresolved that still needs an answer.

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
    if len(transcript) < 40:
        return jsonify({"error": "Not enough transcript captured yet to summarise."}), 400

    user_text = f"GOAL:\n{goal}\n\nFULL TRANSCRIPT:\n{transcript[-40000:]}"
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
