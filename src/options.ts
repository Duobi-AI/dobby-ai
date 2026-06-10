// options.ts — Dobby AI settings page
import { applyColorVariables } from './shared/color-palette.js';
import { COLOR_SCHEME_QUERY, normalizeThemeMode, resolveTheme } from './shared/theme.js';
import { getLocalStorage, removeLocalStorage } from './shared/storage.js';
import { createValidateApiKeyMessage } from './shared/runtime-messages.js';
import type { ThemeMode, ValidateApiKeyResponse } from './shared/types';

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required options element: ${id}`);
  return element as T;
}

const apiKeyInput = requiredElement<HTMLInputElement>('api-key-input');
const saveBtn = requiredElement<HTMLButtonElement>('save-btn');
const removeBtn = requiredElement<HTMLButtonElement>('remove-btn');
const keyStatus = requiredElement<HTMLElement>('key-status');
const hasKeySection = requiredElement<HTMLElement>('has-key');
const noKeySection = requiredElement<HTMLElement>('no-key');
const keyDisplay = requiredElement<HTMLElement>('key-display');
const versionEl = document.getElementById('extension-version');
let themeMode: ThemeMode = 'auto';

if (versionEl && chrome.runtime.getManifest) {
  versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
}

function applyTheme(value: unknown): void {
  themeMode = normalizeThemeMode(value);
  const resolvedTheme = resolveTheme(themeMode);
  applyColorVariables(document.documentElement, resolvedTheme);
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.resolvedTheme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
}

function maskKey(key: string): string {
  if (!key || key.length < 12) return '••••••••';
  return key.substring(0, 7) + '••••' + key.substring(key.length - 4);
}

function showHasKey(key: string): void {
  hasKeySection.style.display = 'block';
  noKeySection.style.display = 'none';
  keyDisplay.textContent = maskKey(key);
}

function showNoKey(): void {
  hasKeySection.style.display = 'none';
  noKeySection.style.display = 'block';
  apiKeyInput.value = '';
  keyStatus.textContent = '';
  keyStatus.className = 'status';
}

// Load current state
getLocalStorage(['userApiKey', 'theme'], (result) => {
  applyTheme(result.theme || 'auto');
  if (result.userApiKey) {
    showHasKey(result.userApiKey);
  } else {
    showNoKey();
  }
});

if (typeof chrome.storage.onChanged?.addListener === 'function') {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName && areaName !== 'local') return;
    if (changes.theme) applyTheme(changes.theme.newValue);
  });
}

if (typeof window.matchMedia === 'function') {
  const colorSchemeQuery = window.matchMedia(COLOR_SCHEME_QUERY);
  const handleSystemThemeChange = () => {
    if (themeMode === 'auto') applyTheme('auto');
  };
  if (typeof colorSchemeQuery.addEventListener === 'function') {
    colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
  } else if (typeof colorSchemeQuery.addListener === 'function') {
    colorSchemeQuery.addListener(handleSystemThemeChange);
  }
}

// Save key
saveBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = 'Please enter an API key';
    keyStatus.className = 'status error';
    return;
  }

  if (!key.startsWith('sk-')) {
    keyStatus.textContent = 'API key should start with "sk-"';
    keyStatus.className = 'status error';
    return;
  }

  saveBtn.disabled = true;
  keyStatus.textContent = 'Validating...';
  keyStatus.className = 'status info';

  chrome.runtime.sendMessage(createValidateApiKeyMessage(key), (response: ValidateApiKeyResponse) => {
    saveBtn.disabled = false;
    if (response && response.valid) {
      keyStatus.textContent = '';
      showHasKey(key);
    } else {
      keyStatus.textContent = response && 'error' in response ? response.error : 'Invalid API key';
      keyStatus.className = 'status error';
    }
  });
});

// Enter key to save
apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

// Remove key
removeBtn.addEventListener('click', () => {
  removeLocalStorage('userApiKey', () => {
    showNoKey();
  });
});

// Provider tab switching
document.querySelectorAll<HTMLElement>('.provider-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.provider-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.provider-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    requiredElement<HTMLElement>(`panel-${tab.dataset.provider}`).classList.add('active');
  });
});
