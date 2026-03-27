// OpenClaw Chrome Extension — Popup Logic

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let currentFilter = 'open';
let allTasks = [];

// ── Initialization ──

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await send('checkAuth');
  if (auth.authenticated) {
    showMain();
    loadAll();
  } else {
    showLogin();
  }
  bindEvents();
});

function bindEvents() {
  // Login
  $('#login-form').addEventListener('submit', handleLogin);

  // Header buttons
  $('#open-dashboard').addEventListener('click', openDashboard);
  $('#refresh-btn').addEventListener('click', () => loadAll());
  $('#logout-btn').addEventListener('click', handleLogout);

  // Tabs
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Task creation
  $('#add-task-btn').addEventListener('click', addTask);
  $('#new-task-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
  });

  // Task filters
  $$('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      $$('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTasks();
    });
  });

  // Capture buttons
  $('#capture-page-btn').addEventListener('click', capturePage);
  $('#capture-note-btn').addEventListener('click', captureNote);
  $('#capture-task-btn').addEventListener('click', captureTask);
}

// ── Messaging ──

function send(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      resolve(response || { error: 'No response' });
    });
  });
}

// ── Screen Management ──

function showLogin() {
  $('#login-screen').classList.remove('hidden');
  $('#main-screen').classList.add('hidden');
}

function showMain() {
  $('#login-screen').classList.add('hidden');
  $('#main-screen').classList.remove('hidden');
}

function switchTab(tabName) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  $$('.tab-content').forEach(tc => tc.classList.add('hidden'));
  $(`#tab-${tabName}`).classList.remove('hidden');
}

// ── Auth ──

async function handleLogin(e) {
  e.preventDefault();
  const btn = $('#login-form button[type="submit"]');
  const errEl = $('#login-error');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Connecting...';

  const result = await send('login', {
    serverUrl: $('#server-url').value.replace(/\/+$/, ''),
    username: $('#username').value,
    password: $('#password').value,
    remember: $('#remember').checked,
  });

  btn.disabled = false;
  btn.textContent = 'Connect';

  if (result.error) {
    errEl.textContent = result.error;
    errEl.classList.remove('hidden');
  } else {
    showMain();
    loadAll();
  }
}

async function handleLogout() {
  await send('logout');
  showLogin();
}

async function openDashboard() {
  const { serverUrl } = await chrome.storage.local.get(['serverUrl']);
  chrome.tabs.create({ url: `${serverUrl || 'http://localhost:3737'}/missioncontrol` });
}

// ── Data Loading ──

async function loadAll() {
  setStatus(true);
  await Promise.all([loadTasks(), loadGoals(), loadSystems(), loadBriefings()]);
}

function setStatus(online) {
  const dot = $('#status-dot');
  dot.classList.toggle('online', online);
  dot.classList.toggle('offline', !online);
  dot.title = online ? 'Connected' : 'Disconnected';
}

// ── Tasks ──

async function loadTasks() {
  const result = await send('getTasks');
  if (result.error) {
    setStatus(false);
    $('#tasks-list').innerHTML = '';
    $('#tasks-empty').classList.remove('hidden');
    $('#tasks-empty').textContent = result.error;
    return;
  }
  allTasks = Array.isArray(result) ? result : [];
  renderTasks();
}

function renderTasks() {
  const list = $('#tasks-list');
  const empty = $('#tasks-empty');

  let filtered = allTasks;
  if (currentFilter === 'open') filtered = allTasks.filter(t => !t.done);
  else if (currentFilter === 'done') filtered = allTasks.filter(t => t.done);

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.textContent = currentFilter === 'open' ? 'No open tasks' : currentFilter === 'done' ? 'No completed tasks' : 'No tasks found';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = filtered.map(t => `
    <div class="task-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}">
      <div class="task-text">
        ${escapeHtml(t.text)}
        <div class="task-meta">
          <span class="tag ${t.priority || 'medium'}">${t.priority || 'med'}</span>
          ${t.category && t.category !== 'general' ? `<span class="tag category">${t.category}</span>` : ''}
          ${t.kanban_column ? `<span class="tag column">${t.kanban_column}</span>` : ''}
        </div>
      </div>
      <button class="task-delete" data-id="${t.id}" title="Delete">&times;</button>
    </div>
  `).join('');

  // Bind checkbox toggles
  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => toggleTask(cb.dataset.id, cb.checked));
  });

  // Bind delete buttons
  list.querySelectorAll('.task-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.id));
  });
}

