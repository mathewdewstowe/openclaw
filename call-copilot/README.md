# Call Copilot

A local desktop tool that listens to **both sides** of a Microsoft Teams call and —
based on a **goal** and a **list of questions you want answered** — tells you the single
best thing to ask next, in real time. It ticks your planned questions off as they get
answered and keeps suggesting sharp follow‑ups. When the call is wrapping up, hit
**Summarise** and it tells you how best to summarise the whole call, with a
copy‑paste‑ready recap.

It hears **both sides**: the other participants (via shared call audio, labelled
**Them**) and you (via your mic, labelled **You**), transcribed separately so it knows
who said what.

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
2. Add the **questions you want to ask**, one per line, in the box below the goal.
   The copilot tracks these and ticks them off as they get answered.
3. Click **● Start listening**. The browser asks what to share — pick the
   **Teams window** (or the whole screen / the Teams tab) and **tick
   "Share audio"**. That's how it hears the other participants (**Them**). Your mic is
   captured separately (**You**) so it hears both sides. The two dots by the timer
   pulse green as each side is heard.
4. As the call unfolds:
   - **Ask next** shows the single best question to ask right now — either the most
     relevant of your planned questions (badge *your question*) or a fresh
     follow‑up (*follow‑up*), with a one‑line reason.
   - **Your questions** ticks off each planned question as it's answered (☐ → ☑).
     You can also click a box to toggle it by hand.
   - **Follow‑up ideas** collects extra sharp questions worth having in your back
     pocket. Click ✓ on one to mark it asked.
5. When the call is closing, click **Summarise the call**. You get a TL;DR, key
   points, decisions, action items, a rundown of which planned questions were
   answered, open questions, and — the part you asked for — **how best to
   summarise it**, plus a ready‑to‑send recap. Hit **Copy**.

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
