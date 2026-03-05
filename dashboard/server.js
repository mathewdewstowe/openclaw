const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

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
const JWT_SECRET = 'md-dashboard-secret-2026-sonesse';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA = path.join(__dirname, 'data');
const readData = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
const writeData = (file, data) => fs.writeFileSync(path.join(DATA, file), JSON.stringify(data, null, 2));

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
app.get('/api/tasks', auth, (req, res) => res.json(readData('tasks.json')));
app.patch('/api/tasks/:id', auth, (req, res) => {
  const tasks = readData('tasks.json');
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  Object.assign(task, req.body);
  writeData('tasks.json', tasks);
  res.json(task);
});
app.post('/api/tasks', auth, (req, res) => {
  const tasks = readData('tasks.json');
  const newTask = { id: Date.now().toString(), completed: false, createdAt: new Date().toISOString().split('T')[0], ...req.body };
  tasks.push(newTask);
  writeData('tasks.json', tasks);
  res.json(newTask);
});

// AGENTS
app.get('/api/agents', auth, (req, res) => res.json(readData('agents.json')));

// GOALS
app.get('/api/goals', auth, (req, res) => res.json(readData('goals.json')));
app.patch('/api/goals/:id', auth, (req, res) => {
  const goals = readData('goals.json');
  const goal = goals.find(g => g.id === req.params.id);
  if (!goal) return res.status(404).json({ error: 'Not found' });
  Object.assign(goal, req.body, { lastUpdated: new Date().toISOString().split('T')[0] });
  writeData('goals.json', goals);
  res.json(goal);
});

// PROPOSALS
app.get('/api/proposals', auth, (req, res) => res.json(readData('proposals.json')));
app.patch('/api/proposals/:id', auth, (req, res) => {
  const proposals = readData('proposals.json');
  const p = proposals.find(p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  Object.assign(p, req.body);
  writeData('proposals.json', proposals);
  res.json(p);
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
app.get('/api/briefings', auth, (req, res) => {
  const b = readData('briefings.json');
  res.json(b.slice(0, 30));
});
app.post('/api/briefings', auth, (req, res) => {
  const briefings = readData('briefings.json');
  const entry = { id: Date.now().toString(), createdAt: new Date().toISOString(), ...req.body };
  briefings.unshift(entry);
  writeData('briefings.json', briefings.slice(0, 90)); // keep 90 days
  res.json(entry);
});

// ICPs
app.get('/api/icps', auth, (req, res) => res.json(readData('icps.json')));
app.post('/api/icps', auth, (req, res) => {
  const icps = readData('icps.json');
  const icp = { id: 'icp-' + Date.now(), createdAt: new Date().toISOString(), ...req.body };
  icps.push(icp);
  writeData('icps.json', icps);
  res.json(icp);
});
app.patch('/api/icps/:id', auth, (req, res) => {
  const icps = readData('icps.json');
  const icp = icps.find(i => i.id === req.params.id);
  if (!icp) return res.status(404).json({ error: 'Not found' });
  Object.assign(icp, req.body);
  writeData('icps.json', icps);
  res.json(icp);
});
app.delete('/api/icps/:id', auth, (req, res) => {
  let icps = readData('icps.json');
  icps = icps.filter(i => i.id !== req.params.id);
  writeData('icps.json', icps);
  res.json({ ok: true });
});

// LINKEDIN POSTS
app.get('/api/posts', auth, (req, res) => res.json(readData('posts.json')));
app.post('/api/posts', auth, (req, res) => {
  const posts = readData('posts.json');
  const newPost = { id: Date.now().toString(), createdAt: new Date().toISOString(), status: 'draft', ...req.body };
  posts.unshift(newPost);
  writeData('posts.json', posts);
  res.json(newPost);
});
app.patch('/api/posts/:id', auth, (req, res) => {
  const posts = readData('posts.json');
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  Object.assign(post, req.body);
  writeData('posts.json', posts);
  res.json(post);
});
app.delete('/api/posts/:id', auth, (req, res) => {
  let posts = readData('posts.json');
  posts = posts.filter(p => p.id !== req.params.id);
  writeData('posts.json', posts);
  res.json({ ok: true });
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

app.listen(PORT, '127.0.0.1', () => console.log(`Dashboard running on http://localhost:${PORT}`));
