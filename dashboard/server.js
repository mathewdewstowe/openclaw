const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const db = require('./db');

// Brute force protection
const loginAttempts = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  const recent = attempts.filter(t => now - t < 15 * 60 * 1000); // 15 min window
  if (recent.length >= 10) return false; // block after 10 attempts
  recent.push(now);
  loginAttempts.set(ip, recent);
  return true;
}

const app = express();
const PORT = 3737;
const BIND = process.env.BIND || '127.0.0.1';
const JWT_SECRET = 'md-dashboard-secret-2026-sonesse';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/missioncontrol', express.static(path.join(__dirname, 'public')));
app.get('/missioncontrol', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/', (req, res) => res.redirect('/missioncontrol'));

const DATA = path.join(__dirname, 'data');
const readData = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
const writeData = (file, data) => fs.writeFileSync(path.join(DATA, file), JSON.stringify(data, null, 2));

// Dual-write helper: persist to SQLite AND JSON file
function syncToJson(file, query) {
  try {
    const rows = db.prepare(query).all();
    writeData(file, rows);
  } catch(e) { /* non-fatal */ }
}

function afterWrite(table) {
  const map = {
    tasks: () => {
      syncToJson('tasks.json', 'SELECT * FROM tasks ORDER BY createdAt DESC');
      writeTaskMarkdown();
    },
    goals: () => syncToJson('goals.json', 'SELECT * FROM goals ORDER BY createdAt DESC'),
    proposals: () => syncToJson('proposals.json', 'SELECT * FROM proposals ORDER BY createdAt DESC'),
    posts: () => syncToJson('posts.json', 'SELECT * FROM posts ORDER BY createdAt DESC'),
    icps: () => syncToJson('icps.json', 'SELECT * FROM icps ORDER BY createdAt DESC'),
    briefings: () => syncToJson('briefings.json', 'SELECT * FROM briefings ORDER BY createdAt DESC LIMIT 90'),
  };
  if (map[table]) map[table]();
}

function writeTaskMarkdown() {
  try {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC').all();
    const date = new Date().toISOString().split('T')[0];
    const mdPath = path.join(DATA, `tasks-${date}.md`);
    const open = tasks.filter(t => !t.done);
    const done = tasks.filter(t => t.done);
    const lines = [`# Tasks — ${date}\n\nUpdated: ${new Date().toISOString()}\n\n## Open (${open.length})\n\n`];
    open.forEach(t => lines.push(`- [ ] [${t.category||''}] [${t.kanban_column||'Triage'}] ${t.text}${t.dueDate ? ' — 📅 '+t.dueDate : ''}\n`));
    lines.push(`\n## Done (${done.length})\n\n`);
    done.forEach(t => lines.push(`- [x] ${t.text}${t.completedAt ? ' — ✅ '+t.completedAt : ''}\n`));
    fs.writeFileSync(mdPath, lines.join(''));
  } catch(e) {}
}

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// LOGIN
app.post('/api/login', (req, res) => {
  const ip = req.headers['cf-connecting-ip'] || req.ip;
  if (!rateLimit(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const { username, password } = req.body;
  const users = readData('users.json');
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const expiresIn = req.body.remember ? '30d' : '7d';
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn });
  res.json({ token, username });
});

// TASKS
app.get('/api/tasks', auth, (req, res) => res.json(db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC').all()));
app.post('/api/tasks', auth, (req, res) => {
  const t = { id: 'task-' + Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), done: 0, priority: 'medium', category: 'general', kanban_column: 'Triage', dueDate: null, notes: null, completedAt: null, goal_id: null, ...req.body };
  if (t.done === true || t.done === '1') t.done = 1;
  if (t.done === false || t.done === '0') t.done = 0;
  // Deduplicate: if a task with the same text exists and is not done, skip
  const existing = db.prepare('SELECT id, done FROM tasks WHERE text = ?').get(t.text);
  if (existing && !existing.done) {
    return res.json({ ...t, id: existing.id, duplicate: true });
  }
  // If exists but was done, allow re-creation (new task)
  db.prepare('INSERT OR REPLACE INTO tasks (id, text, done, priority, category, kanban_column, dueDate, notes, createdAt, updatedAt, completedAt, goal_id) VALUES (@id, @text, @done, @priority, @category, @kanban_column, @dueDate, @notes, @createdAt, @updatedAt, @completedAt, @goal_id)').run(t);
  afterWrite('tasks');
  res.json(t);
});
app.patch('/api/tasks/:id', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  const updated = { ...task, ...req.body, updatedAt: new Date().toISOString() };
  // Track when a task was completed
  const doneVal = req.body.done;
  const isDone = doneVal === 1 || doneVal === true || doneVal === '1';
  const isUndone = doneVal === 0 || doneVal === false || doneVal === '0';
  if (isDone && !task.done) {
    updated.completedAt = new Date().toISOString();
  } else if (isUndone && task.done) {
    updated.completedAt = null;
  }
  if (doneVal !== undefined) updated.done = isDone ? 1 : 0;
  db.prepare('INSERT OR REPLACE INTO tasks (id, text, done, priority, category, kanban_column, dueDate, notes, createdAt, updatedAt, completedAt, goal_id) VALUES (@id, @text, @done, @priority, @category, @kanban_column, @dueDate, @notes, @createdAt, @updatedAt, @completedAt, @goal_id)').run(updated);
  afterWrite('tasks');
  res.json(updated);
});
app.delete('/api/tasks/:id', auth, (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  afterWrite('tasks');
  res.json({ ok: true });
});

// AGENTS
app.get('/api/agents', auth, (req, res) => res.json(readData('agents.json')));

// GOALS
app.get('/api/goals', auth, (req, res) => res.json(db.prepare('SELECT * FROM goals ORDER BY createdAt DESC').all()));
app.post('/api/goals', auth, (req, res) => {
  const g = { id: 'goal-' + Date.now(), createdAt: new Date().toISOString(), lastUpdated: new Date().toLocaleDateString('en-GB'), target: 0, current: 0, unit: 'units', ...req.body };
  db.prepare('INSERT OR REPLACE INTO goals (id, title, description, target, current, unit, lastUpdated, createdAt) VALUES (@id, @title, @description, @target, @current, @unit, @lastUpdated, @createdAt)').run(g);
  afterWrite('goals');
  res.json(g);
});
app.delete('/api/goals/:id', auth, (req, res) => {
  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  afterWrite('goals');
  res.json({ ok: true });
});
app.patch('/api/goals/:id', auth, (req, res) => {
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Not found' });
  const updated = { ...goal, ...req.body, lastUpdated: new Date().toLocaleDateString('en-GB') };
  db.prepare('INSERT OR REPLACE INTO goals (id, title, description, target, current, unit, lastUpdated, createdAt) VALUES (@id, @title, @description, @target, @current, @unit, @lastUpdated, @createdAt)').run(updated);
  // Auto-record history snapshot when current value changes
  if (req.body.current !== undefined && req.body.current !== goal.current) {
    db.prepare('INSERT INTO goal_history (goal_id, value, note, recordedAt) VALUES (?, ?, ?, ?)').run(goal.id, req.body.current, req.body.note || null, new Date().toISOString());
  }
  afterWrite('goals');
  res.json(updated);
});

// GOAL HISTORY
app.get('/api/goals/:id/history', auth, (req, res) => {
  const history = db.prepare('SELECT * FROM goal_history WHERE goal_id = ? ORDER BY recordedAt ASC').all(req.params.id);
  res.json(history);
});
app.post('/api/goals/:id/history', auth, (req, res) => {
  const { value, note } = req.body;
  db.prepare('INSERT INTO goal_history (goal_id, value, note, recordedAt) VALUES (?, ?, ?, ?)').run(req.params.id, value, note || null, new Date().toISOString());
  // Also update the goal's current value
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id);
  if (goal) {
    const updated = { ...goal, current: value, lastUpdated: new Date().toLocaleDateString('en-GB') };
    db.prepare('INSERT OR REPLACE INTO goals (id, title, description, target, current, unit, lastUpdated, createdAt) VALUES (@id, @title, @description, @target, @current, @unit, @lastUpdated, @createdAt)').run(updated);
    afterWrite('goals');
  }
  res.json({ ok: true });
});

