require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { ZoomBot } = require("./bot-engine");
const { createWebSocketServer } = require("./ws-server");

const app = express();
app.use(cors());
app.use(express.json());

// Serve the avatar webpage (Chromium renders this as the bot's camera feed)
app.use(express.static(path.join(__dirname, "../public")));

// Active bots keyed by id
const bots = new Map();

// ──────────────────────────────────────────────
// POST /api/bot — Create a bot and join a Zoom meeting
// ──────────────────────────────────────────────
app.post("/api/bot", async (req, res) => {
  const { meeting_url, bot_name, password, avatar_url } = req.body;

  if (!meeting_url) {
    return res.status(400).json({ error: "meeting_url is required" });
  }

  const bot = new ZoomBot({
    id: `bot_${Date.now()}`,
    meeting_url,
    bot_name,
    password,
    avatar_url,
  });

  bots.set(bot.id, bot);

  // Forward bot events to console (and optionally to webhooks)
  bot.on("status", (e) => console.log(`[${e.id}] Status: ${e.status}`));
  bot.on("joined", (e) => console.log(`[${e.id}] Joined meeting`));
  bot.on("left", (e) => {
    console.log(`[${e.id}] Left meeting`);
    bots.delete(e.id);
  });
  bot.on("error", (e) => console.error(`[${e.id}] Error: ${e.error}`));

  // Start joining asynchronously — return immediately with bot ID
  bot.join().catch((err) => {
    console.error(`[${bot.id}] Join failed:`, err.message);
  });

  res.status(201).json(bot.toJSON());
});

// ──────────────────────────────────────────────
// GET /api/bot/:id — Get bot status
// ──────────────────────────────────────────────
app.get("/api/bot/:id", (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Bot not found" });
  res.json(bot.toJSON());
});

// ──────────────────────────────────────────────
// GET /api/bots — List all active bots
// ──────────────────────────────────────────────
app.get("/api/bots", (_req, res) => {
  res.json(Array.from(bots.values()).map((b) => b.toJSON()));
});

// ──────────────────────────────────────────────
// POST /api/bot/:id/audio-capture — Start capturing meeting audio
// ──────────────────────────────────────────────
app.post("/api/bot/:id/audio-capture", async (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Bot not found" });
  if (bot.status !== "in_meeting") {
    return res.status(409).json({ error: "Bot is not in a meeting yet" });
  }

  try {
    await bot.startAudioCapture(req.body.sample_rate || 16000);
    res.json({ status: "capturing" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/bot/:id — Remove bot from meeting
// ──────────────────────────────────────────────
app.delete("/api/bot/:id", async (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Bot not found" });

  try {
    await bot.leave();
    bots.delete(bot.id);
    res.json({ status: "left" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/health — Health check
// ──────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    active_bots: bots.size,
    uptime: process.uptime(),
  });
});

// Start servers
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8080;

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Avatar page: http://localhost:${PORT}/agent.html`);
});

createWebSocketServer(WS_PORT);
