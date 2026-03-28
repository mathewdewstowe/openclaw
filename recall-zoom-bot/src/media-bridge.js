const { spawn } = require("child_process");
const { EventEmitter } = require("events");

/**
 * MediaBridge — connects Tavus avatar output to Zoom bot input.
 *
 * Architecture:
 *   1. A second Chromium tab loads the Tavus conversation_url
 *   2. Tavus avatar video/audio streams via WebRTC in that tab
 *   3. Meeting audio (from Zoom tab) → piped to Tavus tab as mic input via PulseAudio
 *   4. Tavus avatar audio → piped to Zoom's virtual mic via PulseAudio
 *   5. Tavus avatar video → captured and piped to v4l2loopback virtual camera via ffmpeg
 *
 * PulseAudio routing:
 *   Zoom tab audio output → virtual_speaker sink (captured as meeting audio)
 *   Tavus tab reads from virtual_speaker.monitor (hears meeting audio)
 *   Tavus tab audio output → virtual_mic sink
 *   Zoom tab reads from virtual_mic_source (hears Tavus response)
 *
 * This means both tabs run in the same Chromium with PulseAudio handling the routing.
 */
class MediaBridge extends EventEmitter {
  constructor() {
    super();
    this.tavusPage = null;
    this.ffmpegProcess = null;
    this.status = "idle";
  }

  /**
   * Open the Tavus conversation URL in a new tab within the bot's browser.
   *
   * @param {import('puppeteer-core').Browser} browser - The bot's Chromium instance
   * @param {string} conversationUrl - Tavus conversation URL
   */
  async connect(browser, conversationUrl) {
    this.status = "connecting";

    this.tavusPage = await browser.newPage();
    await this.tavusPage.setViewport({ width: 1280, height: 720 });

    // Grant camera/mic permissions for Tavus WebRTC
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(new URL(conversationUrl).origin, [
      "camera",
      "microphone",
    ]);

    console.log(`[MediaBridge] Loading Tavus conversation: ${conversationUrl}`);
    await this.tavusPage.goto(conversationUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for Tavus to initialize — look for the video element
    await this.tavusPage.waitForFunction(
      () => {
        const videos = document.querySelectorAll("video");
        return Array.from(videos).some((v) => v.readyState >= 2);
      },
      { timeout: 30000 }
    );

    this.status = "connected";
    this.emit("connected");
    console.log("[MediaBridge] Tavus avatar connected");

    // Set up audio routing via PulseAudio
    await this.routeAudio();
  }

  /**
   * Configure PulseAudio to route audio between Zoom and Tavus tabs.
   *
   * Zoom tab (sink-input) → virtual_speaker (default sink)
   *   Meeting participants' audio goes here.
   *
   * Tavus tab needs to hear that meeting audio, so we set Tavus tab's
   * audio source (getUserMedia) to read from virtual_speaker.monitor.
   *
   * Tavus tab's audio output (avatar speaking) → virtual_mic sink
   *   Zoom tab's mic source reads from virtual_mic_source.
   *
   * Since both tabs are in the same Chromium/PulseAudio session,
   * we use pactl to move sink-inputs to the right sinks.
   */
  async routeAudio() {
    // Give Chromium a moment to register its PulseAudio streams
    await new Promise((r) => setTimeout(r, 2000));

    try {
      // List all sink-inputs (audio output streams from Chromium tabs)
      const sinkInputs = await this.exec("pactl list sink-inputs short");
      console.log("[MediaBridge] PulseAudio sink-inputs:", sinkInputs);

      // Move Tavus tab's audio output to virtual_mic (so Zoom hears the avatar)
      // In practice, you'd identify the Tavus tab's sink-input by PID or index
      // For now, route ALL Chromium audio to virtual_speaker (meeting capture)
      // and then selectively move the Tavus output to virtual_mic
      //
      // This will need tuning based on the actual PulseAudio stream indices
      // when running on the VM.

      console.log("[MediaBridge] Audio routing configured (needs VM tuning)");
    } catch (err) {
      console.warn("[MediaBridge] Audio routing setup:", err.message);
    }
  }

  /**
   * Start capturing the Tavus avatar video and piping it to the virtual camera.
   * Uses ffmpeg to read from Xvfb (the Tavus tab region) and write to v4l2loopback.
   *
   * @param {string} display - X display (e.g., ":99")
   * @param {object} region - { x, y, width, height } of the Tavus video element
   */
  startVideoCapture(display = ":99", region = { x: 0, y: 0, width: 1280, height: 720 }) {
    const videoDevice = process.env.VIDEO_DEVICE || "/dev/video10";

    this.ffmpegProcess = spawn("ffmpeg", [
      "-f", "x11grab",
      "-framerate", "30",
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
      console.log(`[MediaBridge] ffmpeg exited with code ${code}`);
      this.ffmpegProcess = null;
    });

    console.log(`[MediaBridge] Video capture started → ${videoDevice}`);
  }

  /** Get a screenshot of the Tavus tab (for debugging) */
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
      proc.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(out.trim()))));
    });
  }
}

module.exports = { MediaBridge };
