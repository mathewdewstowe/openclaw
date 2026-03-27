# OpenClaw Chrome Extension

Quick access to your OpenClaw dashboard from any browser tab.

## Features

- **Tasks** -- View, create, complete, and delete tasks with priority and category tags
- **Goals** -- Track goal progress with visual progress bars
- **Capture** -- Save the current page URL/title or freeform notes to OpenClaw memory
- **Status** -- Monitor connected systems and view the latest briefing

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder from this repo

## Setup

1. Click the OpenClaw icon in your browser toolbar
2. Enter your dashboard URL (default: `http://localhost:3737`)
3. Log in with your dashboard credentials
4. You're connected -- browse tasks, goals, and capture pages

## Dashboard Server

The extension communicates with the OpenClaw dashboard API on port 3737. CORS is enabled for extension requests. The server must be running for the extension to work.

## Permissions

- `storage` -- Persists your auth token and server URL locally
- `activeTab` -- Reads the current tab's URL and title for page capture
- `host_permissions` -- Allows API requests to your local dashboard and Cloudflare tunnel
