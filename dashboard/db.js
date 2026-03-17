const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'dashboard.db');

const db = new Database(DB_PATH);

// Enable WAL mode + durability settings
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('wal_autocheckpoint = 100');
db.pragma('cache_size = -8000');

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'general',
    kanban_column TEXT DEFAULT 'Triage',
    dueDate TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  -- Add kanban_column if upgrading existing DB
  CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY);


  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    target REAL DEFAULT 0,
    current REAL DEFAULT 0,
    unit TEXT DEFAULT 'units',
    lastUpdated TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS briefings (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    type TEXT DEFAULT 'daily',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS icps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT,
    company TEXT,
    email TEXT,
    linkedin TEXT,
    notes TEXT,
    status TEXT DEFAULT 'new',
    score INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    content TEXT,
    status TEXT DEFAULT 'draft',
    scheduledFor TEXT,
    publishedAt TEXT,
    impressions INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    client TEXT,
    value REAL,
    status TEXT DEFAULT 'draft',
    goalAlignment TEXT,
    notes TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS job_applications (
    id TEXT PRIMARY KEY,
    dateApplied TEXT,
    title TEXT,
    company TEXT,
    location TEXT,
    salary TEXT,
    source TEXT,
    score INTEGER DEFAULT 0,
    summary TEXT,
    contact TEXT,
    url TEXT,
    status TEXT DEFAULT 'applied',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS memory_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT,
    value TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS feedback_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suggestion_type TEXT NOT NULL,
    suggestion_content TEXT NOT NULL,
    action TEXT NOT NULL,
    amendment TEXT,
    reason TEXT,
    context TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS preference_profile (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    confidence REAL DEFAULT 0.5,
    examples INTEGER DEFAULT 1,
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id TEXT NOT NULL,
    value REAL NOT NULL,
    note TEXT,
    recordedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS today_priorities (
    date TEXT PRIMARY KEY,
    headline TEXT,
    priorities TEXT,
    blockers TEXT,
    context TEXT,
    generatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_summaries (
    date TEXT PRIMARY KEY,
    summary TEXT,
    achievements TEXT,
    tasksCompleted INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS risks (
    id TEXT PRIMARY KEY,
    goal_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    likelihood TEXT DEFAULT 'medium',
    impact TEXT DEFAULT 'medium',
    severity TEXT DEFAULT 'medium',
    mitigation TEXT,
    status TEXT DEFAULT 'open',
    owner TEXT DEFAULT 'Matthew',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pending_questions (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    context TEXT,
    slack_message_id TEXT,
    slack_channel TEXT,
    answer TEXT,
    askedAt TEXT NOT NULL,
    answeredAt TEXT
  );
`);

// Migrate existing JSON data to SQLite
function migrateFromJSON(jsonFile, table, transform) {
  try {
    const jsonPath = path.join(__dirname, 'data', jsonFile);
    if (!fs.existsSync(jsonPath)) return 0;
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!Array.isArray(data) || data.length === 0) return 0;
    const count = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
    if (count > 0) return 0; // already migrated
    const insert = db.prepare(transform(data[0]));
    let migrated = 0;
    for (const item of data) {
      try { insert.run(item); migrated++; } catch(e) {}
    }
    return migrated;
  } catch(e) { return 0; }
}

// Schema migrations
try { db.exec(`ALTER TABLE tasks ADD COLUMN kanban_column TEXT DEFAULT 'Triage'`); } catch(e) {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN dueDate TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN notes TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN completedAt TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN goal_id TEXT`); } catch(e) {}

// Fix any tasks still defaulting to 'Later' that were never explicitly set
try { db.exec(`UPDATE tasks SET kanban_column = 'Triage' WHERE kanban_column IS NULL`); } catch(e) {}

// Run migrations
const tasksMigrated = migrateFromJSON('tasks.json', 'tasks', (item) =>
  `INSERT OR IGNORE INTO tasks (id, text, done, priority, category, dueDate, createdAt) VALUES (@id, @text, @done, @priority, @category, @dueDate, @createdAt)`
);
const goalsMigrated = migrateFromJSON('goals.json', 'goals', (item) =>
  `INSERT OR IGNORE INTO goals (id, title, description, target, current, unit, lastUpdated, createdAt) VALUES (@id, @title, @description, @target, @current, @unit, @lastUpdated, @createdAt)`
);
const briefingsMigrated = migrateFromJSON('briefings.json', 'briefings', (item) =>
  `INSERT OR IGNORE INTO briefings (id, title, content, createdAt) VALUES (@id, @title, @content, @createdAt)`
);
const icpsMigrated = migrateFromJSON('icps.json', 'icps', (item) =>
  `INSERT OR IGNORE INTO icps (id, name, title, company, email, linkedin, notes, status, score, createdAt) VALUES (@id, @name, @title, @company, @email, @linkedin, @notes, @status, @score, @createdAt)`
);
const postsMigrated = migrateFromJSON('posts.json', 'posts', (item) =>
  `INSERT OR IGNORE INTO posts (id, content, status, scheduledFor, createdAt) VALUES (@id, @content, @status, @scheduledFor, @createdAt)`
);

if (tasksMigrated || goalsMigrated || briefingsMigrated || icpsMigrated || postsMigrated) {
  console.log(`DB migrated: tasks=${tasksMigrated} goals=${goalsMigrated} briefings=${briefingsMigrated} icps=${icpsMigrated} posts=${postsMigrated}`);
}

// Startup reconciliation — merge JSON files into SQLite to ensure no data loss
// Runs every boot; INSERT OR IGNORE so existing records are never overwritten
function reconcileFromJson(jsonFile, insertSql, transform) {
  try {
    const jsonPath = path.join(__dirname, 'data', jsonFile);
    if (!fs.existsSync(jsonPath)) return;
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!Array.isArray(data) || data.length === 0) return;
    const stmt = db.prepare(insertSql);
    let count = 0;
    for (const item of data) {
      try { stmt.run(transform(item)); count++; } catch(e) {}
    }
    if (count > 0) console.log(`Reconciled ${count} records from ${jsonFile}`);
  } catch(e) {}
}

reconcileFromJson('tasks.json',
  'INSERT OR IGNORE INTO tasks (id, text, done, priority, category, kanban_column, dueDate, createdAt, updatedAt) VALUES (@id, @text, @done, @priority, @category, @kanban_column, @dueDate, @createdAt, @updatedAt)',
  item => ({ id: item.id, text: item.text || item.title || '', done: item.done || item.completed ? 1 : 0, priority: item.priority || 'medium', category: item.category || 'general', kanban_column: item.kanban_column || 'Later', dueDate: item.dueDate || null, createdAt: item.createdAt || new Date().toISOString(), updatedAt: item.updatedAt || new Date().toISOString() })
);
reconcileFromJson('goals.json',
  'INSERT OR IGNORE INTO goals (id, title, description, target, current, unit, lastUpdated, createdAt) VALUES (@id, @title, @description, @target, @current, @unit, @lastUpdated, @createdAt)',
  item => ({ id: item.id, title: item.title || '', description: item.description || '', target: item.target || 0, current: item.current || 0, unit: item.unit || 'units', lastUpdated: item.lastUpdated || '', createdAt: item.createdAt || new Date().toISOString() })
);
reconcileFromJson('proposals.json',
  'INSERT OR IGNORE INTO proposals (id, title, client, value, status, goalAlignment, notes, createdAt) VALUES (@id, @title, @client, @value, @status, @goalAlignment, @notes, @createdAt)',
  item => ({ id: item.id, title: item.title || '', client: item.client || '', value: item.value || 0, status: item.status || 'draft', goalAlignment: item.goalAlignment || '', notes: item.notes || item.description || '', createdAt: item.createdAt || new Date().toISOString() })
);
reconcileFromJson('icps.json',
  'INSERT OR IGNORE INTO icps (id, name, title, company, email, linkedin, notes, status, score, createdAt, updatedAt) VALUES (@id, @name, @title, @company, @email, @linkedin, @notes, @status, @score, @createdAt, @updatedAt)',
  item => ({ id: item.id, name: item.name || '', title: item.title || '', company: item.company || '', email: item.email || '', linkedin: item.linkedin || '', notes: item.notes || '', status: item.status || 'new', score: item.score || 0, createdAt: item.createdAt || new Date().toISOString(), updatedAt: item.updatedAt || new Date().toISOString() })
);
reconcileFromJson('posts.json',
  'INSERT OR IGNORE INTO posts (id, content, status, scheduledFor, publishedAt, impressions, createdAt) VALUES (@id, @content, @status, @scheduledFor, @publishedAt, @impressions, @createdAt)',
  item => ({ id: item.id, content: item.content || '', status: item.status || 'draft', scheduledFor: item.scheduledFor || null, publishedAt: item.publishedAt || null, impressions: item.impressions || 0, createdAt: item.createdAt || new Date().toISOString() })
);

// Also write Markdown task log on startup (append-only audit trail)
function writeTaskMarkdown() {
  try {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC').all();
    const date = new Date().toISOString().split('T')[0];
    const mdPath = path.join(__dirname, 'data', `tasks-${date}.md`);
    const lines = [`# Tasks — ${date}\n`, `Generated: ${new Date().toISOString()}\n\n`];
    const open = tasks.filter(t => !t.done);
    const done = tasks.filter(t => t.done);
    lines.push('## Open\n');
    open.forEach(t => lines.push(`- [ ] [${t.category}] [${t.kanban_column||'Later'}] ${t.text}${t.dueDate ? ' — due: '+t.dueDate : ''}\n`));
    lines.push('\n## Done\n');
    done.forEach(t => lines.push(`- [x] ${t.text}\n`));
    fs.writeFileSync(mdPath, lines.join(''));
  } catch(e) {}
}
writeTaskMarkdown();

module.exports = db;
