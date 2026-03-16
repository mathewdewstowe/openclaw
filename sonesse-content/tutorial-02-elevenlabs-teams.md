# How to Deploy an ElevenLabs Voice Bot in a Microsoft Teams Meeting

**Target keywords:** ElevenLabs Teams integration, voice bot Teams, ElevenLabs Microsoft Teams
**Publish on:** sonesse.ai/blog/elevenlabs-teams-integration
**Word count:** ~1,050

---

## Introduction

ElevenLabs makes genuinely impressive conversational AI — low-latency voice, realistic prosody, and a full agent framework that handles interruptions, memory, and tool use. But there's a catch: ElevenLabs agents live behind a WebSocket. Microsoft Teams uses its own proprietary audio stack. Getting your ElevenLabs voice bot to actually *show up in a Teams meeting* — as a named participant, speaking and listening in real time — takes more than a few lines of glue code.

This tutorial walks you through exactly how to do it using the Sonesse API.

**What you'll build:** A Teams meeting participant that's backed by an ElevenLabs conversational AI agent — joins a call, listens to attendees, and responds in real time with a realistic AI voice.

---

## The Problem: ElevenLabs Speaks WebSocket, Teams Speaks... Teams

ElevenLabs Conversational AI exposes a WebSocket endpoint:

```bash
wss://api.elevenlabs.io/v1/convai/conversation?agent_id=YOUR_AGENT_ID
```

You connect, stream audio in, get audio back. In a browser or a custom phone app, this is straightforward. In a Teams meeting, it's not — because Teams doesn't let arbitrary WebSocket clients join as participants.

To get audio in and out of a Teams call, you need to:

1. Register a bot application in Azure Active Directory
2. Implement the Microsoft Bot Framework
3. Join the meeting via the Microsoft Graph Communications API
4. Handle real-time media via the Teams Calling SDK (a C++ library — fun times)
5. Route audio bidirectionally between Teams and ElevenLabs

That's 4–8 weeks of engineering for a developer who already knows both APIs well. And you haven't started on error recovery, reconnections, or multi-meeting concurrency yet.

---

## The Solution: Sonesse Bridges ElevenLabs to Teams

Sonesse sits between your ElevenLabs agent and the Teams meeting. You provide the ElevenLabs agent ID and the Teams meeting URL. Sonesse handles authentication, media bridging, bot lifecycle, and cleanup — in a single API call.

---

## Step 1: Create Your ElevenLabs Conversational Agent

If you haven't already, create an agent in the ElevenLabs dashboard or via the API:

```bash
curl -X POST https://api.elevenlabs.io/v1/convai/agents/create \
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Assistant",
    "conversation_config": {
      "agent": {
        "prompt": {
          "prompt": "You are a helpful sales assistant joining a product demo call. Be concise and friendly."
        },
        "first_message": "Hi everyone — I'\''m here to help answer any questions about the product.",
        "language": "en"
      },
      "tts": {
        "voice_id": "EXAVITQu4vr4xnSDxMaL"
      }
    }
  }'
```

Note your `agent_id` from the response.

---

## Step 2: Get the Teams Meeting Join URL

You need the Teams meeting join link — the `https://teams.microsoft.com/l/meetup-join/...` URL from the calendar invite. You can also generate this programmatically via the Microsoft Graph API if you're building a fully automated workflow:

```bash
curl -X POST https://graph.microsoft.com/v1.0/me/onlineMeetings \
  -H "Authorization: Bearer YOUR_GRAPH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDateTime": "2026-03-16T10:00:00Z",
    "endDateTime": "2026-03-16T11:00:00Z",
    "subject": "Product Demo"
  }'
```

The response includes a `joinWebUrl` — that's your meeting URL.

---

## Step 3: Deploy the ElevenLabs Agent into Teams via Sonesse

One API call:

```bash
curl -X POST https://api.sonesse.ai/v1/deploy \
  -H "Authorization: Bearer YOUR_SONESSE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "teams",
    "meeting_url": "https://teams.microsoft.com/l/meetup-join/...",
    "source": {
      "type": "elevenlabs",
      "agent_id": "YOUR_ELEVENLABS_AGENT_ID",
      "api_key": "YOUR_ELEVENLABS_API_KEY"
    },
    "bot_name": "AI Sales Assistant",
    "auto_leave": true
  }'
```

Sonesse will:
- Spin up a bot participant and join the Teams meeting
- Open the ElevenLabs WebSocket connection
- Bridge real-time audio bidirectionally between Teams and ElevenLabs
- Handle turn-taking, interruptions, and reconnection automatically
- Leave the meeting cleanly when it ends (or on demand)

The bot shows up in the Teams participant list like any other attendee — with the `bot_name` you specify.

---

## Step 4: Listen for Webhooks (Optional but Useful)

Sonesse can push lifecycle events to your backend so you can react in real time:

```json
{
  "event": "bot_joined",
  "deployment_id": "dep_abc123",
  "platform": "teams",
  "timestamp": "2026-03-16T10:01:42Z"
}
```

```json
{
  "event": "bot_left",
  "deployment_id": "dep_abc123",
  "duration_seconds": 1847,
  "timestamp": "2026-03-16T10:32:29Z"
}
```

Useful for logging, CRM updates, triggering follow-up workflows, or handing off to a human agent mid-call.

```bash
curl -X POST https://api.sonesse.ai/v1/deploy \
  -H "Authorization: Bearer YOUR_SONESSE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "teams",
    "meeting_url": "...",
    "source": { ... },
    "bot_name": "AI Sales Assistant",
    "webhook_url": "https://your-app.com/webhooks/sonesse",
    "auto_leave": true
  }'
```

---

## Use Cases

**AI sales rep on demo calls** — deploy an ElevenLabs agent to join Zoom or Teams demos, handle FAQs, and qualify leads in real time. Human closes; the bot handles everything before.

**Customer support escalation buffer** — bot joins the call while a human agent is connecting, keeps the customer engaged, gathers context.

**Training and role-play** — deploy simulated customer personas into internal training calls. Junior reps practice objection handling with an AI playing the difficult prospect.

**Meeting assistant** — an always-available voice bot attendees can address directly for live Q&A, definitions, or action item capture — without a human moderator.

**Compliance narration** — regulated industries (finance, healthcare) use voice bots to deliver required disclosures at the start of every client call, with full audit logging via Sonesse.

---

## Why Not Just Build It Yourself?

Short answer: you could. Long answer:

- The Teams Calling API requires a C++ native media library (`Microsoft.Skype.Bots.Media`) that doesn't play nicely with Python or Node.js environments
- Azure AD app registration + Teams meeting permissions have a ~2 week approval cycle for production
- ElevenLabs audio format (PCM 16kHz) ≠ Teams audio format (SILK/Opus) — you'll build a transcoder
- Reconnection logic for dropped calls adds another week

Sonesse handles all of this at the infrastructure level, with SLAs, and lets you switch platforms — same call, change `"teams"` to `"zoom"` or `"meet"` — without rewriting anything.

---

## Next Steps

- [Sign up for Sonesse API access →](https://sonesse.ai)
- [Deploy a Tavus AI avatar in Teams →](/blog/tavus-microsoft-teams-integration)
- [Add an Anam AI avatar to a Zoom meeting →](/blog/anam-ai-zoom-integration)

---

*This is part of the Sonesse integration guide series. New tutorials published every weekday.*