async function addTask() {
  const input = $('#new-task-text');
  const text = input.value.trim();
  if (!text) return;

  const priority = $('#new-task-priority').value;
  const result = await send('createTask', { task: { text, priority } });

  if (result.error) {
    showCaptureStatus(result.error, false);
    return;
  }

  input.value = '';
  await loadTasks();
}

async function toggleTask(id, done) {
  await send('toggleTask', { id, done });
  // Update local state immediately for responsiveness
  const task = allTasks.find(t => t.id === id);
  if (task) task.done = done ? 1 : 0;
  renderTasks();
}

async function deleteTask(id) {
  await send('deleteTask', { id });
  allTasks = allTasks.filter(t => t.id !== id);
  renderTasks();
}

// ── Goals ──

async function loadGoals() {
  const result = await send('getGoals');
  if (result.error) return;

  const goals = Array.isArray(result) ? result : [];
  const list = $('#goals-list');
  const empty = $('#goals-empty');

  if (goals.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = goals.map(g => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    return `
      <div class="goal-item">
        <div class="goal-header">
          <span class="goal-title">${escapeHtml(g.title)}</span>
          <span class="goal-values">${g.current}/${g.target} ${g.unit || ''}</span>
        </div>
        <div class="goal-bar">
          <div class="goal-bar-fill" style="width: ${pct}%"></div>
        </div>
        ${g.description ? `<div class="goal-desc">${escapeHtml(g.description)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ── Systems / Status ──

async function loadSystems() {
  const result = await send('getSystems');
  if (result.error) return;

  const systems = Array.isArray(result) ? result : [];
  const list = $('#systems-list');

  list.innerHTML = systems.map(s => `
    <div class="system-item">
      <span class="system-icon">${s.icon || ''}</span>
      <div class="system-info">
        <div class="system-name">${escapeHtml(s.name)}</div>
        <div class="system-account">${escapeHtml(s.account || '')}</div>
      </div>
      <span class="system-status ${s.status}">${s.status}</span>
    </div>
  `).join('');
}

async function loadBriefings() {
  const result = await send('getBriefings');
  if (result.error) return;

  const briefings = Array.isArray(result) ? result : [];
  const card = $('#latest-briefing');
  const content = $('#briefing-content');

  if (briefings.length === 0) {
    card.classList.add('hidden');
    return;
  }

  const latest = briefings[0];
  card.classList.remove('hidden');
  content.innerHTML = `<strong>${escapeHtml(latest.title || 'Briefing')}</strong><br>${escapeHtml(latest.content || '').substring(0, 500)}`;
}

// ── Capture ──

async function capturePage() {
  const btn = $('#capture-page-btn');
  btn.disabled = true;
  btn.textContent = 'Capturing...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');

    const result = await send('captureMemory', {
      entry: {
        key: `capture/page/${new Date().toISOString().split('T')[0]}`,
        value: `**Captured Page**\n- Title: ${tab.title}\n- URL: ${tab.url}\n- Captured: ${new Date().toISOString()}`,
      },
    });

    if (result.error) throw new Error(result.error);
    showCaptureStatus('Page captured to memory', true);
  } catch (err) {
    showCaptureStatus(err.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Capture Current Page';
  }
}

async function captureNote() {
  const text = $('#capture-note-text').value.trim();
  const key = $('#capture-note-key').value.trim() || `note/${new Date().toISOString().split('T')[0]}`;
  if (!text) return showCaptureStatus('Enter a note first', false);

  const result = await send('captureMemory', {
    entry: { key, value: text },
  });

  if (result.error) return showCaptureStatus(result.error, false);

  $('#capture-note-text').value = '';
  $('#capture-note-key').value = '';
  showCaptureStatus('Note saved to memory', true);
}

async function captureTask() {
  const text = $('#capture-task-text').value.trim();
  if (!text) return showCaptureStatus('Enter a task description', false);

  const result = await send('createTask', { task: { text, priority: 'medium', category: 'captured' } });

  if (result.error) return showCaptureStatus(result.error, false);

  $('#capture-task-text').value = '';
  showCaptureStatus('Task created', true);
  await loadTasks();
}

function showCaptureStatus(msg, success) {
  const el = $('#capture-status');
  el.textContent = msg;
  el.className = success ? 'success' : 'error';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── Utility ──

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
