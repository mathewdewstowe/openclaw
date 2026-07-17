/* Call Copilot — frontend logic
 *
 * Flow:
 *   1. Capture the OTHER side (getDisplayMedia + audio) and YOUR side (mic) as
 *      TWO separate streams so we always hear both and can label who spoke.
 *   2. Record each in short, independently-decodable segments, POST to
 *      /api/transcribe (local Whisper), and tag each line "You" / "Them".
 *   3. Periodically POST goal + planned questions + labelled transcript to
 *      /api/suggest -> a single "ask next", planned-question coverage, follow-ups.
 *   4. Summarise button POSTs the whole transcript to /api/summarize.
 */

const $ = (id) => document.getElementById(id);

const state = {
  recording: false,
  segMs: 10000,          // length of each audio segment
  pipes: [],             // [{stream, label, recorder, active}]
  transcript: [],        // [{speaker, text}]
  planned: [],           // [{text, covered}]
  asked: [],             // questions already suggested/asked (avoid repeats)
  currentNext: "",       // the live "ask next" question text
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

// Transcript formatted for the model, with speaker labels.
function transcriptForModel() {
  return state.transcript.map((e) => `${e.speaker}: ${e.text}`).join("\n").trim();
}

function plannedTexts() {
  return state.planned.map((p) => p.text);
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
// Build the two source streams. We keep them SEPARATE (no mixing) so each can
// be transcribed and labelled independently — that's what lets us hear both.
async function buildSources() {
  const wantSystem = $("capSystem").checked;
  const wantMic = $("capMic").checked;
  if (!wantSystem && !wantMic) throw new Error("Pick at least one audio source.");
  const pipes = [];

  if (wantSystem) {
    const disp = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const atracks = disp.getAudioTracks();
    disp.getVideoTracks().forEach((t) => t.stop());   // we only want the audio
    if (!atracks.length) {
      disp.getTracks().forEach((t) => t.stop());
      throw new Error('No call audio captured — re-share and tick "Share audio".');
    }
    pipes.push({ stream: new MediaStream([atracks[0]]), raw: disp, label: "Them" });
  }

  if (wantMic) {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    pipes.push({ stream: mic, raw: mic, label: "You" });
  }

  state.pipes = pipes;
}

function pickMime() {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
}

/* Record one self-contained segment for a pipe, then start the next. Each
 * segment is a complete file Whisper can decode on its own. */
function recordSegment(pipe) {
  if (!state.recording || !pipe.active) return;
  const mime = pickMime();
  const chunks = [];
  const rec = new MediaRecorder(pipe.stream, mime ? { mimeType: mime } : undefined);
  pipe.recorder = rec;

  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    if (chunks.length) {
      const blob = new Blob(chunks, { type: mime || "audio/webm" });
      if (blob.size > 1200) sendSegment(blob, pipe.label);   // skip near-silent blips
    }
    if (state.recording && pipe.active) recordSegment(pipe);  // loop
  };

  rec.start();
  setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, state.segMs);
}

async function sendSegment(blob, speaker) {
  const fd = new FormData();
  fd.append("audio", blob, "seg.webm");
  try {
    const r = await fetch("/api/transcribe", { method: "POST", body: fd });
    const data = await r.json();
    if (data.error) { toast(data.error, 5000); return; }
    const text = (data.text || "").trim();
    if (text) appendTranscript(speaker, text);
  } catch (e) {
    console.error("transcribe failed", e);
  }
}

/* ------------------------------------------------------------- transcript - */
function appendTranscript(speaker, text) {
  state.transcript.push({ speaker, text });
  pulseEar(speaker);
  const box = $("transcript");
  const empty = box.querySelector(".empty");
  if (empty) empty.remove();
  const line = document.createElement("div");
  line.className = "t-line " + (speaker === "You" ? "t-you" : "t-them");
  const tag = document.createElement("span");
  tag.className = "t-tag";
  tag.textContent = speaker;
  const body = document.createElement("span");
  body.textContent = " " + text;
  line.append(tag, body);
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function pulseEar(speaker) {
  const el = speaker === "You" ? $("earYou") : $("earThem");
  if (!el) return;
  el.classList.add("ear-live");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("ear-live"), 1400);
}

/* --------------------------------------------------------------- planned -- */
function syncPlannedFromInput() {
  const lines = $("planned").value.split("\n").map((s) => s.trim()).filter(Boolean);
  // Preserve covered state for questions that still exist.
  const prev = new Map(state.planned.map((p) => [p.text, p.covered]));
  state.planned = lines.map((text) => ({ text, covered: prev.get(text) || false }));
  renderPlanned();
}

function renderPlanned() {
  const box = $("plannedList");
  box.innerHTML = "";
  if (!state.planned.length) {
    box.innerHTML = '<div class="empty">Add questions on the left and they\'ll be tracked here.</div>';
    $("plannedCount").textContent = "0 / 0";
    return;
  }
  let done = 0;
  state.planned.forEach((p, i) => {
    if (p.covered) done++;
    const row = document.createElement("div");
    row.className = "planned-item" + (p.covered ? " covered" : "");
    row.innerHTML = `<span class="pi-check">${p.covered ? "☑" : "☐"}</span><span class="pi-text"></span>`;
    row.querySelector(".pi-text").textContent = p.text;
    // Manual toggle in case the model misses one.
    row.querySelector(".pi-check").onclick = () => { p.covered = !p.covered; renderPlanned(); };
    box.appendChild(row);
  });
  $("plannedCount").textContent = `${done} / ${state.planned.length}`;
}

