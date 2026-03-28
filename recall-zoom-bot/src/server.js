require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ZoomBot } = require("./bot-engine");
const { TavusClient } = require("./tavus-client");

const app = express();
app.use(cors());
app.use(express.json());

const bots = new Map();
const tavus = process.env.TAVUS_API_KEY ? new TavusClient(process.env.TAVUS_API_KEY) : null;

// ── POST /api/bot — Join a Zoom meeting ─────
// Optionally pass tavus config to connect avatar immediately after joining.
app.post("/api/bot", async (req, res) => {
  const { meeting_url, bot_name, password, tavus: tavusConfig } = req.body;
  if (!meeting_url) return res.status(400).json({ error: "meeting_url is required" });

  let tavusConversationUrl = null;

  // If Tavus config provided, create a conversation first
  if (tavusConfig) {
    if (!tavus) return res.status(400).json({ error: "TAVUS_API_KEY not configured" });

    try {
      const conversation = await tavus.createConversation({
        replicaId: tavusConfig.replica_id,
        personaId: tavusConfig.persona_id,
        conversationName: tavusConfig.conversation_name || `Zoom: ${bot_name || "AI Assistant"}`,
        customGreeting: tavusConfig.custom_greeting,
        context: tavusConfig.context,
      });
      tavusConversationUrl = conversation.conversation_url;
      console.log(`Tavus conversation created: ${conversation.conversation_id}`);
    } catch (err) {
      return res.status(500).json({ error: `Tavus error: ${err.message}` });
    }
  }

  const bot = new ZoomBot({
    id: `bot_${Date.now()}`,
    meeting_url,
    bot_name,
    password,
    tavus_conversation_url: tavusConversationUrl,
  });

  bots.set(bot.id, bot);

  bot.on("status", (e) => console.log(`[${e.id}] ${e.status}`));
  bot.on("audio", () => {}); // Handled by consumers
  bot.on("participant_joined", (e) => console.log(`[${e.id}] + ${e.name}`));
  bot.on("participant_left", (e) => console.log(`[${e.id}] - ${e.name}`));
  bot.on("tavus_connected", (e) => console.log(`[${e.id}] Tavus avatar live`));
  bot.on("left", (e) => bots.delete(e.id));
  bot.on("error", (e) => {
    console.error(`[${e.id}] ERROR: ${e.error}`);
    // Keep bot in map so we can retrieve error screenshots
  });

  bot.join().catch((err) => console.error(`[${bot.id}] Join failed:`, err.message));

  res.status(201).json(bot.toJSON());
});

// ── GET /api/bot/:id ────────────────────────
app.get("/api/bot/:id", (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Not found" });
  res.json(bot.toJSON());
});

// ── GET /api/bots ───────────────────────────
app.get("/api/bots", (_req, res) => {
  res.json(Array.from(bots.values()).map((b) => b.toJSON()));
});

// ── POST /api/bot/:id/tavus — Connect Tavus avatar to a running bot ──
app.post("/api/bot/:id/tavus", async (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Not found" });
  if (bot.status !== "in_meeting") return res.status(409).json({ error: "Bot not in meeting yet" });

  const { replica_id, persona_id, conversation_name, custom_greeting, context, conversation_url } = req.body;

  try {
    let url = conversation_url;

    // If no conversation_url provided, create one via Tavus API
    if (!url) {
      if (!tavus) return res.status(400).json({ error: "TAVUS_API_KEY not configured" });
      if (!replica_id) return res.status(400).json({ error: "replica_id or conversation_url required" });

      const conversation = await tavus.createConversation({
        replicaId: replica_id,
        personaId: persona_id,
        conversationName: conversation_name || `Zoom: ${bot.botName}`,
        customGreeting: custom_greeting,
        context,
      });
      url = conversation.conversation_url;
      console.log(`Tavus conversation created: ${conversation.conversation_id}`);
    }

    await bot.connectTavus(url);
    res.json({ status: "connected", tavus_conversation_url: url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/bot/:id/tavus — Disconnect Tavus avatar ──
app.delete("/api/bot/:id/tavus", async (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Not found" });
  await bot.disconnectTavus();
  res.json({ status: "disconnected" });
});

// ── GET /api/bot/:id/screenshot — Debug view of Zoom tab ──
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

// ── GET /api/bot/:id/tavus/screenshot — Debug view of Tavus tab ──
app.get("/api/bot/:id/tavus/screenshot", async (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Not found" });
  try {
    const img = await bot.tavusScreenshot();
    if (!img) return res.status(409).json({ error: "No Tavus session" });
    res.json({ image: `data:image/png;base64,${img}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bot/:id/error-screenshot — View last error screenshot ──
app.get("/api/bot/:id/error-screenshot", (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Not found" });
  const fs = require("fs");
  if (!bot.lastErrorScreenshot || !fs.existsSync(bot.lastErrorScreenshot)) {
    return res.status(404).json({ error: "No error screenshot" });
  }
  res.sendFile(bot.lastErrorScreenshot);
});

// ── DELETE /api/bot/:id — Leave meeting ─────
app.delete("/api/bot/:id", async (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: "Not found" });
  await bot.leave();
  bots.delete(bot.id);
  res.json({ status: "left" });
});

// ── POST /api/tavus/preview — Open a standalone Tavus conversation ──
app.post("/api/tavus/preview", async (req, res) => {
  if (!tavus) return res.status(400).json({ error: "TAVUS_API_KEY not configured" });

  const { persona_id, replica_id } = req.body;
  try {
    const conversation = await tavus.createConversation({
      personaId: persona_id,
      replicaId: replica_id,
      conversationName: "Avatar Preview",
    });
    res.json({
      conversation_id: conversation.conversation_id,
      conversation_url: conversation.conversation_url,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/health ─────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    tavus_configured: !!tavus,
    active_bots: bots.size,
    uptime: process.uptime(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Zoom bot API running on :${PORT}`));
