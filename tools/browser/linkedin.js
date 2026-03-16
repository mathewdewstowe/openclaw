const { chromium } = require('playwright');
const { execSync } = require('child_process');

/**
 * Resolve the Windows host IP from WSL2.
 * WSL2 sits behind a NAT — localhost:9222 points to WSL itself, not Windows.
 * The Windows host is always the default gateway (e.g. 172.21.0.1).
 */
function getWindowsHostIP() {
  try {
    const result = execSync("ip route show default | awk '{print $3}' | head -1", { encoding: 'utf8' });
    return result.trim();
  } catch (e) {
    return '172.21.0.1'; // fallback
  }
}

function getCDPUrl() {
  const hostIP = getWindowsHostIP();
  return `http://${hostIP}:9223`;
}

async function connect() {
  const cdpUrl = getCDPUrl();
  try {
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    console.log(`✅ Connected to Chrome at ${cdpUrl}`);
    return { browser, page };
  } catch (e) {
    throw new Error(
      `❌ Could not connect to Chrome at ${cdpUrl}\n\n` +
      `Make sure Chrome is running in debug mode:\n` +
      `→ Double-click "Chrome Debug Mode.bat" on your Desktop\n\n` +
      `Then verify it's working: http://${getWindowsHostIP()}:9222/json\n\n` +
      `Error: ${e.message}`
    );
  }
}

async function isLoggedIn(page) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  const url = page.url();
  return !url.includes('/login') && !url.includes('/checkpoint');
}

async function checkSession() {
  const { browser, page } = await connect();
  const loggedIn = await isLoggedIn(page);
  if (loggedIn) {
    console.log('✅ LinkedIn session valid — logged in');
  } else {
    console.log('❌ Not logged into LinkedIn in Chrome');
    console.log('   Open Chrome, go to linkedin.com, and log in manually.');
  }
  await browser.close();
  return loggedIn;
}

async function getProfile(profileUrl) {
  const { browser, page } = await connect();

  if (!await isLoggedIn(page)) {
    throw new Error('❌ Not logged into LinkedIn. Log in via Chrome first.');
  }

  console.log(`Loading profile: ${profileUrl}`);
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  const result = await page.evaluate(() => {
    const text = (sel) => document.querySelector(sel)?.innerText?.trim() || null;
    return {
      name: text('h1'),
      headline: text('.text-body-medium.break-words'),
      location: text('.text-body-small.inline.t-black--light.break-words'),
      about: text('#about ~ div .full-width') || text('.pv-shared-text-with-see-more span'),
      url: window.location.href,
    };
  });

  // Experience
  try {
    result.experience = await page.evaluate(() => {
      const items = document.querySelectorAll('#experience ~ div .pvs-list__item--line-separated');
      return Array.from(items).slice(0, 5).map(item => item.innerText.trim().split('\n').slice(0,3).join(' | '));
    });
  } catch(e) { result.experience = []; }

  result.scraped_at = new Date().toISOString();
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  return result;
}

async function searchPeople({ keywords, title, company, location, limit = 10 }) {
  const { browser, page } = await connect();

  if (!await isLoggedIn(page)) {
    throw new Error('❌ Not logged into LinkedIn.');
  }

  console.log('✅ Logged into LinkedIn');

  const params = new URLSearchParams();
  if (keywords) params.set('keywords', keywords);
  if (title)    params.set('title', title);
  if (company)  params.set('company', company);
  params.set('origin', 'FACETED_SEARCH');

  const searchUrl = `https://www.linkedin.com/search/results/people/?${params.toString()}`;
  console.log('🔍 Searching:', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  const results = await page.evaluate((maxResults) => {
    const cards = document.querySelectorAll('.reusable-search__result-container');
    const people = [];
    cards.forEach((card, i) => {
      if (i >= maxResults) return;
      const name     = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]')?.innerText?.trim();
      const headline = card.querySelector('.entity-result__primary-subtitle')?.innerText?.trim();
      const loc      = card.querySelector('.entity-result__secondary-subtitle')?.innerText?.trim();
      const url      = card.querySelector('.app-aware-link')?.href;
      if (name) people.push({ name, headline, location: loc, profileUrl: url });
    });
    return people;
  }, limit);

  console.log(`\n📋 Found ${results.length} results:\n`);
  results.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    if (p.headline) console.log(`   ${p.headline}`);
    if (p.location) console.log(`   📍 ${p.location}`);
    if (p.profileUrl) console.log(`   ${p.profileUrl}`);
    console.log();
  });

  await browser.close();
  return results;
}

async function searchCompanies({ keywords, limit = 10 }) {
  const { browser, page } = await connect();

  if (!await isLoggedIn(page)) throw new Error('❌ Not logged into LinkedIn.');

  const params = new URLSearchParams();
  params.set('keywords', keywords || '');
  params.set('origin', 'FACETED_SEARCH');

  const searchUrl = `https://www.linkedin.com/search/results/companies/?${params.toString()}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  const results = await page.evaluate((maxResults) => {
    const cards = document.querySelectorAll('.reusable-search__result-container');
    const companies = [];
    cards.forEach((card, i) => {
      if (i >= maxResults) return;
      const name      = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]')?.innerText?.trim();
      const industry  = card.querySelector('.entity-result__primary-subtitle')?.innerText?.trim();
      const followers = card.querySelector('.entity-result__secondary-subtitle')?.innerText?.trim();
      const url       = card.querySelector('.app-aware-link')?.href;
      if (name) companies.push({ name, industry, followers, url });
    });
    return companies;
  }, limit);

  console.log(`\n🏢 Found ${results.length} companies:\n`);
  results.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`);
    if (c.industry)  console.log(`   ${c.industry}`);
    if (c.followers) console.log(`   ${c.followers}`);
    if (c.url)       console.log(`   ${c.url}`);
    console.log();
  });

  await browser.close();
  return results;
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === 'check') {
  checkSession().catch(console.error);
} else if (command === 'profile') {
  getProfile(args[1]).catch(console.error);
} else if (command === 'search-people') {
  searchPeople({
    keywords: args[1] || '',
    title: args[2] || '',
    company: args[3] || '',
    limit: parseInt(args[4]) || 10
  }).catch(console.error);
} else if (command === 'search-companies') {
  searchCompanies({
    keywords: args[1] || '',
    limit: parseInt(args[2]) || 10
  }).catch(console.error);
} else {
  console.log('Usage:');
  console.log('  node linkedin.js check');
  console.log('  node linkedin.js profile "https://www.linkedin.com/in/username"');
  console.log('  node linkedin.js search-people "keywords" "title" "company" limit');
  console.log('  node linkedin.js search-companies "keywords" limit');
  console.log('\nExamples:');
  console.log('  node linkedin.js search-people "conversational AI" "VP Customer Experience" "" 10');
  console.log('  node linkedin.js search-companies "contact centre AI" 10');
  console.log('  node linkedin.js profile "https://www.linkedin.com/in/satya-nadella"');
}

module.exports = { connect, checkSession, getProfile, searchPeople, searchCompanies };
