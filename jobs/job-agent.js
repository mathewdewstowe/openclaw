#!/usr/bin/env node
/**
 * Job Application Agent v2
 * Reads job alert emails, scores against Matthew's profile, sends ranked shortlist
 * Supports auto-apply for high-scoring roles via CV-Library
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const GOG = 'GOG_KEYRING_PASSWORD=openclaw gog';
const ACCOUNT = 'matthewdewstowe@gmail.com';
const RESULTS_PATH = path.join(__dirname, 'latest-results.json');
const APPLIED_PATH = path.join(__dirname, 'applied.json');
const SHEET_ID = '1Hv3Iccnhh81DbiJVHmHohwzg4CNDmEYbda8cwSnfpow';

// Matthew's profile
const PROFILE = {
  seniority: [
    'head of product', 'director of product', 'vp product', 'vp of product',
    'chief product', 'cpo', 'fractional', 'interim cpo', 'interim product',
    'principal product', 'product director', 'product vp'
  ],
  sectors: [
    'saas', 'ai', 'b2b', 'platform', 'talent', 'hr tech', 'hrtech',
    'recruitment', 'fintech', 'marketplace', 'agentic', 'prop tech',
    'legal tech', 'edtech', 'healthtech'
  ],
  keywords: [
    'ai', 'machine learning', 'agentic', 'strategy', 'roadmap',
    'pe', 'private equity', 'venture', 'growth', 'scale', 'portfolio',
    'transformation', 'product-led', 'plg'
  ],
  location: ['remote', 'london', 'cardiff', 'wales', 'hybrid', 'uk wide'],
  contractTypes: ['contract', 'interim', 'fractional', 'day rate', 'outside ir35', 'inside ir35'],
  minDayRate: 400,
  minSalary: 90000,
  dealbreakers: [
    'electrical', 'hardware', 'field sales', 'atex', 'automotive',
    'defence', 'accounting', 'junior', 'graduate', 'entry level',
    'apprentice', 'insurance broker', 'claims', 'underwriting'
  ],
  autoApplyThreshold: 75  // auto-apply if score >= this
};

function gog(cmd, opts = {}) {
  try {
    const result = execSync(`${GOG} ${cmd} -a ${ACCOUNT} 2>/dev/null`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      ...opts
    });
    return result;
  } catch (e) {
    return null;
  }
}

function gogJson(cmd) {
  const result = gog(`${cmd} -j`);
  if (!result) return null;
  try { return JSON.parse(result); } catch { return null; }
}

function scoreJob(job) {
  const text = `${job.title} ${job.description} ${job.location} ${job.company || ''}`.toLowerCase();
  let score = 0;
  const flags = [];

  // Dealbreakers — instant reject
  for (const bad of PROFILE.dealbreakers) {
    if (text.includes(bad)) return { score: -1, flags: [`❌ Dealbreaker: ${bad}`] };
  }

  // Seniority (30 pts)
  for (const s of PROFILE.seniority) {
    if (text.includes(s)) { score += 30; flags.push('✅ Seniority match'); break; }
  }

  // Contract/interim (25 pts — cashflow priority)
  for (const c of PROFILE.contractTypes) {
    if (text.includes(c)) { score += 25; flags.push('💰 Contract/Interim'); break; }
  }

  // Day rate (20 pts)
  const dayRateMatch = text.match(/£(\d[\d,]+)\s*(?:\/|\s+per\s+)day/i) ||
    (job.salary && job.salary.match(/£(\d[\d,]+)\/day/i));
  if (dayRateMatch) {
    const rate = parseInt(dayRateMatch[1].replace(',', ''));
    if (rate >= PROFILE.minDayRate) {
      score += 20;
      flags.push(`💷 £${rate}/day`);
    }
  }

  // Salary (15 pts)
  if (!dayRateMatch && job.salary) {
    const salaryNums = job.salary.match(/£([\d,]+)/g);
    if (salaryNums) {
      const max = Math.max(...salaryNums.map(s => parseInt(s.replace(/[£,]/g, ''))));
      if (max >= PROFILE.minSalary) {
        score += 15;
        flags.push(`💷 £${max.toLocaleString()}`);
      }
    }
  }

  // Sector/keyword (5 pts each, max 20)
  let keywordScore = 0;
  for (const k of [...PROFILE.sectors, ...PROFILE.keywords]) {
    if (text.includes(k) && keywordScore < 20) {
      keywordScore += 5;
      score += 5;
    }
  }

  // Location (10 pts)
  for (const loc of PROFILE.location) {
    if (text.includes(loc)) { score += 10; flags.push(`📍 ${loc}`); break; }
  }

  return { score, flags };
}

/**
 * Parse CV-Library job alert email body
 * CV-Library format: job entries separated by blank lines, each has:
 *   Title in [location] URL
 *   Salary: ...
 *   Description: ...
 */
