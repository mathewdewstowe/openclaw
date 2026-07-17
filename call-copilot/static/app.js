/* Call Copilot — frontend logic
 *
 * Flow:
 *   1. Capture call audio (getDisplayMedia + audio) and/or mic (getUserMedia),
 *      mix them into one stream.
 *   2. Record it in short, independently-decodable segments and POST each to
 *      /api/transcribe (local Whisper).
 *   3. Append text to the rolling transcript. Periodically POST goal+transcript
 *      to /api/suggest and render the questions.
 *   4. Summarise button POSTs the whole transcript to /api/summarize.
 */

const $ = (id) => document.getElementById(id);

const state = {
  recording: false,
  segMs: 12000,          // length of each audio segment
  mixStream: null,
  sources: [],           // MediaStreams to stop on teardown
  audioCtx: null,
  recorder: null,
  transcript: [],        // array of text chunks
  asked: [],             // questions already suggested (avoid repeats)
  suggestBusy: false,
  lastSuggestLen: 0,
  startTime: 0,
  timerId: null,
  suggestTimer: null,
};

/* ---------------------------------------------------------------- helpers - */
function toast(msg, ms = 3200) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._id);
  t._id = setTimeout(() => t.classList.add("hidden"), ms);
}

function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(Math.floor(sec % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function transcriptText() {
  return state.transcript.join(" ").replace(/\s+/g, " ").trim();
}

/* ----------------------------------------------------------------- status - */
async function refreshStatus() {
  try {
    const r = await fetch("/api/status");
    const s = await r.json();
    const dot = $("statusDot");
    const ws = $("whisperState");
    if (s.whisper_ready) {
      ws.textContent = `Whisper ready (${s.whisper_model})`;
      ws.className = "pill pill-ok";
    } else {
      ws.textContent = "Whisper not ready";
      ws.className = "pill pill-warn";
      ws.title = s.whisper_error || "";
    }
    dot.className = "dot" + (s.has_key ? " dot-ok" : " dot-warn");
    dot.title = s.has_key ? "API key set" : "No API key — open Settings";
    if (!s.has_key) toast("No Anthropic API key set — open Settings to add one.", 5000);
    return s;
  } catch (e) {
    $("whisperState").textContent = "server offline";
    return null;
  }
}

/* ---------------------------------------------------------------- capture - */
async function buildMixStream() {
  const wantSystem = $("capSystem").checked;
  const wantMic = $("capMic").checked;
  if (!wantSystem && !wantMic) throw new Error("Pick at least one audio source.");

  state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const dest = state.audioCtx.createMediaStreamDestination();
  let gotAudio = false;

  if (wantSystem) {
    // The browser will ask which window/screen/tab to share. Tick "share audio".
    const disp = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    state.sources.push(disp);
    const tracks = disp.getAudioTracks();
    if (tracks.length) {
      state.audioCtx.createMediaStreamSource(new MediaStream([tracks[0]])).connect(dest);
      gotAudio = true;
    } else {
      toast('No call audio captured — re-share and tick "Share audio".', 6000);
    }
    // We don't need the video; stop it to save resources.
    disp.getVideoTracks().forEach((t) => t.stop());
  }

  if (wantMic) {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.sources.push(mic);
    state.audioCtx.createMediaStreamSource(mic).connect(dest);
    gotAudio = true;
  }

  if (!gotAudio) throw new Error("No audio tracks were captured.");
  state.mixStream = dest.stream;
}

function pickMime() {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
}

/* Record one self-contained segment, then immediately start the next. Each
 * segment is a complete file Whisper can decode on its own. */
function recordSegment() {
  if (!state.recording) return;
  const mime = pickMime();
  const chunks = [];
  const rec = new MediaRecorder(state.mixStream, mime ? { mimeType: mime } : undefined);
  state.recorder = rec;

  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    if (chunks.length) {
      const blob = new Blob(chunks, { type: mime || "audio/webm" });
      if (blob.size > 1200) sendSegment(blob);  // skip near-empty blips
    }
    if (state.recording) recordSegment();        // loop
  };

  rec.start();
  setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, state.segMs);
}

