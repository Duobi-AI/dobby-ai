// @ts-check

import { applyColorVariables } from './shared/color-palette.js';
import { COLOR_SCHEME_QUERY, normalizeThemeMode, resolveTheme } from './shared/theme.js';
import { getLocalStorage, setLocalStorage } from './shared/storage.js';
import { SHOW_HISTORY_MESSAGE } from './shared/runtime-messages.js';

/** @typedef {import('./shared/types').ContentRuntimeMessage} ContentRuntimeMessage */
/** @typedef {import('./shared/types').HistoryEntry} HistoryEntry */
/** @typedef {import('./shared/types').StorageState} StorageState */
/** @typedef {import('./shared/types').ThemeMode} ThemeMode */
/** @typedef {import('./shared/types').UsageState} UsageState */

const FREE_CHAT_LIMIT = 30;
const LOW_QUOTA_THRESHOLD = 5;

const toggle = /** @type {HTMLInputElement} */ (document.getElementById('enabled'));
const status = document.getElementById('status');
const screenshotToggle = /** @type {HTMLInputElement} */ (document.getElementById('screenshot-enabled'));
const screenshotStatus = document.getElementById('screenshot-status');
const autosuggestToggle = /** @type {HTMLInputElement} */ (document.getElementById('autosuggest-enabled'));
const autosuggestStatus = document.getElementById('autosuggest-status');
const settingsBtn = document.getElementById('settings');
const historyBtn = /** @type {HTMLButtonElement} */ (document.getElementById('history'));
const clearHistoryBtn = /** @type {HTMLButtonElement} */ (document.getElementById('clear-history'));
const feedback = document.getElementById('action-feedback');
const usageCard = document.getElementById('usage-card');
const usagePrimary = document.getElementById('usage-primary');
const usageSecondary = document.getElementById('usage-secondary');
const versionEl = document.getElementById('version');
const themeOptions = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.theme-option'));
/** @type {ThemeMode} */
let themeMode = 'auto';
/** @type {MediaQueryList | null} */
let colorSchemeQuery = null;

/** @returns {string} */
function getUtcDay() {
  return new Date().toISOString().split('T')[0];
}

/** @param {unknown} value */
function applyTheme(value) {
  themeMode = normalizeThemeMode(value);
  const resolvedTheme = resolveTheme(themeMode);
  applyColorVariables(document.documentElement, resolvedTheme);
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.resolvedTheme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
}

function getResetTimeLabel() {
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  return reset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * @param {HTMLInputElement} input
 * @param {HTMLElement} stateEl
 * @param {boolean} enabled
 */
function setSwitchState(input, stateEl, enabled) {
  input.checked = enabled;
  stateEl.textContent = enabled ? 'On' : 'Off';
  stateEl.classList.toggle('on', enabled);
  stateEl.classList.toggle('off', !enabled);
}

/** @param {string} message */
function setFeedback(message) {
  feedback.textContent = message || '';
}

/** @param {UsageState | undefined} rawUsage */
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

/** @param {Pick<StorageState, 'userApiKey' | 'dobbyUsage'>} state */
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

/** @param {HistoryEntry[]} history */
function setHistoryState(history) {
  const hasHistory = Array.isArray(history) && history.length > 0;
  historyBtn.disabled = !hasHistory;
  clearHistoryBtn.disabled = !hasHistory;
}

function loadPopupState() {
  getLocalStorage([
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

/** @param {ContentRuntimeMessage} message */
function broadcastToContent(message) {
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(/** @type {number} */ (tab.id), message).catch(() => {});
    });
  });
}

/** @param {ThemeMode} value */
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
  setLocalStorage({ dobbyEnabled: enabled });
  setSwitchState(toggle, status, enabled);
  broadcastToContent({ type: 'DOBBY_TOGGLE', enabled });
});

screenshotToggle.addEventListener('change', () => {
  const enabled = screenshotToggle.checked;
  setLocalStorage({ screenshotEnabled: enabled });
  setSwitchState(screenshotToggle, screenshotStatus, enabled);
  broadcastToContent({ type: 'SCREENSHOT_TOGGLE', enabled });
});

autosuggestToggle.addEventListener('change', () => {
  const enabled = autosuggestToggle.checked;
  setLocalStorage({ autosuggestEnabled: enabled });
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
    chrome.tabs.sendMessage(tabId, SHOW_HISTORY_MESSAGE)
      .then(() => setFeedback('History opened on this page.'))
      .catch(() => setFeedback('Open a regular webpage to show history.'));
  });
});

clearHistoryBtn.addEventListener('click', () => {
  setLocalStorage({ chatHistory: [] }, () => {
    setHistoryState([]);
    setFeedback('History cleared.');
  });
});

themeOptions.forEach((btn) => {
  btn.addEventListener('click', () => {
    const value = btn.dataset.theme;
    if (value !== 'auto' && value !== 'light' && value !== 'dark') return;
    setLocalStorage({ theme: value });
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
