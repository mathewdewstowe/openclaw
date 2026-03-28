const { WebSocketServer } = require("ws");

/**
 * WebSocket server that receives real-time audio/events from Recall.ai bots.
 *
 * Configure this URL as a realtime_endpoint when creating a bot:
 *   "realtime_endpoints": [{
 *     "type": "websocket",
 *     "config": { "url": "wss://your-server.com/ws" },
 *     "events": ["audio_mixed_raw.data", "transcript.data"]
 *   }]
 *
 * Audio format: mono 16-bit signed little-endian PCM at 16kHz
 */
function createWebSocketServer(port) {
  const wss = new WebSocketServer({ port });

  wss.on("listening", () => {
    console.log(`WebSocket server listening on ws://localhost:${port}`);
  });

  wss.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`WS connection from ${clientIp}`);

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        // Binary = raw audio data (S16LE PCM, 16kHz, mono)
        handleAudioChunk(data);
      } else {
        // Text = JSON event (transcript, participant events, etc.)
        try {
          const event = JSON.parse(data.toString());
          handleEvent(event);
        } catch {
          console.warn("Non-JSON text message received");
        }
      }
    });

    ws.on("close", () => {
      console.log(`WS connection closed from ${clientIp}`);
    });

    ws.on("error", (err) => {
      console.error("WS error:", err.message);
    });
  });

  return wss;
}

function handleAudioChunk(buffer) {
  // buffer is raw S16LE PCM audio at 16kHz mono
  // Each sample = 2 bytes, so buffer.length / 2 = number of samples
  const samples = buffer.length / 2;
  const durationMs = (samples / 16000) * 1000;

  // TODO: Pipe this to your AI model (e.g., OpenAI Realtime API, Deepgram, etc.)
  // For now, just log the chunk size
  if (Math.random() < 0.01) {
    // Log ~1% of chunks to avoid flooding
    console.log(`Audio chunk: ${buffer.length} bytes (${durationMs.toFixed(0)}ms)`);
  }
}

function handleEvent(event) {
  // Handle different real-time event types from Recall.ai
  switch (event.type) {
    case "transcript.data":
      console.log(`[Transcript] ${event.data?.speaker || "Unknown"}: ${event.data?.text || ""}`);
      break;

    case "participant_events.join":
      console.log(`[Participant] Joined: ${event.data?.name || "Unknown"}`);
      break;

    case "participant_events.leave":
      console.log(`[Participant] Left: ${event.data?.name || "Unknown"}`);
      break;

    default:
      console.log(`[Event] ${event.type}:`, JSON.stringify(event.data || {}).slice(0, 200));
  }
}

module.exports = { createWebSocketServer };