async function sendSegment(blob) {
  const fd = new FormData();
  fd.append("audio", blob, "seg.webm");
  try {
    const r = await fetch("/api/transcribe", { method: "POST", body: fd });
    const data = await r.json();
    if (data.error) { toast(data.error, 5000); return; }
    const text = (data.text || "").trim();
    if (text) appendTranscript(text);
  } catch (e) {
    console.error("transcribe failed", e);
  }
}

/* ------------------------------------------------------------- transcript - */
function appendTranscript(text) {
  state.transcript.push(text);
  const box = $("transcript");
  const empty = box.querySelector(".empty");
  if (empty) empty.remove();
  const line = document.createElement("div");
  line.className = "t-line";
  line.textContent = text;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

/* -------------------------------------------------------------- suggestions */
async function maybeSuggest() {
  if (!state.recording || state.suggestBusy) return;
  const goal = $("goal").value.trim();
  const full = transcriptText();
  if (!goal || full.length < 60) return;
  // Only call when there's meaningfully new material since last time.
  if (full.length - state.lastSuggestLen < 120) return;

  state.suggestBusy = true;
  state.lastSuggestLen = full.length;
  $("suggestState").textContent = "thinking…";
  $("suggestState").className = "pill pill-live";
  try {
    const r = await fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal, transcript: full, asked: state.asked }),
    });
    const data = await r.json();
    if (data.error) { toast(data.error, 5000); }
    else renderQuestions(data.questions || [], data.note || "");
  } catch (e) {
    console.error("suggest failed", e);
  } finally {
    state.suggestBusy = false;
    $("suggestState").textContent = state.recording ? "listening" : "idle";
    $("suggestState").className = "pill " + (state.recording ? "pill-ok" : "pill-muted");
  }
}

function renderQuestions(questions, note) {
  const box = $("questions");
  if (!questions.length && !box.querySelector(".q-card")) {
    return; // keep the empty hint until we have something
  }
  questions.forEach((q) => {
    if (state.asked.includes(q.q)) return;
    state.asked.push(q.q);
    const empty = box.querySelector(".empty");
    if (empty) empty.remove();
    const card = document.createElement("div");
    card.className = "q-card q-new";
    card.innerHTML = `
      <div class="q-text"></div>
      <div class="q-foot"><span class="q-why"></span><button class="q-done" title="Mark asked">✓</button></div>`;
    card.querySelector(".q-text").textContent = q.q;
    card.querySelector(".q-why").textContent = q.why || "";
    card.querySelector(".q-done").onclick = () => card.classList.toggle("q-asked");
    box.prepend(card);
    setTimeout(() => card.classList.remove("q-new"), 1500);
  });
  if (note) {
    let n = box.parentElement.querySelector(".q-note");
    if (!n) {
      n = document.createElement("div");
      n.className = "q-note";
      box.parentElement.appendChild(n);
    }
    n.textContent = "Read: " + note;
  }
}

/* --------------------------------------------------------------- lifecycle */
async function start() {
  const goal = $("goal").value.trim();
  if (!goal && !confirm("No goal set — the copilot works much better with one. Start anyway?"))
    return;
  try {
    await buildMixStream();
  } catch (e) {
    toast(e.message || "Could not start capture.", 5000);
    return;
  }
  state.recording = true;
  state.startTime = Date.now();
  $("startBtn").disabled = true;
  $("stopBtn").disabled = false;
  $("summariseBtn").disabled = false;
  $("suggestState").textContent = "listening";
  $("suggestState").className = "pill pill-ok";

  // If the user stops screen-share from the browser chrome, stop cleanly.
  state.sources.forEach((s) =>
    s.getTracks().forEach((t) => (t.onended = () => { if (state.recording) stop(); }))
  );

  recordSegment();
  state.timerId = setInterval(() => {
    $("timer").textContent = fmtTime((Date.now() - state.startTime) / 1000);
  }, 500);
  state.suggestTimer = setInterval(maybeSuggest, 6000);
}

