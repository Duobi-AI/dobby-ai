// tests/popup.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockStorage;
let mockTabs;

function currentUtcDay() {
  return new Date().toISOString().split('T')[0];
}

function setupDom() {
  document.documentElement.removeAttribute('data-theme-mode');
  document.documentElement.removeAttribute('data-resolved-theme');
  document.documentElement.style.colorScheme = '';
  document.body.innerHTML = `
    <div id="version"></div>
    <div id="usage-card" class="usage-card">
      <div id="usage-primary"></div>
      <div id="usage-secondary"></div>
    </div>
    <input type="checkbox" id="enabled" />
    <span id="status"></span>
    <input type="checkbox" id="screenshot-enabled" checked />
    <span id="screenshot-status"></span>
    <input type="checkbox" id="autosuggest-enabled" />
    <span id="autosuggest-status"></span>
    <button id="history">History</button>
    <button id="clear-history">Clear</button>
    <button id="settings">Settings</button>
    <div id="action-feedback"></div>
    <div id="theme-segment">
      <button class="theme-option active" data-theme="auto">Auto</button>
      <button class="theme-option" data-theme="light">Light</button>
      <button class="theme-option" data-theme="dark">Dark</button>
    </div>
  `;
}

function getStorageResult(keys) {
  if (Array.isArray(keys)) {
    return keys.reduce((acc, key) => {
      if (Object.prototype.hasOwnProperty.call(mockStorage, key)) acc[key] = mockStorage[key];
      return acc;
    }, {});
  }
  if (typeof keys === 'string') {
    return Object.prototype.hasOwnProperty.call(mockStorage, keys) ? { [keys]: mockStorage[keys] } : {};
  }
  return {};
}

async function loadPopup(initialStorage = {}) {
  vi.resetModules();
  setupDom();
  mockStorage = { ...initialStorage };
  mockTabs = [];

  global.chrome = {
    storage: {
      local: {
        get: vi.fn((keys, cb) => cb(getStorageResult(keys))),
        set: vi.fn((data, cb) => {
          Object.assign(mockStorage, data);
          if (cb) cb();
        }),
      },
    },
    tabs: {
      query: vi.fn((query, cb) => cb(mockTabs)),
      sendMessage: vi.fn(() => Promise.resolve()),
    },
    runtime: {
      getManifest: vi.fn(() => ({ version: '1.2.0' })),
      openOptionsPage: vi.fn(),
    },
  };

  await import('../src/popup.js');
}