// Agent suggestions — generated based on goals, missing automations, usage patterns
app.get('/api/agent-suggestions', auth, (req, res) => {
  try {
    const suggestions = JSON.parse(require('fs').readFileSync(path.join(DATA, 'agent-suggestions.json'), 'utf8'));
    res.json(suggestions);
  } catch(e) {
    res.json([]);
  }
});

app.post('/api/agent-suggestions/:id/dismiss', auth, (req, res) => {
  try {
    const data = JSON.parse(require('fs').readFileSync(path.join(DATA, 'agent-suggestions.json'), 'utf8'));
    const updated = data.map(s => s.id === req.params.id ? { ...s, dismissed: true, dismissedAt: new Date().toISOString() } : s);
    require('fs').writeFileSync(path.join(DATA, 'agent-suggestions.json'), JSON.stringify(updated, null, 2));
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/agent-suggestions/:id/activate', auth, (req, res) => {
  try {
    const data = JSON.parse(require('fs').readFileSync(path.join(DATA, 'agent-suggestions.json'), 'utf8'));
    const updated = data.map(s => s.id === req.params.id ? { ...s, status: 'active', activatedAt: new Date().toISOString() } : s);
    require('fs').writeFileSync(path.join(DATA, 'agent-suggestions.json'), JSON.stringify(updated, null, 2));
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PROPOSALS
app.get('/api/proposals', auth, (req, res) => res.json(db.prepare('SELECT * FROM proposals ORDER BY createdAt DESC').all()));
app.post('/api/proposals', auth, (req, res) => {
  const p = { id: 'proposal-' + Date.now(), createdAt: new Date().toISOString(), status: 'draft', ...req.body };
  db.prepare('INSERT OR REPLACE INTO proposals (id, title, client, value, status, goalAlignment, notes, createdAt) VALUES (@id, @title, @client, @value, @status, @goalAlignment, @notes, @createdAt)').run(p);
  afterWrite('proposals');
  res.json(p);
});
app.patch('/api/proposals/:id', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const updated = { ...p, ...req.body };
  db.prepare('INSERT OR REPLACE INTO proposals (id, title, client, value, status, goalAlignment, notes, createdAt) VALUES (@id, @title, @client, @value, @status, @goalAlignment, @notes, @createdAt)').run(updated);
  afterWrite('proposals');
  res.json(updated);
});
app.delete('/api/proposals/:id', auth, (req, res) => {
  db.prepare('DELETE FROM proposals WHERE id = ?').run(req.params.id);
  afterWrite('proposals');
  res.json({ ok: true });
});

// MEMORY
app.get('/api/memory', auth, (req, res) => {
  try {
    const workspacePath = '/home/matthewdewstowe/.openclaw/workspace';
    let content = '';
    const memFile = path.join(workspacePath, 'MEMORY.md');
    if (fs.existsSync(memFile)) content += fs.readFileSync(memFile, 'utf8');
    const memDir = path.join(workspacePath, 'memory');
    if (fs.existsSync(memDir)) {
      const files = fs.readdirSync(memDir).filter(f => f.endsWith('.md')).sort().reverse();
      files.slice(0, 10).forEach(f => {
        content += `\n\n---\n## ${f}\n` + fs.readFileSync(path.join(memDir, f), 'utf8');
      });
    }
    res.json({ content });
  } catch (e) { res.json({ content: 'No memory files found yet.' }); }
});

// MEMORY LOG (Chrome extension capture)
app.post('/api/memory-log', auth, (req, res) => {
  const { key, value } = req.body;
  if (!key || !value) return res.status(400).json({ error: 'key and value required' });
  db.prepare('INSERT INTO memory_log (key, value, createdAt) VALUES (?, ?, ?)').run(key, value, new Date().toISOString());
  res.json({ ok: true });
});

// CONNECTED SYSTEMS
app.get('/api/systems', auth, (req, res) => {
  const systems = [
    { name: 'Gmail (GoG)', status: 'connected', account: 'matthewdewstowe@gmail.com', icon: '📧' },
    { name: 'Google Calendar', status: 'connected', account: 'matthewdewstowe@gmail.com', icon: '📅' },
    { name: 'Google Drive', status: 'connected', account: 'matthewdewstowe@gmail.com', icon: '📁' },
    { name: 'Google Sheets', status: 'connected', account: 'matthewdewstowe@gmail.com', icon: '📊' },
    { name: 'Apollo', status: 'connected', account: 'API Key configured', icon: '🎯' },
    { name: 'Pipedrive', status: 'pending', account: 'API key needed', icon: '📊' },
    { name: 'LinkedIn', status: 'blocked', account: 'Browser automation blocked (WSL networking)', icon: '🔗' },
    { name: 'WhatsApp', status: 'connected', account: '+447572869043', icon: '💬' },
    { name: 'OpenClaw Shell', status: 'connected', account: 'WSL2 exec enabled', icon: '🖥️' },
  ];
  res.json(systems);
});

// LINKEDIN FEED (placeholder)
app.get('/api/linkedin-feed', auth, (req, res) => {
  res.json({ status: 'pending', message: 'LinkedIn browser automation not yet connected. Pending WSL mirrored networking setup.', posts: [] });
});

// BRIEFINGS
app.get('/api/briefings', auth, (req, res) => res.json(db.prepare('SELECT * FROM briefings ORDER BY createdAt DESC LIMIT 30').all()));
app.post('/api/briefings', auth, (req, res) => {
  const entry = { id: Date.now().toString(), createdAt: new Date().toISOString(), type: 'daily', ...req.body };
  db.prepare('INSERT OR REPLACE INTO briefings (id, title, content, type, createdAt) VALUES (@id, @title, @content, @type, @createdAt)').run(entry);
  // Keep only 90 most recent
  db.prepare('DELETE FROM briefings WHERE id NOT IN (SELECT id FROM briefings ORDER BY createdAt DESC LIMIT 90)').run();
  afterWrite('briefings');
  res.json(entry);
});

// ICPs
app.get('/api/icps', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM icps ORDER BY createdAt DESC').all().map(row => ({
    ...row,
    problem_statements: (() => {
      try { return JSON.parse(row.problem_statements || '[]'); } catch { return []; }
    })()
  }));
  res.json(rows);
});
app.post('/api/icps', auth, (req, res) => {
  const icp = {
    id: 'icp-' + Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'new',
    score: 0,
    sector: '', company_size: '', persona: '', value_prop: '', how_we_help: '', buying_trigger: '',
    problem_statements: '[]',
    ...req.body
  };
  icp.problem_statements = Array.isArray(icp.problem_statements) ? JSON.stringify(icp.problem_statements) : (icp.problem_statements || '[]');
  db.prepare('INSERT OR REPLACE INTO icps (id, name, title, company, email, linkedin, notes, sector, company_size, persona, value_prop, problem_statements, how_we_help, buying_trigger, status, score, createdAt, updatedAt) VALUES (@id, @name, @title, @company, @email, @linkedin, @notes, @sector, @company_size, @persona, @value_prop, @problem_statements, @how_we_help, @buying_trigger, @status, @score, @createdAt, @updatedAt)').run(icp);
  afterWrite('icps');
  res.json({ ...icp, problem_statements: JSON.parse(icp.problem_statements) });
});
app.patch('/api/icps/:id', auth, (req, res) => {
  const icp = db.prepare('SELECT * FROM icps WHERE id = ?').get(req.params.id);
  if (!icp) return res.status(404).json({ error: 'Not found' });
  const updated = { ...icp, ...req.body, updatedAt: new Date().toISOString() };
  updated.problem_statements = Array.isArray(updated.problem_statements) ? JSON.stringify(updated.problem_statements) : (updated.problem_statements || '[]');
  db.prepare('INSERT OR REPLACE INTO icps (id, name, title, company, email, linkedin, notes, sector, company_size, persona, value_prop, problem_statements, how_we_help, buying_trigger, status, score, createdAt, updatedAt) VALUES (@id, @name, @title, @company, @email, @linkedin, @notes, @sector, @company_size, @persona, @value_prop, @problem_statements, @how_we_help, @buying_trigger, @status, @score, @createdAt, @updatedAt)').run(updated);
  afterWrite('icps');
  res.json({ ...updated, problem_statements: JSON.parse(updated.problem_statements) });
});
app.delete('/api/icps/:id', auth, (req, res) => {
  db.prepare('DELETE FROM icps WHERE id = ?').run(req.params.id);
  afterWrite('icps');
  res.json({ ok: true });
});

