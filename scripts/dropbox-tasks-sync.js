#!/usr/bin/env node
/**
 * dropbox-tasks-sync.js
 * Writes Master_Tasks.md to Dropbox (via Windows filesystem mount)
 * Backs up previous version to Master_Tasks_Backup.md
 * Run hourly via cron.
 */

const fs = require('fs');
const path = require('path');

const DROPBOX = '/mnt/c/Users/matthewdewstowe/Dropbox/OpenClaw Backups';
const MASTER   = path.join(DROPBOX, 'Master_Tasks.md');
const BACKUP   = path.join(DROPBOX, 'Master_Tasks_Backup.md');
const TASKS_JSON = '/home/matthewdewstowe/.openclaw/workspace/dashboard/data/tasks.json';
const GOALS_JSON = '/home/matthewdewstowe/.openclaw/workspace/dashboard/data/goals.json';

// Goal map — id → short name
const GOAL_LABELS = {
  '1':                      'Sonesse: 10 Hot Leads',
  '2':                      'Nth Layer: 1 Deal Closed',
  'goal-1773613936188':     '80% Automation',
  'goal-1773613045702':     'Customer Conversations',
  'goal-1773613045690':     'Hours Saved',
  'goal-1773613045677':     'Outreach Drafted',
  'goal-1773613045664':     'Qualified Prospects',
  'goal-1773613045624':     'Signals Actioned',
  'goal-1773597567416':     'Save £30k Deposit',
};

// Task category → priority order
const PRIORITY_ORDER = { 'Blocked': 0, 'Urgent': 1, 'High': 1, 'high': 1, 'medium': 2, 'low': 3 };

function priorityEmoji(p) {
  if (!p) return '⚪';
  const l = p.toLowerCase();
  if (l === 'blocked') return '🔴';
  if (l === 'urgent' || l === 'high') return '🟠';
  if (l === 'medium') return '🟡';
  if (l === 'low') return '🟢';
  return '⚪';
}

function goalLabel(task) {
  if (task.goal_id && GOAL_LABELS[task.goal_id]) return GOAL_LABELS[task.goal_id];
  // Infer from text
  const t = (task.text || '').toLowerCase();
  if (t.includes('sonesse') || t.includes('conversational ai') || t.includes('tavus') || t.includes('elevenlabs')) return 'Sonesse: 10 Hot Leads';
  if (t.includes('nth layer') || t.includes('consulting') || t.includes('deal') || t.includes('pipedrive')) return 'Nth Layer: 1 Deal Closed';
  if (t.includes('linkedin') || t.includes('apollo') || t.includes('outreach') || t.includes('prospect')) return 'Qualified Prospects';
  if (t.includes('automat') || t.includes('cron') || t.includes('agent') || t.includes('n8n') || t.includes('dashboard')) return '80% Automation';
  if (t.includes('debt') || t.includes('invoice') || t.includes('£') || t.includes('deposit')) return 'Save £30k Deposit';
  if (t.includes('seo') || t.includes('blog') || t.includes('content')) return 'Sonesse: 10 Hot Leads';
  return '—';
}

function businessLabel(task) {
  const t = (task.text || '').toLowerCase();
  if (t.includes('sonesse') || t.includes('tavus') || t.includes('elevenlabs') || t.includes('conversational ai') || t.includes('anam')) return 'Sonesse';
  if (t.includes('nth layer') || t.includes('consulting') || t.includes('deloitte') || t.includes('welsh') || t.includes('apollo')) return 'Nth Layer';
  if (t.includes('openclaw') || t.includes('dashboard') || t.includes('n8n') || t.includes('cron') || t.includes('automat') || t.includes('agent') || t.includes('linkedin')) return 'OpenClaw (Infra)';
  if (t.includes('personal') || t.includes('train') || t.includes('health') || t.includes('drink') || t.includes('deposit') || t.includes('debt')) return 'Personal';
  return 'General';
}

function isBlocked(task) {
  return (task.category || '').toLowerCase() === 'blocked' ||
         (task.text || '').toLowerCase().includes('blocked') ||
         (task.notes || '').toLowerCase().includes('blocked');
}

