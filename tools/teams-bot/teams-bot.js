#!/usr/bin/env node
/**
 * Teams Meeting Bot — Vision-Based
 *
 * Joins a Microsoft Teams web meeting using Playwright + screenshots.
 * Connects to an existing Chrome instance via CDP, navigates the Teams
 * web join flow using element selectors with screenshot capture at every
 * step for vision-based verification and debugging.
 *
 * Usage:
 *   node teams-bot.js <meeting-url> [--name "Display Name"] [--mic on|off] [--cam on|off]
 *
 * Requirements:
 *   - Chrome running with --remote-debugging-port=9222
 *   - npm install (playwright)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ─── Config ────────────────────────────────────────────────────────────────────

const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const DEFAULT_NAME = 'OpenClaw Bot';
const STEP_TIMEOUT = 30_000;
const NAV_TIMEOUT = 60_000;

// Human-like timing
const DELAY_MIN = 800;
const DELAY_MAX = 2000;
const TYPING_DELAY_MIN = 40;
const TYPING_DELAY_MAX = 120;

// ─── CLI Args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    meetingUrl: null,
    displayName: DEFAULT_NAME,
    mic: false,  // off by default
    cam: false,  // off by default
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      config.displayName = args[++i];
    } else if (args[i] === '--mic' && args[i + 1]) {
      config.mic = args[++i].toLowerCase() === 'on';
    } else if (args[i] === '--cam' && args[i + 1]) {
      config.cam = args[++i].toLowerCase() === 'on';
    } else if (!args[i].startsWith('--')) {
      config.meetingUrl = args[i];
    }
  }

  if (!config.meetingUrl) {
    console.error('Usage: node teams-bot.js <meeting-url> [--name "Name"] [--mic on|off] [--cam on|off]');
    process.exit(1);
  }

  return config;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function delay(min = DELAY_MIN, max = DELAY_MAX) {
  await new Promise(r => setTimeout(r, rand(min, max)));
}

let stepCounter = 0;

async function screenshot(page, label) {
  stepCounter++;
  const filename = `${String(stepCounter).padStart(2, '0')}-${label}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`📸 [${stepCounter}] ${label} → ${filename}`);
  return filepath;
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

// ─── Selector Strategies ───────────────────────────────────────────────────────
// Teams web UI uses varying selectors across versions.  We try multiple
// strategies for each action to be resilient to UI changes.

const SELECTORS = {
  // "Continue on this browser" / "Join on the web instead"
  continueOnBrowser: [
    'button:has-text("Continue on this browser")',
    'button:has-text("Join on the web instead")',
    'a:has-text("Continue on this browser")',
    'a:has-text("Join on the web instead")',
    '[data-tid="joinOnWeb"]',
    'button:has-text("continue on this browser")',
    'button:has-text("join on the web")',
  ],

  // Name input field (anonymous join)
  nameInput: [
    'input[placeholder*="name" i]',
    'input[data-tid="prejoin-display-name-input"]',
    'input[aria-label*="name" i]',
    '#username',
    'input[type="text"]',
  ],

  // Mic toggle
  micToggle: [
    'button[aria-label*="microphone" i]',
    'button[aria-label*="mic" i]',
    'button[data-tid="toggle-mute"]',
    '[id*="microphone" i] button',
    'button[title*="microphone" i]',
    'button[title*="mic" i]',
  ],

  // Camera toggle
  camToggle: [
    'button[aria-label*="camera" i]',
    'button[aria-label*="video" i]',
    'button[data-tid="toggle-video"]',
    '[id*="camera" i] button',
    'button[title*="camera" i]',
    'button[title*="video" i]',
  ],

  // Join now button
  joinNow: [
    'button:has-text("Join now")',
    'button:has-text("Join meeting")',
    'button[data-tid="prejoin-join-button"]',
    'button:has-text("join now")',
    'button:has-text("Join")',
  ],

  // In-meeting indicators
  inMeeting: [
    '[data-tid="calling-unified-bar"]',
    '[data-tid="hangup-button"]',
    'button[aria-label*="Leave" i]',
    'button[aria-label*="Hang up" i]',
    '#hangup-button',
    'button:has-text("Leave")',
  ],

  // Leave button
  leave: [
    'button[aria-label*="Leave" i]',
    'button[aria-label*="Hang up" i]',
    'button[data-tid="hangup-button"]',
    '#hangup-button',
    'button:has-text("Leave")',
  ],
};

/**
 * Try multiple selectors until one matches. Returns the first visible locator.
 */
