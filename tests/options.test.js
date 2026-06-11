// tests/options.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

let storageGetCallback;
let sendMessageCallback;

// Set up DOM elements before importing options.js
document.body.innerHTML = `
  <input id="api-key-input" type="text" />
  <button id="save-btn">Save</button>
  <button id="remove-btn">Remove</button>
  <span id="key-status"></span>
  <div id="has-key" style="display:none"></div>
  <div id="no-key" style="display:none"></div>
  <span id="key-display"></span>
  <div class="provider-tab active" data-provider="openai">OpenAI</div>
  <div class="provider-tab" data-provider="anthropic">Anthropic</div>
  <div class="provider-panel active" id="panel-openai">OpenAI Panel</div>
  <div class="provider-panel" id="panel-anthropic">Anthropic Panel</div>
`;

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys, cb) => { storageGetCallback = cb; }),
      set: vi.fn(),
      remove: vi.fn((key, cb) => { if (cb) cb(); }),
    },
  },
  runtime: {
    sendMessage: vi.fn((msg, cb) => { sendMessageCallback = cb; }),
  },
};

await import('../src/options.js');

const apiKeyInput = document.getElementById('api-key-input');
const saveBtn = document.getElementById('save-btn');
const removeBtn = document.getElementById('remove-btn');
const keyStatus = document.getElementById('key-status');
const hasKeySection = document.getElementById('has-key');
const noKeySection = document.getElementById('no-key');
const keyDisplay = document.getElementById('key-display');

