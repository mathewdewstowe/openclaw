require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { RecallClient } = require("./recall-client");
const { createWebSocketServer } = require("./ws-server");

const app = express();
app.use(cors());
app.use(express.json());

// Serve the agent webpage (this is what Recall.ai renders as the bot's camera)
app.use(express.static(path.join(__dirname, "../public")));

const recall = new RecallClient(
  process.env.RECALLAI_API_KEY,
  process.env.RECALLAI_REGION || "us-east-1"
);

// In-memory store for active bots
const activeBots = new Map();

// ──────────────────────────────────────────────
// POST /api/bot — Create a bot and join a Zoom meeting
// ──────────────────────────────────────────────
app.post("/api/bot", async (req, res) => {
  const { meeting_url, bot_name, zoom_email } = req.body;

  if (!meeting_url) {
    return res.status(400).json({ error: "meeting_url is required" });
  }

  try {
    const agentPageUrl =
      process.env.AGENT_PAGE_URL || `http://localhost:${process.env.PORT || 3000}/agent.html`;

    const botConfig = {
      meeting_url,
      bot_name: bot_name || "AI Assistant",
      output_media: {
        camera: {
          kind: "webpage",
          config: {
            url: agentPageUrl,
          },
        },
      },
      recording_config: {
        transcript: {
          provider: {
            meeting_captions: {},
          },
        },
      },
    };

    // Add Zoom-specific config if email provided (for email-required meetings)
    if (zoom_email) {
      botConfig.zoom = { user_email: zoom_email };
    }

    const bot = await recall.createBot(botConfig);
    activeBots.set(bot.id, {
      id: bot.id,
      meeting_url,
      bot_name: botConfig.bot_name,
      status: "joining",
      created_at: new Date().toISOString(),
    });

    console.log(`Bot created: ${bot.id} -> ${meeting_url}`);
    res.status(201).json(bot);
  } catch (err) {
    console.error("Failed to create bot:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/bot/:id — Get bot status
// ──────────────────────────────────────────────
app.get("/api/bot/:id", async (req, res) => {
  try {
    const bot = await recall.getBot(req.params.id);
    res.json(bot);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/bots — List active bots
// ──────────────────────────────────────────────
app.get("/api/bots", (_req, res) => {
  res.json(Array.from(activeBots.values()));
});

// ──────────────────────────────────────────────
// POST /api/bot/:id/output-media — Start/change output media mid-call
// ──────────────────────────────────────────────
app.post("/api/bot/:id/output-media", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "url is required" });
  }

  try {
    const result = await recall.startOutputMedia(req.params.id, url);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/bot/:id/output-media — Stop output media
// ──────────────────────────────────────────────
app.delete("/api/bot/:id/output-media", async (req, res) => {
  try {
    await recall.stopOutputMedia(req.params.id);
    res.json({ status: "stopped" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/bot/:id — Remove bot from meeting
// ──────────────────────────────────────────────
app.delete("/api/bot/:id", async (req, res) => {
  try {
    await recall.leaveCall(req.params.id);
    activeBots.delete(req.params.id);
    res.json({ status: "leaving" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/webhooks/recall — Receive Recall.ai webhook events
// ──────────────────────────────────────────────
app.post("/api/webhooks/recall", (req, res) => {
  const event = req.body;
  console.log("Recall webhook:", JSON.stringify(event, null, 2));

  const botId = event.data?.bot_id;
  if (botId && activeBots.has(botId)) {
    const record = activeBots.get(botId);
    record.status = event.event || record.status;
    record.last_event = event;
    activeBots.set(botId, record);
  }

  res.sendStatus(200);
});

// Start servers
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8080;

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Agent page: http://localhost:${PORT}/agent.html`);
});

createWebSocketServer(WS_PORT);
