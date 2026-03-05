const { chromium } = require('playwright');

const CDP_URL = 'http://localhost:9222';

async function connect() {
  try {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    return { browser, page };
  } catch (e) {
    throw new Error(`❌ Could not connect to Chrome. Make sure Chrome is running with:\nchrome.exe --remote-debugging-port=9222 --profile-directory=Default\n\nError: ${e.message}`);
  }
}

async function isLoggedIn(page) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  const url = page.url();
  return !url.includes('/login') && !url.includes('/checkpoint');
}

async function searchPeople({ keywords, title, company, location, limit = 10 }) {
  const { page } = await connect();

  const loggedIn = await isLoggedIn(page);
  if (!loggedIn) {
    throw new Error('❌ Not logged into LinkedIn. Please log in manually in Chrome first.');
  }

  console.log('✅ Logged into LinkedIn');

  // Build search URL
  const params = new URLSearchParams();
  params.set('keywords', keywords || '');
  if (title) params.set('title', title);
  if (company) params.set('company', company);
  if (location) params.set('geoUrn', location);
  params.set('origin', 'FACETED_SEARCH');

  const searchUrl = `https://www.linkedin.com/search/results/people/?${params.toString()}`;
  console.log('🔍 Searching:', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Scrape results
  const results = await page.evaluate((maxResults) => {
    const cards = document.querySelectorAll('.reusable-search__result-container');
    const people = [];
    cards.forEach((card, i) => {
      if (i >= maxResults) return;
      const name = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]')?.innerText?.trim();
      const headline = card.querySelector('.entity-result__primary-subtitle')?.innerText?.trim();
      const location = card.querySelector('.entity-result__secondary-subtitle')?.innerText?.trim();
      const profileUrl = card.querySelector('.app-aware-link')?.href;
      if (name) people.push({ name, headline, location, profileUrl });
    });
    return people;
  }, limit);

  console.log(`\n📋 Found ${results.length} results:\n`);
  results.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   ${p.headline || 'No headline'}`);
    console.log(`   ${p.location || 'No location'}`);
    console.log(`   ${p.profileUrl || 'No URL'}\n`);
  });

  return results;
}

async function searchCompanies({ keywords, limit = 10 }) {
  const { page } = await connect();

  const loggedIn = await isLoggedIn(page);
  if (!loggedIn) throw new Error('❌ Not logged into LinkedIn.');

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
      const name = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]')?.innerText?.trim();
      const industry = card.querySelector('.entity-result__primary-subtitle')?.innerText?.trim();
      const followers = card.querySelector('.entity-result__secondary-subtitle')?.innerText?.trim();
      const url = card.querySelector('.app-aware-link')?.href;
      if (name) companies.push({ name, industry, followers, url });
    });
    return companies;
  }, limit);

  console.log(`\n🏢 Found ${results.length} companies:\n`);
  results.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`);
    console.log(`   ${c.industry || ''}`);
    console.log(`   ${c.followers || ''}`);
    console.log(`   ${c.url || ''}\n`);
  });

  return results;
}

// CLI usage
const args = process.argv.slice(2);
const command = args[0];

if (command === 'search-people') {
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
  console.log('  node linkedin.js search-people "keywords" "title" "company" limit');
  console.log('  node linkedin.js search-companies "keywords" limit');
  console.log('\nExamples:');
  console.log('  node linkedin.js search-people "conversational AI" "VP Customer Experience" "" 10');
  console.log('  node linkedin.js search-companies "contact centre AI" 10');
}

module.exports = { searchPeople, searchCompanies };