/* -------------------------------------------------------------- suggestions */
async function maybeSuggest() {
  if (!state.recording || state.suggestBusy) return;
  const goal = $("goal").value.trim();
  const planned = plannedTexts();
  const full = transcriptForModel();
  if ((!goal && !planned.length) || full.length < 60) return;
  // Only call when there's meaningfully new material since last time.
  if (full.length - state.lastSuggestLen < 100) return;

  state.suggestBusy = true;
  state.lastSuggestLen = full.length;
  setSuggestState("thinking…", "pill-live");
  try {
    const r = await fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal, planned, transcript: full, asked: state.asked }),
    });
    const data = await r.json();
    if (data.error) { toast(data.error, 5000); }
    else applySuggestions(data);
  } catch (e) {
    console.error("suggest failed", e);
  } finally {
    state.suggestBusy = false;
    setSuggestState(state.recording ? "listening" : "idle", state.recording ? "pill-ok" : "pill-muted");
  }
}

function setSuggestState(text, cls) {
  const el = $("suggestState");
  el.textContent = text;
  el.className = "pill " + cls;
}

function applySuggestions(data) {
  // 1. Mark planned questions the model judged answered.
  if (Array.isArray(data.covered) && state.planned.length) {
    let changed = false;
    data.covered.forEach((i) => {
      if (state.planned[i] && !state.planned[i].covered) { state.planned[i].covered = true; changed = true; }
    });
    if (changed) renderPlanned();
  }

  // 2. The single best thing to ask next.
  renderAskNext(data.next || "", data.next_reason || "", data.next_source || "");

  // 3. Follow-up ideas.
  renderFollowups(data.questions || []);

  // 4. Read on the room.
  const note = (data.note || "").trim();
  const n = $("qNote");
  if (note) { n.textContent = "Read: " + note; n.classList.remove("hidden"); }
}

function renderAskNext(text, reason, source) {
  const box = $("askNext");
  if (!text) {
    if (!box.querySelector(".ask-live")) {
      box.innerHTML = '<div class="empty">Listening — nothing urgent to ask right now.</div>';
    }
    return;
  }
  if (text === state.currentNext) return;   // unchanged, don't re-animate
  state.currentNext = text;
  if (!state.asked.includes(text)) state.asked.push(text);
  const badge = source === "planned"
    ? '<span class="src-badge src-planned">your question</span>'
    : '<span class="src-badge src-fresh">follow-up</span>';
  box.innerHTML = `
    <div class="ask-live">
      <div class="ask-q"></div>
      <div class="ask-foot">${badge}<span class="ask-why"></span></div>
    </div>`;
  box.querySelector(".ask-q").textContent = text;
  box.querySelector(".ask-why").textContent = reason || "";
}

function renderFollowups(questions) {
  const box = $("questions");
  questions.forEach((q) => {
    if (!q.q || state.asked.includes(q.q)) return;
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
}

/* --------------------------------------------------------------- lifecycle */
async function start() {
  syncPlannedFromInput();
  const goal = $("goal").value.trim();
  if (!goal && !state.planned.length &&
      !confirm("No goal or questions set — the copilot works much better with them. Start anyway?"))
    return;
  try {
    await buildSources();
  } catch (e) {
    toast(e.message || "Could not start capture.", 6000);
    return;
  }
  state.recording = true;
  state.startTime = Date.now();
  $("startBtn").disabled = true;
  $("stopBtn").disabled = false;
  $("summariseBtn").disabled = false;
  setSuggestState("listening", "pill-ok");

  state.pipes.forEach((pipe) => {
    pipe.active = true;
    // If the user stops screen-share from the browser chrome, drop that pipe.
    pipe.raw.getTracks().forEach((t) => (t.onended = () => {
      pipe.active = false;
      if (pipe.label === "Them") toast("Call-audio share ended — only your mic is live now.", 5000);
      if (!state.pipes.some((p) => p.active)) stop();
    }));
    recordSegment(pipe);
  });

  state.timerId = setInterval(() => {
    $("timer").textContent = fmtTime((Date.now() - state.startTime) / 1000);
  }, 500);
  state.suggestTimer = setInterval(maybeSuggest, 5000);
}

function stop() {
  state.recording = false;
  state.pipes.forEach((pipe) => {
    pipe.active = false;
    try { if (pipe.recorder && pipe.recorder.state !== "inactive") pipe.recorder.stop(); } catch {}
    pipe.raw.getTracks().forEach((t) => t.stop());
  });
  state.pipes = [];
  clearInterval(state.timerId);
  clearInterval(state.suggestTimer);
  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;
  setSuggestState("idle", "pill-muted");
}

/* ---------------------------------------------------------------- summary - */
async function summarise() {
  const full = transcriptForModel();
  if (full.length < 40) { toast("Not enough transcript captured yet.", 4000); return; }
  const modal = $("summaryModal");
  modal.classList.remove("hidden");
  $("summaryBody").innerHTML = '<div class="spinner"></div> Writing your debrief…';
  try {
    const r = await fetch("/api/summarize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: $("goal").value.trim(),
        planned: plannedTexts(),
        transcript: full,
      }),
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
$("planned").addEventListener("input", syncPlannedFromInput);
$("clearBtn").onclick = () => {
  state.transcript = [];
  state.asked = [];
  state.currentNext = "";
  state.lastSuggestLen = 0;
  state.planned.forEach((p) => (p.covered = false));
  renderPlanned();
  $("transcript").innerHTML = '<div class="empty">Nothing yet.</div>';
  $("questions").innerHTML = '<div class="empty">Fresh follow-ups based on what\'s said will appear here.</div>';
  $("askNext").innerHTML = '<div class="empty">Your single best next question shows up here, live.</div>';
  $("qNote").classList.add("hidden");
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
