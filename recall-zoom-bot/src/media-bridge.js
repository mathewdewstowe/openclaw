const { spawn } = require("child_process");
const { EventEmitter } = require("events");

/**
 * MediaBridge — connects a Tavus avatar to the Zoom meeting.
 *
 * How it works:
 *   1. Opens a second Chromium tab with the Tavus conversation_url (a Daily room)
 *   2. The Daily WebRTC session connects — the Tavus replica joins as a participant
 *   3. PulseAudio routes audio bidirectionally:
 *      - Zoom tab output → virtual_speaker sink → Tavus tab mic input (via monitor)
 *      - Tavus tab output → virtual_mic sink → Zoom tab mic input (via source)
 *   4. ffmpeg captures the Tavus video from Xvfb and pipes it to v4l2loopback
 *      virtual camera, which Zoom uses as the bot's camera feed
 *
 * Both tabs run in the same Chromium / PulseAudio session. The routing is:
 *   Meeting participants speak → Zoom renders audio → virtual_speaker
 *   virtual_speaker.monitor → Tavus tab hears it → replica processes + responds
 *   Replica audio → virtual_mic → Zoom tab mic → meeting hears avatar
 *   Replica video → Xvfb display → ffmpeg → /dev/video10 → Zoom tab camera
 */
class MediaBridge extends EventEmitter {
  constructor() {
    super();
    this.tavusPage = null;
    this.conversationUrl = null;
    this.ffmpegProcess = null;
    this.status = "idle";
  }

  /**
   * Connect to a Tavus conversation.
   *
   * @param {import('puppeteer-core').Browser} browser - The bot's Chromium instance
   * @param {string} conversationUrl - Tavus conversation URL (Daily room)
   */
  async connect(browser, conversationUrl) {
    this.status = "connecting";
    this.conversationUrl = conversationUrl;

    this.tavusPage = await browser.newPage();
    await this.tavusPage.setViewport({ width: 1280, height: 720 });

    // Grant camera/mic permissions for the Daily room domain
    const context = browser.defaultBrowserContext();
    const origin = new URL(conversationUrl).origin;
    await context.overridePermissions(origin, ["camera", "microphone"]);

    // Load a minimal page that uses Daily prebuilt to join the room.
    // This gives us the replica's video and audio via WebRTC.
    const dailyEmbed = this.buildDailyPage(conversationUrl);
    await this.tavusPage.setContent(dailyEmbed, { waitUntil: "networkidle0" });

    console.log(`[MediaBridge] Loading Tavus conversation: ${conversationUrl}`);

    // Log console output from the Daily page for debugging
    this.tavusPage.on("console", (msg) => {
      console.log(`[MediaBridge/Daily] ${msg.text()}`);
    });
    this.tavusPage.on("pageerror", (err) => {
      console.error(`[MediaBridge/Daily] Page error: ${err.message}`);
    });

    // Wait for the Daily call to connect and the replica to join
    // First wait for the Daily SDK to load and join the room
    try {
      await this.tavusPage.waitForFunction(
        () => window.__dailyJoined === true,
        { timeout: 30000 }
      );
      console.log("[MediaBridge] Daily room joined, waiting for replica...");
    } catch {
      console.warn("[MediaBridge] Daily join timeout — checking page state...");
      const state = await this.tavusPage.evaluate(() => ({
        dailyLoaded: typeof window.Daily !== "undefined",
        dailyJoined: window.__dailyJoined,
        replicaReady: window.__replicaReady,
        errors: window.__dailyErrors || [],
      }));
      console.log(`[MediaBridge] Page state: ${JSON.stringify(state)}`);
    }

    // Wait for replica tracks (up to 90 seconds total — Tavus can be slow to start)
    await this.tavusPage.waitForFunction(
      () => window.__replicaReady === true,
      { timeout: 90000 }
    );

    this.status = "connected";
    this.emit("connected");
    console.log("[MediaBridge] Tavus replica connected and streaming");

    // Configure PulseAudio routing between Zoom and Tavus tabs
    await this.routeAudio();
  }

