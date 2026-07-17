# Call Copilot

A local desktop tool that listens to a Microsoft Teams call, and — based on a
**goal you give it** — prompts you with the sharpest questions to ask in real time.
When the call is wrapping up, hit **Summarise** and it tells you how best to
summarise the whole call, with a copy‑paste‑ready recap.

Everything runs on your machine. Audio is transcribed locally with Whisper — the
only thing that leaves your computer is the transcript **text**, sent to the
Anthropic API to generate the question prompts and the summary.

```
 ┌── your goal ──┐   ┌─ call audio + your mic ─┐
 │  "Find out …" │   │  captured via screen-   │
 └───────┬───────┘   │  share-with-audio +     │
         │           │  microphone             │
         │           └────────────┬────────────┘
         │                        │  local Whisper
         │                        ▼
         │                 live transcript
         │                        │
         ▼                        ▼
    ┌────────────── Claude ──────────────┐
    │  "Ask now" questions  •  Summary   │
    └────────────────────────────────────┘
```

## Requirements

- **Python 3.9+**
- **ffmpeg** — needed by Whisper to decode audio.
  - macOS: `brew install ffmpeg`
  - Windows: `winget install Gyan.FFmpeg` (or download from ffmpeg.org and add to PATH)
  - Linux: `sudo apt install ffmpeg`
- An **Anthropic API key** (from <https://console.anthropic.com>).
- A Chromium‑based browser (Chrome or Edge) — needed for capturing call audio.
  Firefox cannot share system/tab audio reliably.

## Run it

**macOS / Linux**

```bash
cd call-copilot
./run.sh
```

**Windows** — double‑click `run.bat` (or run it from a terminal).

The first run creates a virtualenv and installs Flask + faster‑whisper (a few
minutes). It then opens <http://127.0.0.1:8777> in your browser.

Prefer to do it by hand:

```bash
python3 -m venv .venv
. .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python server.py            # then open http://127.0.0.1:8777
```

## First‑time setup (in the app)

1. Click **⚙︎ Settings**, paste your Anthropic API key, choose a Whisper model
   (`base.en` is a good start), and **Save**. The key is stored locally in
   `config.local.json` (git‑ignored). Alternatively export `ANTHROPIC_API_KEY`
   before launching.
2. The status pill up top should read **Whisper ready** after the first
   transcription (the model downloads on first use).

## Using it on a call

1. Type your **goal** for the call — be specific. This is the single biggest
   lever on how useful the prompts are.
   > *"Confirm they can hit a March go‑live, find out who owns the integration
   > work, and surface any budget blockers."*
2. Click **● Start listening**. The browser asks what to share — pick the
   **Teams window** (or the whole screen / the Teams tab) and **tick
   "Share audio"**. That's how it hears the other participants. Your mic is
   captured separately so it hears you too.
3. As the call unfolds, suggested questions appear under **Ask now**, newest on
   top, each with a one‑line reason. Click ✓ to mark one asked.
4. When the call is closing, click **Summarise the call**. You get a TL;DR, key
   points, decisions, action items, open questions, and — the part you asked for
   — **how best to summarise it**, plus a ready‑to‑send recap. Hit **Copy**.

## Notes & tuning

- **No question prompts?** They only appear once there's a goal set and enough
  transcript, and the model deliberately stays quiet when it has nothing new
  worth asking. Give it 20–30 seconds of speech.
- **Transcript looks rough?** Bump the Whisper model to `small.en` in Settings
  (more accurate, a bit slower). Auto‑transcription of multi‑speaker calls is
  never perfect — the summary and prompts tolerate rough input.
- **Privacy:** the audio never leaves your machine; only transcript text is sent
  to Anthropic. Be mindful of your workplace's call‑recording policy — treat
  this like taking detailed notes.
- **Models:** live prompts use a fast model (Haiku) to stay cheap and snappy;
  the summary uses a stronger model (Sonnet). Change these in
  `config.local.json` if you like.

## Files

| File | What it does |
|------|--------------|
| `server.py` | Flask backend: transcription, suggestions, summary, Anthropic calls |
| `templates/index.html` | The single‑page UI |
| `static/app.js` | Audio capture, segmented transcription, live loop |
| `static/style.css` | Styling |
| `config.local.json` | Your API key + model choices (created on save, git‑ignored) |
