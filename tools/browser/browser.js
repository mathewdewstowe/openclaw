const { chromium } = require('playwright');

async function connect() {
const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0] || await context.newPage();
console.log('✅ Connected to Chrome:', await page.title());
return { browser, page };
}

async function goTo(url) {
const { page } = await connect();
await page.goto(url);
console.log('📄 Loaded:', url);
return page;
}

module.exports = { connect, goTo };

connect().catch(console.error);
