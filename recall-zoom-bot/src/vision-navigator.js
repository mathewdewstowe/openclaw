/**
 * VisionNavigator — Uses Claude's vision to navigate Zoom web client.
 *
 * Instead of brittle CSS selectors, takes screenshots and asks Claude
 * to identify what's on screen and what to click/type next.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

class VisionNavigator {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.model = options.model || "claude-sonnet-4-20250514";
    this.maxSteps = options.maxSteps || 15;
    this.debug = options.debug !== false;
  }

  /**
   * Navigate the Zoom join flow using vision.
   * @param {import('puppeteer-core').Page} page - Puppeteer page
   * @param {object} opts - { botName, password, meetingId }
   * @returns {Promise<string>} - Final status: "in_meeting" | "waiting_room" | "error"
   */
  async joinMeeting(page, opts) {
    const { botName, password, meetingId } = opts;
    const logPrefix = opts.logPrefix || "[vision]";

    for (let step = 0; step < this.maxSteps; step++) {
      // Take screenshot
      const screenshot = await page.screenshot({ encoding: "base64" });
      const pageUrl = page.url();

      if (this.debug) {
        const fs = require("fs");
        fs.writeFileSync(`/tmp/vision-step-${step}.png`, Buffer.from(screenshot, "base64"));
        console.log(`${logPrefix} Step ${step}: URL=${pageUrl}`);
      }

      // Ask Claude what to do
      const action = await this.analyzeScreen(screenshot, pageUrl, {
        botName,
        password,
        meetingId,
        step,
      });

      console.log(`${logPrefix} Step ${step}: action=${JSON.stringify(action)}`);

      // Execute the action
      if (action.status === "in_meeting") {
        console.log(`${logPrefix} Successfully joined meeting!`);
        return "in_meeting";
      }

      if (action.status === "waiting_room") {
        console.log(`${logPrefix} In waiting room`);
        return "waiting_room";
      }

      if (action.status === "error") {
        throw new Error(`Vision navigator: ${action.message || "Unknown error on screen"}`);
      }

      if (action.type === "click") {
        await this.clickAt(page, action.x, action.y, action.description);
      } else if (action.type === "type") {
        if (action.clearFirst) {
          await this.clickAt(page, action.x, action.y, `focus ${action.field}`);
          await page.keyboard.down("Control");
          await page.keyboard.press("a");
          await page.keyboard.up("Control");
        } else if (action.x && action.y) {
          await this.clickAt(page, action.x, action.y, `focus ${action.field}`);
        }
        await page.keyboard.type(action.text, { delay: 30 });
      } else if (action.type === "wait") {
        const ms = action.duration || 3000;
        console.log(`${logPrefix} Waiting ${ms}ms...`);
        await new Promise((r) => setTimeout(r, ms));
      } else if (action.type === "navigate") {
        await page.goto(action.url, { waitUntil: "networkidle2", timeout: 30000 });
      }

      // Brief pause between steps
      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error("Vision navigator: exceeded max steps without joining");
  }

  async clickAt(page, x, y, description) {
    console.log(`  -> Clicking (${x}, ${y}): ${description || ""}`);
    await page.mouse.click(x, y);
  }

  async analyzeScreen(screenshotBase64, pageUrl, context) {
    const systemPrompt = `You are a browser automation assistant helping a bot join a Zoom meeting via the Zoom web client. You analyze screenshots and return the next action to take.

The bot needs to:
1. Enter its name: "${context.botName}"
2. Enter the meeting password if required: "${context.password || "none"}"
3. Accept any consent checkboxes
4. Click the Join button
5. Handle any post-join dialogs (join audio, etc.)

The viewport is 1280x720 pixels. Return coordinates relative to this viewport.

IMPORTANT:
- If you see the meeting is loaded (video tiles, participant gallery, meeting controls at bottom), return {"status": "in_meeting"}
- If you see a waiting room message, return {"status": "waiting_room"}
- If you see an error message (meeting ended, invalid link, etc.), return {"status": "error", "message": "description"}
- If you see a "Join from Your Browser" link, click it
- If you see a CAPTCHA, return {"status": "error", "message": "CAPTCHA detected"}
- If you see a name input field, type the bot name
- If you see a password/passcode field, type the password
- If you see a Join button, click it
- If you see an "Accept cookies" or consent dialog, dismiss it
- If the page is still loading, return {"type": "wait", "duration": 3000}

Return ONLY valid JSON. No markdown, no explanation.`;

    const response = await this.callClaude(systemPrompt, [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: screenshotBase64 },
          },
          {
            type: "text",
            text: `Step ${context.step}. Current URL: ${pageUrl}\nMeeting ID: ${context.meetingId}\nWhat action should I take next? Return JSON only.`,
          },
        ],
      },
    ]);

    try {
      // Extract JSON from response
      const text = response.content[0].text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse vision response:", response.content[0]?.text);
      return { type: "wait", duration: 2000 };
    }
  }

  async callClaude(system, messages) {
    const body = {
      model: this.model,
      max_tokens: 1024,
      system,
      messages,
    };

    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error ${res.status}: ${errText}`);
    }

    return res.json();
  }
}

module.exports = { VisionNavigator };
