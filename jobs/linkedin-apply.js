#!/usr/bin/env node
/**
 * LinkedIn Easy Apply Agent v2
 * Human-like behaviour: random delays, mouse movements, scroll patterns
 * Connects to existing Chrome via CDP
 * Profile: Matthew Dewstowe — VP/Director/Head of Product roles
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROFILE = JSON.parse(fs.readFileSync('/home/matthewdewstowe/.openclaw/workspace/jobs/application-profile.json', 'utf8'));
const LOG_FILE = '/home/matthewdewstowe/.openclaw/workspace/jobs/apply-log.json';
const CDP_URL = 'http://localhost:9222';
const SHEET_ID = '1Hv3Iccnhh81DbiJVHmHohwzg4CNDmEYbda8cwSnfpow';
const GOG = 'GOG_KEYRING_PASSWORD=openclaw gog';
const ACCOUNT = 'matthewdewstowe@gmail.com';

// === RECORDING CONFIG ===
const RECORDINGS_DIR = '/home/matthewdewstowe/.openclaw/workspace/jobs/recordings';
const TRACES_DIR = '/home/matthewdewstowe/.openclaw/workspace/jobs/traces';
fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
fs.mkdirSync(TRACES_DIR, { recursive: true });

// === HUMAN-LIKE CONFIG ===
const MAX_APPLICATIONS_PER_RUN = 15;
const MIN_DELAY_MS = 2000;
const MAX_DELAY_MS = 6000;
const PAGE_LOAD_DELAY_MS = 4000;
const BETWEEN_JOBS_MIN_MS = 3000;
const BETWEEN_JOBS_MAX_MS = 8000;
const BETWEEN_SEARCHES_MIN_MS = 5000;
const BETWEEN_SEARCHES_MAX_MS = 12000;
const MODAL_STEP_MIN_MS = 1500;
const MODAL_STEP_MAX_MS = 3500;
const MAX_PAGES_PER_SEARCH = 3;
const MAX_CONSECUTIVE_ERRORS = 3; // abort if 3 in a row = likely bot detection

// === HELPERS ===

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanDelay(min = MIN_DELAY_MS, max = MAX_DELAY_MS) {
  const ms = rand(min, max);
  await new Promise(r => setTimeout(r, ms));
}

async function humanMouseMove(page) {
  try {
    const x = rand(100, 900);
    const y = rand(100, 600);
    await page.mouse.move(x, y, { steps: rand(5, 15) });
  } catch(e) {
    // Ignore mouse move failures
  }
}

async function humanScroll(page) {
  try {
    const direction = Math.random() > 0.3 ? 1 : -1;
    const amount = rand(100, 400) * direction;
    await page.mouse.wheel(0, amount);
    await humanDelay(500, 1500);
  } catch(e) {
    // Ignore scroll failures
  }
}

async function humanClick(page, locator) {
  // Move mouse to element, pause, then click
  const box = await locator.boundingBox().catch(() => null);
  if (box) {
    // Move to element with slight offset (not dead centre)
    const offsetX = rand(-5, 5);
    const offsetY = rand(-3, 3);
    await page.mouse.move(
      box.x + box.width / 2 + offsetX,
      box.y + box.height / 2 + offsetY,
      { steps: rand(8, 20) }
    );
    await humanDelay(200, 600);
    await page.mouse.click(
      box.x + box.width / 2 + offsetX,
      box.y + box.height / 2 + offsetY
    );
  } else {
    // Fallback to JS click
    await locator.evaluate(el => el.click()).catch(() => {});
  }
}

async function humanType(page, locator, text) {
  // Clear and type character by character with variable speed
  await locator.click().catch(() => {});
  await locator.fill('');
  await humanDelay(200, 400);
  for (const char of text) {
    await locator.type(char, { delay: rand(30, 120) });
  }
}

async function checkBotProtection(page) {
  // Check for protechts / reCAPTCHA in current page
  const url = page.url();
  if (url.includes('protechts') || url.includes('checkpoint')) {
    return true;
  }
  // Check for challenge elements on page
  const hasChallenge = await page.locator('iframe[src*="recaptcha"], iframe[src*="protechts"], .challenge-dialog').isVisible({ timeout: 1000 }).catch(() => false);
  return hasChallenge;
}

async function checkBotProtectionTabs(browser) {
  // Check all tabs for protechts/recaptcha indicators
  const contexts = browser.contexts();
  for (const ctx of contexts) {
    for (const p of ctx.pages()) {
      const url = p.url();
      if (url.includes('protechts') && url.includes('linkedin')) {
        return true;
      }
    }
  }
  return false;
}

// === LOGGING ===

function logApplyToSheet(entry) {
  try {
    const row = [[
      entry.appliedAt.split('T')[0],
      entry.title,
      entry.company,
      entry.location || '',
      '',
      entry.source,
      '',
      '',
      entry.url,
      'Applied',
      entry.jobId
    ]];
    const tmpFile = '/tmp/apply-sheet-entry.json';
    fs.writeFileSync(tmpFile, JSON.stringify(row));
    execSync(`${GOG} sheets append "${SHEET_ID}" "Sheet1!A:K" --values-json "$(cat ${tmpFile})" --insert INSERT_ROWS --account ${ACCOUNT} 2>/dev/null`, { encoding: 'utf8', shell: '/bin/bash' });
    console.log(`  → Logged to sheet`);
  } catch(e) {
    console.log(`  → Sheet log failed: ${e.message?.slice(0,80)}`);
  }
}

// === SEARCH CONFIG ===

const SEARCH_URLS = [
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=Head%20of%20Product&location=United%20Kingdom&f_E=4,5,6&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=Director%20of%20Product&location=United%20Kingdom&f_E=4,5,6&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=VP%20of%20Product&location=United%20Kingdom&f_E=4,5,6&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=Chief%20Product%20Officer&location=United%20Kingdom&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=Fractional%20CPO&location=United%20Kingdom&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=Interim%20Head%20of%20Product&location=United%20Kingdom&sortBy=DD',
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=Product%20Director&location=United%20Kingdom&f_E=5,6&sortBy=DD',
];

const SKIP_TITLES = [
  'product manager', 'senior product manager', 'junior', 'associate',
  'electrical', 'hardware', 'product owner', 'product designer',
  'product marketing', 'product analyst', 'product engineer',
  'recruitment', 'talent acquisition'
];

const TARGET_TITLES = [
  'head of product', 'director of product', 'vp of product', 'vp product',
  'vice president of product', 'chief product', 'cpo', 'fractional',
  'interim', 'principal product', 'product director', 'product strategy',
  'group product', 'head of ai', 'director of ai', 'chief technology',
  'head of product management'
];

let log = [];
try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch(e) {}
const appliedIds = new Set(log.map(l => l.jobId));

function shouldApply(title) {
  const t = title.toLowerCase();
  if (SKIP_TITLES.some(s => t.includes(s))) return false;
  return TARGET_TITLES.some(s => t.includes(s));
}

function saveLog() {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

// === FORM FILLING ===

async function fillTextField(page, label, value) {
  try {
    const field = page.locator(`input[aria-label*="${label}" i], input[id*="${label.toLowerCase().replace(/\\s+/g,'-')}" i], textarea[aria-label*="${label}" i]`).first();
    if (await field.isVisible({ timeout: 2000 })) {
      await humanDelay(300, 800);
      await humanType(page, field, value);
      return true;
    }
  } catch(e) {}
  return false;
}

async function handleApplicationModal(page, jobTitle, company) {
  console.log(`  → Filling application for: ${jobTitle} @ ${company}`);
  
  try {
    await page.waitForSelector('.jobs-easy-apply-modal, [data-test-modal]', { timeout: 12000 });
  } catch(e) {
    console.log('  ✗ Modal did not appear');
    return false;
  }

  // Small pause — read the modal like a human would
  await humanDelay(1500, 3000);

  let stepCount = 0;
  const maxSteps = 10;

  while (stepCount < maxSteps) {
    stepCount++;
    await humanDelay(MODAL_STEP_MIN_MS, MODAL_STEP_MAX_MS);

    const modalText = await page.locator('.jobs-easy-apply-modal, [data-test-modal]').innerText().catch(() => '');

    // Check if already submitted
    if (modalText.includes('application was sent') || modalText.includes('Application submitted')) {
      console.log('  ✓ Application submitted!');
      return true;
    }

    // Fill phone if asked
    await fillTextField(page, 'Mobile phone number', PROFILE.phone);
    await fillTextField(page, 'Phone', PROFILE.phone);

    // Fill location/city
    await fillTextField(page, 'City', 'Tenby');
    await fillTextField(page, 'location', 'United Kingdom');

    // Answer common yes/no questions
    const radioGroups = await page.locator('fieldset, [role="radiogroup"]').all();
    for (const group of radioGroups) {
      const groupText = await group.innerText().catch(() => '');
      const gt = groupText.toLowerCase();
      
      // Right to work / authorised / eligible / sponsorship
      if (gt.includes('authorized') || gt.includes('authorised') || gt.includes('eligible') || gt.includes('right to work') || gt.includes('legally')) {
        const yesLabel = group.locator('label').filter({ hasText: /^yes$/i }).first();
        if (await yesLabel.isVisible({ timeout: 500 }).catch(() => false)) {
          await humanDelay(300, 700);
          await humanClick(page, yesLabel);
        }
      }
      // Sponsorship — answer No (Matthew has right to work)
      if (gt.includes('sponsor') || gt.includes('visa')) {
        const noLabel = group.locator('label').filter({ hasText: /^no$/i }).first();
        if (await noLabel.isVisible({ timeout: 500 }).catch(() => false)) {
          await humanDelay(300, 700);
          await humanClick(page, noLabel);
        }
      }
    }

    // Handle salary/compensation text inputs
    const salaryField = page.locator('input[aria-label*="salary" i], input[aria-label*="compensation" i], input[aria-label*="expected" i], input[aria-label*="rate" i]').first();
    if (await salaryField.isVisible({ timeout: 500 }).catch(() => false)) {
      const currentVal = await salaryField.inputValue().catch(() => '');
      if (!currentVal) {
        await humanDelay(400, 900);
        await humanType(page, salaryField, '150000');
      }
    }

    // Handle dropdowns - select first non-empty option for unknowns
    const selects = page.locator('select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const sel = selects.nth(i);
      const val = await sel.inputValue().catch(() => '');
      if (!val || val === 'Select an option') {
        const options = await sel.locator('option').all();
        if (options.length > 1) {
          const secondOpt = await options[1].getAttribute('value');
          if (secondOpt) {
            await humanDelay(300, 600);
            await sel.selectOption(secondOpt).catch(() => {});
          }
        }
      }
    }

    // Handle "years of experience" numeric fields
    const numericFields = await page.locator('input[type="number"], input[aria-label*="year" i], input[aria-label*="experience" i]').all();
    for (const field of numericFields) {
      const label = await field.getAttribute('aria-label') || '';
      if (label.toLowerCase().includes('year') || label.toLowerCase().includes('experience')) {
        const val = await field.inputValue();
        if (!val) {
          await humanDelay(300, 700);
          await humanType(page, field, '10');
        }
      }
    }

    // Handle notice period
    const noticeField = page.locator('input[aria-label*="notice" i]').first();
    if (await noticeField.isVisible({ timeout: 500 }).catch(() => false)) {
      const val = await noticeField.inputValue().catch(() => '');
      if (!val) {
        await humanDelay(300, 700);
        await humanType(page, noticeField, 'Immediate');
      }
    }

    // Look for Next / Submit / Review button
    const submitBtn = page.locator('button[aria-label*="Submit application" i]').first();
    const reviewBtn = page.locator('button[aria-label*="Review your application" i]').first();
    const nextBtn = page.locator('button[aria-label*="Continue to next step" i], button[aria-label*="Next" i]').first();

    if (await submitBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('  → Submitting...');
      await humanDelay(500, 1200);
      await humanClick(page, submitBtn);
      await humanDelay(2000, 4000);
      
      // Check for post-submit confirmation
      const postText = await page.locator('.jobs-easy-apply-modal, [data-test-modal]').innerText().catch(() => '');
      if (postText.includes('application was sent') || postText.includes('Application submitted') || postText.includes('Done')) {
        // Dismiss any post-apply dialog
        const doneBtn = page.locator('button[aria-label*="Dismiss" i], button[aria-label*="Done" i]').first();
        await doneBtn.click().catch(() => {});
      }
      return true;
    } else if (await reviewBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('  → Reviewing...');
      await humanDelay(400, 900);
      await humanClick(page, reviewBtn);
    } else if (await nextBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log(`  → Step ${stepCount}: Next`);
      await humanDelay(400, 900);
      await humanClick(page, nextBtn);
    } else {
      // Try generic buttons
      const genericBtn = page.locator('button').filter({ hasText: /^(Next|Continue|Review|Submit)$/i }).first();
      if (await genericBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        const btnText = await genericBtn.innerText();
        console.log(`  → Step ${stepCount}: ${btnText}`);
        await humanDelay(400, 900);
        await humanClick(page, genericBtn);
      } else {
        console.log(`  ✗ No navigation button found at step ${stepCount}`);
        // Screenshot the unknown step so we can learn from it
        const unknownScreenshotPath = `/tmp/unknown-form-step-${Date.now()}.png`;
        await page.screenshot({ path: unknownScreenshotPath, fullPage: false }).catch(() => {});
        console.log(`  📸 Unknown step screenshot saved: ${unknownScreenshotPath}`);
        // Log what was visible on the page
        const visibleInputs = await page.locator('input:visible, textarea:visible, select:visible').evaluateAll(
          els => els.map(el => ({ tag: el.tagName, type: el.type, label: el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name'), value: el.value?.slice(0, 50) }))
        ).catch(() => []);
        console.log(`  Visible inputs:`, JSON.stringify(visibleInputs.slice(0, 10)));
        const closeBtn = page.locator('button[aria-label*="Dismiss" i], button[aria-label*="Close" i]').first();
        await humanDelay(300, 600);
        await closeBtn.click().catch(() => {});
        return false;
      }
    }
  }
  
  console.log('  ✗ Max steps reached');
  return false;
}

// === JOB PROCESSING ===

async function processJobList(page, totalApplied) {
  const results = { applied: 0, skipped: 0, errors: 0, alreadyApplied: 0 };
  
  // Random scroll before reading results — like a human scanning
  await humanScroll(page);
  await humanDelay(1000, 2000);

  const jobCards = await page.locator('.job-card-container, .jobs-search-results__list-item').all();
  console.log(`Found ${jobCards.length} job cards`);

  let consecutiveErrors = 0;

  for (let i = 0; i < jobCards.length; i++) {
    // Check application cap
    if (totalApplied + results.applied >= MAX_APPLICATIONS_PER_RUN) {
      console.log(`\n⚠️  Hit daily cap of ${MAX_APPLICATIONS_PER_RUN} applications. Stopping.`);
      results.hitCap = true;
      break;
    }

    // Check consecutive errors (likely bot detection)
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.log(`\n⚠️  ${MAX_CONSECUTIVE_ERRORS} consecutive errors — possible bot detection. Stopping.`);
      results.botDetected = true;
      break;
    }

    const card = jobCards[i];
    
    const titleEl = card.locator('.job-card-list__title, .job-card-container__link').first();
    const title = await titleEl.innerText().catch(() => '').then(t => t.trim());
    
    const link = await card.locator('a').first().getAttribute('href').catch(() => '');
    const jobIdMatch = link?.match(/\/jobs\/view\/(\d+)/);
    const jobId = jobIdMatch?.[1] || `unknown-${i}`;
    
    const company = await card.locator('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle').first().innerText().catch(() => 'Unknown');

    console.log(`\n[${i+1}/${jobCards.length}] ${title.split('\n')[0]} @ ${company.split('\n')[0]} (${jobId})`);

    if (!title) { results.skipped++; continue; }
    if (!shouldApply(title)) { console.log(`  → Skipped (title filter)`); results.skipped++; continue; }
    if (appliedIds.has(jobId)) { console.log(`  → Already applied`); results.alreadyApplied++; continue; }

    const appliedBadge = await card.locator('.artdeco-inline-feedback--success, [data-test-job-card-applied]').isVisible({ timeout: 500 }).catch(() => false);
    if (appliedBadge) { console.log(`  → Already applied (badge)`); results.alreadyApplied++; continue; }

    // Human-like: pause before clicking a job card
    await humanDelay(BETWEEN_JOBS_MIN_MS, BETWEEN_JOBS_MAX_MS);
    
    // Move mouse to card area, then click
    await humanMouseMove(page);
    await humanDelay(300, 800);
    await humanClick(page, card);
    await humanDelay(2000, 4000);

    // Read the job description briefly (scroll the right panel)
    await humanMouseMove(page);
    await humanScroll(page);
    await humanDelay(1500, 3000);

    // Check for Easy Apply button
    const easyApplyBtn = page.locator('button[aria-label*="Easy Apply" i]').first();
    if (!await easyApplyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  → No Easy Apply button');
      results.skipped++;
      consecutiveErrors = 0; // Not an error, just external apply
      continue;
    }

    // Scroll to Easy Apply button, pause, then click
    await easyApplyBtn.scrollIntoViewIfNeeded().catch(() => {});
    await humanDelay(800, 1500);
    await humanClick(page, easyApplyBtn);
    await humanDelay(1500, 3000);

    // === START RECORDING for this application ===
    const safeTitle = title.split('\n')[0].replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 40).trim();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const traceSlug = `${timestamp}_${jobId}_${safeTitle}`;
    const tracePath = path.join(TRACES_DIR, `${traceSlug}.zip`);
    const videoDir = path.join(RECORDINGS_DIR, traceSlug);
    fs.mkdirSync(videoDir, { recursive: true });

    // Record video on a fresh context page for this application
    // (We capture the existing page by starting a trace on the existing context)
    let traceStarted = false;
    try {
      await page.context().tracing.start({ screenshots: true, snapshots: true, sources: false });
      traceStarted = true;
    } catch(e) {
      console.log(`  ⚠ Trace start failed: ${e.message?.slice(0, 60)}`);
    }

    const success = await handleApplicationModal(page, title.split('\n')[0], company.split('\n')[0]);

    // === STOP RECORDING ===
    if (traceStarted) {
      try {
        await page.context().tracing.stop({ path: tracePath });
        console.log(`  📹 Trace saved: ${path.basename(tracePath)}`);
      } catch(e) {
        console.log(`  ⚠ Trace save failed: ${e.message?.slice(0, 60)}`);
      }
    }

    // Screenshot the final state (what did the page look like at end?)
    const finalScreenshot = path.join(videoDir, 'final-state.png');
    await page.screenshot({ path: finalScreenshot, fullPage: false }).catch(() => {});
    
    const entry = {
      jobId,
      title: title.split('\n')[0].trim(),
      company: company.split('\n')[0].trim(),
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      source: 'LinkedIn',
      appliedAt: new Date().toISOString(),
      status: success ? 'Applied' : 'Failed',
      notes: success ? 'Easy Apply via Chrome CDP' : 'Easy Apply failed — manual review needed',
      trace: tracePath,
      screenshot: finalScreenshot,
    };
    log.push(entry);
    appliedIds.add(jobId);
    saveLog();

    if (success) {
      results.applied++;
      consecutiveErrors = 0;
      console.log(`  ✓ Applied to: ${entry.title} @ ${entry.company}`);
      logApplyToSheet(entry);
      // Extra pause after successful apply — celebrate like a human
      await humanDelay(3000, 6000);
    } else {
      results.errors++;
      consecutiveErrors++;
      console.log(`  ✗ Failed: ${entry.title} @ ${entry.company}`);
    }
  }

  return results;
}

// === MAIN ===

async function main() {
  console.log('=== LinkedIn Easy Apply Agent v2 (Human-like) ===');
  console.log(`Max applications this run: ${MAX_APPLICATIONS_PER_RUN}`);
  console.log(`Connecting to Chrome at ${CDP_URL}...`);

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch(e) {
    console.error('Failed to connect to Chrome:', e.message);
    process.exit(1);
  }

  console.log('Connected!');

  // Check for existing bot protection
  if (await checkBotProtectionTabs(browser)) {
    console.log('\n🚨 Bot protection detected (protechts tabs found).');
    console.log('Please clear CAPTCHA manually in Chrome, then retry.');
    await browser.close().catch(() => {});
    process.exit(1);
  }

  const contexts = browser.contexts();
  let context = contexts[0];
  const pages = context.pages();
  
  // Find a usable LinkedIn page, or the feed, or create one
  let page = pages.find(p => p.url().includes('linkedin.com/feed')) 
    || pages.find(p => p.url().includes('linkedin.com/jobs'))
    || pages.find(p => p.url().includes('linkedin.com'));
  
  if (!page) {
    page = await context.newPage();
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  }
  
  console.log(`Using tab: ${page.url()}`);

  // Warm up: browse briefly like a human
  console.log('\n🔄 Warming up...');
  if (!page.url().includes('linkedin.com/feed')) {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  }
  await humanDelay(3000, 5000);
  await humanMouseMove(page);
  await humanScroll(page);
  await humanDelay(2000, 4000);
  await humanScroll(page);
  await humanDelay(1500, 3000);

  // Check for bot protection after loading feed
  if (await checkBotProtection(page)) {
    console.log('\n🚨 Bot protection detected on feed page. Please clear CAPTCHA manually.');
    await browser.close().catch(() => {});
    process.exit(1);
  }

  console.log('✅ Feed loaded, no bot protection detected. Starting job search...\n');

  const totalResults = { applied: 0, skipped: 0, errors: 0, alreadyApplied: 0 };
  let stopped = false;

  // Shuffle search URLs for variety
  const shuffled = [...SEARCH_URLS].sort(() => Math.random() - 0.5);

  for (const searchUrl of shuffled) {
    if (stopped) break;
    if (totalResults.applied >= MAX_APPLICATIONS_PER_RUN) break;

    const keyword = decodeURIComponent(searchUrl.split('keywords=')[1]?.split('&')[0] || 'unknown');
    console.log(`\n=== Searching: ${keyword} ===`);
    
    // Human-like delay between searches
    await humanDelay(BETWEEN_SEARCHES_MIN_MS, BETWEEN_SEARCHES_MAX_MS);
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('Navigation warning:', e.message));
    await humanDelay(PAGE_LOAD_DELAY_MS, PAGE_LOAD_DELAY_MS + 3000);

    // Check for bot protection after navigation
    if (await checkBotProtection(page)) {
      console.log('\n🚨 Bot protection triggered during search. Stopping.');
      stopped = true;
      break;
    }

    let pageNum = 1;
    while (pageNum <= MAX_PAGES_PER_SEARCH) {
      if (totalResults.applied >= MAX_APPLICATIONS_PER_RUN) break;

      console.log(`\n-- Page ${pageNum} --`);
      const results = await processJobList(page, totalResults.applied);
      
      totalResults.applied += results.applied;
      totalResults.skipped += results.skipped;
      totalResults.errors += results.errors;
      totalResults.alreadyApplied += results.alreadyApplied;

      if (results.hitCap || results.botDetected) {
        stopped = true;
        break;
      }

      // Try next page with human-like behaviour
      const nextBtn = page.locator('button[aria-label="View next page"]').first();
      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await humanDelay(2000, 5000);
        await humanClick(page, nextBtn);
        await humanDelay(PAGE_LOAD_DELAY_MS, PAGE_LOAD_DELAY_MS + 3000);
        pageNum++;
      } else {
        break;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Applied:         ${totalResults.applied}`);
  console.log(`Already applied: ${totalResults.alreadyApplied}`);
  console.log(`Skipped:         ${totalResults.skipped}`);
  console.log(`Errors:          ${totalResults.errors}`);
  console.log(`Traces saved to: ${TRACES_DIR}`);
  console.log(`Log saved to:    ${LOG_FILE}`);

  if (stopped) {
    console.log('\n⚠️  Run stopped early (cap reached or bot detection).');
  }

  // === POST-RUN: Write failure analysis for review ===
  const thisRunFailed = log.filter(e => 
    e.status === 'Failed' && 
    e.trace && 
    Date.now() - new Date(e.appliedAt).getTime() < 3600 * 1000
  );
  if (thisRunFailed.length > 0) {
    const analysisFile = `/tmp/apply-failures-${new Date().toISOString().slice(0,10)}.json`;
    fs.writeFileSync(analysisFile, JSON.stringify(thisRunFailed.map(e => ({
      title: e.title,
      company: e.company,
      notes: e.notes,
      trace: e.trace,
      screenshot: e.screenshot,
    })), null, 2));
    console.log(`\n📋 ${thisRunFailed.length} failures logged for review: ${analysisFile}`);
    console.log('   To inspect a trace: npx playwright show-trace <trace.zip>');
  }

  await browser.close().catch(() => {});
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
