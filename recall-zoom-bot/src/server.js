require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ZoomBot } = require("./bot-engine");

const app = express();
app.use(cors());
app.use(express.json());

const bots = new Map();

// ── POST /api/bot — Join a Zoom meeting ─────
app.post("/api/bot", async (req, res) => {
  const { meeting_url, bot_name, password } = req.body;
  if (!meeting_url) return res.status(400).json({ error: "meeting_url is required" });

  const bot = new ZoomBot({
    id: `bot_${Date.now()}`,
    meeting_url,
    bot_name,
    password,
  });

  bots.set(bot.id, bot);

  bot.on("status", (e) => console.log(`[${e.id}] ${e.status}`));
  bot.on("audio", (e) => {
    // e.pcm = Buffer of S16LE PCM at 16kHz
    // TODO: forward to your AI / transcription service
  });
  bot.on("participant_joined", (e) => console.log(`[${e.id}] + ${e.name}`));
  bot.on("participant_left", (e) => console.log(`[${e.id}] - ${e.name}`));
  bot.on("left", (e) => bots.delete(e.id));
  bot.on("error", (e) => console.error(`[${e.id}] ERROR: ${e.error}`));

  bot.join().catch((err) => console.error(`[${bot.id}] Join failed:`, err.message));

  res.status(201).json(bot.toJSON());
});

// ── GET /api/bot/:id — Bot status ───────────
app.get("/api/bot/:id", (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Not found" });
  res.json(bot.toJSON());
});

// ── GET /api/bots — List all bots ───────────
app.get("/api/bots", (_req, res) => {
  res.json(Array.from(bots.values()).map((b) => b.toJSON()));
});

// ── GET /api/bot/:id/screenshot — Debug view ─
app.get("/api/bot/:id/screenshot", async (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Not found" });
  try {
    const img = await bot.screenshot();
    if (!img) return res.status(409).json({ error: "No active page" });
    res.json({ image: `data:image/png;base64,${img}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/bot/:id — Leave meeting ─────
app.delete("/api/bot/:id", async (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Not found" });
  await bot.leave();
  bots.delete(bot.id);
  res.json({ status: "left" });
});

// ── GET /api/health ─────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", active_bots: bots.size, uptime: process.uptime() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Zoom bot API running on :${PORT}`));