function formatTask(task) {
  const done = task.done ? '[x]' : '[ ]';
  const pri  = priorityEmoji(isBlocked(task) ? 'blocked' : (task.priority || task.kanban_column || ''));
  const goal = goalLabel(task);
  const biz  = businessLabel(task);
  const due  = task.dueDate ? ` · 📅 ${task.dueDate}` : '';
  const col  = task.kanban_column ? ` · _${task.kanban_column}_` : '';
  return `- ${done} ${pri} **${task.text}**\n  → Goal: ${goal} · ${biz}${col}${due}`;
}

function buildMarkdown(tasks, goals) {
  const now = new Date();
  const ts  = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  const open   = tasks.filter(t => !t.done);
  const done   = tasks.filter(t => t.done);
  const blocked = open.filter(t => isBlocked(t));
  const urgent  = open.filter(t => !isBlocked(t) && ['urgent','high'].includes((t.priority||t.kanban_column||'').toLowerCase()));
  const medium  = open.filter(t => !isBlocked(t) && (t.priority||'').toLowerCase() === 'medium');
  const low     = open.filter(t => !isBlocked(t) && (t.priority||'').toLowerCase() === 'low');
  const other   = open.filter(t => !isBlocked(t) && !['urgent','high','medium','low'].includes((t.priority||'').toLowerCase()));

  const lines = [];
  lines.push(`# Master Tasks`);
  lines.push(`> Last updated: ${ts}`);
  lines.push(`> Open: ${open.length} · Blocked: ${blocked.length} · Done: ${done.length}\n`);

  // Goals summary
  lines.push(`## 🎯 Goals\n`);
  if (goals && goals.length) {
    goals.filter(g => !g.done).forEach(g => {
      const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
      const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10 - Math.floor(pct/10));
      lines.push(`- **${g.title}** — ${g.current}/${g.target} ${g.unit || ''} [${bar}] ${pct}%`);
    });
  }
  lines.push('');

  if (blocked.length) {
    lines.push(`## 🔴 Blocked (${blocked.length})\n`);
    blocked.forEach(t => lines.push(formatTask(t)));
    lines.push('');
  }

  if (urgent.length) {
    lines.push(`## 🟠 High / Urgent (${urgent.length})\n`);
    urgent.forEach(t => lines.push(formatTask(t)));
    lines.push('');
  }

  if (medium.length) {
    lines.push(`## 🟡 Medium (${medium.length})\n`);
    medium.forEach(t => lines.push(formatTask(t)));
    lines.push('');
  }

  if (low.length) {
    lines.push(`## 🟢 Low (${low.length})\n`);
    low.forEach(t => lines.push(formatTask(t)));
    lines.push('');
  }

  if (other.length) {
    lines.push(`## ⚪ Other (${other.length})\n`);
    other.forEach(t => lines.push(formatTask(t)));
    lines.push('');
  }

  if (done.length) {
    lines.push(`## ✅ Done (${done.length})\n`);
    done.slice(0, 20).forEach(t => lines.push(`- [x] ~~${t.text}~~`));
    if (done.length > 20) lines.push(`\n_...and ${done.length - 20} more completed tasks_`);
    lines.push('');
  }

  lines.push(`---\n_Generated by OpenClaw · https://missioncontrol.nthlayer.co.uk_`);
  return lines.join('\n');
}

// Main
try {
  // Ensure output dir exists
  if (!fs.existsSync(DROPBOX)) fs.mkdirSync(DROPBOX, { recursive: true });

  const tasks = JSON.parse(fs.readFileSync(TASKS_JSON, 'utf8'));
  let goals = [];
  try { goals = JSON.parse(fs.readFileSync(GOALS_JSON, 'utf8')); } catch(e) {}

  const md = buildMarkdown(tasks, goals);

  // Rotate: current → backup
  if (fs.existsSync(MASTER)) {
    fs.copyFileSync(MASTER, BACKUP);
  }

  // Write new master
  fs.writeFileSync(MASTER, md, 'utf8');

  console.log(`[${new Date().toISOString()}] ✅ Master_Tasks.md written to Dropbox (${tasks.length} tasks)`);
} catch (err) {
  console.error(`[${new Date().toISOString()}] ❌ Error:`, err.message);
  process.exit(1);
}
