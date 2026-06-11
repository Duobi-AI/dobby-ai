import { applyColorVariables } from './shared/color-palette.js';
import { COLOR_SCHEME_QUERY, normalizeThemeMode, resolveTheme } from './shared/theme.js';
import { getLocalStorage, setLocalStorage } from './shared/storage.js';
import { SHOW_HISTORY_MESSAGE } from './shared/runtime-messages.js';
import type {
  ContentRuntimeMessage,
  HistoryEntry,
  StorageState,
  ThemeMode,
  UsageState,
} from './shared/types';

const FREE_CHAT_LIMIT = 30;
const LOW_QUOTA_THRESHOLD = 5;

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required popup element: ${id}`);
  return element as T;
}

const toggle = requiredElement<HTMLInputElement>('enabled');
const status = requiredElement<HTMLElement>('status');
const screenshotToggle = requiredElement<HTMLInputElement>('screenshot-enabled');
const screenshotStatus = requiredElement<HTMLElement>('screenshot-status');
const autosuggestToggle = requiredElement<HTMLInputElement>('autosuggest-enabled');
const autosuggestStatus = requiredElement<HTMLElement>('autosuggest-status');
const settingsBtn = requiredElement<HTMLButtonElement>('settings');
const historyBtn = requiredElement<HTMLButtonElement>('history');
const clearHistoryBtn = requiredElement<HTMLButtonElement>('clear-history');
const feedback = requiredElement<HTMLElement>('action-feedback');
const usageCard = requiredElement<HTMLElement>('usage-card');
const usagePrimary = requiredElement<HTMLElement>('usage-primary');
const usageSecondary = requiredElement<HTMLElement>('usage-secondary');
const versionEl = document.getElementById('version');
const themeOptions = document.querySelectorAll<HTMLElement>('.theme-option');
let themeMode: ThemeMode = 'auto';
let colorSchemeQuery: MediaQueryList | null = null;

function getUtcDay(): string {
  return new Date().toISOString().split('T')[0]!;
}

function applyTheme(value: unknown): void {
  themeMode = normalizeThemeMode(value);
  const resolvedTheme = resolveTheme(themeMode);
  applyColorVariables(document.documentElement, resolvedTheme);
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.resolvedTheme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
}

function getResetTimeLabel(): string {
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  return reset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function setSwitchState(input: HTMLInputElement, stateEl: HTMLElement, enabled: boolean): void {
  input.checked = enabled;
  stateEl.textContent = enabled ? 'On' : 'Off';
  stateEl.classList.toggle('on', enabled);
  stateEl.classList.toggle('off', !enabled);
}

function setFeedback(message: string): void {
  feedback.textContent = message || '';
}

type UsageSummary = Pick<
  UsageState,
  'chatRequests' | 'autosuggestRequests' | 'screenshotRequests' | 'freeChatRemaining'
>;

function todayUsage(rawUsage: UsageState | undefined): UsageSummary {
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

function renderUsage({ userApiKey, dobbyUsage }: Pick<StorageState, 'userApiKey' | 'dobbyUsage'>): void {
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

function setHistoryState(history: HistoryEntry[]): void {
  const hasHistory = Array.isArray(history) && history.length > 0;
  historyBtn.disabled = !hasHistory;
  clearHistoryBtn.disabled = !hasHistory;
}

function loadPopupState(): void {
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

function broadcastToContent(message: ContentRuntimeMessage): void {
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id as number, message).catch(() => {});
    });
  });
}

function setActiveThemeOption(value: ThemeMode): void {
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
