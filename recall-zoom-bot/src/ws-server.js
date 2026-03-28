const { WebSocketServer } = require("ws");

/**
 * WebSocket server for bidirectional audio streaming.
 *
 * Clients connect to receive meeting audio (PCM) and send AI-generated
 * audio back into the meeting via PulseAudio virtual devices.
 *
 * Protocol:
 *   Binary messages = raw audio (S16LE PCM, 16kHz, mono)
 *   Text messages   = JSON control events
 *
 * Inbound events (from AI client):
 *   { "type": "audio",  "bot_id": "..." }  → followed by binary audio chunks
 *   { "type": "subscribe", "bot_id": "...", "events": ["audio", "transcript"] }
 *
 * Outbound events (to AI client):
 *   { "type": "transcript", "speaker": "...", "text": "..." }
 *   { "type": "participant_joined", "name": "..." }
 *   { "type": "participant_left",   "name": "..." }
 *   { "type": "bot_status", "status": "..." }
 *   Binary = meeting audio chunks (S16LE PCM, 16kHz, mono)
 */
function createWebSocketServer(port) {
  const wss = new WebSocketServer({ port });

  // Track subscriptions: botId -> Set<WebSocket>
  const subscriptions = new Map();

  wss.on("listening", () => {
    console.log(`WebSocket server listening on ws://localhost:${port}`);
  });

  wss.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`WS client connected from ${clientIp}`);

    let subscribedBotId = null;

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        // Binary = audio from AI to inject into meeting
        // TODO: Write to PulseAudio virtual_mic sink via ffmpeg or pacat
        handleInboundAudio(subscribedBotId, data);
      } else {
        try {
          const msg = JSON.parse(data.toString());
          handleControlMessage(ws, msg);
          if (msg.type === "subscribe" && msg.bot_id) {
            subscribedBotId = msg.bot_id;
            if (!subscriptions.has(msg.bot_id)) {
              subscriptions.set(msg.bot_id, new Set());
            }
            subscriptions.get(msg.bot_id).add(ws);
          }
        } catch {
          console.warn("Invalid JSON message from WS client");
        }
      }
    });

    ws.on("close", () => {
      console.log(`WS client disconnected from ${clientIp}`);
      if (subscribedBotId && subscriptions.has(subscribedBotId)) {
        subscriptions.get(subscribedBotId).delete(ws);
      }
    });

    ws.on("error", (err) => {
      console.error("WS error:", err.message);
    });
  });

  /**
   * Broadcast meeting audio to all subscribers of a bot.
   * Call this from the bot engine when audio chunks arrive.
   */
  function broadcastAudio(botId, pcmBuffer) {
    const subs = subscriptions.get(botId);
    if (!subs) return;
    for (const ws of subs) {
      if (ws.readyState === ws.OPEN) {
        ws.send(pcmBuffer);
      }
    }
  }

  /**
   * Broadcast a JSON event to all subscribers of a bot.
   */
  function broadcastEvent(botId, event) {
    const subs = subscriptions.get(botId);
    if (!subs) return;
    const msg = JSON.stringify(event);
    for (const ws of subs) {
      if (ws.readyState === ws.OPEN) {
        ws.send(msg);
      }
    }
  }

  return { wss, broadcastAudio, broadcastEvent };
}

function handleInboundAudio(botId, buffer) {
  // PCM audio from AI → needs to be piped into PulseAudio virtual_mic
  // In production, use: pacat --playback --device=virtual_mic --format=s16le --rate=16000 --channels=1
  // For now, log stats
  if (Math.random() < 0.01) {
    const samples = buffer.length / 2;
    const durationMs = (samples / 16000) * 1000;
    console.log(`[Audio IN] bot=${botId} ${buffer.length}B (${durationMs.toFixed(0)}ms)`);
  }
}

function handleControlMessage(ws, msg) {
  switch (msg.type) {
    case "subscribe":
      console.log(`[WS] Client subscribed to bot ${msg.bot_id}`);
      ws.send(JSON.stringify({ type: "subscribed", bot_id: msg.bot_id }));
      break;

    case "ping":
      ws.send(JSON.stringify({ type: "pong" }));
      break;

    default:
      console.log(`[WS] Unknown message type: ${msg.type}`);
  }
}

module.exports = { createWebSocketServer };