describe('popup.js', () => {
  beforeEach(async () => {
    await loadPopup();
  });

  describe('initial state', () => {
    it('renders the manifest version', () => {
      expect(document.getElementById('version').textContent).toBe('v1.2.0');
    });

    it('loads default toggle states', () => {
      expect(document.getElementById('enabled').checked).toBe(true);
      expect(document.getElementById('status').textContent).toBe('On');
      expect(document.getElementById('screenshot-enabled').checked).toBe(true);
      expect(document.getElementById('screenshot-status').textContent).toBe('On');
      expect(document.getElementById('autosuggest-enabled').checked).toBe(false);
      expect(document.getElementById('autosuggest-status').textContent).toBe('Off');
    });

    it('loads explicit disabled/enabled settings from storage', async () => {
      await loadPopup({
        dobbyEnabled: false,
        screenshotEnabled: false,
        autosuggestEnabled: true,
      });

      expect(document.getElementById('enabled').checked).toBe(false);
      expect(document.getElementById('status').textContent).toBe('Off');
      expect(document.getElementById('screenshot-enabled').checked).toBe(false);
      expect(document.getElementById('screenshot-status').textContent).toBe('Off');
      expect(document.getElementById('autosuggest-enabled').checked).toBe(true);
      expect(document.getElementById('autosuggest-status').textContent).toBe('On');
    });
  });

  describe('usage status', () => {
    it('shows default free-tier message before quota is synced', () => {
      expect(document.getElementById('usage-primary').textContent).toBe('30 free questions/day');
      expect(document.getElementById('usage-secondary').textContent).toContain('Ask once to sync');
    });

    it('shows remaining free quota and local counters', async () => {
      await loadPopup({
        dobbyUsage: {
          day: currentUtcDay(),
          freeChatRemaining: 18,
          chatRequests: 12,
          autosuggestRequests: 7,
          screenshotRequests: 2,
        },
      });

      expect(document.getElementById('usage-primary').textContent).toBe('18/30 free left');
      expect(document.getElementById('usage-secondary').textContent).toContain('12 chats, 7 suggestions, 2 screenshots');
      expect(document.getElementById('usage-card').classList.contains('ok')).toBe(true);
    });

    it('warns when free quota is low', async () => {
      await loadPopup({
        dobbyUsage: {
          day: currentUtcDay(),
          freeChatRemaining: 4,
          chatRequests: 26,
        },
      });

      expect(document.getElementById('usage-primary').textContent).toBe('4/30 free left');
      expect(document.getElementById('usage-card').classList.contains('warning')).toBe(true);
    });

    it('shows limit reached when free quota is exhausted', async () => {
      await loadPopup({
        dobbyUsage: {
          day: currentUtcDay(),
          freeChatRemaining: 0,
          chatRequests: 30,
        },
      });

      expect(document.getElementById('usage-primary').textContent).toBe('Free quota used');
      expect(document.getElementById('usage-card').classList.contains('danger')).toBe(true);
    });

    it('shows API key status when a key is configured', async () => {
      await loadPopup({
        userApiKey: 'sk-user',
        dobbyUsage: {
          day: currentUtcDay(),
          chatRequests: 3,
          autosuggestRequests: 2,
          screenshotRequests: 1,
        },
      });

      expect(document.getElementById('usage-primary').textContent).toBe('Using your API key');
      expect(document.getElementById('usage-secondary').textContent).toContain('3 chats, 2 suggestions, 1 screenshots');
    });

    it('ignores stale usage from previous UTC days', async () => {
      await loadPopup({
        dobbyUsage: {
          day: '2000-01-01',
          freeChatRemaining: 1,
          chatRequests: 29,
        },
      });

      expect(document.getElementById('usage-primary').textContent).toBe('30 free questions/day');
    });
  });

  describe('toggle changes', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTabs = [{ id: 1 }, { id: 2 }];
    });

    it('persists and broadcasts Dobby enabled state', () => {
      const input = document.getElementById('enabled');
      input.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ dobbyEnabled: false });
      expect(document.getElementById('status').textContent).toBe('Off');
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'DOBBY_TOGGLE', enabled: false });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { type: 'DOBBY_TOGGLE', enabled: false });
    });

    it('persists and broadcasts screenshot state', () => {
      const input = document.getElementById('screenshot-enabled');
      input.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ screenshotEnabled: false });
      expect(document.getElementById('screenshot-status').textContent).toBe('Off');
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'SCREENSHOT_TOGGLE', enabled: false });
    });

    it('persists and broadcasts autosuggest state', () => {
      const input = document.getElementById('autosuggest-enabled');
      input.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ autosuggestEnabled: true });
      expect(document.getElementById('autosuggest-status').textContent).toBe('On');
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'AUTOSUGGEST_TOGGLE', enabled: true });
    });
  });

  describe('quick actions', () => {
    it('opens options page from Settings', () => {
      document.getElementById('settings').click();
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });

    it('disables history actions when there is no history', () => {
      expect(document.getElementById('history').disabled).toBe(true);
      expect(document.getElementById('clear-history').disabled).toBe(true);
    });

    it('opens history on the active tab when history exists', async () => {
      await loadPopup({ chatHistory: [{ id: '1', text: 'hello' }] });
      mockTabs = [{ id: 7 }];

      document.getElementById('history').click();

      expect(chrome.tabs.query).toHaveBeenCalledWith(
        { active: true, currentWindow: true },
        expect.any(Function),
      );
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { type: 'SHOW_HISTORY' });
      await vi.waitFor(() => {
        expect(document.getElementById('action-feedback').textContent).toBe('History opened on this page.');
      });
    });

    it('shows feedback when history cannot open on the active tab', async () => {
      await loadPopup({ chatHistory: [{ id: '1', text: 'hello' }] });
      mockTabs = [];

      document.getElementById('history').click();

      expect(document.getElementById('action-feedback').textContent).toBe('Open a regular webpage to show history.');
    });

    it('clears chat history from storage', async () => {
      await loadPopup({ chatHistory: [{ id: '1', text: 'hello' }] });

      document.getElementById('clear-history').click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ chatHistory: [] }, expect.any(Function));
      expect(mockStorage.chatHistory).toEqual([]);
      expect(document.getElementById('history').disabled).toBe(true);
      expect(document.getElementById('action-feedback').textContent).toBe('History cleared.');
    });
  });

  describe('theme toggle', () => {
    it('loads light theme from storage and activates Light button', async () => {
      await loadPopup({ theme: 'light' });
      const options = document.querySelectorAll('.theme-option');
      expect(options[0].classList.contains('active')).toBe(false);
      expect(options[1].classList.contains('active')).toBe(true);
      expect(options[2].classList.contains('active')).toBe(false);
      expect(document.documentElement.dataset.themeMode).toBe('light');
      expect(document.documentElement.dataset.resolvedTheme).toBe('light');
    });

    it('persists theme to chrome.storage on click', () => {
      vi.clearAllMocks();
      document.querySelector('.theme-option[data-theme="dark"]').click();
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ theme: 'dark' });
      expect(document.documentElement.dataset.themeMode).toBe('dark');
      expect(document.documentElement.dataset.resolvedTheme).toBe('dark');
    });

    it('resolves auto theme from OS preference', async () => {
      window.matchMedia = vi.fn(() => ({ matches: true }));
      await loadPopup({ theme: 'auto' });
      expect(document.documentElement.dataset.themeMode).toBe('auto');
      expect(document.documentElement.dataset.resolvedTheme).toBe('dark');
    });

    it('updates auto theme when the OS color scheme changes', async () => {
      let mediaHandler;
      const mediaQuery = {
        matches: false,
        addEventListener: vi.fn((event, handler) => {
          if (event === 'change') mediaHandler = handler;
        }),
      };
      window.matchMedia = vi.fn(() => mediaQuery);

      await loadPopup({ theme: 'auto' });
      expect(document.documentElement.dataset.resolvedTheme).toBe('light');

      mediaQuery.matches = true;
      mediaHandler();
      expect(document.documentElement.dataset.resolvedTheme).toBe('dark');
    });
  });
});