// LINKEDIN POSTS
app.get('/api/posts', auth, (req, res) => res.json(db.prepare('SELECT * FROM posts ORDER BY createdAt DESC').all()));
app.post('/api/posts', auth, (req, res) => {
  const post = { id: Date.now().toString(), createdAt: new Date().toISOString(), status: 'draft', impressions: 0, ...req.body };
  db.prepare('INSERT OR REPLACE INTO posts (id, content, status, scheduledFor, publishedAt, impressions, createdAt) VALUES (@id, @content, @status, @scheduledFor, @publishedAt, @impressions, @createdAt)').run(post);
  afterWrite('posts');
  res.json(post);
});
app.patch('/api/posts/:id', auth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const updated = { ...post, ...req.body };
  db.prepare('INSERT OR REPLACE INTO posts (id, content, status, scheduledFor, publishedAt, impressions, createdAt) VALUES (@id, @content, @status, @scheduledFor, @publishedAt, @impressions, @createdAt)').run(updated);
  afterWrite('posts');
  res.json(updated);
});
app.delete('/api/posts/:id', auth, (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  afterWrite('posts');
  res.json({ ok: true });
});

// FEEDBACK & LEARNING
app.get('/api/preferences', auth, (req, res) => {
  const prefs = db.prepare('SELECT * FROM preference_profile ORDER BY confidence DESC').all();
  res.json(prefs);
});
app.post('/api/feedback', auth, (req, res) => {
  const { suggestion_type, suggestion_content, action, amendment, reason, context } = req.body;
  // Log the feedback
  db.prepare('INSERT INTO feedback_log (suggestion_type, suggestion_content, action, amendment, reason, context) VALUES (?, ?, ?, ?, ?, ?)')
    .run(suggestion_type, suggestion_content, action || 'approved', amendment || null, reason || null, context || null);
  // Update preference profile based on patterns
  if (action === 'rejected' && reason) {
    const existing = db.prepare('SELECT * FROM preference_profile WHERE key = ?').get('rejected_reason_' + suggestion_type);
    if (existing) {
      db.prepare('UPDATE preference_profile SET value = ?, examples = examples + 1, updatedAt = ? WHERE key = ?')
        .run(existing.value + '; ' + reason, new Date().toISOString(), existing.key);
    } else {
      db.prepare('INSERT INTO preference_profile (key, value, confidence, examples) VALUES (?, ?, 0.6, 1)')
        .run('rejected_reason_' + suggestion_type, reason);
    }
  }
  if (amendment) {
    const existing = db.prepare('SELECT * FROM preference_profile WHERE key = ?').get('amendment_pattern_' + suggestion_type);
    if (existing) {
      db.prepare('UPDATE preference_profile SET examples = examples + 1, confidence = MIN(1.0, confidence + 0.05), updatedAt = ? WHERE key = ?')
        .run(new Date().toISOString(), existing.key);
    } else {
      db.prepare('INSERT INTO preference_profile (key, value, confidence, examples) VALUES (?, ?, 0.55, 1)')
        .run('amendment_pattern_' + suggestion_type, amendment);
    }
  }
  // Write preferences to file for agent consumption
  const allPrefs = db.prepare('SELECT * FROM preference_profile').all();
  const prefsObj = {};
  allPrefs.forEach(p => prefsObj[p.key] = { value: p.value, confidence: p.confidence, examples: p.examples });
  require('fs').writeFileSync(require('path').join(__dirname, 'data', 'preferences.json'), JSON.stringify(prefsObj, null, 2));
  res.json({ ok: true });
});
app.get('/api/feedback/stats', auth, (req, res) => {
  const stats = db.prepare(`
    SELECT suggestion_type, action, COUNT(*) as count
    FROM feedback_log
    GROUP BY suggestion_type, action
    ORDER BY count DESC
  `).all();
  const approvalRate = db.prepare(`
    SELECT
      COUNT(CASE WHEN action='approved' THEN 1 END) * 100.0 / COUNT(*) as rate
    FROM feedback_log
  `).get();
  res.json({ stats, approvalRate: approvalRate?.rate || 0 });
});

