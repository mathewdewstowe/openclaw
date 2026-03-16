#!/usr/bin/env node
/**
 * LinkedIn Easy Apply Agent
 * Connects to existing Chrome via CDP, applies to Easy Apply jobs
 * Profile: Matthew Dewstowe — VP/Director/Head of Product roles
 */

const { chromium } = require('playwright');
const fs = require('fs');

const { execSync } = require('child_process');
const PROFILE = JSON.parse(fs.readFileSync('/home/matthewdewstowe/.openclaw/workspace/jobs/application-profile.json', 'utf8'));
const LOG_FILE = '/home/matthewdewstowe/.openclaw/workspace/jobs/apply-log.json';
const CDP_URL = 'http://localhost:9222';
const SHEET_ID = '1Hv3Iccnhh81DbiJVHmHohwzg4CNDmEYbda8cwSnfpow';
const GOG = 'GOG_KEYRING_PASSWORD=openclaw gog';
const ACCOUNT = 'matthewdewstowe@gmail.com';

function logApplyToSheet(entry) {
  try {
    const row = [[
      entry.appliedAt.split('T')[0],
      entry.title,
      entry.company,
      '', // location
      '', // salary
      entry.source,
      '', // score
      '', // summary
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

const SEARCH_URLS = [
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=VP%20of%20Product&location=United%20Kingdom&f_E=4,5,6',
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=Director%20of%20Product&location=United%20Kingdom&f_E=4,5,6',
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=Head%20of%20Product&location=United%20Kingdom&f_E=4,5,6',
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=Chief%20Product%20Officer&location=United%20Kingdom',
  'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=Fractional%20CPO&location=United%20Kingdom',
];

const SKIP_TITLES = ['product manager', 'senior product manager', 'junior', 'associate', 'electrical', 'hardware'];
const TARGET_TITLES = ['head of product', 'director of product', 'vp of product', 'vp product', 'chief product', 'cpo', 'fractional', 'interim', 'principal product', 'product director', 'product strategy', 'group product'];

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

async function fillTextField(page, label, value) {
  try {
    const field = page.locator(`input[aria-label*="${label}" i], input[id*="${label.toLowerCase().replace(/\s+/g,'-')}" i], textarea[aria-label*="${label}" i]`).first();
    if (await field.isVisible({ timeout: 2000 })) {
      await field.fill(value);
      return true;
    }
  } catch(e) {}
  return false;
}

async function handleApplicationModal(page, jobTitle, company) {
  console.log(`  → Filling application for: ${jobTitle} @ ${company}`);
  
  try {
    // Wait for modal
    await page.waitForSelector('.jobs-easy-apply-modal, [data-test-modal]', { timeout: 10000 });
  } catch(e) {
    console.log('  ✗ Modal did not appear');
    return false;
  }

  let stepCount = 0;
  const maxSteps = 10;

  while (stepCount < maxSteps) {
    stepCount++;
    await page.waitForTimeout(1000);

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
    const radioYes = page.locator('input[type="radio"]').filter({ hasText: /yes/i }).first();
    if (await radioYes.isVisible({ timeout: 500 }).catch(() => false)) {
      await radioYes.click().catch(() => {});
    }

    // Handle "Are you legally authorized to work" type questions
    const authLabels = page.locator('label').filter({ hasText: /authorized|authorised|eligible|right to work/i });
    const authCount = await authLabels.count();
    if (authCount > 0) {
      // Try to click "Yes" radio near it
      const yesRadio = page.locator('input[type="radio"][value="Yes"], input[type="radio"][value="yes"]').first();
      await yesRadio.click().catch(() => {});
    }

    // Handle salary/compensation text inputs
    const salaryField = page.locator('input[aria-label*="salary" i], input[aria-label*="compensation" i], input[aria-label*="expected" i]').first();
    if (await salaryField.isVisible({ timeout: 500 }).catch(() => false)) {
      await salaryField.fill('150000').catch(() => {});
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
          if (secondOpt) await sel.selectOption(secondOpt).catch(() => {});
        }
      }
    }

    // Handle "years of experience" numeric fields
    const expFields = page.locator('input[type="number"], input[aria-label*="year" i], input[aria-label*="experience" i]').all();
    for (const field of await expFields) {
      const label = await field.getAttribute('aria-label') || '';
      if (label.toLowerCase().includes('year') || label.toLowerCase().includes('experience')) {
        const val = await field.inputValue();
        if (!val) await field.fill('10').catch(() => {});
      }
    }

    // Look for Next / Submit / Review button
    const nextBtn = page.locator('button[aria-label*="Continue to next step" i], button[aria-label*="Next" i]').first();
    const reviewBtn = page.locator('button[aria-label*="Review your application" i]').first();
    const submitBtn = page.locator('button[aria-label*="Submit application" i]').first();

    if (await submitBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('  → Submitting...');
      await submitBtn.click();
      await page.waitForTimeout(2000);
      return true;
    } else if (await reviewBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('  → Reviewing...');
      await reviewBtn.click();
    } else if (await nextBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log(`  → Step ${stepCount}: Next`);
      await nextBtn.click();
    } else {
      // Try generic "Continue" / "Next" buttons
      const genericBtn = page.locator('button').filter({ hasText: /^(Next|Continue|Review|Submit)$/i }).first();
      if (await genericBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        const btnText = await genericBtn.innerText();
        console.log(`  → Step ${stepCount}: ${btnText}`);
        await genericBtn.click();
      } else {
        console.log(`  ✗ No navigation button found at step ${stepCount}`);
        // Close modal and skip
        const closeBtn = page.locator('button[aria-label*="Dismiss" i], button[aria-label*="Close" i]').first();
        await closeBtn.click().catch(() => {});
        return false;
      }
    }
  }
  
  console.log('  ✗ Max steps reached');
  return false;
}

async function processJobList(page) {
  const results = { applied: 0, skipped: 0, errors: 0, alreadyApplied: 0 };
  
  // Get all job cards
  const jobCards = await page.locator('.job-card-container, .jobs-search-results__list-item').all();
  console.log(`Found ${jobCards.length} job cards`);

  for (let i = 0; i < jobCards.length; i++) {
    const card = jobCards[i];
    
    // Get job title and ID
    const titleEl = card.locator('.job-card-list__title, .job-card-container__link').first();
    const title = await titleEl.innerText().catch(() => '').then(t => t.trim());
    
    // Get job ID from link
    const link = await card.locator('a').first().getAttribute('href').catch(() => '');
    const jobIdMatch = link?.match(/\/jobs\/view\/(\d+)/);
    const jobId = jobIdMatch?.[1] || `unknown-${i}`;
    
    // Get company
    const company = await card.locator('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle').first().innerText().catch(() => 'Unknown');

    console.log(`\n[${i+1}/${jobCards.length}] ${title} @ ${company} (${jobId})`);

    if (!title) { results.skipped++; continue; }
    if (!shouldApply(title)) { console.log(`  → Skipped (title filter)`); results.skipped++; continue; }
    if (appliedIds.has(jobId)) { console.log(`  → Already applied`); results.alreadyApplied++; continue; }

    // Check if already applied badge
    const appliedBadge = await card.locator('.artdeco-inline-feedback--success, [data-test-job-card-applied]').isVisible({ timeout: 500 }).catch(() => false);
    if (appliedBadge) { console.log(`  → Already applied (badge)`); results.alreadyApplied++; continue; }

    // Click the card to load it in the right panel — use JS click to bypass nav overlay
    await card.evaluate(el => el.click()).catch(() => {});
    await page.waitForTimeout(2500);

    // Check for Easy Apply button in right panel
    const easyApplyBtn = page.locator('button[aria-label*="Easy Apply" i]').first();
    if (!await easyApplyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  → No Easy Apply button (external apply or already applied)');
      results.skipped++;
      continue;
    }

    // Click Easy Apply — scroll into view first to avoid nav interception
    await easyApplyBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    await easyApplyBtn.click({ force: true }).catch(() => easyApplyBtn.click());
    await page.waitForTimeout(1500);

    const success = await handleApplicationModal(page, title, company);
    
    const entry = {
      jobId,
      title: title.split('\n')[0].trim(), // clean up any duplicate lines
      company: company.split('\n')[0].trim(),
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      source: 'LinkedIn',
      appliedAt: new Date().toISOString(),
      status: success ? 'Applied' : 'Failed',
      notes: success ? '' : 'Easy Apply failed — manual review needed',
    };
    log.push(entry);
    appliedIds.add(jobId);
    saveLog();

    if (success) {
      results.applied++;
      console.log(`  ✓ Applied to: ${title} @ ${company}`);
      logApplyToSheet(entry);
    } else {
      results.errors++;
      console.log(`  ✗ Failed: ${title} @ ${company}`);
    }

    await page.waitForTimeout(2000);
  }

  return results;
}

async function main() {
  console.log('=== LinkedIn Easy Apply Agent ===');
  console.log(`Connecting to Chrome at ${CDP_URL}...`);

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch(e) {
    console.error('Failed to connect to Chrome:', e.message);
    console.log('Make sure Chrome is running with --remote-debugging-port=9222');
    process.exit(1);
  }

  console.log('Connected!');

  // Get existing LinkedIn tab or create new one
  const contexts = browser.contexts();
  let context = contexts[0];
  const pages = context.pages();
  
  let page = pages.find(p => p.url().includes('linkedin.com')) || pages[0];
  if (!page) {
    page = await context.newPage();
  }
  
  console.log(`Using tab: ${page.url()}`);

  const totalResults = { applied: 0, skipped: 0, errors: 0, alreadyApplied: 0 };

  for (const searchUrl of SEARCH_URLS) {
    console.log(`\n=== Searching: ${searchUrl.split('keywords=')[1]?.split('&')[0]} ===`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => console.log('Navigation warning:', e.message));
    await page.waitForTimeout(3000);

    // Process multiple pages
    let pageNum = 1;
    while (pageNum <= 5) {
      console.log(`\n-- Page ${pageNum} --`);
      const results = await processJobList(page);
      
      totalResults.applied += results.applied;
      totalResults.skipped += results.skipped;
      totalResults.errors += results.errors;
      totalResults.alreadyApplied += results.alreadyApplied;

      // Try to go to next page — use JS click to bypass nav overlay
      const nextBtn = page.locator('button[aria-label="View next page"]').first();
      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.evaluate(el => el.click()).catch(() => {});
        await page.waitForTimeout(3000);
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
  console.log(`Log saved to:    ${LOG_FILE}`);

  // Don't disconnect - just detach to leave Chrome running
  await browser.close().catch(() => {});
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