async function findElement(page, selectorList, timeout = STEP_TIMEOUT) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const sel of selectorList) {
      try {
        const locator = page.locator(sel).first();
        if (await locator.isVisible({ timeout: 500 })) {
          return locator;
        }
      } catch {
        // selector not found, try next
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  return null;
}

/**
 * Check if any selector from a list is currently visible (no waiting).
 */
async function isVisible(page, selectorList) {
  for (const sel of selectorList) {
    try {
      if (await page.locator(sel).first().isVisible({ timeout: 500 })) {
        return true;
      }
    } catch {
      // not visible
    }
  }
  return false;
}

// ─── Meeting Flow Steps ────────────────────────────────────────────────────────

async function navigateToMeeting(page, url) {
  log('Navigating to meeting URL...');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await delay(2000, 4000);
  await screenshot(page, 'landing-page');
  log('✅ Landing page loaded');
}

async function clickContinueOnBrowser(page) {
  log('Looking for "Continue on this browser" button...');
  const btn = await findElement(page, SELECTORS.continueOnBrowser);

  if (btn) {
    await delay();
    await btn.click();
    log('✅ Clicked "Continue on this browser"');
    await delay(2000, 4000);
    await screenshot(page, 'after-continue-on-browser');
    return true;
  }

  // May already be on the pre-join screen (signed-in flow)
  log('⚠️  "Continue on this browser" not found — may already be on pre-join screen');
  await screenshot(page, 'no-continue-button');
  return false;
}

async function handlePermissionsDialog(page) {
  // Teams may trigger browser permission dialogs for mic/camera.
  // Playwright can't dismiss native dialogs, but we can grant permissions on the context.
  try {
    const context = page.context();
    await context.grantPermissions(['microphone', 'camera'], {
      origin: page.url(),
    });
    log('✅ Granted mic/camera permissions');
  } catch (e) {
    log(`⚠️  Could not grant permissions (CDP context): ${e.message}`);
  }
}

async function enterDisplayName(page, name) {
  log(`Looking for name input field...`);
  const input = await findElement(page, SELECTORS.nameInput, 10_000);

  if (input) {
    await delay();
    await input.click({ clickCount: 3 }); // select all existing text
    await delay(300, 600);

    // Type name with human-like delays
    for (const char of name) {
      await input.type(char, { delay: rand(TYPING_DELAY_MIN, TYPING_DELAY_MAX) });
    }

    log(`✅ Entered display name: "${name}"`);
    await screenshot(page, 'name-entered');
    return true;
  }

  log('ℹ️  No name input found — likely signed in already');
  return false;
}

async function toggleMic(page, wantOn) {
  log(`Setting mic: ${wantOn ? 'ON' : 'OFF'}`);
  const btn = await findElement(page, SELECTORS.micToggle, 10_000);

  if (!btn) {
    log('⚠️  Mic toggle not found');
    await screenshot(page, 'mic-toggle-not-found');
    return;
  }

  // Determine current state from aria-pressed or aria-label
  const ariaLabel = (await btn.getAttribute('aria-label') || '').toLowerCase();
  const ariaPressed = await btn.getAttribute('aria-pressed');

  // "Mute microphone" means mic is currently ON, "Unmute" means OFF
  const isMicCurrentlyOn =
    ariaLabel.includes('mute') && !ariaLabel.includes('unmute') ||
    ariaPressed === 'false'; // not pressed = not muted = mic on

  if (wantOn !== isMicCurrentlyOn) {
    await delay();
    await btn.click();
    log(`✅ Toggled mic → ${wantOn ? 'ON' : 'OFF'}`);
  } else {
    log(`ℹ️  Mic already ${wantOn ? 'ON' : 'OFF'}`);
  }

  await screenshot(page, `mic-${wantOn ? 'on' : 'off'}`);
}

async function toggleCam(page, wantOn) {
  log(`Setting camera: ${wantOn ? 'ON' : 'OFF'}`);
  const btn = await findElement(page, SELECTORS.camToggle, 10_000);

  if (!btn) {
    log('⚠️  Camera toggle not found');
    await screenshot(page, 'cam-toggle-not-found');
    return;
  }

  const ariaLabel = (await btn.getAttribute('aria-label') || '').toLowerCase();
  const ariaPressed = await btn.getAttribute('aria-pressed');

  const isCamCurrentlyOn =
    ariaLabel.includes('turn off') ||
    (ariaPressed === 'false');

  if (wantOn !== isCamCurrentlyOn) {
    await delay();
    await btn.click();
    log(`✅ Toggled camera → ${wantOn ? 'ON' : 'OFF'}`);
  } else {
    log(`ℹ️  Camera already ${wantOn ? 'ON' : 'OFF'}`);
  }

  await screenshot(page, `cam-${wantOn ? 'on' : 'off'}`);
}

async function clickJoinNow(page) {
  log('Looking for "Join now" button...');
  const btn = await findElement(page, SELECTORS.joinNow);

  if (!btn) {
    log('❌ "Join now" button not found');
    await screenshot(page, 'join-button-not-found');
    return false;
  }

  await delay();
  await btn.click();
  log('✅ Clicked "Join now"');
  await delay(3000, 5000);
  await screenshot(page, 'after-join-click');
  return true;
}

async function waitForMeetingJoined(page) {
  log('Waiting to confirm we are in the meeting...');
  const indicator = await findElement(page, SELECTORS.inMeeting, 30_000);

  if (indicator) {
    log('✅ Successfully joined the meeting!');
    await screenshot(page, 'in-meeting');
    return true;
  }

  log('⚠️  Could not confirm meeting join — check screenshots');
  await screenshot(page, 'join-uncertain');
  return false;
}

async function leaveMeeting(page) {
  log('Leaving meeting...');
  const btn = await findElement(page, SELECTORS.leave, 5_000);

  if (btn) {
    await btn.click();
    await delay(1000, 2000);
    log('✅ Left meeting');
    await screenshot(page, 'left-meeting');
    return true;
  }

  log('⚠️  Leave button not found');
  return false;
}

// ─── Meeting Monitor ───────────────────────────────────────────────────────────

async function monitorMeeting(page, intervalMs = 30_000) {
  log(`📡 Monitoring meeting (screenshot every ${intervalMs / 1000}s). Press Ctrl+C to stop.`);

  const monitorLoop = async () => {
    let tick = 0;
    while (true) {
      await new Promise(r => setTimeout(r, intervalMs));
      tick++;

      try {
        // Check if still in meeting
        const stillIn = await isVisible(page, SELECTORS.inMeeting);
        if (!stillIn) {
          log('⚠️  No longer in meeting — may have been removed or meeting ended');
          await screenshot(page, `monitor-${tick}-ended`);
          break;
        }

        await screenshot(page, `monitor-${tick}`);
        log(`📡 Meeting active (tick ${tick})`);
      } catch (e) {
        log(`⚠️  Monitor error: ${e.message}`);
        break;
      }
    }
  };

  return monitorLoop();
}

// ─── Main Flow ─────────────────────────────────────────────────────────────────

async function joinMeeting(config) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // Clear old screenshots
  const existing = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
  for (const f of existing) {
    fs.unlinkSync(path.join(SCREENSHOTS_DIR, f));
  }

  log('Connecting to Chrome via CDP...');
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = await context.newPage();

  // Set viewport for consistent screenshots
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    // Grant permissions up front
    await handlePermissionsDialog(page);

    // Step 1: Navigate
    await navigateToMeeting(page, config.meetingUrl);

    // Step 2: "Continue on this browser"
    await clickContinueOnBrowser(page);

    // Step 3: Wait for pre-join screen to stabilise
    await delay(2000, 3000);
    await screenshot(page, 'pre-join-screen');

    // Step 4: Enter display name (if required)
    await enterDisplayName(page, config.displayName);

    // Step 5: Set mic/cam
    await toggleMic(page, config.mic);
    await toggleCam(page, config.cam);

    // Step 6: Join
    const joined = await clickJoinNow(page);
    if (!joined) {
      log('❌ Failed to click Join — aborting');
      return { success: false, page };
    }

    // Step 7: Confirm in meeting
    const inMeeting = await waitForMeetingJoined(page);

    return { success: inMeeting, page, browser };
  } catch (e) {
    log(`❌ Error: ${e.message}`);
    await screenshot(page, 'error');
    return { success: false, page, browser };
  }
}

