const puppeteer = require("puppeteer-core");
const { EventEmitter } = require("events");
const { MediaBridge } = require("./media-bridge");
const { VisionNavigator } = require("./vision-navigator");

/**
 * ZoomBot — Perception-first bot with Tavus avatar interaction.
 *
 * Phase 1 (Perception): Puppeteer navigates Zoom web client, joins meeting,
 *   captures audio, tracks participants.
 * Phase 2 (Interaction): Connects a Tavus avatar via MediaBridge. Tavus hears
 *   meeting audio and its avatar video/audio is piped back into Zoom.
 */
class ZoomBot extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id || `bot_${Date.now()}`;
    this.meetingUrl = config.meeting_url;
    this.meetingId = this.extractMeetingId(config.meeting_url);
    this.password = config.password || this.extractPassword(config.meeting_url);
    this.botName = config.bot_name || "Notetaker";
    this.tavusConversationUrl = config.tavus_conversation_url || null;
    this.useVision = config.use_vision !== false; // Default to vision-guided navigation
    this.status = "idle";
    this.browser = null;
    this.page = null;
    this.mediaBridge = null;
    this.participants = [];
    this.createdAt = new Date().toISOString();
    this.joinedAt = null;
  }

  extractMeetingId(url) {
    const match = url.match(/\/j\/(\d+)/);
    return match ? match[1] : null;
  }

  extractPassword(url) {
    const match = url.match(/[?&]pwd=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // ── Main join flow ────────────────────────

  async join() {
    this.setStatus("launching");

    const display = process.env.DISPLAY || ":99";
    const chromePath = process.env.CHROME_PATH || "/usr/bin/chromium-browser";

    this.browser = await puppeteer.launch({
      headless: false,
      executablePath: chromePath,
      args: [
        `--display=${display}`,
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1280,720",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=WebRtcHideLocalIpsWithMdns",
        "--autoplay-policy=no-user-gesture-required",
      ],
      env: {
        ...process.env,
        DISPLAY: display,
        PULSE_SERVER: process.env.PULSE_SERVER || "unix:/tmp/pulseaudio.socket",
      },
      ignoreDefaultArgs: ["--mute-audio"],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 720 });
    await this.page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    // Hook WebRTC before any page loads
    await this.installWebRTCHooks();

    this.setStatus("joining");

    try {
      // Navigate to the Zoom web client page first
      await this.navigateToWebClient();

      if (this.useVision && process.env.ANTHROPIC_API_KEY) {
        // Vision-guided navigation: Claude looks at the screen and decides what to do
        console.log(`[${this.id}] Using vision-guided navigation`);
        const vision = new VisionNavigator(process.env.ANTHROPIC_API_KEY);
        const result = await vision.joinMeeting(this.page, {
          botName: this.botName,
          password: this.password,
          meetingId: this.meetingId,
          logPrefix: `[${this.id}]`,
        });

        if (result === "waiting_room") {
          this.setStatus("waiting_room");
          this.emit("waiting_room", { id: this.id });
          console.log(`[${this.id}] In waiting room, waiting to be admitted...`);
          // Wait for waiting room to clear (up to 5 minutes)
          await this.page.waitForFunction(
            () => !document.querySelector('[class*="waiting-room"], [class*="WaitingRoom"]'),
            { timeout: 300000 }
          );
        }
      } else {
        // Fallback: selector-based navigation
        console.log(`[${this.id}] Using selector-based navigation`);
        await this.enterDetails();
        await this.clickJoin();
        await this.handlePostJoin();
      }

      this.joinedAt = new Date().toISOString();
      this.setStatus("in_meeting");
      this.emit("joined", { id: this.id });

      // Start capturing audio and watching participants
      await this.startAudioCapture();
      this.startParticipantWatch();

      // If Tavus conversation URL was provided, connect the avatar
      if (this.tavusConversationUrl) {
        await this.connectTavus(this.tavusConversationUrl);
      }
    } catch (err) {
      // Take a debug screenshot before reporting error
      if (this.page) {
        try {
          const fs = require("fs");
          const ts = Date.now();
          const path = `/tmp/bot-error-${this.id}-${ts}.png`;
          await this.page.screenshot({ path });
          console.log(`[${this.id}] Error screenshot saved: ${path}`);
          this.lastErrorScreenshot = path;
        } catch {}
      }
      this.setStatus("error");
      this.emit("error", { id: this.id, error: err.message });
      throw err;
    }
  }

  // ── Tavus integration ─────────────────────

  /**
   * Connect a Tavus avatar to the meeting.
   * Opens the Tavus conversation URL in a second browser tab.
   * MediaBridge handles audio/video routing between Zoom ↔ Tavus.
   */
  async connectTavus(conversationUrl) {
    if (!this.browser) throw new Error("Browser not running — join a meeting first");

    this.tavusConversationUrl = conversationUrl;
    this.mediaBridge = new MediaBridge();

    this.mediaBridge.on("connected", () => {
      this.emit("tavus_connected", { id: this.id });
      console.log(`[${this.id}] Tavus avatar connected`);
    });

    this.mediaBridge.on("disconnected", () => {
      this.emit("tavus_disconnected", { id: this.id });
    });

    await this.mediaBridge.connect(this.browser, conversationUrl);

    // Start piping Tavus video to virtual camera
    const display = process.env.DISPLAY || ":99";
    this.mediaBridge.startVideoCapture(display);
  }

  /** Disconnect Tavus avatar (bot stays in meeting) */
  async disconnectTavus() {
    if (this.mediaBridge) {
      await this.mediaBridge.disconnect();
      this.mediaBridge = null;
    }
  }

  /** Get a screenshot of the Tavus tab */
  async tavusScreenshot() {
    if (!this.mediaBridge) return null;
    return this.mediaBridge.screenshot();
  }

  // ── Navigation ────────────────────────────

  async navigateToWebClient() {
    if (!this.meetingId) throw new Error("Could not extract meeting ID from URL");

    let url = `https://zoom.us/wc/join/${this.meetingId}`;
    if (this.password) url += `?pwd=${encodeURIComponent(this.password)}`;

    console.log(`[${this.id}] Navigating to ${url}`);
    await this.page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    console.log(`[${this.id}] Page URL after load: ${this.page.url()}`);
    console.log(`[${this.id}] Page title: ${await this.page.title()}`);

    // Handle redirect to /j/ page — click "Join from Your Browser"
    if (this.page.url().includes("/j/") && !this.page.url().includes("/wc/")) {
      console.log(`[${this.id}] Redirected to launch page, looking for browser join link...`);

      // Try multiple selectors for "Join from Your Browser" link
      const browserJoinLink = await this.findEl([
        'a[href*="wc/join"]',
        'a[href*="/wc/"]',
        '#join_from_browser',
        'a:has-text("Join from Your Browser")',
        'a:has-text("join from your browser")',
      ]);

      if (browserJoinLink) {
        console.log(`[${this.id}] Found browser join link, clicking...`);
        await browserJoinLink.click();
        await this.page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
      } else {
        // Fallback: manually construct the /wc/ URL and navigate directly
        console.log(`[${this.id}] No browser join link found, navigating directly to /wc/ URL`);
        await this.page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      }

      console.log(`[${this.id}] Page URL after browser join: ${this.page.url()}`);
    }

    // Handle CAPTCHA or "are you human" checks
    const pageContent = await this.page.content();
    if (pageContent.includes("recaptcha") || pageContent.includes("captcha")) {
      console.log(`[${this.id}] WARNING: CAPTCHA detected on page`);
    }

    // Log what we see on the page for debugging
    const bodyText = await this.page.evaluate(() => document.body?.innerText?.substring(0, 500) || "");
    console.log(`[${this.id}] Page text preview: ${bodyText.substring(0, 200)}`);
  }

  async enterDetails() {
    const nameInput = await this.findEl([
      "#inputname",
      'input[placeholder*="name" i]',
      'input[type="text"][aria-label*="name" i]',
    ]);
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type(this.botName, { delay: 30 });
      console.log(`[${this.id}] Name: ${this.botName}`);
    }

    if (this.password) {
      const pwdInput = await this.findEl([
        "#inputpasscode",
        'input[type="password"]',
        'input[placeholder*="passcode" i]',
        'input[placeholder*="password" i]',
      ]);
      if (pwdInput) {
        await pwdInput.type(this.password, { delay: 30 });
      }
    }

    const consent = await this.page.$("#wc_agree1");
    if (consent) await consent.click();
  }

  async clickJoin() {
    const btn = await this.findEl([
      "#joinBtn",
      "button.btn-join",
      'button[class*="join"]',
      'input[type="button"][value="Join"]',
    ]);
    if (!btn) throw new Error("Could not find Join button");
    await btn.click();
    console.log(`[${this.id}] Clicked Join`);
  }

  async handlePostJoin() {
    console.log(`[${this.id}] Waiting for meeting to load...`);
    console.log(`[${this.id}] Current URL: ${this.page.url()}`);

    // Take a screenshot right after clicking join for debugging
    try {
      const ts = Date.now();
      const path = `/tmp/bot-post-join-${this.id}-${ts}.png`;
      await this.page.screenshot({ path });
      console.log(`[${this.id}] Post-join screenshot saved: ${path}`);
      this.lastErrorScreenshot = path;
    } catch {}

    await this.page.waitForFunction(
      () => {
        return document.querySelector(
          '#wc-container-left, #meeting-sdk-container, .meeting-app, [class*="meeting-client"], #webclient'
        ) || document.querySelector('[class*="waiting-room"], [class*="WaitingRoom"]');
      },
      { timeout: 60000 }
    );

    // Handle waiting room
    const inWaitingRoom = await this.page.$('[class*="waiting-room"], [class*="WaitingRoom"]');
    if (inWaitingRoom) {
      this.setStatus("waiting_room");
      this.emit("waiting_room", { id: this.id });
      console.log(`[${this.id}] In waiting room...`);
      await this.page.waitForFunction(
        () => !document.querySelector('[class*="waiting-room"], [class*="WaitingRoom"]'),
        { timeout: 300000 }
      );
    }

    // Join audio
    await this.page.waitForTimeout(2000);
    const audioBtn = await this.findEl([
      "button.join-audio-by-voip",
      'button[class*="join-audio-by-voip"]',
      'button[aria-label*="join audio" i]',
      ".join-dialog button.btn-primary",
    ]);
    if (audioBtn) {
      await audioBtn.click();
      console.log(`[${this.id}] Joined audio`);
    }

    console.log(`[${this.id}] In meeting`);
  }

  // ── Audio capture ─────────────────────────

  async installWebRTCHooks() {
    await this.page.evaluateOnNewDocument(() => {
      const OrigRTC = window.RTCPeerConnection;
      window.RTCPeerConnection = function (...args) {
        const pc = new OrigRTC(...args);
        pc.addEventListener("track", (event) => {
          if (event.track.kind === "audio") {
            window.__remoteAudioTrack = event.track;
            window.__remoteStream = event.streams[0];
            window.dispatchEvent(new CustomEvent("__audio_ready"));
          }
        });
        return pc;
      };
      window.RTCPeerConnection.prototype = OrigRTC.prototype;
      Object.assign(window.RTCPeerConnection, OrigRTC);
    });
  }

  async startAudioCapture() {
    // Set up in-browser audio processing → exposes chunks via CDP
    await this.page.evaluate(() => {
      function capture() {
        const stream = window.__remoteStream;
        if (!stream) return;

        const ctx = new AudioContext({ sampleRate: 16000 });
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          const f32 = e.inputBuffer.getChannelData(0);
          const i16 = new Int16Array(f32.length);
          for (let i = 0; i < f32.length; i++) {
            const s = Math.max(-1, Math.min(1, f32[i]));
            i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          // Store latest chunk for polling from Node side
          window.__audioChunk = Array.from(i16);
          window.__audioReady = true;
        };

        source.connect(processor);
        processor.connect(ctx.destination);
        window.__audioCapturing = true;
      }

      if (window.__remoteStream) capture();
      else window.addEventListener("__audio_ready", capture, { once: true });
    });

    // Poll for audio chunks from the page and emit them
    this._audioInterval = setInterval(async () => {
      if (!this.page || this.status !== "in_meeting") return;
      try {
        const chunk = await this.page.evaluate(() => {
          if (!window.__audioReady) return null;
          window.__audioReady = false;
          return window.__audioChunk;
        });
        if (chunk) {
          const buffer = Buffer.from(new Int16Array(chunk).buffer);
          this.emit("audio", { id: this.id, pcm: buffer });
        }
      } catch {
        // Page may have closed
      }
    }, 250);

    console.log(`[${this.id}] Audio capture started (16kHz S16LE PCM)`);
  }

  // ── Participant tracking ──────────────────

  startParticipantWatch() {
    this._participantInterval = setInterval(async () => {
      if (!this.page || this.status !== "in_meeting") return;
      try {
        const names = await this.page.evaluate(() => {
          // Zoom web client renders participant names in various containers
          const selectors = [
            '[class*="participant-item"] [class*="name"]',
            '[class*="participants-list"] [class*="name"]',
            '.participants-ul li .participant-name',
          ];
          for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            if (els.length) return Array.from(els).map(el => el.textContent.trim());
          }
          return [];
        });

        const prev = new Set(this.participants);
        const curr = new Set(names);

        for (const name of curr) {
          if (!prev.has(name)) {
            this.emit("participant_joined", { id: this.id, name });
            console.log(`[${this.id}] Participant joined: ${name}`);
          }
        }
        for (const name of prev) {
          if (!curr.has(name)) {
            this.emit("participant_left", { id: this.id, name });
            console.log(`[${this.id}] Participant left: ${name}`);
          }
        }

        this.participants = names;
      } catch {
        // Page may have closed
      }
    }, 5000);
  }

  // ── Leave ─────────────────────────────────

  async leave() {
    this.setStatus("leaving");

    clearInterval(this._audioInterval);
    clearInterval(this._participantInterval);

    // Disconnect Tavus first
    if (this.mediaBridge) {
      await this.mediaBridge.disconnect().catch(() => {});
      this.mediaBridge = null;
    }

    try {
      const leaveBtn = await this.findEl([
        'button[aria-label*="leave" i]',
        'button[class*="leave"]',
        ".footer__leave-btn",
      ]);
      if (leaveBtn) {
        await leaveBtn.click();
        await this.page.waitForTimeout(1000);
        const confirm = await this.findEl([
          'button[class*="leave-meeting"]',
          'button[class*="confirm"]',
        ]);
        if (confirm) await confirm.click();
      }
    } catch {
      // Just close the browser
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }

    this.setStatus("left");
    this.emit("left", { id: this.id });
    console.log(`[${this.id}] Left meeting`);
  }

  // ── Screenshot (for debugging) ────────────

  async screenshot() {
    if (!this.page) return null;
    return this.page.screenshot({ encoding: "base64" });
  }

  // ── Helpers ───────────────────────────────

  async findEl(selectors) {
    for (const sel of selectors) {
      try {
        const el = await this.page.$(sel);
        if (el) return el;
      } catch { continue; }
    }
    return null;
  }

  setStatus(s) {
    this.status = s;
    this.emit("status", { id: this.id, status: s });
  }

  toJSON() {
    return {
      id: this.id,
      meeting_url: this.meetingUrl,
      bot_name: this.botName,
      status: this.status,
      tavus_connected: this.mediaBridge?.status === "connected",
      tavus_conversation_url: this.tavusConversationUrl,
      participants: this.participants,
      created_at: this.createdAt,
      joined_at: this.joinedAt,
    };
  }
}

module.exports = { ZoomBot };
