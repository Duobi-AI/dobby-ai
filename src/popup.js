const toggle = document.getElementById('enabled');
const status = document.getElementById('status');
const settingsLink = document.getElementById('settings');

chrome.storage.local.get('dobbyEnabled', (data) => {
  const enabled = data.dobbyEnabled !== false; // default: enabled
  toggle.checked = enabled;
  status.textContent = enabled ? 'Enabled' : 'Disabled';
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ dobbyEnabled: enabled });
  status.textContent = enabled ? 'Enabled' : 'Disabled';
  // Notify content-script tabs (filter to http/https to avoid chrome:// errors)
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'DOBBY_TOGGLE', enabled }).catch(() => {});
    });
  });
});

settingsLink.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Screenshot mode toggle
const screenshotToggle = document.getElementById('screenshot-enabled');

chrome.storage.local.get('screenshotEnabled', (data) => {
  const enabled = data.screenshotEnabled !== false; // default: enabled
  screenshotToggle.checked = enabled;
});

screenshotToggle.addEventListener('change', () => {
  const enabled = screenshotToggle.checked;
  chrome.storage.local.set({ screenshotEnabled: enabled });
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'SCREENSHOT_TOGGLE', enabled }).catch(() => {});
    });
  });
});

// Autosuggest toggle
const autosuggestToggle = document.getElementById('autosuggest-enabled');
const autosuggestStatus = document.getElementById('autosuggest-status');

chrome.storage.local.get('autosuggestEnabled', (data) => {
  const enabled = data.autosuggestEnabled === true; // default: disabled
  autosuggestToggle.checked = enabled;
});

autosuggestToggle.addEventListener('change', () => {
  const enabled = autosuggestToggle.checked;
  chrome.storage.local.set({ autosuggestEnabled: enabled });
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'AUTOSUGGEST_TOGGLE', enabled }).catch(() => {});
    });
  });
});

// Theme segmented control
const themeOptions = document.querySelectorAll('.theme-option');

function setActiveThemeOption(value) {
  themeOptions.forEach((btn) => {
    const isActive = btn.dataset.theme === value;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

chrome.storage.local.get('theme', (data) => {
  const theme = data.theme || 'auto';
  setActiveThemeOption(theme);
});

themeOptions.forEach((btn) => {
  btn.addEventListener('click', () => {
    const value = btn.dataset.theme;
    chrome.storage.local.set({ theme: value });
    setActiveThemeOption(value);
  });
});