// ─── Entry Point ───────────────────────────────────────────────────────────────

async function main() {
  const config = parseArgs();

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Teams Meeting Bot — Vision Based     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  Meeting:  ${config.meetingUrl}`);
  console.log(`  Name:     ${config.displayName}`);
  console.log(`  Mic:      ${config.mic ? 'ON' : 'OFF'}`);
  console.log(`  Camera:   ${config.cam ? 'ON' : 'OFF'}`);
  console.log(`  CDP:      ${CDP_URL}`);
  console.log(`  Shots:    ${SCREENSHOTS_DIR}`);
  console.log('');

  const { success, page, browser } = await joinMeeting(config);

  if (success) {
    console.log('');
    console.log('🎉 Bot is in the meeting!');
    console.log('   Screenshots are being captured periodically.');
    console.log('   Press Ctrl+C to leave and exit.');
    console.log('');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await leaveMeeting(page);
      process.exit(0);
    });

    // Monitor until meeting ends
    await monitorMeeting(page);
  } else {
    console.log('');
    console.log('❌ Bot could not join the meeting.');
    console.log(`   Check screenshots in: ${SCREENSHOTS_DIR}`);
    console.log('');
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = { joinMeeting, leaveMeeting, monitorMeeting, SELECTORS };

// Run if called directly
if (require.main === module) {
  main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
  });
}