describe('options.js', () => {
  describe('theme', () => {
    it('applies stored dark theme to the settings page', () => {
      storageGetCallback({ theme: 'dark' });
      expect(document.documentElement.dataset.themeMode).toBe('dark');
      expect(document.documentElement.dataset.resolvedTheme).toBe('dark');
    });

    it('defaults to resolved light theme when no theme is stored', () => {
      storageGetCallback({});
      expect(document.documentElement.dataset.themeMode).toBe('auto');
      expect(document.documentElement.dataset.resolvedTheme).toBe('light');
    });
  });

  describe('maskKey', () => {
    it('returns dots for short keys (less than 12 chars)', () => {
      // Load with a short key to see masking
      storageGetCallback({ userApiKey: 'sk-short' });
      expect(keyDisplay.textContent).toBe('••••••••');
    });

    it('shows first 7 and last 4 chars for normal keys', () => {
      const key = 'sk-proj-abcdefghijklmnop';
      storageGetCallback({ userApiKey: key });
      expect(keyDisplay.textContent).toBe('sk-proj••••mnop');
    });
  });

  describe('initial load', () => {
    it('shows has-key section when API key exists', () => {
      storageGetCallback({ userApiKey: 'sk-proj-abcdefghijklmnop' });
      expect(hasKeySection.style.display).toBe('block');
      expect(noKeySection.style.display).toBe('none');
    });

    it('shows no-key section when no API key', () => {
      storageGetCallback({});
      expect(hasKeySection.style.display).toBe('none');
      expect(noKeySection.style.display).toBe('block');
    });
  });

  describe('save button', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      saveBtn.disabled = false;
      // Reset to no-key state
      storageGetCallback({});
    });

    it('shows error for empty key', () => {
      apiKeyInput.value = '';
      saveBtn.click();
      expect(keyStatus.textContent).toBe('Please enter an API key');
      expect(keyStatus.className).toBe('status error');
    });

    it('shows error for whitespace-only key', () => {
      apiKeyInput.value = '   ';
      saveBtn.click();
      expect(keyStatus.textContent).toBe('Please enter an API key');
      expect(keyStatus.className).toBe('status error');
    });

    it('shows error for key not starting with sk-', () => {
      apiKeyInput.value = 'pk-badkey12345';
      saveBtn.click();
      expect(keyStatus.textContent).toBe('API key should start with "sk-"');
      expect(keyStatus.className).toBe('status error');
    });

    it('does not reject sk-ant- keys with coming soon message', () => {
      apiKeyInput.value = 'sk-ant-test123456789';
      saveBtn.click();
      // Should proceed to validation (not show "coming soon")
      expect(keyStatus.textContent).not.toContain('coming soon');
    });

    it('sends validation message for valid sk- key', () => {
      apiKeyInput.value = 'sk-proj-abcdefghijklmnop';
      saveBtn.click();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'VALIDATE_API_KEY', apiKey: 'sk-proj-abcdefghijklmnop' },
        expect.any(Function),
      );
      expect(keyStatus.textContent).toBe('Validating...');
      expect(keyStatus.className).toBe('status info');
      expect(saveBtn.disabled).toBe(true);
    });

    it('shows has-key section on successful validation', () => {
      apiKeyInput.value = 'sk-proj-abcdefghijklmnop';
      saveBtn.click();
      // Simulate valid response
      sendMessageCallback({ valid: true });
      expect(saveBtn.disabled).toBe(false);
      expect(hasKeySection.style.display).toBe('block');
      expect(noKeySection.style.display).toBe('none');
    });

    it('shows error on failed validation', () => {
      apiKeyInput.value = 'sk-proj-abcdefghijklmnop';
      saveBtn.click();
      sendMessageCallback({ valid: false, error: 'Invalid API key' });
      expect(saveBtn.disabled).toBe(false);
      expect(keyStatus.textContent).toBe('Invalid API key');
      expect(keyStatus.className).toBe('status error');
    });

    it('shows default error when response has no error message', () => {
      apiKeyInput.value = 'sk-proj-abcdefghijklmnop';
      saveBtn.click();
      sendMessageCallback({ valid: false });
      expect(keyStatus.textContent).toBe('Invalid API key');
    });
  });

  describe('Enter key', () => {
    it('triggers save button click on Enter', () => {
      apiKeyInput.value = '';
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      apiKeyInput.dispatchEvent(event);
      // The save handler should have fired (empty key => error message)
      expect(keyStatus.textContent).toBe('Please enter an API key');
    });

    it('does not trigger save on other keys', () => {
      vi.clearAllMocks();
      keyStatus.textContent = '';
      apiKeyInput.value = '';
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      apiKeyInput.dispatchEvent(event);
      expect(keyStatus.textContent).toBe('');
    });
  });

  describe('remove key', () => {
    it('calls chrome.storage.local.remove and shows no-key section', () => {
      // First set up as having a key
      storageGetCallback({ userApiKey: 'sk-proj-abcdefghijklmnop' });
      expect(hasKeySection.style.display).toBe('block');

      removeBtn.click();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith('userApiKey', expect.any(Function));
      expect(hasKeySection.style.display).toBe('none');
      expect(noKeySection.style.display).toBe('block');
      expect(apiKeyInput.value).toBe('');
      expect(keyStatus.textContent).toBe('');
      expect(keyStatus.className).toBe('status');
    });
  });

  describe('provider tab switching', () => {
    it('switches active tab and panel', () => {
      const tabs = document.querySelectorAll('.provider-tab');
      const panels = document.querySelectorAll('.provider-panel');

      // Click the Anthropic tab
      tabs[1].click();

      expect(tabs[0].classList.contains('active')).toBe(false);
      expect(tabs[1].classList.contains('active')).toBe(true);
      expect(panels[0].classList.contains('active')).toBe(false);
      expect(panels[1].classList.contains('active')).toBe(true);
    });

    it('switches back to first tab', () => {
      const tabs = document.querySelectorAll('.provider-tab');
      const panels = document.querySelectorAll('.provider-panel');

      // Click Anthropic first, then OpenAI
      tabs[1].click();
      tabs[0].click();

      expect(tabs[0].classList.contains('active')).toBe(true);
      expect(tabs[1].classList.contains('active')).toBe(false);
      expect(panels[0].classList.contains('active')).toBe(true);
      expect(panels[1].classList.contains('active')).toBe(false);
    });
  });
});
