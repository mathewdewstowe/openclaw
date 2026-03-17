#!/bin/bash
# Exports all tasks + goals to Dropbox as Master_Tasks.md
# Rotates previous to Master_Tasks_Backup.md first

DROPBOX="/mnt/c/Users/matthewdewstowe/Dropbox/OpenClaw Backups"
MASTER="$DROPBOX/Master_Tasks.md"
BACKUP="$DROPBOX/Master_Tasks_Backup.md"
DB="/home/matthewdewstowe/.openclaw/workspace/dashboard/data/dashboard.db"

mkdir -p "$DROPBOX"

# Rotate: current → backup
[ -f "$MASTER" ] && cp "$MASTER" "$BACKUP"

NOW=$(date -u +"%Y-%m-%d %H:%M UTC")

node - <<'EOF' > "$MASTER"
const Database = require('/home/matthewdewstowe/.openclaw/workspace/dashboard/node_modules/better-sqlite3');
const db = new Database('/home/matthewdewstowe/.openclaw/workspace/dashboard/data/dashboard.db', { readonly: true });

const now = new Date().toUTCString();
const tasks = db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC').all();
const goals = db.prepare('SELECT * FROM goals ORDER BY createdAt').all();

const open = tasks.filter(t => !t.done);
const done = tasks.filter(t => t.done);

const priorityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
const colOrder = { 'Urgent': 1, 'Today': 2, 'Later': 3, 'Future': 4 };

open.sort((a, b) => {
  const pa = priorityOrder[a.priority] || 9;
  const pb = priorityOrder[b.priority] || 9;
  if (pa !== pb) return pa - pb;
  return (colOrder[a.kanban_column] || 9) - (colOrder[b.kanban_column] || 9);
});

let md = `# Master Tasks — Matthew Dewstowe\n\n> Last updated: ${now}\n\n---\n\n`;

// Goals
md += `## 🎯 Goals\n\n`;
if (goals.length) {
  goals.forEach(g => {
    const pct = g.target_value > 0 ? ` (${Math.round(g.current_value / g.target_value * 100)}%)` : '';
    const bar = g.target_value > 0 ? ` — ${g.current_value}/${g.target_value} ${g.unit}${pct}` : '';
    md += `- **${g.title}**${bar}\n`;
  });
} else {
  md += '_No goals found_\n';
}
md += '\n---\n\n';

// Blockers
const blockers = open.filter(t => t.category === 'Blocked' || t.category === 'Blocker');
if (blockers.length) {
  md += `## 🚨 Blockers (${blockers.length})\n\n`;
  blockers.forEach(t => {
    md += `### ${t.text}\n`;
    md += `- **Goal:** ${t.goal || '—'}\n`;
    md += `- **Column:** ${t.kanban_column || '—'}${t.dueDate ? ` | 📅 ${t.dueDate}` : ''}\n`;
    if (t.notes) md += `- **Notes:** ${t.notes.split('\n')[0]}\n`;
    md += '\n';
  });
}

// High / Medium / Low
['high', 'medium', 'low'].forEach(pri => {
  const label = { high: '🔴 High Priority', medium: '🟡 Medium Priority', low: '🟢 Low Priority' }[pri];
  const group = open.filter(t => t.priority === pri && t.category !== 'Blocked' && t.category !== 'Blocker');
  if (!group.length) return;
  md += `## ${label} (${group.length})\n\n`;
  group.forEach(t => {
    md += `### ${t.text}\n`;
    md += `- **Goal:** ${t.goal || '—'}\n`;
    md += `- **Status:** ${t.category || '—'} | **Column:** ${t.kanban_column || '—'}${t.dueDate ? ` | 📅 ${t.dueDate}` : ''}\n`;
    if (t.notes) md += `- **Notes:** ${t.notes.split('\n')[0]}\n`;
    md += '\n';
  });
});

// Summary table
md += `---\n\n## 📋 All Open Tasks (${open.length})\n\n`;
md += `| Task | Priority | Status | Column | Due |\n|------|----------|--------|--------|-----|\n`;
open.forEach(t => {
  const text = t.text.replace(/\|/g, ' ').substring(0, 60) + (t.text.length > 60 ? '…' : '');
  md += `| ${text} | ${t.priority || '—'} | ${t.category || '—'} | ${t.kanban_column || '—'} | ${t.dueDate || '—'} |\n`;
});

// Done
md += `\n---\n\n## ✅ Recently Completed\n\n`;
done.slice(0, 20).forEach(t => {
  const d = (t.updatedAt || '').substring(0, 10);
  md += `- [x] ${t.text}${d ? ` *(${d})*` : ''}\n`;
});

process.stdout.write(md);
db.close();
EOF

echo "✅ Master_Tasks.md written to Dropbox at $NOW"
echo "📁 Backup saved as Master_Tasks_Backup.md"
