# How to Deploy a Tavus AI Avatar Inside a Microsoft Teams Meeting

**Target keywords:** Tavus Teams integration, Tavus Microsoft Teams, AI avatar Teams meeting, deploy Tavus in Teams
**Publish on:** sonesse.ai/blog/tavus-microsoft-teams-integration
**Word count:** ~1,200

---

## Introduction

Tavus lets you build real-time AI video replicas — lifelike digital avatars that can see, hear, and respond in video calls. But there's a problem: Tavus creates a WebRTC conversation session. Microsoft Teams uses its own proprietary media stack. Getting those two things to talk to each other requires a non-trivial integration layer.

This tutorial shows you how to deploy a Tavus AI avatar directly inside a Microsoft Teams meeting — as a participant — using the Sonesse API.

**What you'll build:** A Teams bot that joins a meeting, presents a Tavus avatar to all participants, and handles real-time audio/video bridging between Tavus CVI and Teams.

---

## The Problem: Tavus + Teams Don't Speak the Same Language

Tavus creates conversations via a standard WebRTC endpoint:

```bash
POST https://tavusapi.com/v2/conversations
{
  "replica_id": "r9d2b0d8b8",
  "persona_id": "pd67b482b68",
  "conversation_name": "Sales demo with Acme Corp"
}
```

This returns a `conversation_url` — a browser-based video call. Great for embedding in a web app. Not so great for joining a Microsoft Teams meeting that 10 people are already in.

Teams requires a bot to:
1. Authenticate via Azure Active Directory
2. Join the meeting via the Microsoft Graph Communications API
3. Send and receive media using Teams-specific protocols (not standard WebRTC)

Building that bridge from scratch takes weeks. Sonesse does it in a single API call.

---

## The Solution: Sonesse as the Bridge

Sonesse acts as the orchestration layer between your Tavus avatar and the Teams meeting. You provide:
- Your Tavus conversation URL
- The Teams meeting URL or join link

Sonesse handles the rest: authentication, media bridging, bot lifecycle management.

---

## Step 1: Create Your Tavus Conversation

First, spin up a Tavus conversation as normal:

```bash
curl -X POST https://tavusapi.com/v2/conversations \
  -H "x-api-key: YOUR_TAVUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "replica_id": "YOUR_REPLICA_ID",
    "persona_id": "YOUR_PERSONA_ID",
    "conversation_name": "Teams Meeting Bot"
  }'
```

Save the `conversation_id` and `conversation_url` from the response.

---

## Step 2: Get Your Teams Meeting URL

You need the Teams meeting join URL. This is the `https://teams.microsoft.com/l/meetup-join/...` link from the calendar invite or meeting chat.

You can also create meetings programmatically via the Microsoft Graph API if you're building an automated workflow.

---

## Step 3: Deploy the Tavus Avatar into Teams via Sonesse

With Sonesse, deploying your Tavus avatar into the Teams meeting is a single API call:

```bash
curl -X POST https://api.sonesse.ai/v1/deploy \
  -H "Authorization: Bearer YOUR_SONESSE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "teams",
    "meeting_url": "https://teams.microsoft.com/l/meetup-join/...",
    "source": {
      "type": "tavus",
      "conversation_url": "YOUR_TAVUS_CONVERSATION_URL"
    },
    "bot_name": "Aria (AI Assistant)",
    "auto_leave": true
  }'
```

Sonesse will:
- Authenticate a bot participant with Teams
- Join the meeting on behalf of your Tavus avatar
- Bridge the Tavus WebRTC session to the Teams media stack
- Manage the bot lifecycle (joining, presenting, leaving)

---

## Step 4: Handle Events (Optional)

Sonesse sends webhook events so you can react to meeting lifecycle events:

```json
{
  "event": "participant_joined",
  "meeting_id": "...",
  "participant": "John Smith",
  "timestamp": "2026-03-15T14:30:00Z"
}
```

Useful for triggering your Tavus avatar to greet participants by name, or hand off to a human agent when needed.

---

## Use Cases

- **AI sales rep** — deploy a Tavus replica to join product demo calls, answer questions, and qualify leads
- **AI onboarding assistant** — join new employee Teams calls and walk through onboarding materials
- **AI interview coach** — join candidate prep calls as a mock interviewer
- **Regulated industry compliance** — deploy compliant AI agents into client meetings with full audit logging

---

## Why Not Build This Yourself?

The Teams bot API surface is substantial. To replicate what Sonesse does, you'd need to:

- Register an Azure AD application with the right Graph API permissions
- Implement the Microsoft Bot Framework SDK
- Handle Teams media sessions via the Calling API
- Build and maintain the WebRTC ↔ Teams media bridge
- Manage bot lifecycle, error recovery, and reconnection logic

Estimated engineering effort: 4–8 weeks for a developer familiar with both APIs. Sonesse does this in one API call, with production reliability and multi-platform support (Zoom and Google Meet supported via the same endpoint, just change `"platform"`).

---

## Next Steps

- [Sign up for Sonesse API access →](https://sonesse.ai)
- [Deploy a Tavus avatar in Zoom →](/blog/tavus-zoom-integration)
- [ElevenLabs voice bot in Teams →](/blog/elevenlabs-teams-integration)

---

*This is part of the Sonesse integration guide series. New tutorials published every weekday.*
