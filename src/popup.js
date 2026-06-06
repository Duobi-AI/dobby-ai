const FREE_CHAT_LIMIT = 30;
const LOW_QUOTA_THRESHOLD = 5;

const toggle = document.getElementById('enabled');
const status = document.getElementById('status');
const screenshotToggle = document.getElementById('screenshot-enabled');
const screenshotStatus = document.getElementById('screenshot-status');
const autosuggestToggle = document.getElementById('autosuggest-enabled');
const autosuggestStatus = document.getElementById('autosuggest-status');
const settingsBtn = document.getElementById('settings');
const historyBtn = document.getElementById('history');
const clearHistoryBtn = document.getElementById('clear-history');
const feedback = document.getElementById('action-feedback');
const usageCard = document.getElementById('usage-card');
const usagePrimary = document.getElementById('usage-primary');
const usageSecondary = document.getElementById('usage-secondary');
const versionEl = document.getElementById('version');
const themeOptions = document.querySelectorAll('.theme-option');
const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';
let themeMode = 'auto';
let colorSchemeQuery = null;

function getUtcDay() {
  return new Date().toISOString().split('T')[0];
}

function normalizeThemeMode(value) {
  return value === 'light' || value === 'dark' || value === 'auto' ? value : 'auto';
}

function getSystemTheme() {
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light';
  }
  return 'light';
}

function resolveTheme(value) {
  const mode = normalizeThemeMode(value);
  return mode === 'auto' ? getSystemTheme() : mode;
}

function applyTheme(value) {
  themeMode = normalizeThemeMode(value);
  const resolvedTheme = resolveTheme(themeMode);
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.resolvedTheme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
}

function getResetTimeLabel() {
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  return reset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function setSwitchState(input, stateEl, enabled) {
  input.checked = enabled;
  stateEl.textContent = enabled ? 'On' : 'Off';
  stateEl.classList.toggle('on', enabled);
  stateEl.classList.toggle('off', !enabled);
}

function setFeedback(message) {
  feedback.textContent = message || '';
}

function todayUsage(rawUsage) {
  if (!rawUsage || rawUsage.day !== getUtcDay()) {
    return {
      chatRequests: 0,
      autosuggestRequests: 0,
      screenshotRequests: 0,
      freeChatRemaining: null,
    };
  }
  return rawUsage;
}

function renderUsage({ userApiKey, dobbyUsage }) {
  const usage = todayUsage(dobbyUsage);
  usageCard.classList.remove('ok', 'warning', 'danger');

  if (userApiKey) {
    usageCard.classList.add('ok');
    usagePrimary.textContent = 'Using your API key';
    usageSecondary.textContent = `Provider billing applies. Today: ${usage.chatRequests || 0} chats, ${usage.autosuggestRequests || 0} suggestions, ${usage.screenshotRequests || 0} screenshots.`;
    return;
  }

  const remaining = Number.isFinite(usage.freeChatRemaining) ? usage.freeChatRemaining : null;
  if (remaining == null) {
    usagePrimary.textContent = `${FREE_CHAT_LIMIT} free questions/day`;
    usageSecondary.textContent = 'Ask once to sync remaining quota. Add an API key for unlimited use.';
    return;
  }

  if (remaining <= 0) {
    usageCard.classList.add('danger');
    usagePrimary.textContent = 'Free quota used';
  } else {
    usageCard.classList.add(remaining <= LOW_QUOTA_THRESHOLD ? 'warning' : 'ok');
    usagePrimary.textContent = `${remaining}/${FREE_CHAT_LIMIT} free left`;
  }

  usageSecondary.textContent = `Resets around ${getResetTimeLabel()}. Today: ${usage.chatRequests || 0} chats, ${usage.autosuggestRequests || 0} suggestions, ${usage.screenshotRequests || 0} screenshots.`;
}

function setHistoryState(history) {
  const hasHistory = Array.isArray(history) && history.length > 0;
  historyBtn.disabled = !hasHistory;
  clearHistoryBtn.disabled = !hasHistory;
}

function loadPopupState() {
  chrome.storage.local.get([
    'dobbyEnabled',
    'screenshotEnabled',
    'autosuggestEnabled',
    'theme',
    'userApiKey',
    'dobbyUsage',
    'chatHistory',
  ], (data) => {
    setSwitchState(toggle, status, data.dobbyEnabled !== false);
    setSwitchState(screenshotToggle, screenshotStatus, data.screenshotEnabled !== false);
    setSwitchState(autosuggestToggle, autosuggestStatus, data.autosuggestEnabled === true);
    setActiveThemeOption(data.theme || 'auto');
    applyTheme(data.theme || 'auto');
    renderUsage({ userApiKey: data.userApiKey, dobbyUsage: data.dobbyUsage });
    setHistoryState(data.chatHistory || []);
  });
}

function broadcastToContent(message) {
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    });
  });
}

function setActiveThemeOption(value) {
  themeOptions.forEach((btn) => {
    const isActive = btn.dataset.theme === value;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

if (versionEl && chrome.runtime.getManifest) {
  versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
}

loadPopupState();

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ dobbyEnabled: enabled });
  setSwitchState(toggle, status, enabled);
  broadcastToContent({ type: 'DOBBY_TOGGLE', enabled });
});

screenshotToggle.addEventListener('change', () => {
  const enabled = screenshotToggle.checked;
  chrome.storage.local.set({ screenshotEnabled: enabled });
  setSwitchState(screenshotToggle, screenshotStatus, enabled);
  broadcastToContent({ type: 'SCREENSHOT_TOGGLE', enabled });
});

autosuggestToggle.addEventListener('change', () => {
  const enabled = autosuggestToggle.checked;
  chrome.storage.local.set({ autosuggestEnabled: enabled });
  setSwitchState(autosuggestToggle, autosuggestStatus, enabled);
  broadcastToContent({ type: 'AUTOSUGGEST_TOGGLE', enabled });
});

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

historyBtn.addEventListener('click', () => {
  setFeedback('');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs && tabs[0] && tabs[0].id;
    if (!tabId) {
      setFeedback('Open a regular webpage to show history.');
      return;
    }
    chrome.tabs.sendMessage(tabId, { type: 'SHOW_HISTORY' })
      .then(() => setFeedback('History opened on this page.'))
      .catch(() => setFeedback('Open a regular webpage to show history.'));
  });
});

clearHistoryBtn.addEventListener('click', () => {
  chrome.storage.local.set({ chatHistory: [] }, () => {
    setHistoryState([]);
    setFeedback('History cleared.');
  });
});

themeOptions.forEach((btn) => {
  btn.addEventListener('click', () => {
    const value = btn.dataset.theme;
    chrome.storage.local.set({ theme: value });
    setActiveThemeOption(value);
    applyTheme(value);
  });
});

if (typeof window.matchMedia === 'function') {
  colorSchemeQuery = window.matchMedia(COLOR_SCHEME_QUERY);
  const handleSystemThemeChange = () => {
    if (themeMode === 'auto') applyTheme('auto');
  };
  if (typeof colorSchemeQuery.addEventListener === 'function') {
    colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
  } else if (typeof colorSchemeQuery.addListener === 'function') {
    colorSchemeQuery.addListener(handleSystemThemeChange);
  }
}
