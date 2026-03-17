# How to Add an Anam AI Avatar to a Zoom Meeting

**Target keywords:** Anam AI Zoom, avatar bot Zoom meeting, Anam.ai integration
**Publish on:** sonesse.ai/blog/anam-ai-zoom-integration
**Word count:** ~1,050

---

## Introduction

Anam.ai builds some of the most compelling real-time AI avatars available right now — photorealistic faces, natural lip sync, low-latency responses, and a conversational AI layer that feels genuinely human. If you're building AI-powered sales demos, virtual assistants, or interactive training sessions, Anam is worth serious attention.

The problem? Anam's avatar runs in a browser or an embedded iframe. Zoom has its own meeting infrastructure. Getting your Anam avatar to actually *join a Zoom meeting as a participant* — with a camera feed, microphone, and the ability to interact live with real attendees — requires bridging two very different systems.

This tutorial walks you through deploying an Anam AI avatar into a Zoom meeting using the Sonesse API.

**What you'll build:** A Zoom meeting participant that shows your Anam avatar — a photorealistic, speaking AI face — visible to all attendees, responding in real time via Anam's conversational AI.

---

## The Problem: Anam Lives in a Browser, Zoom Lives in the Clouds

Anam's SDK is designed for browser-based experiences:

```javascript
const client = await createClient("YOUR_ANAM_API_KEY");
await client.startSession();
```

Within a web app, this is elegant. You get a WebRTC stream with an AI face, audio in, audio and video out. But Zoom meetings don't work like a web page you can just embed things into.

To get an Anam avatar appearing in a Zoom call, you'd need to:

1. Provision a headless browser (Chromium/Puppeteer) that loads the Anam session
2. Register a Zoom SDK app and obtain meeting credentials
3. Use the Zoom Video SDK to join the meeting programmatically
4. Capture the avatar video track and inject it as the bot's camera feed
5. Pipe meeting audio into Anam's mic input
6. Handle reconnects, network degradation, and Zoom's session lifecycle

That's a non-trivial infrastructure challenge — and you haven't yet thought about running multiple avatar sessions concurrently, or switching between Zoom, Teams, and Google Meet.

---

## The Solution: Sonesse Bridges Anam to Zoom

Sonesse handles the headless browser orchestration, Zoom SDK integration, audio/video bridging, and bot lifecycle management. You provide the Anam persona configuration and the Zoom meeting URL. Sonesse does the rest.

---

## Step 1: Create Your Anam Persona

First, set up your AI persona in the Anam dashboard or via the API. You can configure the avatar's appearance, voice, and conversation behaviour:

```bash
curl -X POST https://api.anam.ai/v1/personas \
  -H "Authorization: Bearer YOUR_ANAM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sophie",
    "persona_name": "Sophie",
    "system_prompt": "You are Sophie, a product specialist for Acme Corp. You join sales calls to answer technical questions and demo product features. Be warm, professional, and concise.",
    "brain_type": "GPT4_TURBO",
    "avatar_id": "leo_desk_v2"
  }'
```

Note your `persona_id` from the response. You can preview the persona in the Anam playground before deploying.

---

## Step 2: Get the Zoom Meeting Join URL

You need the Zoom join URL for the target meeting — the `https://zoom.us/j/...` link from the calendar invite. Or generate it on demand via the Zoom API:

```bash
curl -X POST https://api.zoom.us/v2/users/me/meetings \
  -H "Authorization: Bearer YOUR_ZOOM_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Product Demo with Sophie",
    "type": 2,
    "start_time": "2026-03-17T14:00:00Z",
    "duration": 60,
    "settings": {
      "join_before_host": true,
      "participant_video": true
    }
  }'
```

The response includes `join_url` — that's what you'll pass to Sonesse.

---

## Step 3: Deploy the Anam Avatar into Zoom via Sonesse

One API call to bring Sophie into the meeting:

```bash
curl -X POST https://api.sonesse.ai/v1/deploy \
  -H "Authorization: Bearer YOUR_SONESSE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "zoom",
    "meeting_url": "https://zoom.us/j/YOUR_MEETING_ID?pwd=YOUR_PASSWORD",
    "source": {
      "type": "anam",
      "persona_id": "YOUR_ANAM_PERSONA_ID",
      "api_key": "YOUR_ANAM_API_KEY"
    },
    "bot_name": "Sophie (AI Product Specialist)",
    "auto_leave": true
  }'
```