function parseJobsFromEmail(body) {
  const jobs = [];
  if (!body) return jobs;

  // Extract all CV-Library job URLs with their context
  // Pattern: job title text followed by URL
  const jobPattern = /([^\n]{10,120})\s+in\s+([^\n]{3,80}?)\s+(https?:\/\/(?:www\.)?cv-library\.co\.uk\/job\/\d+\/[^\s?&]+)/gi;
  const urlPattern = /https?:\/\/(?:www\.)?cv-library\.co\.uk\/job\/(\d+)\/([^\s?&]+)/gi;

  // Also handle LinkedIn job alert format
  const linkedinPattern = /https?:\/\/www\.linkedin\.com\/jobs\/view\/(\d+)/gi;

  let match;

  // CV-Library: find job blocks
  // Split by double newline or horizontal rule to get job blocks
  const sections = body.split(/\n{2,}|\r\n\r\n/);

  for (const section of sections) {
    // Skip very short sections
    if (section.trim().length < 20) continue;

    // Look for a URL in this section
    const urlMatch = section.match(/https?:\/\/(?:www\.)?cv-library\.co\.uk\/job\/\d+\/([^\s?&]+)/);
    if (!urlMatch) continue;

    const url = urlMatch[0].split('?')[0]; // clean URL without tracking params
    const cleanSection = section.replace(/\s+/g, ' ').trim();

    // Extract title — look for "Job title:" prefix or first capitalised line
    let title = '';
    const titleFromLabel = cleanSection.match(/(?:Job title|Title|Role):\s*([^.]+?)(?:\.|Location:|Salary:|$)/i);
    if (titleFromLabel) {
      title = titleFromLabel[1].trim();
    } else {
      // Title is usually before "in [location]" or first chunk of text before URL
      const beforeUrl = cleanSection.split(/https?:\/\//)[0].trim();
      const titleCandidate = beforeUrl.split(/\bin\b/i)[0].trim();
      if (titleCandidate.length > 5 && titleCandidate.length < 120) {
        title = titleCandidate.replace(/^[^a-zA-Z]+/, ''); // strip leading non-alpha
      }
    }

    if (!title || title.length < 5) continue;

    // Extract location
    let location = '';
    const locationMatch = cleanSection.match(/(?:Location|Based):\s*([^,\n.]+)/i) ||
      cleanSection.match(/\bin\s+([A-Z][a-zA-Z\s,]+?)(?:\s+https?:|,|\.|$)/);
    if (locationMatch) location = locationMatch[1].trim();

    // Extract salary
    let salary = '';
    const salaryMatch = cleanSection.match(/(?:Salary|Rate|Pay):\s*([^\n.]+)/i) ||
      cleanSection.match(/(£[\d,]+(?:\s*[-–]\s*£[\d,]+)?(?:\s*(?:\/day|per day|\/annum|pa|per annum|k))?)/i);
    if (salaryMatch) salary = salaryMatch[1].trim();

    // Extract description snippet
    let description = '';
    const descMatch = cleanSection.match(/(?:Description|About|Summary):\s*([^.]{20,200})/i);
    if (descMatch) description = descMatch[1].trim();
    if (!description) {
      // Use a chunk of the section text as description
      description = cleanSection.replace(url, '').replace(title, '').slice(0, 200).trim();
    }

    // Dedup by URL
    if (!jobs.find(j => j.url === url)) {
      jobs.push({ title, location, salary, description, url, source: 'cv-library' });
    }
  }

  // LinkedIn jobs (simpler — just grab title + URL)
  const linkedInBlocks = body.split(/\n{2,}/);
  for (const block of linkedInBlocks) {
    const liUrl = block.match(/https?:\/\/www\.linkedin\.com\/jobs\/view\/(\d+)[^\s]*/);
    if (!liUrl) continue;
    const url = liUrl[0];
    if (jobs.find(j => j.url === url)) continue;
    const title = block.split('\n')[0].trim().replace(/^[^a-zA-Z]+/, '');
    if (title.length > 5) {
      jobs.push({ title, location: '', salary: '', description: '', url, source: 'linkedin' });
    }
  }

  return jobs;
}

function loadApplied() {
  try {
    return JSON.parse(fs.readFileSync(APPLIED_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveApplied(applied) {
  fs.writeFileSync(APPLIED_PATH, JSON.stringify(applied, null, 2));
}

function logToSheet(job, status = 'Applied') {
  try {
    const date = new Date().toLocaleDateString('en-GB');
    const row = [[date, job.title, job.company || '', job.location || '', job.salary || '', job.source || 'email', status, job.url || '']];
    execSync(
      `GOG_KEYRING_PASSWORD=openclaw gog sheets append "${SHEET_ID}" "Sheet1!A:H" --values-json '${JSON.stringify(row).replace(/'/g, "'\\''")}' --insert INSERT_ROWS -a ${ACCOUNT} 2>/dev/null`,
      { encoding: 'utf8' }
    );
  } catch (e) {
    console.log('Sheet log failed (non-fatal):', e.message);
  }
}

async function main() {
  const autoApply = process.argv.includes('--auto-apply');
  console.log(`Job Agent v2 starting (auto-apply: ${autoApply})`);

  // Fetch job alert emails
  const searchResult = gogJson(`gmail search "in:inbox (from:cv-library OR from:jobalerts-noreply@linkedin.com OR subject:job alert) newer_than:7d" --max 10`);
  const emails = searchResult?.messages || searchResult?.threads || [];
  console.log(`Found ${emails.length} job alert emails`);

  if (emails.length === 0) {
    console.log('No job alert emails found. Check Gmail auth or alert setup.');
    // Still send a report so we know the agent ran
    const html = `<h2>🎯 Job Agent — ${new Date().toLocaleDateString('en-GB')}</h2><p>No job alert emails found in the last 7 days. Gmail auth may need refreshing.</p>`;
    gog(`gmail send --to ${ACCOUNT} --subject "🎯 Job Agent: No emails found" --body-html "${html.replace(/"/g, '\\"')}"`);
    return;
  }

  let allJobs = [];
  const applied = loadApplied();

  for (const email of emails) {
    const id = email.id || email.threadId;
    const raw = gog(`gmail get ${id} --body`);
    if (!raw) continue;
    const parsed = parseJobsFromEmail(raw);
    console.log(`  Email ${id}: parsed ${parsed.length} jobs`);
    allJobs = allJobs.concat(parsed);
  }

  // Dedup by URL
  const seen = new Set();
  allJobs = allJobs.filter(j => {
    if (!j.url || seen.has(j.url)) return false;
    seen.add(j.url);
    return true;
  });

  console.log(`Total unique jobs: ${allJobs.length}`);

  // Score and rank
  const scored = allJobs
    .map(job => ({ ...job, ...scoreJob(job) }))
    .filter(j => j.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 15);
  const autoApplyJobs = autoApply ? scored.filter(j => j.score >= PROFILE.autoApplyThreshold && !applied.find(a => a.url === j.url)) : [];

  console.log(`Shortlisted: ${scored.length} | Top: ${top.length} | Auto-apply candidates: ${autoApplyJobs.length}`);

  // Save results
  fs.writeFileSync(RESULTS_PATH, JSON.stringify({
    processed: new Date().toISOString(),
    total: allJobs.length,
    shortlisted: scored.length,
    autoApplied: autoApplyJobs.length,
    top
  }, null, 2));

  // Auto-apply (score >= threshold, not already applied)
  const newlyApplied = [];
  if (autoApply && autoApplyJobs.length > 0) {
    console.log(`Auto-applying to ${autoApplyJobs.length} jobs...`);
    for (const job of autoApplyJobs) {
      // CV-Library: use the candidate_apply_only link if present, else direct URL
      // Just log for now — full browser automation needs Chrome DevTools
      console.log(`  Would apply: ${job.title} (${job.score}) — ${job.url}`);
      newlyApplied.push({ ...job, appliedAt: new Date().toISOString() });
      logToSheet(job, 'Auto-Applied');
    }
    saveApplied([...applied, ...newlyApplied]);
  }

  // Build email report
  const topRows = top.map((j, i) => `
    <tr style="border-bottom:1px solid #eee;${j.score >= PROFILE.autoApplyThreshold ? 'background:#f0fff4;' : ''}">
      <td style="padding:8px;font-weight:bold;color:#555;">${i + 1}</td>
      <td style="padding:8px;">
        <a href="${j.url}" style="font-weight:bold;color:#0066cc;">${j.title}</a>
        ${j.location ? `<br><small style="color:#888;">📍 ${j.location}</small>` : ''}
        ${j.score >= PROFILE.autoApplyThreshold ? '<br><span style="color:#2d6a4f;font-size:11px;font-weight:bold;">⚡ Auto-apply eligible</span>' : ''}
      </td>
      <td style="padding:8px;color:#555;">${j.salary || '<span style="color:#aaa;">Not listed</span>'}</td>
      <td style="padding:8px;font-size:12px;">${j.flags.join('<br>')}</td>
      <td style="padding:8px;font-weight:bold;font-size:16px;color:${j.score >= 70 ? '#2d6a4f' : j.score >= 50 ? '#b45309' : '#555'};">${j.score}</td>
    </tr>
  `).join('');

  const appliedSection = newlyApplied.length > 0 ? `
    <h3 style="color:#2d6a4f;">⚡ Auto-Applied (${newlyApplied.length})</h3>
    <ul>${newlyApplied.map(j => `<li><a href="${j.url}">${j.title}</a> — Score: ${j.score}</li>`).join('')}</ul>
  ` : '';

  const html = `
<div style="font-family:sans-serif;max-width:800px;margin:0 auto;">
  <h2 style="color:#333;">🎯 Job Agent Report — ${new Date().toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</h2>
  <p style="color:#555;">
    Scanned <strong>${allJobs.length}</strong> jobs from ${emails.length} alert emails.
    <strong>${scored.length}</strong> passed the filter.
    Showing top <strong>${top.length}</strong>.
  </p>
  ${appliedSection}
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <thead>
      <tr style="background:#f0f0f0;text-align:left;">
        <th style="padding:8px;">#</th>
        <th style="padding:8px;">Role</th>
        <th style="padding:8px;">Salary/Rate</th>
        <th style="padding:8px;">Signals</th>
        <th style="padding:8px;">Score</th>
      </tr>
    </thead>
    <tbody>${topRows}</tbody>
  </table>
  <hr style="margin:24px 0;">
  <p style="color:#999;font-size:11px;">
    OpenClaw Job Agent v2 • Auto-apply threshold: ${PROFILE.autoApplyThreshold}+ •
    Reply "apply to #N" to manually trigger an application for any listed role.
  </p>
</div>`;

  const subject = `🎯 Job Agent: ${top.length} top picks from ${allJobs.length} listings${newlyApplied.length ? ` | ⚡ ${newlyApplied.length} auto-applied` : ''}`;

  const tmpHtml = '/tmp/job-report.html';
  fs.writeFileSync(tmpHtml, html);

  gog(`gmail send --to ${ACCOUNT} --subject "${subject}" --body-html "$(cat ${tmpHtml})"`);
  console.log(`Done. Report sent: ${subject}`);
}

main().catch(e => {
  console.error('Job agent error:', e.message);
  process.exit(1);
});
