/**
 * Recall.ai API client
 * Docs: https://docs.recall.ai/reference/bot_create
 */
class RecallClient {
  constructor(apiKey, region = "us-east-1") {
    if (!apiKey) throw new Error("RECALLAI_API_KEY is required");
    this.apiKey = apiKey;
    this.baseUrl = `https://${region}.recall.ai/api/v1`;
  }

  async request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const opts = {
      method,
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`Recall API ${method} ${path} failed: ${res.status} ${text}`);
      err.status = res.status;
      throw err;
    }

    if (res.status === 204) return null;
    return res.json();
  }

  // ── Bot lifecycle ──────────────────────────

  /** Create a bot and send it to a meeting */
  createBot(config) {
    return this.request("POST", "/bot/", config);
  }

  /** Get bot status and details */
  getBot(botId) {
    return this.request("GET", `/bot/${botId}/`);
  }

  /** Tell the bot to leave the call */
  leaveCall(botId) {
    return this.request("POST", `/bot/${botId}/leave_call/`);
  }

  // ── Output media ──────────────────────────

  /** Start or change output media (streams a webpage as camera/screenshare) */
  startOutputMedia(botId, url) {
    return this.request("POST", `/bot/${botId}/output_media/`, {
      camera: {
        kind: "webpage",
        config: { url },
      },
    });
  }

  /** Stop output media */
  stopOutputMedia(botId) {
    return this.request("DELETE", `/bot/${botId}/output_media/`);
  }

  /** Start screenshare */
  startScreenshare(botId, url) {
    return this.request("POST", `/bot/${botId}/output_screenshare/`, {
      kind: "webpage",
      config: { url },
    });
  }

  /** Stop screenshare */
  stopScreenshare(botId) {
    return this.request("DELETE", `/bot/${botId}/output_screenshare/`);
  }

  // ── Output video (static image) ───────────

  /** Set bot camera to a static image */
  setOutputVideo(botId, imageUrl) {
    return this.request("POST", `/bot/${botId}/output_video/`, {
      kind: "image_url",
      config: { url: imageUrl },
    });
  }

  // ── Recordings & transcripts ──────────────

  /** Get the recording for a bot */
  getRecording(botId) {
    return this.request("GET", `/bot/${botId}/recording/`);
  }

  /** Get the transcript for a bot */
  getTranscript(botId) {
    return this.request("GET", `/bot/${botId}/transcript/`);
  }
}

module.exports = { RecallClient };
