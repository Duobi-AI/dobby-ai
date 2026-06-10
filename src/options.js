// @ts-check

// options.js — Dobby AI settings page
import { applyColorVariables } from './shared/color-palette.js';
import { COLOR_SCHEME_QUERY, normalizeThemeMode, resolveTheme } from './shared/theme.js';
import { getLocalStorage, removeLocalStorage } from './shared/storage.js';
import { createValidateApiKeyMessage } from './shared/runtime-messages.js';

/** @typedef {import('./shared/types').StorageState} StorageState */
/** @typedef {import('./shared/types').ThemeMode} ThemeMode */
/** @typedef {import('./shared/types').ValidateApiKeyResponse} ValidateApiKeyResponse */

const apiKeyInput = /** @type {HTMLInputElement} */ (document.getElementById('api-key-input'));
const saveBtn = /** @type {HTMLButtonElement} */ (document.getElementById('save-btn'));
const removeBtn = document.getElementById('remove-btn');
const keyStatus = document.getElementById('key-status');
const hasKeySection = document.getElementById('has-key');
const noKeySection = document.getElementById('no-key');
const keyDisplay = document.getElementById('key-display');
const versionEl = document.getElementById('extension-version');
/** @type {ThemeMode} */
let themeMode = 'auto';

if (versionEl && chrome.runtime.getManifest) {
  versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
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

/** @param {string} key */
function maskKey(key) {
  if (!key || key.length < 12) return '••••••••';
  return key.substring(0, 7) + '••••' + key.substring(key.length - 4);
}

/** @param {string} key */
function showHasKey(key) {
  hasKeySection.style.display = 'block';
  noKeySection.style.display = 'none';
  keyDisplay.textContent = maskKey(key);
}

function showNoKey() {
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

  chrome.runtime.sendMessage(createValidateApiKeyMessage(key), (/** @type {ValidateApiKeyResponse} */ response) => {
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
/** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.provider-tab')).forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.provider-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.provider-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.provider}`).classList.add('active');
  });
});
