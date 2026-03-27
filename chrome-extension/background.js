// OpenClaw Chrome Extension — Background Service Worker

const DEFAULT_SERVER = 'http://localhost:3737';

// Get stored auth config
async function getConfig() {
  const result = await chrome.storage.local.get(['serverUrl', 'token']);
  return {
    serverUrl: result.serverUrl || DEFAULT_SERVER,
    token: result.token || null,
  };
}

// Make authenticated API request
async function apiRequest(endpoint, options = {}) {
  const config = await getConfig();
  if (!config.token) throw new Error('Not authenticated');

  const url = `${config.serverUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    await chrome.storage.local.remove(['token']);
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch(err =>
    sendResponse({ error: err.message })
  );
  return true; // keep channel open for async response
});

async function handleMessage(msg) {
  switch (msg.action) {
    case 'login':
      return login(msg.serverUrl, msg.username, msg.password, msg.remember);
    case 'logout':
      return logout();
    case 'checkAuth':
      return checkAuth();
    case 'getTasks':
      return apiRequest('/api/tasks');
    case 'createTask':
      return apiRequest('/api/tasks', { method: 'POST', body: JSON.stringify(msg.task) });
    case 'toggleTask':
      return apiRequest(`/api/tasks/${msg.id}`, { method: 'PATCH', body: JSON.stringify({ done: msg.done ? 1 : 0 }) });
    case 'deleteTask':
      return apiRequest(`/api/tasks/${msg.id}`, { method: 'DELETE' });
    case 'getGoals':
      return apiRequest('/api/goals');
    case 'getSystems':
      return apiRequest('/api/systems');
    case 'getBriefings':
      return apiRequest('/api/briefings');
    case 'captureMemory':
      return apiRequest('/api/memory-log', { method: 'POST', body: JSON.stringify(msg.entry) });
    default:
      throw new Error(`Unknown action: ${msg.action}`);
  }
}

async function login(serverUrl, username, password, remember) {
  const url = `${serverUrl}/api/login`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, remember }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Login failed');
  }

  const data = await response.json();
  await chrome.storage.local.set({
    serverUrl,
    token: data.token,
    username: data.username,
  });
  return { ok: true, username: data.username };
}

async function logout() {
  await chrome.storage.local.remove(['token', 'username']);
  return { ok: true };
}

async function checkAuth() {
  const config = await getConfig();
  if (!config.token) return { authenticated: false };

  try {
    // Quick health check — try fetching tasks
    await apiRequest('/api/tasks');
    const { username } = await chrome.storage.local.get(['username']);
    return { authenticated: true, username, serverUrl: config.serverUrl };
  } catch {
    return { authenticated: false };
  }
}
