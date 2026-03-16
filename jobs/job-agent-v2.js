#!/usr/bin/env node
/**
 * Job Agent v2 — Full Email Processor
 * Sources: CV-Library, LinkedIn alerts, Indeed alerts
 * Outputs: Google Sheet + latest-results.json
 */

const { execSync } = require('child_process');
const fs = require('fs');

const GOG = 'GOG_KEYRING_PASSWORD=openclaw gog';
const ACCOUNT = 'matthewdewstowe@gmail.com';
const SHEET_ID = '1Hv3Iccnhh81DbiJVHmHohwzg4CNDmEYbda8cwSnfpow';

function gog(cmd) {
  try {
    const out = execSync(`${GOG} ${cmd} --account ${ACCOUNT} --json --no-input 2>/dev/null`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(out);
  } catch (e) { return null; }
}

function gogRaw(cmd) {
  try {
    return execSync(`${GOG} ${cmd} --account ${ACCOUNT} 2>/dev/null`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch (e) { return ''; }
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function scoreJob(title, description, salary, location, company) {
  const t = `${title} ${description} ${company}`.toLowerCase();
  const s = `${salary}`.toLowerCase();
  const l = `${location}`.toLowerCase();
  let score = 1;

  const seniorTitles = ['head of product', 'director of product', 'vp of product', 'chief product',
    'cpo', 'fractional', 'principal product', 'product director', 'product strategy lead',
    'product strategy', 'head of ai', 'ai strategy', 'vp product', 'interim cpo'];
  if (seniorTitles.some(k => t.includes(k))) score += 2;
  else if (t.includes('senior product') || t.includes('senior director') || t.includes('group product')) score += 1;

  if (t.includes('ai') || t.includes('agentic') || t.includes('machine learning') || t.includes('saas') || t.includes('platform')) score += 1;
  if (t.includes('private equity') || t.includes('pe-backed') || t.includes('venture') || t.includes('series') || t.includes('backed')) score += 1;
  if (t.includes('contract') || t.includes('interim') || t.includes('fractional') || t.includes('day rate') || s.includes('/day')) score = Math.min(5, score + 1);

  const salaryNums = (salary || '').match(/[\d,]+/g);
  if (salaryNums) {
    const max = Math.max(...salaryNums.map(n => parseInt(n.replace(/,/g, ''))));
    if (max >= 150000 || (s.includes('/day') && max >= 600)) score = Math.min(5, score + 1);
  }

  if (l.includes('remote') || l.includes('hybrid')) score = Math.min(5, score + 0.5);
  if (t.includes('talent') || t.includes('recruitment') || t.includes('hr tech')) score = Math.min(5, score + 0.5);

  return Math.min(5, Math.max(1, Math.round(score)));
}

function isSkipped(title) {
  const t = title.toLowerCase();
  const allowed = [
    'head of product', 'director of product', 'product director', 'vp of product', 'vp product',
    'vice president of product', 'chief product', 'cpo', 'fractional', 'interim cpo',
    'principal product', 'product strategy', 'group product', 'head of ai',
    'director of ai', 'head of innovation', 'head of engineering', 'head of technology',
    'chief technology', 'cto', 'product lead', 'head of digital', 'director of digital',
    'managing director', 'strategy consultant', 'vp of ai', 'director of engineering',
    'head of product development', 'head of product management', 'head of product & technology',
    'head of product and technology', 'director of product management'
  ];
  if (!allowed.some(a => t.includes(a))) return true;
  const dealbreakers = ['junior', 'electrical', 'hardware', 'field sales', 'atex', 'automotive', 'ecommerce', 'e-commerce'];
  return dealbreakers.some(d => t.includes(d));
}

// ── Parsers ───────────────────────────────────────────────────────────────────

// CV-Library: "    Title in Location URL\n    Salary: ...\n    Description: ..."
function parseCVLibrary(body) {
  const jobs = [];
  const blocks = body.split(/[-]{20,}/);

  for (const block of blocks) {
    // Title + location on one line: "    Head of Product in London https://..."
    const titleLineMatch = block.match(/^\s{2,}([A-Z][^\n]{3,80}?)\s+in\s+([A-Za-z][^\n]+?)\s+(https:\/\/www\.cv-library\.co\.uk\/job\/\d+\/[^\s?]+)/m);
    if (!titleLineMatch) continue;

    const title = titleLineMatch[1].trim();
    const location = titleLineMatch[2].trim();
    // Use the job view URL (not the /apply URL)
    const url = titleLineMatch[3].split('?')[0];
    // Extract job ID from URL for dedup
    const idMatch = url.match(/\/job\/(\d+)\//);
    const jobId = idMatch ? idMatch[1] : null;

    const salaryMatch = block.match(/Salary:\s*([^\n]+)/);
    const descMatch = block.match(/Description:\s*([^\n]{10,})/);

    jobs.push({
      jobId,
      title,
      company: '',
      location,
      salary: salaryMatch ? salaryMatch[1].trim() : '',
      summary: descMatch ? descMatch[1].trim().replace(/\.\s*\.\s*/g, ' ') : '',
      url,
      source: 'CV-Library',
    });
  }
  return jobs;
}

// LinkedIn "You may be a fit / X is hiring" emails
// Format: Title\nCompany\nLocation\n\nView job: https://www.linkedin.com/comm/jobs/view/JOBID/
function parseLinkedInEmail(body) {
  const jobs = [];
  const blocks = body.split(/-{10,}|\n\n\n/);

  for (const block of blocks) {
    // Extract job ID from comm/jobs/view URL
    const viewMatch = block.match(/View job:\s*(https:\/\/www\.linkedin\.com\/comm\/jobs\/view\/(\d+)\/[^\s]*)/);
    if (!viewMatch) continue;

    const jobId = viewMatch[2];
    const url = `https://www.linkedin.com/jobs/view/${jobId}`;

    // Lines before "View job:" contain title, company, location
    const preView = block.substring(0, block.indexOf('View job:')).trim();
    const lines = preView.split('\n').map(l => l.trim()).filter(Boolean)
      .filter(l => !l.startsWith('Apply') && !l.startsWith('This company') && !l.startsWith('Fast') && !l.startsWith('connections'));

    if (lines.length < 1) continue;
    const title = lines[0];
    const company = lines[1] || '';
    const location = lines[2] || '';

    jobs.push({ jobId, title, company, location, salary: '', summary: '', url, source: 'LinkedIn' });
  }
  return jobs;
}

// Indeed alert emails
// Format: Title\nCompany - Location\n[Salary]\nDescription snippet\nURL
function parseIndeed(body) {
  const jobs = [];
  const lines = body.split('\n').map(l => l.trim());

  for (let i = 0; i < lines.length - 2; i++) {
    const line = lines[i];
    // Job title: starts with capital, not too short, not a URL, not metadata
    if (!line.match(/^[A-Z][a-zA-Z\s&()'-]{5,70}$/) || line.startsWith('http') || line.includes('@')) continue;
    // Next line: "Company - Location" or "Company\nLocation"
    const nextLine = lines[i + 1] || '';
    const compLocMatch = nextLine.match(/^([^-\n]+?)\s+-\s+(.+)$/);
    if (!compLocMatch) continue;

    const title = line.trim();
    const company = compLocMatch[1].trim();
    const location = compLocMatch[2].trim();

    // Skip non-jobs
    if (title.includes('See all') || title.includes('Indeed') || title.includes('unsubscribe')) continue;

    // Salary on next line (optional)
    let salary = '';
    let urlLineIdx = i + 2;
    const maybeSalary = lines[i + 2] || '';
    if (maybeSalary.match(/[£$€]|\/year|\/hour|per annum|a year/i)) {
      salary = maybeSalary.replace(/\s+a year|\s+\/year/i, '/yr').trim();
      urlLineIdx = i + 3;
    }

    // Description (next non-URL line)
    let summary = '';
    let urlLine = '';
    for (let j = urlLineIdx; j < Math.min(i + 8, lines.length); j++) {
      if (lines[j].startsWith('http')) { urlLine = lines[j]; break; }
      if (lines[j] && !lines[j].match(/^(Just posted|Easily apply|\d+ day|New$)/i) && lines[j].length > 20) {
        summary = lines[j];
      }
    }

    // Extract job key from Indeed URL for dedup
    const jkMatch = urlLine.match(/[?&]jk[=s]([a-f0-9]+)/);
    const jobId = jkMatch ? `indeed_${jkMatch[1]}` : null;

    if (!urlLine) continue; // skip if no URL found

    jobs.push({ jobId, title, company, location, salary, summary, url: urlLine, source: 'Indeed' });
  }
  return jobs;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Job Agent v2 Starting ===');

  const labelsData = gog('gmail labels list');
  const labels = labelsData?.labels || [];
  const appliedLabel = labels.find(l => l.name === 'Job Alerts/Applied');
  const alertsLabel = labels.find(l => l.name === 'Job Alerts/Alerts');
  const rootLabel = labels.find(l => l.name === 'Job Alerts');
  console.log(`Labels — Applied: ${appliedLabel?.id}, Alerts: ${alertsLabel?.id}, Root: ${rootLabel?.id}`);

  const emailsData = gog(`gmail messages search "label:Job-Alerts OR label:Job-Alerts-Alerts" --max 50`);
  const emails = emailsData?.messages || [];
  console.log(`Found ${emails.length} emails to process`);

  const today = new Date().toISOString().split('T')[0];
  const allJobs = [];
  const processedEmailIds = [];

  for (const email of emails) {
    const body = gogRaw(`gmail get ${email.id}`);
    if (!body) continue;
    processedEmailIds.push(email.id);

    const from = (body.match(/^from\s+(.+)$/mi)?.[1] || '').toLowerCase();
    const subject = email.subject || '';

    let jobs = [];

    if (from.includes('cv-library')) {
      jobs = parseCVLibrary(body);
    } else if (from.includes('linkedin') || from.includes('jobs-listings')) {
      jobs = parseLinkedInEmail(body);
    } else if (from.includes('indeed') || from.includes('alert@indeed')) {
      jobs = parseIndeed(body);
    } else {
      // Try all parsers, take the one that returns most results
      const a = parseCVLibrary(body);
      const b = parseLinkedInEmail(body);
      const c = parseIndeed(body);
      jobs = [a, b, c].sort((x, y) => y.length - x.length)[0];
    }

    console.log(`  [${from.split('@')[0]?.slice(-15)}] "${subject.slice(0, 50)}" → ${jobs.length} jobs`);
    for (const j of jobs) {
      j.emailId = email.id;
      j.emailDate = email.date ? email.date.split(',').slice(-1)[0].trim().split(' ').slice(0, 3).join(' ') : '';
    }
    allJobs.push(...jobs);
  }

  console.log(`\nTotal parsed: ${allJobs.length}`);

  // Deduplicate by URL/jobId
  const seen = new Set();
  const unique = [];
  for (const job of allJobs) {
    const key = job.jobId || job.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(job);
  }
  console.log(`After dedup: ${unique.length}`);

  // Filter and score
  const filtered = unique
    .filter(j => j.title && j.title.length > 3)
    .filter(j => !j.title.toLowerCase().includes('matthew') && !j.title.toLowerCase().includes('email'))
    .filter(j => !isSkipped(j.title))
    .map(j => ({ ...j, score: scoreJob(j.title, j.summary, j.salary, j.location, j.company) }))
    .sort((a, b) => b.score - a.score);

  console.log(`After filter: ${filtered.length} jobs`);

  // Write to Google Sheet
  if (filtered.length > 0) {
    // Set header
    execSync(`${GOG} sheets update "${SHEET_ID}" "Sheet1!A1:K1" --values-json '[["Date","Job Title","Company","Location","Salary","Source","Score","Summary","URL","Status","LinkedIn Job ID"]]' --input USER_ENTERED --account ${ACCOUNT} 2>/dev/null`, { encoding: 'utf8' });

    // Preserve Applied/Interview rows before clearing
    let preservedRows = [];
    try {
      const existing = execSync(`${GOG} sheets get "${SHEET_ID}" "Sheet1!A2:K1000" --account ${ACCOUNT} 2>/dev/null`, { encoding: 'utf8' });
      // Parse TSV output — preserve rows where col J (index 9) is Applied or Interview
      const lines = existing.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const cols = line.split('\t');
        const status = (cols[9] || '').trim();
        if (status === 'Applied' || status === 'Interview') {
          preservedRows.push(cols.map(c => c.trim()));
        }
      }
      console.log(`Preserving ${preservedRows.length} Applied/Interview rows`);
    } catch(e) {}

    // Clear old rows
    execSync(`${GOG} sheets clear "${SHEET_ID}" "Sheet1!A2:K1000" --account ${ACCOUNT} 2>/dev/null`, { encoding: 'utf8' });

    const rows = filtered.map(j => [
      today,
      j.title || '',
      j.company || '',
      j.location || '',
      j.salary || '',
      j.source || '',
      j.score || 1,
      (j.summary || '').substring(0, 200).replace(/[\r\n]+/g, ' '),
      j.url || '',
      'New',
      j.jobId || ''
    ]);

    for (let i = 0; i < rows.length; i += 40) {
      const batch = rows.slice(i, i + 40);
      const tmpFile = `/tmp/job-batch-${i}.json`;
      fs.writeFileSync(tmpFile, JSON.stringify(batch));
      try {
        execSync(`${GOG} sheets append "${SHEET_ID}" "Sheet1!A:K" --values-json "$(cat ${tmpFile})" --insert INSERT_ROWS --account ${ACCOUNT} 2>/dev/null`, { encoding: 'utf8', shell: '/bin/bash' });
      } catch(e) {
        console.log(`  Batch ${i} error: ${e.message?.slice(0,100)}`);
      }
    }
    console.log(`Logged ${filtered.length} jobs to Google Sheet`);

    // Re-append preserved Applied/Interview rows
    if (preservedRows.length > 0) {
      const tmpPreserved = '/tmp/job-preserved.json';
      fs.writeFileSync(tmpPreserved, JSON.stringify(preservedRows));
      try {
        execSync(`${GOG} sheets append "${SHEET_ID}" "Sheet1!A:K" --values-json "$(cat ${tmpPreserved})" --insert INSERT_ROWS --account ${ACCOUNT} 2>/dev/null`, { encoding: 'utf8', shell: '/bin/bash' });
        console.log(`Re-appended ${preservedRows.length} Applied/Interview rows`);
      } catch(e) {
        console.log(`Error re-appending preserved rows: ${e.message?.slice(0,100)}`);
      }
    }
  }

  // Move processed emails to Applied label
  if (appliedLabel && processedEmailIds.length > 0) {
    const removeLabels = [alertsLabel?.id, rootLabel?.id].filter(Boolean);
    let moved = 0;
    for (const emailId of processedEmailIds) {
      try {
        const token = execSync(`${GOG} auth token ${ACCOUNT} 2>/dev/null`, { encoding: 'utf8' }).trim();
        const payload = JSON.stringify({ addLabelIds: [appliedLabel.id], removeLabelIds: removeLabels });
        execSync(`curl -s -X POST "https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '${payload}' 2>/dev/null`, { encoding: 'utf8' });
        moved++;
      } catch(e) {}
    }
    console.log(`Moved ${moved} emails to Job Alerts/Applied`);
  }

  // Save results
  const results = {
    processedAt: new Date().toISOString(),
    emailsProcessed: processedEmailIds.length,
    totalParsed: allJobs.length,
    afterDedup: unique.length,
    afterFilter: filtered.length,
    top: filtered.slice(0, 25)
  };
  fs.writeFileSync('/home/matthewdewstowe/.openclaw/workspace/jobs/latest-results.json', JSON.stringify(results, null, 2));

  console.log('\n=== Top Matches ===');
  filtered.slice(0, 15).forEach((j, i) => {
    console.log(`${i+1}. [${j.score}/5] ${j.title} @ ${j.company || '?'} | ${j.salary || 'Salary TBC'} | ${j.source} | ${j.url ? j.url.slice(0,60) : 'no URL'}`);
  });

  console.log(`\nSheet: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