// TODAY PRIORITIES
app.get('/api/today', auth, (req, res) => {
  const date = new Date().toISOString().split('T')[0];
  const row = db.prepare('SELECT * FROM today_priorities WHERE date = ?').get(date);
  res.json(row || { date, headline: null, priorities: null, blockers: null, context: null });
});
app.post('/api/today', auth, (req, res) => {
  const date = new Date().toISOString().split('T')[0];
  const { headline, priorities, blockers, context } = req.body;
  db.prepare('INSERT OR REPLACE INTO today_priorities (date, headline, priorities, blockers, context, generatedAt) VALUES (@date, @headline, @priorities, @blockers, @context, @generatedAt)')
    .run({ date, headline, priorities: JSON.stringify(priorities || []), blockers: JSON.stringify(blockers || []), context: context || '', generatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

// DAILY SUMMARIES (Yesterday tab)
app.get('/api/daily-summary', auth, (req, res) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = req.query.date || yesterday.toISOString().split('T')[0];
  let row = db.prepare('SELECT * FROM daily_summaries WHERE date = ?').get(date);
  // Merge online time
  const otRow = db.prepare('SELECT * FROM online_time_log WHERE date = ?').get(date);
  res.json({ ...(row || { date, summary: null, achievements: null, tasksCompleted: 0 }), onlineHours: otRow?.hours || 0 });
});
app.post('/api/daily-summary', auth, (req, res) => {
  const { date, summary, achievements, tasksCompleted, onlineHours } = req.body;
  const achievementsStr = Array.isArray(achievements) ? JSON.stringify(achievements) : (achievements || '[]');
  db.prepare('INSERT OR REPLACE INTO daily_summaries (date, summary, achievements, tasksCompleted, onlineHours, createdAt) VALUES (@date, @summary, @achievements, @tasksCompleted, @onlineHours, @createdAt)')
    .run({ date, summary, achievements: achievementsStr, tasksCompleted: tasksCompleted || 0, onlineHours: onlineHours || 0, createdAt: new Date().toISOString() });
  res.json({ ok: true });
});

// ONLINE TIME — powered by RescueTime API
const RESCUETIME_KEY = 'B6384SrpleyLx3tj1O6yFJ3e13F4w5DYI4EYxO3t';

async function calcOnlineHours(dateStr) {
  try {
    const url = `https://www.rescuetime.com/anapi/data?key=${RESCUETIME_KEY}&perspective=interval&restrict_kind=overview&interval=day&restrict_begin=${dateStr}&restrict_end=${dateStr}&format=json`;
    const resp = await fetch(url);
    const data = await resp.json();
    const totalSec = (data.rows || []).reduce((sum, r) => sum + r[1], 0);
    const hours = Math.round((totalSec / 3600) * 10) / 10;
    return { hours, firstSeen: null, lastSeen: null, messageCount: 0, source: 'rescuetime' };
  } catch (e) {
    console.error('RescueTime API error:', e.message);
    return { hours: 0, firstSeen: null, lastSeen: null, messageCount: 0, source: 'error' };
  }
}

// Record or refresh online time for a given date
async function upsertOnlineTime(dateStr) {
  const result = await calcOnlineHours(dateStr);
  db.prepare(`INSERT OR REPLACE INTO online_time_log (date, hours, firstSeen, lastSeen, messageCount, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)`).run(dateStr, result.hours, result.firstSeen, result.lastSeen, result.messageCount, new Date().toISOString());
  return result;
}

// GET /api/online-time?date=YYYY-MM-DD  (defaults to yesterday)
app.get('/api/online-time', auth, async (req, res) => {
  const date = req.query.date || (() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0];
  })();
  let row = db.prepare('SELECT * FROM online_time_log WHERE date = ?').get(date);
  const stale = !row || (Date.now() - new Date(row.updatedAt).getTime()) > 10 * 60 * 1000;
  if (stale) { await upsertOnlineTime(date); row = db.prepare('SELECT * FROM online_time_log WHERE date = ?').get(date); }
  res.json(row || { date, hours: 0 });
});

// GET /api/online-time/week  — current ISO week (Mon–Sun)
app.get('/api/online-time/week', auth, async (req, res) => {
  const now = new Date();
  const dayOfWeek = now.getUTCDay() || 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (dayOfWeek - 1));
  monday.setUTCHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    if (d <= now) {
      let row = db.prepare('SELECT * FROM online_time_log WHERE date = ?').get(dateStr);
      if (!row || (Date.now() - new Date(row.updatedAt).getTime()) > 10 * 60 * 1000) {
        await upsertOnlineTime(dateStr);
        row = db.prepare('SELECT * FROM online_time_log WHERE date = ?').get(dateStr);
      }
      days.push(row || { date: dateStr, hours: 0 });
    } else {
      days.push({ date: dateStr, hours: 0, future: true });
    }
  }
  const totalHours = days.reduce((s, d) => s + (d.hours || 0), 0);
  const weekGoal = 50;
  res.json({
    weekStart: monday.toISOString().split('T')[0],
    days,
    totalHours: Math.round(totalHours * 10) / 10,
    weekGoal,
    pct: Math.min(100, Math.round((totalHours / weekGoal) * 100))
  });
});