Sonesse will:
- Spin up a bot participant and join the Zoom meeting with camera and mic enabled
- Start an Anam avatar session in a headless browser environment
- Bridge the avatar's video output as the bot's camera stream (other participants see Sophie's face)
- Bridge meeting audio into Anam's conversational input in real time
- Handle turn-taking, lip sync timing, and audio/video sync automatically
- Leave cleanly when the meeting ends

From the attendees' perspective, Sophie joins as a named participant with a camera on — a photorealistic face they can talk to directly.

---

## Step 4: Inject Context Before the Meeting Starts

For sales and support workflows, you often want to prime the avatar with context about the meeting — who's attending, what product tier they're on, any CRM notes. Use the `context` field:

```bash
curl -X POST https://api.sonesse.ai/v1/deploy \
  -H "Authorization: Bearer YOUR_SONESSE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "zoom",
    "meeting_url": "https://zoom.us/j/...",
    "source": {
      "type": "anam",
      "persona_id": "YOUR_ANAM_PERSONA_ID",
      "api_key": "YOUR_ANAM_API_KEY"
    },
    "bot_name": "Sophie (AI Product Specialist)",
    "context": "This is a demo for TechCorp Ltd, a 500-person SaaS company. They are evaluating the Enterprise plan. Key stakeholder: James Chen, Head of Engineering. Known interest: API-first integrations and SSO.",
    "auto_leave": true,
    "webhook_url": "https://your-app.com/webhooks/sonesse"
  }'
```

Sonesse passes this context to Anam at session start, so Sophie walks into the meeting already knowing who she's talking to.

---

## Step 5: Handle Webhook Events

Track the bot lifecycle with Sonesse webhooks:

```json
{
  "event": "bot_joined",
  "deployment_id": "dep_xyz789",
  "platform": "zoom",
  "bot_name": "Sophie (AI Product Specialist)",
  "timestamp": "2026-03-17T14:00:07Z"
}
```

```json
{
  "event": "bot_left",
  "deployment_id": "dep_xyz789",
  "duration_seconds": 2310,
  "timestamp": "2026-03-17T14:38:37Z"
}
```

Use these events to trigger CRM updates, log session data, or kick off post-call follow-up workflows.

---

## Use Cases

**AI-powered sales demos** — deploy a product-specialist avatar to handle inbound demo calls. The avatar demos the product, answers technical questions, and handles objections. Human AEs join only when it's time to close.

**Virtual onboarding sessions** — a personalised avatar guides new customers through setup and configuration live on a video call, with real-time Q&A, no scheduling required.

**24/7 support escalation** — when customers need to "talk to someone," they get an avatar that looks and sounds human, available immediately. Escalates to a human only for complex cases.

**Training simulations** — put an avatar in the "customer" seat during sales rep training. The rep practices discovery and objection handling; the avatar plays a realistic, challenging prospect.

**Financial services client meetings** — deploy a compliant AI participant that delivers scripted disclosures, records consent, and answers standard questions — fully logged for regulatory purposes.

---

## Why Not Build This Yourself?

You absolutely could — here's what you'd be signing up for:

- **Headless browser orchestration at scale.** Anam runs in WebRTC. You need a persistent, reliable browser session per meeting, with GPU acceleration for smooth video rendering.
- **Zoom Video SDK complexity.** The SDK requires a server-side participant token, handles its own WebRTC negotiation, and has quirks around camera/mic permissions in headless environments.
- **Audio/video sync.** Lip sync quality degrades immediately if your audio and video pipelines drift. Getting this right under real network conditions takes significant work.
- **Concurrency and cleanup.** What happens when 10 meetings start simultaneously? When a meeting host ends the call unexpectedly? Error handling here is genuinely hard.

Sonesse handles all of this as managed infrastructure, with the same API contract across Zoom, Teams, and Google Meet.

---

## Next Steps

- [Sign up for Sonesse API access →](https://sonesse.ai)
- [Deploy an ElevenLabs voice bot in a Microsoft Teams meeting →](/blog/elevenlabs-teams-integration)
- [How to join a Teams call as a bot — complete developer guide →](/blog/join-teams-call-as-bot)

---

*This is part of the Sonesse integration guide series. New tutorials published every weekday.*
