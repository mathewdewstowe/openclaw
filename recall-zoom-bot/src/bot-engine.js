const puppeteer = require("puppeteer-core");
const { EventEmitter } = require("events");
const path = require("path");

/**
 * ZoomBot — launches a headless Chromium, joins a Zoom meeting via web client,
 * and manages audio/video through virtual devices.
 *
 * Audio architecture:
 *   Meeting audio → PulseAudio "virtual_speaker" sink → captured via sink monitor
 *   Bot mic input ← PulseAudio "virtual_mic_source" ← your AI audio piped in
 *
 * Video architecture:
 *   Avatar page rendered in Chromium → captured as bot's camera via --use-fake-device flags
 */
class ZoomBot extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id || `bot_${Date.now()}`;
    this.meetingUrl = config.meeting_url;
    this.meetingId = config.meeting_id || this.extractMeetingId(config.meeting_url);
    this.password = config.password || this.extractPassword(config.meeting_url);
    this.botName = config.bot_name || "AI Assistant";
    this.avatarUrl = config.avatar_url || process.env.AVATAR_URL || "http://localhost:3000/agent.html";
    this.status = "idle";
    this.browser = null;
    this.page = null;
    this.createdAt = new Date().toISOString();
  }

  extractMeetingId(url) {
    const match = url.match(/\/j\/(\d+)/);
    return match ? match[1] : null;
  }

  extractPassword(url) {
    const match = url.match(/[?&]pwd=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /** Launch Chromium and join the Zoom meeting */
  async join() {
    this.setStatus("launching");

    const display = process.env.DISPLAY || ":99";
    const chromePath = process.env.CHROME_PATH || "/usr/bin/chromium-browser";

    this.browser = await puppeteer.launch({
      headless: false, // Need real headed mode for WebRTC; Xvfb provides the display
      executablePath: chromePath,
      args: [
        `--display=${display}`,

        // Virtual media devices
        "--use-fake-ui-for-media-stream",         // Auto-grant camera/mic permissions
        "--use-fake-device-for-media-stream",     // Use virtual devices

        // If you want to feed a specific file as the camera input (Y4M format):
        // `--use-file-for-fake-video-capture=${avatarVideoPath}`,

        // Audio routing through PulseAudio virtual devices
        "--alsa-output-device=virtual_speaker",

        // Browser config
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

    // Inject WebRTC hooks before page loads to capture meeting audio tracks
    await this.installAudioCapture();

    this.setStatus("joining");

    try {
      await this.navigateToZoomWebClient();
      await this.enterMeetingDetails();
      await this.clickJoin();
      await this.handlePostJoin();
      this.setStatus("in_meeting");
      this.emit("joined", { id: this.id });
    } catch (err) {
      this.setStatus("error");
      this.emit("error", { id: this.id, error: err.message });
      throw err;
    }
  }

  /** Navigate to the Zoom web client join page */
  async navigateToZoomWebClient() {
    const meetingId = this.meetingId;
    if (!meetingId) throw new Error("Could not extract meeting ID from URL");

    let webClientUrl = `https://zoom.us/wc/join/${meetingId}`;
    if (this.password) {
      webClientUrl += `?pwd=${encodeURIComponent(this.password)}`;
    }

    console.log(`[${this.id}] Navigating to ${webClientUrl}`);
    await this.page.goto(webClientUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // If redirected to /j/ page, look for "Join from Your Browser" link
    const currentUrl = this.page.url();
    if (currentUrl.includes("/j/") && !currentUrl.includes("/wc/")) {
      const browserLink = await this.page.$('a[href*="wc/join"]');
      if (browserLink) {
        await browserLink.click();
        await this.page.waitForNavigation({ waitUntil: "networkidle2" });
      }
    }
  }

  /** Fill in the bot name and password fields */
  async enterMeetingDetails() {
    // Enter display name
    const nameInput = await this.findElement([
      "#inputname",
      'input[placeholder*="name" i]',
      'input[type="text"][aria-label*="name" i]',
    ]);

    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type(this.botName, { delay: 30 });
      console.log(`[${this.id}] Entered name: ${this.botName}`);
    }

    // Enter password if there's a password field visible
    if (this.password) {
      const pwdInput = await this.findElement([
        "#inputpasscode",
        'input[type="password"]',
        'input[placeholder*="passcode" i]',
        'input[placeholder*="password" i]',
      ]);
      if (pwdInput) {
        await pwdInput.type(this.password, { delay: 30 });
        console.log(`[${this.id}] Entered password`);
      }
    }

    // Accept terms checkbox if present
    const consent = await this.page.$("#wc_agree1");
    if (consent) await consent.click();
  }

  /** Click the join button */
  async clickJoin() {
    const joinBtn = await this.findElement([
      "#joinBtn",
      "button.btn-join",
      'button[class*="join"]',
      'input[type="button"][value="Join"]',
    ]);

    if (joinBtn) {
      await joinBtn.click();
      console.log(`[${this.id}] Clicked Join`);
    } else {
      throw new Error("Could not find Join button");
    }
  }

  /** Handle post-join states: waiting room, audio dialog, etc. */
  async handlePostJoin() {
    // Wait for either meeting container or waiting room (up to 60s)
    console.log(`[${this.id}] Waiting for meeting to load...`);

    await this.page.waitForFunction(
      () => {
        const meetingEl = document.querySelector(
          '#wc-container-left, #meeting-sdk-container, .meeting-app, [class*="meeting-client"]'
        );
        const waitingEl = document.querySelector(
          '[class*="waiting-room"], [class*="WaitingRoom"]'
        );
        return meetingEl || waitingEl;
      },
      { timeout: 60000 }
    );

    // Check for waiting room
    const inWaitingRoom = await this.page.$('[class*="waiting-room"], [class*="WaitingRoom"]');
    if (inWaitingRoom) {
      this.setStatus("waiting_room");
      this.emit("waiting_room", { id: this.id });
      console.log(`[${this.id}] In waiting room, waiting for host to admit...`);

      await this.page.waitForFunction(
        () => !document.querySelector('[class*="waiting-room"], [class*="WaitingRoom"]'),
        { timeout: 300000 } // 5 min max
      );
    }

    // Handle "Join Audio by Computer" dialog
    await this.page.waitForTimeout(2000);
    const audioBtn = await this.findElement([
      "button.join-audio-by-voip",
      'button[class*="join-audio-by-voip"]',
      'button[aria-label*="join audio" i]',
      ".join-dialog button.btn-primary",
    ]);
    if (audioBtn) {
      await audioBtn.click();
      console.log(`[${this.id}] Joined audio by computer`);
    }

    console.log(`[${this.id}] Successfully in meeting`);
  }

  /**
   * Install WebRTC hooks to intercept meeting audio.
   * Emits 'audio' events with raw PCM data.
   */
  async installAudioCapture() {
    await this.page.evaluateOnNewDocument(() => {
      // Hook RTCPeerConnection to capture remote audio tracks
      const OrigRTC = window.RTCPeerConnection;
      window.RTCPeerConnection = function (...args) {
        const pc = new OrigRTC(...args);

        pc.addEventListener("track", (event) => {
          if (event.track.kind === "audio") {
            window.__remoteAudioTrack = event.track;
            window.__remoteStream = event.streams[0];
            window.dispatchEvent(new CustomEvent("zoom-audio-ready"));
          }
        });

        return pc;
      };
      window.RTCPeerConnection.prototype = OrigRTC.prototype;
      Object.assign(window.RTCPeerConnection, OrigRTC);
    });
  }

  /**
   * Start capturing meeting audio and emitting it as PCM buffers.
   * Call this after the bot has joined the meeting.
   */
  async startAudioCapture(sampleRate = 16000) {
    await this.page.evaluate((sr) => {
      function captureAudio() {
        const stream = window.__remoteStream;
        if (!stream) {
          console.warn("No remote audio stream yet");
          return;
        }

        const ctx = new AudioContext({ sampleRate: sr });
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          const float32 = e.inputBuffer.getChannelData(0);
          // Convert to Int16 PCM
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          // Post to Node.js via console (Puppeteer captures this)
          window.__lastAudioChunk = int16.buffer;
        };

        source.connect(processor);
        processor.connect(ctx.destination);
      }

      if (window.__remoteStream) {
        captureAudio();
      } else {
        window.addEventListener("zoom-audio-ready", captureAudio, { once: true });
      }
    }, sampleRate);

    console.log(`[${this.id}] Audio capture started at ${sampleRate}Hz`);
  }

  /** Leave the meeting and close the browser */
  async leave() {
    this.setStatus("leaving");
    try {
      // Try clicking the Leave button in Zoom
      const leaveBtn = await this.findElement([
        'button[aria-label*="leave" i]',
        'button[class*="leave"]',
        ".footer__leave-btn",
      ]);
      if (leaveBtn) await leaveBtn.click();

      // Confirm leave if prompted
      await this.page.waitForTimeout(1000);
      const confirmBtn = await this.findElement([
        'button[class*="leave-meeting-btn"]',
        'button:not([disabled])[class*="confirm"]',
      ]);
      if (confirmBtn) await confirmBtn.click();
    } catch {
      // If clicking fails, just close the browser
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

  /** Helper: try multiple selectors and return the first match */
  async findElement(selectors) {
    for (const sel of selectors) {
      try {
        const el = await this.page.$(sel);
        if (el) return el;
      } catch {
        continue;
      }
    }
    return null;
  }

  setStatus(status) {
    this.status = status;
    this.emit("status", { id: this.id, status });
  }

  toJSON() {
    return {
      id: this.id,
      meeting_url: this.meetingUrl,
      bot_name: this.botName,
      status: this.status,
      created_at: this.createdAt,
    };
  }
}

module.exports = { ZoomBot };