// POST /api/online-time/refresh  — force recalculate all days this week
app.post('/api/online-time/refresh', auth, async (req, res) => {
  const now = new Date();
  const dayOfWeek = now.getUTCDay() || 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (dayOfWeek - 1));
  monday.setUTCHours(0, 0, 0, 0);
  const results = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    if (d <= now) {
      const dateStr = d.toISOString().split('T')[0];
      const r = await upsertOnlineTime(dateStr);
      results.push({ date: dateStr, ...r });
    }
  }
  res.json({ ok: true, results });
});

// TOKEN USAGE
app.get('/api/usage', auth, (req, res) => {
  try {
    const usageFile = '/home/matthewdewstowe/.openclaw/usage.json';
    if (fs.existsSync(usageFile)) {
      return res.json(JSON.parse(fs.readFileSync(usageFile, 'utf8')));
    }
    // Fallback: parse from openclaw logs if available
    res.json({
      note: 'Usage data syncs from OpenClaw session stats',
      model: 'anthropic/claude-sonnet-4-6',
      daily: { used: null, limit: null, resetsAt: getNextMidnightUTC() },
      weekly: { used: null, limit: null, resetsAt: getNextMondayUTC() },
      session: { tokens: null, cost: null },
      lastUpdated: new Date().toISOString()
    });
  } catch(e) {
    res.json({ error: e.message });
  }
});

