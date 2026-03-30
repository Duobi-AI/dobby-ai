// tests/popup.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

const storageGetCallbacks = {};

// Set up DOM elements before importing popup.js
document.body.innerHTML = `
  <input type="checkbox" id="enabled" />
  <span id="status"></span>
  <input type="checkbox" id="screenshot-enabled" checked />
  <span id="screenshot-status">Screenshot mode</span>
  <input type="checkbox" id="autosuggest-enabled" />
  <span id="autosuggest-status" title="Works in standard text fields (textarea). Gmail, Docs, and Notion support coming soon.">Auto-suggest</span>
  <div id="theme-segment">
    <button class="theme-option active" data-theme="auto">Auto</button>
    <button class="theme-option" data-theme="light">Light</button>
    <button class="theme-option" data-theme="dark">Dark</button>
  </div>
  <a id="settings" href="#">Settings</a>
`;

global.chrome = {
  storage: {
    local: {
      get: vi.fn((key, cb) => { storageGetCallbacks[key] = cb; }),
      set: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn((q, cb) => cb([])),
    sendMessage: vi.fn(() => Promise.resolve()),
  },
  runtime: {
    openOptionsPage: vi.fn(),
  },
};

await import('../src/popup.js');

const toggle = document.getElementById('enabled');
const status = document.getElementById('status');
const settingsLink = document.getElementById('settings');

describe('popup.js', () => {
  describe('initial state', () => {
    it('loads enabled state from storage (default enabled)', () => {
      // Trigger the storage callback with empty data (default = enabled)
      storageGetCallbacks['dobbyEnabled']({});
      expect(toggle.checked).toBe(true);
      expect(status.textContent).toBe('Enabled');
    });

    it('loads disabled state from storage when explicitly disabled', () => {
      storageGetCallbacks['dobbyEnabled']({ dobbyEnabled: false });
      expect(toggle.checked).toBe(false);
      expect(status.textContent).toBe('Disabled');
    });

    it('loads enabled state from storage when explicitly enabled', () => {
      storageGetCallbacks['dobbyEnabled']({ dobbyEnabled: true });
      expect(toggle.checked).toBe(true);
      expect(status.textContent).toBe('Enabled');
    });
  });

  describe('toggle change', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Re-mock tabs.query so it provides tabs
      chrome.tabs.query.mockImplementation((q, cb) => cb([]));
      chrome.tabs.sendMessage.mockReturnValue(Promise.resolve());
    });

    it('updates status text to Disabled when unchecked', () => {
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      expect(status.textContent).toBe('Disabled');
    });

    it('updates status text to Enabled when checked', () => {
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      expect(status.textContent).toBe('Enabled');
    });

    it('calls chrome.storage.local.set with correct value', () => {
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ dobbyEnabled: true });

      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ dobbyEnabled: false });
    });

    it('broadcasts DOBBY_TOGGLE message to all http/https tabs', () => {
      const mockTabs = [{ id: 1 }, { id: 2 }];
      chrome.tabs.query.mockImplementation((q, cb) => cb(mockTabs));

      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));

      expect(chrome.tabs.query).toHaveBeenCalledWith(
        { url: ['http://*/*', 'https://*/*'] },
        expect.any(Function),
      );
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'DOBBY_TOGGLE', enabled: true });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { type: 'DOBBY_TOGGLE', enabled: true });
    });
  });

  describe('settings link', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('opens options page when clicked', () => {
      settingsLink.click();
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });
  });

  describe('screenshot mode toggle', () => {
    it('renders screenshot toggle', () => {
      const toggle = document.getElementById('screenshot-enabled');
      expect(toggle).not.toBeNull();
      expect(toggle.type).toBe('checkbox');
    });

    it('defaults to enabled', () => {
      storageGetCallbacks['screenshotEnabled']({});
      const toggle = document.getElementById('screenshot-enabled');
      expect(toggle.checked).toBe(true);
    });

    it('persists toggle state to chrome.storage', () => {
      vi.clearAllMocks();
      chrome.tabs.query.mockImplementation((q, cb) => cb([]));
      const toggle = document.getElementById('screenshot-enabled');
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ screenshotEnabled: false });
    });

    it('notifies content scripts on toggle', () => {
      vi.clearAllMocks();
      chrome.tabs.query.mockImplementation((q, cb) => cb([{ id: 1 }]));
      chrome.tabs.sendMessage.mockReturnValue(Promise.resolve());
      const toggle = document.getElementById('screenshot-enabled');
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'SCREENSHOT_TOGGLE', enabled: false });
    });
  });

  describe('theme toggle', () => {
    it('renders three theme option buttons', () => {
      const options = document.querySelectorAll('.theme-option');
      expect(options.length).toBe(3);
      expect(options[0].dataset.theme).toBe('auto');
      expect(options[1].dataset.theme).toBe('light');
      expect(options[2].dataset.theme).toBe('dark');
    });

    it('defaults to Auto active when theme absent from storage', () => {
      storageGetCallbacks['theme']({});
      const options = document.querySelectorAll('.theme-option');
      expect(options[0].classList.contains('active')).toBe(true);
      expect(options[1].classList.contains('active')).toBe(false);
      expect(options[2].classList.contains('active')).toBe(false);
    });

    it('loads light theme from storage and activates Light button', () => {
      storageGetCallbacks['theme']({ theme: 'light' });
      const options = document.querySelectorAll('.theme-option');
      expect(options[0].classList.contains('active')).toBe(false);
      expect(options[1].classList.contains('active')).toBe(true);
      expect(options[2].classList.contains('active')).toBe(false);
    });

    it('loads dark theme from storage and activates Dark button', () => {
      storageGetCallbacks['theme']({ theme: 'dark' });
      const options = document.querySelectorAll('.theme-option');
      expect(options[0].classList.contains('active')).toBe(false);
      expect(options[1].classList.contains('active')).toBe(false);
      expect(options[2].classList.contains('active')).toBe(true);
    });

    it('persists theme to chrome.storage on click', () => {
      vi.clearAllMocks();
      const darkBtn = document.querySelector('.theme-option[data-theme="dark"]');
      darkBtn.click();
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('updates active class on click', () => {
      const lightBtn = document.querySelector('.theme-option[data-theme="light"]');
      lightBtn.click();
      const options = document.querySelectorAll('.theme-option');
      expect(options[1].classList.contains('active')).toBe(true);
      expect(options[0].classList.contains('active')).toBe(false);
      expect(options[2].classList.contains('active')).toBe(false);
    });
  });

  describe('autosuggest toggle', () => {
    it('renders autosuggest toggle', () => {
      const toggle = document.getElementById('autosuggest-enabled');
      expect(toggle).not.toBeNull();
      expect(toggle.type).toBe('checkbox');
    });

    it('defaults to disabled', () => {
      chrome.storage.local.get.mockImplementation((key, cb) => cb({}));
      const toggle = document.getElementById('autosuggest-enabled');
      expect(toggle.checked).toBe(false);
    });

    it('persists toggle state to chrome.storage', () => {
      const toggle = document.getElementById('autosuggest-enabled');
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ autosuggestEnabled: true });
    });

    it('notifies content scripts on toggle', () => {
      chrome.tabs.query.mockImplementation((q, cb) => cb([{ id: 1 }]));
      const toggle = document.getElementById('autosuggest-enabled');
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'AUTOSUGGEST_TOGGLE', enabled: true });
    });
  });
});