function stop() {
  state.recording = false;
  try { if (state.recorder && state.recorder.state !== "inactive") state.recorder.stop(); } catch {}
  state.sources.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  state.sources = [];
  if (state.audioCtx) { state.audioCtx.close().catch(() => {}); state.audioCtx = null; }
  clearInterval(state.timerId);
  clearInterval(state.suggestTimer);
  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;
  $("suggestState").textContent = "idle";
  $("suggestState").className = "pill pill-muted";
}

/* ---------------------------------------------------------------- summary - */
async function summarise() {
  const full = transcriptText();
  if (full.length < 40) { toast("Not enough transcript captured yet.", 4000); return; }
  const modal = $("summaryModal");
  modal.classList.remove("hidden");
  $("summaryBody").innerHTML = '<div class="spinner"></div> Writing your debrief…';
  try {
    const r = await fetch("/api/summarize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: $("goal").value.trim(), transcript: full }),
    });
    const data = await r.json();
    if (data.error) { $("summaryBody").textContent = data.error; return; }
    $("summaryBody").innerHTML = renderMarkdown(data.summary || "");
    $("summaryBody").dataset.raw = data.summary || "";
  } catch (e) {
    $("summaryBody").textContent = "Failed to generate summary: " + e.message;
  }
}

/* Tiny, dependency-free Markdown renderer — enough for our summary sections. */
function renderMarkdown(md) {
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (let raw of lines) {
    const line = raw.trimEnd();
    if (/^##\s+/.test(line)) { closeList(); html += `<h3>${esc(line.replace(/^##\s+/, ""))}</h3>`; }
    else if (/^#\s+/.test(line)) { closeList(); html += `<h2>${esc(line.replace(/^#\s+/, ""))}</h2>`; }
    else if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      let item = esc(line.replace(/^\s*[-*]\s+/, ""));
      item = item.replace(/^\[ \]\s*/, "☐ ").replace(/^\[[xX]\]\s*/, "☑ ");
      html += `<li>${inlineMd(item)}</li>`;
    } else if (line === "") { closeList(); }
    else { closeList(); html += `<p>${inlineMd(esc(line))}</p>`; }
  }
  closeList();
  return html;
}
function inlineMd(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

/* ----------------------------------------------------------------- settings */
async function openSettings() {
  const s = await refreshStatus();
  if (s) $("whisperModel").value = s.whisper_model || "base.en";
  $("settingsMsg").textContent = "";
  $("settingsModal").classList.remove("hidden");
}
async function saveSettings() {
  const body = {
    anthropic_api_key: $("apiKey").value.trim() || undefined,
    whisper_model: $("whisperModel").value,
  };
  const r = await fetch("/api/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  $("settingsMsg").textContent = data.ok ? "Saved." : "Save failed.";
  $("apiKey").value = "";
  await refreshStatus();
  setTimeout(() => $("settingsModal").classList.add("hidden"), 700);
}

/* -------------------------------------------------------------------- wire */
$("startBtn").onclick = start;
$("stopBtn").onclick = stop;
$("summariseBtn").onclick = summarise;
$("clearBtn").onclick = () => {
  state.transcript = [];
  state.asked = [];
  state.lastSuggestLen = 0;
  $("transcript").innerHTML = '<div class="empty">Nothing yet.</div>';
  $("questions").innerHTML = '<div class="empty">Suggested questions will appear here.</div>';
};
$("settingsBtn").onclick = openSettings;
$("settingsCancel").onclick = () => $("settingsModal").classList.add("hidden");
$("settingsSave").onclick = saveSettings;
$("summaryClose").onclick = () => $("summaryModal").classList.add("hidden");
$("copySummary").onclick = () => {
  const raw = $("summaryBody").dataset.raw || $("summaryBody").innerText;
  navigator.clipboard.writeText(raw).then(() => toast("Summary copied."));
};

refreshStatus();
setInterval(() => { if (!state.recording) refreshStatus(); }, 15000);