  /**
   * Build a minimal HTML page that joins the Daily room.
   * When the replica's video/audio tracks arrive, they play full-screen.
   * The page also captures mic audio (from PulseAudio virtual_speaker.monitor)
   * so the replica hears the meeting participants.
   */
  buildDailyPage(conversationUrl) {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; }
    body { background: #000; overflow: hidden; }
    video { width: 1280px; height: 720px; object-fit: cover; }
  </style>
  <script src="https://unpkg.com/@daily-co/daily-js"></script>
</head>
<body>
  <video id="replicaVideo" autoplay playsinline></video>
  <script>
    window.__replicaReady = false;
    window.__dailyJoined = false;
    window.__dailyErrors = [];

    const call = window.Daily.createCallObject({
      videoSource: false,  // We don't send video from this tab
      audioSource: true,   // Send mic audio (meeting audio via PulseAudio)
    });

    call.on("joined-meeting", () => {
      console.log("[Daily] Successfully joined meeting");
      window.__dailyJoined = true;
    });

    call.on("participant-joined", (event) => {
      console.log("[Daily] participant-joined:", event.participant.user_name || event.participant.session_id);
    });

    call.on("participant-updated", (event) => {
      if (!event.participant.local) {
        console.log("[Daily] participant-updated:", event.participant.user_name || event.participant.session_id, "tracks:", JSON.stringify(event.participant.tracks));
      }
    });

    call.on("track-started", (event) => {
      const { participant, track } = event;
      console.log("[Daily] track-started:", track.kind, "from", participant.local ? "local" : (participant.user_name || participant.session_id));
      if (participant.local) return; // Skip our own tracks

      // The first remote participant is the Tavus replica
      if (track.kind === "video") {
        const video = document.getElementById("replicaVideo");
        video.srcObject = new MediaStream([track]);
        video.play().catch(() => {});
        console.log("[Daily] Replica video track started");
      }

      if (track.kind === "audio") {
        // Play replica audio through this tab's audio output
        // PulseAudio routes this to virtual_mic → Zoom hears it
        const audio = new Audio();
        audio.srcObject = new MediaStream([track]);
        audio.play().catch(() => {});
        console.log("[Daily] Replica audio track started");
        window.__replicaReady = true;
      }
    });

    call.on("error", (err) => {
      console.error("[Daily] Error:", err);
      window.__dailyErrors.push(String(err));
    });

    call.on("left-meeting", () => {
      console.log("[Daily] Left meeting");
    });

    // Join the Tavus conversation room
    console.log("[Daily] Attempting to join:", "${conversationUrl}");
    call.join({ url: "${conversationUrl}" })
      .then(() => console.log("[Daily] Join promise resolved"))
      .catch((err) => {
        console.error("[Daily] Join failed:", err);
        window.__dailyErrors.push("join-failed: " + String(err));
      });
  </script>
</body>
</html>`;
  }

  /**
   * Configure PulseAudio to route audio between Zoom and Tavus tabs.
   *
   * The key routing:
   *   Zoom tab audio output → virtual_speaker (default sink)
   *     → virtual_speaker.monitor is the "mic" for Tavus tab
   *   Tavus tab audio output → virtual_mic
   *     → virtual_mic_source feeds Zoom tab's mic
   *
   * We use pactl to move specific sink-inputs to the correct sinks.
   */
  async routeAudio() {
    await new Promise((r) => setTimeout(r, 2000));

    try {
      // List sink-inputs to identify which belongs to which tab
      const sinkInputs = await this.exec("pactl list sink-inputs short");
      const lines = sinkInputs.split("\n").filter(Boolean);

      console.log(`[MediaBridge] Found ${lines.length} PulseAudio sink-inputs`);

      // Each Chromium tab creates a sink-input. The newer one is the Tavus tab.
      // Move the Tavus tab's output to virtual_mic so Zoom hears the avatar.
      if (lines.length >= 2) {
        // Last entry is the most recently created (Tavus tab)
        const tavusInput = lines[lines.length - 1].split("\t")[0];
        await this.exec(`pactl move-sink-input ${tavusInput} virtual_mic`);
        console.log(`[MediaBridge] Moved Tavus audio output (input #${tavusInput}) → virtual_mic`);
      }

      // The Tavus tab's audio source (getUserMedia) automatically picks up
      // the default source (virtual_mic_source → virtual_speaker.monitor)
      // if PulseAudio is configured correctly by setup.sh.

      console.log("[MediaBridge] Audio routing configured");
    } catch (err) {
      console.warn("[MediaBridge] Audio routing warning:", err.message);
      console.warn("[MediaBridge] Manual PulseAudio routing may be needed on the VM");
    }
  }

  /**
   * Capture the Tavus avatar video from Xvfb and pipe to v4l2loopback.
   * The Tavus tab renders the replica's video full-screen at 1280x720.
   * ffmpeg grabs that region of the Xvfb display and writes to /dev/video10.
   */
  startVideoCapture(display = ":99", region = { x: 0, y: 0, width: 1280, height: 720 }) {
    const videoDevice = process.env.VIDEO_DEVICE || "/dev/video10";

    this.ffmpegProcess = spawn("ffmpeg", [
      "-f", "x11grab",
      "-framerate", "25",
      "-video_size", `${region.width}x${region.height}`,
      "-i", `${display}+${region.x},${region.y}`,
      "-vf", "format=yuv420p",
      "-f", "v4l2",
      videoDevice,
    ], { stdio: ["pipe", "pipe", "pipe"] });

    this.ffmpegProcess.stderr.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Error") || msg.includes("error")) {
        console.error("[MediaBridge/ffmpeg]", msg.trim());
      }
    });

    this.ffmpegProcess.on("exit", (code) => {
      console.log(`[MediaBridge] ffmpeg exited (code ${code})`);
      this.ffmpegProcess = null;
    });

    console.log(`[MediaBridge] Video capture: Xvfb ${display} → ${videoDevice}`);
  }

  /**
   * Send a text message to the Tavus replica via Daily's echo interaction.
   * The replica will speak this text verbatim.
   * Only works if the persona's pipeline_mode is "echo".
   */
  async sendEcho(conversationId, text) {
    if (!this.tavusPage) return;
    await this.tavusPage.evaluate(
      (convId, msg) => {
        const call = window.Daily?.callObject?.();
        if (call) {
          call.sendAppMessage(
            {
              message_type: "conversation",
              event_type: "conversation.echo",
              conversation_id: convId,
              properties: { text: msg },
            },
            "*"
          );
        }
      },
      conversationId,
      text
    );
  }

  /** Screenshot of the Tavus tab (for debugging) */
  async screenshot() {
    if (!this.tavusPage) return null;
    return this.tavusPage.screenshot({ encoding: "base64" });
  }

  /** Disconnect Tavus and stop media piping */
  async disconnect() {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill("SIGTERM");
      this.ffmpegProcess = null;
    }

    if (this.tavusPage) {
      // Leave the Daily room cleanly
      await this.tavusPage.evaluate(() => {
        if (window.Daily) {
          const call = window.Daily.callObject?.();
          if (call) call.leave();
        }
      }).catch(() => {});

      await this.tavusPage.close().catch(() => {});
      this.tavusPage = null;
    }

    this.status = "disconnected";
    this.emit("disconnected");
    console.log("[MediaBridge] Disconnected");
  }

  exec(cmd) {
    return new Promise((resolve, reject) => {
      const proc = spawn("sh", ["-c", cmd]);
      let out = "";
      proc.stdout.on("data", (d) => (out += d.toString()));
      proc.stderr.on("data", (d) => (out += d.toString()));
      proc.on("close", (code) =>
        code === 0 ? resolve(out.trim()) : reject(new Error(out.trim()))
      );
    });
  }
}

module.exports = { MediaBridge };