function getNextMidnightUTC() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

function getNextMondayUTC() {
  const d = new Date();
  const day = d.getUTCDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// APOLLO CAMPAIGNS
app.get('/api/apollo/campaigns', auth, async (req, res) => {
  try {
    const apiKey = process.env.APOLLO_API_KEY || 'V5ZsfKQ0dsCMCBum2wKEdA';
    const campResp = await fetch('https://api.apollo.io/v1/emailer_campaigns/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ per_page: 25 })
    });
    const campData = await campResp.json();
    const campaigns = campData.emailer_campaigns || [];

    const enriched = campaigns.map(c => ({
      id: c.id,
      name: c.name,
      status: c.active ? 'active' : (c.archived ? 'archived' : 'inactive'),
      // Correct contact counts directly from campaign object
      scheduled: c.unique_scheduled || 0,
      delivered: c.unique_delivered || 0,
      opened: c.unique_opened || 0,
      clicked: c.unique_clicked || 0,
      bounced: c.unique_bounced || 0,
      hard_bounced: c.unique_hard_bounced || 0,
      replied: c.unique_replied || 0,
      unsubscribed: c.unique_unsubscribed || 0,
      // Rates (0–1 floats)
      open_rate: c.open_rate || 0,
      click_rate: c.click_rate || 0,
      reply_rate: c.reply_rate || 0,
      bounce_rate: c.bounce_rate || 0,
      // Steps count
      num_steps: c.num_steps || 0,
      created_at: c.created_at
    }));

    res.json(enriched);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ASSETS
app.get('/api/assets', auth, (req, res) => res.json(db.prepare('SELECT * FROM assets ORDER BY createdAt DESC').all()));
app.post('/api/assets', auth, (req, res) => {
  const a = { id: 'asset-' + Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), type: 'link', category: 'general', icon: '🔗', ...req.body };
  db.prepare('INSERT OR REPLACE INTO assets (id, name, description, url, type, category, icon, createdAt, updatedAt) VALUES (@id, @name, @description, @url, @type, @category, @icon, @createdAt, @updatedAt)').run(a);
  res.json(a);
});
app.patch('/api/assets/:id', auth, (req, res) => {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Not found' });
  const updated = { ...asset, ...req.body, updatedAt: new Date().toISOString() };
  db.prepare('INSERT OR REPLACE INTO assets (id, name, description, url, type, category, icon, createdAt, updatedAt) VALUES (@id, @name, @description, @url, @type, @category, @icon, @createdAt, @updatedAt)').run(updated);
  res.json(updated);
});
app.delete('/api/assets/:id', auth, (req, res) => {
  db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// RISK REGISTER
app.get('/api/risks', auth, (req, res) => res.json(db.prepare('SELECT * FROM risks ORDER BY createdAt DESC').all()));
app.post('/api/risks', auth, (req, res) => {
  const r = {
    id: 'risk-' + Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    likelihood: 'medium', impact: 'medium', severity: 'medium',
    status: 'open', owner: 'Matthew',
    goal_id: null, description: null, mitigation: null,
    ...req.body
  };
  r.goal_id = r.goal_id || null;
  r.description = r.description || null;
  r.mitigation = r.mitigation || null;
  // Auto-calc severity from likelihood + impact
  const scoreMap = { low: 1, medium: 2, high: 3 };
  const score = (scoreMap[r.likelihood] || 2) * (scoreMap[r.impact] || 2);
  r.severity = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';
  db.prepare('INSERT OR REPLACE INTO risks (id, goal_id, title, description, likelihood, impact, severity, mitigation, status, owner, createdAt, updatedAt) VALUES (@id, @goal_id, @title, @description, @likelihood, @impact, @severity, @mitigation, @status, @owner, @createdAt, @updatedAt)').run(r);
  res.json(r);
});
app.patch('/api/risks/:id', auth, (req, res) => {
  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id);
  if (!risk) return res.status(404).json({ error: 'Not found' });
  const updated = { ...risk, ...req.body, updatedAt: new Date().toISOString() };
  updated.goal_id = updated.goal_id || null;
  updated.description = updated.description || null;
  updated.mitigation = updated.mitigation || null;
  const scoreMap = { low: 1, medium: 2, high: 3 };
  const score = (scoreMap[updated.likelihood] || 2) * (scoreMap[updated.impact] || 2);
  updated.severity = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';
  db.prepare('INSERT OR REPLACE INTO risks (id, goal_id, title, description, likelihood, impact, severity, mitigation, status, owner, createdAt, updatedAt) VALUES (@id, @goal_id, @title, @description, @likelihood, @impact, @severity, @mitigation, @status, @owner, @createdAt, @updatedAt)').run(updated);
  res.json(updated);
});
app.delete('/api/risks/:id', auth, (req, res) => {
  db.prepare('DELETE FROM risks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// COMMAND CENTRE — aggregated war room data
app.get('/api/command-centre', auth, async (req, res) => {
  try {
    // Goals
    const goals = db.prepare('SELECT * FROM goals ORDER BY createdAt DESC').all();

    // Tasks
    const allTasksOpen = db.prepare('SELECT * FROM tasks WHERE done = 0 ORDER BY createdAt DESC').all();
    const blockedTasks = allTasksOpen.filter(t => t.kanban_column === 'Urgent' || t.priority === 'high');
    const todayItems = allTasksOpen.filter(t => t.kanban_column === 'Today' || t.kanban_column === 'Urgent');

    // Today priorities
    const date = new Date().toISOString().split('T')[0];
    const todayRow = db.prepare('SELECT * FROM today_priorities WHERE date = ?').get(date);
    let priorities = [], blockers = [], headline = null;
    if (todayRow) {
      try { priorities = JSON.parse(todayRow.priorities || '[]'); } catch {}
      try { blockers = JSON.parse(todayRow.blockers || '[]'); } catch {}
      headline = todayRow.headline;
    }

    // Job applications
    const applyLogPath = '/home/matthewdewstowe/.openclaw/workspace/jobs/apply-log.json';
    let totalApplied = 0, thisWeek = 0;
    try {
      const applyLog = JSON.parse(fs.readFileSync(applyLogPath, 'utf8'));
      totalApplied = applyLog.length;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      thisWeek = applyLog.filter(j => new Date(j.appliedAt) >= weekAgo).length;
    } catch(e) {}

    res.json({
      goals,
      tasks: {
        open: allTasksOpen.length,
        blocked: blockedTasks.length,
        today: todayItems.length,
        items: todayItems.slice(0, 8),
        blockedItems: blockedTasks.slice(0, 5)
      },
      today: { headline, priorities, blockers },
      jobs: { total: totalApplied, thisWeek }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PENDING QUESTIONS
app.get('/api/questions', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM pending_questions WHERE answeredAt IS NULL ORDER BY askedAt DESC').all();
  res.json(rows);
});
app.post('/api/questions', auth, (req, res) => {
  const q = {
    id: 'q-' + Date.now(),
    askedAt: new Date().toISOString(),
    answeredAt: null,
    answer: null,
    context: null,
    slack_message_id: null,
    slack_channel: null,
    ...req.body
  };
  db.prepare('INSERT OR REPLACE INTO pending_questions (id, question, context, slack_message_id, slack_channel, answer, askedAt, answeredAt) VALUES (@id, @question, @context, @slack_message_id, @slack_channel, @answer, @askedAt, @answeredAt)').run(q);
  res.json(q);
});
app.patch('/api/questions/:id/answer', auth, (req, res) => {
  const { answer } = req.body;
  if (!answer) return res.status(400).json({ error: 'answer required' });
  db.prepare('UPDATE pending_questions SET answer = ?, answeredAt = ? WHERE id = ?')
    .run(answer, new Date().toISOString(), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/questions/:id', auth, (req, res) => {
  db.prepare('DELETE FROM pending_questions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── JOB APPLY LAUNCHER ───────────────────────────────────────────────────────
// Called from Google Sheet link: GET /api/apply?job_id=XXX&title=...&company=...&token=APPLY_TOKEN
// Spawns codegen session in background, returns immediately
const { spawn } = require('child_process');
const APPLY_TOKEN = 'apply-md-2026'; // static token for sheet links — not sensitive, local only

const activeCodegenSessions = new Map(); // jobId → { pid, startedAt }

app.get('/api/apply', (req, res) => {
  const { job_id, title, company, token } = req.query;
  if (token !== APPLY_TOKEN) return res.status(401).send('Unauthorized');
  if (!job_id) return res.status(400).send('Missing job_id');

  // Check if already running for this job
  if (activeCodegenSessions.has(job_id)) {
    const s = activeCodegenSessions.get(job_id);
    return res.send(`<html><body style="font-family:sans-serif;padding:40px;background:#1a1a2e;color:#eee">
      <h2>⚠️ Already Running</h2>
      <p>Codegen for <b>${title || job_id}</b> is already running (PID ${s.pid}).</p>
      <p>Check your desktop for the Playwright window.</p>
    </body></html>`);
  }

  const jobTitle = decodeURIComponent(title || 'Unknown Role');
  const jobCompany = decodeURIComponent(company || 'Unknown Company');
  const scriptPath = '/home/matthewdewstowe/.openclaw/workspace/jobs/apply-with-codegen.sh';

  console.log(`[apply-launcher] Starting codegen: ${job_id} — ${jobTitle} @ ${jobCompany}`);

  const proc = spawn('bash', [scriptPath, job_id, jobTitle, jobCompany], {
    detached: true,
    stdio: ['ignore',
      fs.openSync(`/tmp/codegen-${job_id}.log`, 'a'),
      fs.openSync(`/tmp/codegen-${job_id}.log`, 'a')
    ],
    env: { ...process.env, DISPLAY: ':0', XDG_RUNTIME_DIR: '/run/user/1000' }
  });

  proc.unref();
  activeCodegenSessions.set(job_id, { pid: proc.pid, startedAt: new Date().toISOString(), title: jobTitle, company: jobCompany });

  proc.on('exit', () => {
    activeCodegenSessions.delete(job_id);
    console.log(`[apply-launcher] Codegen ended for ${job_id}`);
  });

  res.send(`<html><body style="font-family:sans-serif;padding:40px;background:#1a1a2e;color:#eee;text-align:center">
    <h1 style="color:#7c6bf8">🎬 Codegen Started!</h1>
    <p style="font-size:1.2em"><b>${jobTitle}</b> @ <b>${jobCompany}</b></p>
    <br>
    <p>✅ A browser window is opening on your desktop now.</p>
    <p>Apply to the job normally — every action is being recorded.</p>
    <p style="color:#aaa;margin-top:30px">When you're done, <b>close the Playwright inspector window</b>.<br>
    I'll be notified automatically and will save the recording.</p>
    <br>
    <p style="color:#555;font-size:0.85em">Log: /tmp/codegen-${job_id}.log</p>
    <script>setTimeout(()=>window.close(),8000)</script>
  </body></html>`);
});

app.get('/api/apply/status', (req, res) => {
  const { token } = req.query;
  if (token !== APPLY_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  const sessions = [...activeCodegenSessions.entries()].map(([id, s]) => ({ jobId: id, ...s }));
  res.json({ activeSessions: sessions.length, sessions });
});

const server = app.listen(PORT, BIND, () => console.log(`Dashboard running on http://${BIND}:${PORT}`));
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

function shutdown(signal) {
  console.log(`[shutdown] received ${signal}`);
  server.close(() => {
    try { db.close(); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  console.error('[unhandledRejection]', error);
});
process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  process.exit(1);
});
