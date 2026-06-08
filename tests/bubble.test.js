// tests/bubble.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupChromeMocks } from './helpers.js';

setupChromeMocks();

// Mock external dependencies that bubble modules import
vi.mock('../src/content/api.js', () => ({
  requestChat: vi.fn(() => ({ cancel: vi.fn() })),
}));
vi.mock('../src/content/history.js', () => ({
  saveConversation: vi.fn(() => Promise.resolve()),
  getHistory: vi.fn(() => Promise.resolve([])),
  clearHistory: vi.fn(() => Promise.resolve()),
}));
vi.mock('../src/content/prompt.js', () => ({
  buildChatMessages: vi.fn((text, instruction) => [
    { role: 'system', content: instruction },
    { role: 'user', content: text },
  ]),
  buildFollowUp: vi.fn((msgs, q) => [...msgs, { role: 'user', content: q }]),
}));
vi.mock('../src/content/detection.js', () => ({
  detectContentType: vi.fn(() => ({ type: 'general', subType: null, confidence: 'high' })),
}));
vi.mock('../src/content/presets.js', () => ({
  getSuggestedPresetsForType: vi.fn(() => [
    { id: 'explain', label: 'Explain this', instruction: 'Explain the following' },
  ]),
}));

const {
  showBubble,
  showBubbleWithPresets,
  hideBubble,
  appendToken,
  setBubbleStatus,
  getBubbleContainer: _getBubbleContainer,
  detectTheme,
} = await import('../src/content/bubble/core.js');
const { renderMarkdown } = await import('../src/content/bubble/markdown.js');

// Import mocked modules for per-test overrides
const historyModule = await import('../src/content/history.js');
const promptModule = await import('../src/content/prompt.js');
const apiModule = await import('../src/content/api.js');

describe('bubble.js', () => {
  beforeEach(() => {
    hideBubble();
    document.body.innerHTML = '';
    vi.clearAllMocks();
    // Re-set default mock implementations after clearAllMocks
    apiModule.requestChat.mockReturnValue({ cancel: vi.fn() });
    historyModule.saveConversation.mockReturnValue(Promise.resolve());
    historyModule.getHistory.mockReturnValue(Promise.resolve([]));
    historyModule.clearHistory.mockReturnValue(Promise.resolve());
    promptModule.buildChatMessages.mockImplementation((text, instruction) => [
      { role: 'system', content: instruction },
      { role: 'user', content: text },
    ]);
    promptModule.buildFollowUp.mockImplementation((msgs, q) => [...msgs, { role: 'user', content: q }]);
  });

  describe('showBubble', () => {
    it('creates a shadow DOM container', async () => {
      await showBubble({ bottom: 200, left: 100, right: 300 }, [{ role: 'user', content: 'hi' }]);
      const container = _getBubbleContainer();
      expect(container).not.toBeNull();
      expect(container.shadowRoot).not.toBeNull();
    });

    it('positions below the selection rect', async () => {
      await showBubble({ bottom: 150, left: 50, right: 250 }, []);
      const container = _getBubbleContainer();
      expect(container.style.top).toBe('158px'); // bottom + 8px gap
    });

    it('shows thinking status initially', async () => {
      await showBubble({ bottom: 100, left: 50, right: 250 }, []);
      const container = _getBubbleContainer();
      const status = container.shadowRoot.querySelector('.bubble-status');
      expect(status.textContent).toBe('thinking...');
    });

    it('has Dobby AI branding in header', async () => {
      await showBubble({ bottom: 100, left: 50, right: 250 }, []);
      const container = _getBubbleContainer();
      const header = container.shadowRoot.querySelector('.bubble-header');
      expect(header.textContent).toContain('Dobby AI');
    });
  });

  describe('appendToken', () => {
    it('appends text to response area', async () => {
      await showBubble({ bottom: 100, left: 50, right: 250 }, []);
      appendToken('Hello');
      appendToken(' world');
      const container = _getBubbleContainer();
      const body = container.shadowRoot.querySelector('.response-text');
      expect(body.textContent).toContain('Hello world');
    });
  });

  describe('setBubbleStatus', () => {
    it('updates status text', async () => {
      await showBubble({ bottom: 100, left: 50, right: 250 }, []);
      setBubbleStatus('typing...');
      const container = _getBubbleContainer();
      const status = container.shadowRoot.querySelector('.bubble-status');
      expect(status.textContent).toBe('typing...');
    });
  });

  describe('hideBubble', () => {
    it('removes bubble from DOM', async () => {
      await showBubble({ bottom: 100, left: 50, right: 250 }, []);
      expect(_getBubbleContainer()).not.toBeNull();
      hideBubble();
      expect(_getBubbleContainer()).toBeNull();
    });

    it('is safe to call when no bubble exists', async () => {
      expect(() => hideBubble()).not.toThrow();
    });
  });

  describe('renderMarkdown', () => {
    it('renders bold text', async () => {
      expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
    });

    it('renders inline code', async () => {
      expect(renderMarkdown('`code`')).toContain('<code>code</code>');
    });

    it('renders code blocks', async () => {
      const result = renderMarkdown('```\nconst x = 1;\n```');
      expect(result).toContain('<pre><code>');
      expect(result).toContain('const x = 1;');
    });

    it('renders newlines as <br>', async () => {
      expect(renderMarkdown('line1\nline2')).toContain('<br>');
    });

    it('handles plain text without modification', async () => {
      const result = renderMarkdown('just plain text');
      expect(result).toContain('just plain text');
    });
  });

  describe('detectTheme', () => {
    it('returns stored light or dark theme without checking OS preference', async () => {
      window.matchMedia = vi.fn(() => ({ matches: false }));
      chrome.storage.local.get = vi.fn((key, cb) => cb({ theme: 'dark' }));

      expect(await detectTheme()).toBe('dark');
      expect(window.matchMedia).not.toHaveBeenCalled();
    });

    it('returns light when OS prefers light', async () => {
      chrome.storage.local.get = vi.fn((key, cb) => cb({}));
      window.matchMedia = vi.fn(() => ({ matches: false }));
      expect(await detectTheme()).toBe('light');
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });

    it('returns dark when OS prefers dark', async () => {
      chrome.storage.local.get = vi.fn((key, cb) => cb({}));
      window.matchMedia = vi.fn(() => ({ matches: true }));
      expect(await detectTheme()).toBe('dark');
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });

    it('defaults to light when matchMedia unavailable', async () => {
      chrome.storage.local.get = vi.fn((key, cb) => cb({}));
      const original = window.matchMedia;
      window.matchMedia = undefined;
      expect(await detectTheme()).toBe('light');
      window.matchMedia = original;
    });
  });

  // Errata item 8: additional tests
  describe('follow-up input', () => {
    it('calls buildFollowUp and requestChat on Enter', async () => {
      await showBubble({ bottom: 100, left: 50, right: 250 }, [{ role: 'user', content: 'hi' }]);
      const container = _getBubbleContainer();
      const input = container.shadowRoot.querySelector('.follow-up-input');
      input.disabled = false;
      input.value = 'tell me more';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(promptModule.buildFollowUp).toHaveBeenCalled();
    });
  });

  describe('history preview', () => {
    it('shows user text instead of instruction in history entry', async () => {
      historyModule.getHistory.mockResolvedValue([
        {
          text: 'user selected text here',
          instruction: 'system prompt content',
          response: 'AI response',
          pageTitle: 'Test Page',
          timestamp: Date.now(),
        },
      ]);

      await showBubble({ bottom: 100, left: 50, right: 250 }, [{ role: 'user', content: 'hi' }]);
      const container = _getBubbleContainer();
      const shadow = container.shadowRoot;

      // Click history button to open the history panel
      shadow.querySelector('.history-btn').click();

      // Wait for async getHistory to resolve
      await new Promise((r) => setTimeout(r, 0));

      const instrDiv = shadow.querySelector('.history-instruction');
      expect(instrDiv.textContent).toBe('user selected text here');
    });

    it('restores conversation state and enables follow-up on history entry click', async () => {
      historyModule.getHistory.mockResolvedValue([
        {
          text: 'user selected text here',
          instruction: 'system prompt content',
          response: 'AI response',
          pageTitle: 'Test Page',
          timestamp: Date.now(),
        },
      ]);

      await showBubble({ bottom: 100, left: 50, right: 250 }, [{ role: 'user', content: 'hi' }]);
      const container = _getBubbleContainer();
      const shadow = container.shadowRoot;

      shadow.querySelector('.history-btn').click();
      await new Promise((r) => setTimeout(r, 0));

      // Click the history entry
      shadow.querySelector('.history-entry').click();

      // Follow-up input should be enabled
      const followUpInput = shadow.querySelector('.follow-up-input');
      expect(followUpInput.disabled).toBe(false);

      // Response should be rendered
      const responseText = shadow.querySelector('.response-text');
      expect(responseText.innerHTML).toContain('AI response');
    });

    it('follow-up works after loading history entry', async () => {
      historyModule.getHistory.mockResolvedValue([
        {
          text: 'user selected text here',
          instruction: 'system prompt content',
          response: 'AI response',
          pageTitle: 'Test Page',
          timestamp: Date.now(),
        },
      ]);

      await showBubble({ bottom: 100, left: 50, right: 250 }, [{ role: 'user', content: 'hi' }]);
      const container = _getBubbleContainer();
      const shadow = container.shadowRoot;

      shadow.querySelector('.history-btn').click();
      await new Promise((r) => setTimeout(r, 0));

      // Click history entry to load it
      shadow.querySelector('.history-entry').click();

      // Cursor element must still exist for startStreaming
      const cursor = shadow.querySelector('.cursor');
      expect(cursor).not.toBeNull();

      // Follow-up should work without crashing
      const followUpInput = shadow.querySelector('.follow-up-input');
      followUpInput.disabled = false;
      followUpInput.value = 'tell me more';
      followUpInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      // requestChat should have been called (streaming started)
      expect(apiModule.requestChat).toHaveBeenCalled();
    });

    it('falls back to instruction when text is empty', async () => {
      historyModule.getHistory.mockResolvedValue([
        {
          text: '',
          instruction: 'system prompt content',
          response: 'AI response',
          pageTitle: 'Test Page',
          timestamp: Date.now(),
        },
      ]);

      await showBubble({ bottom: 100, left: 50, right: 250 }, [{ role: 'user', content: 'hi' }]);
      const container = _getBubbleContainer();
      const shadow = container.shadowRoot;

      shadow.querySelector('.history-btn').click();
      await new Promise((r) => setTimeout(r, 0));

      const instrDiv = shadow.querySelector('.history-instruction');
      expect(instrDiv.textContent).toBe('system prompt content');
    });
  });

  describe('keyboard shortcuts', () => {
    it('closes bubble on Escape key', async () => {
      await showBubble({ bottom: 100, left: 50, right: 250 }, []);
      expect(_getBubbleContainer()).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(_getBubbleContainer()).toBeNull();
    });
  });

  describe('renderMarkdown XSS', () => {
    it('escapes HTML tags in input', async () => {
      const result = renderMarkdown('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('renderMarkdown lists', () => {
    it('renders list items', async () => {
      const result = renderMarkdown('- item one\n- item two');
      expect(result).toContain('<li>item one</li>');
    });
  });

  describe('renderMarkdown images', () => {
    it('renders https image markdown as img tag', async () => {
      const result = renderMarkdown('![diagram](https://example.com/img.png)');
      expect(result).toContain('<img class="response-img"');
      expect(result).toContain('src="https://example.com/img.png"');
      expect(result).toContain('alt="diagram"');
    });

    it('rejects non-https image URLs', async () => {
      const result = renderMarkdown('![pic](http://example.com/img.png)');
      expect(result).not.toContain('<img');
      expect(result).toContain('![pic]');
    });

    it('rejects javascript: URLs', async () => {
      const result = renderMarkdown('![xss](javascript:alert(1))');
      expect(result).not.toContain('<img');
    });

    it('rejects data: URLs', async () => {
      const result = renderMarkdown('![xss](data:text/html,<script>alert(1)</script>)');
      expect(result).not.toContain('<img');
    });

    it('escapes alt text to prevent XSS', async () => {
      const result = renderMarkdown('![<script>xss</script>](https://example.com/img.png)');
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('alt="<script>');
    });

    it('escapes double quotes in alt text', async () => {
      const result = renderMarkdown('![x" onerror="alert(1)](https://example.com/img.png)');
      // Quotes escaped — onerror stays inside the alt value, not a separate attribute
      expect(result).toContain('&quot;');
      expect(result).not.toMatch(/alt="[^"]*"\s+onerror="/);
    });

    it('escapes double quotes in URLs', async () => {
      const result = renderMarkdown('![x](https://evil.com/x" onerror="alert(1))');
      // Quotes escaped — onerror stays inside the src value, not a separate attribute
      expect(result).toContain('&quot;');
      expect(result).not.toMatch(/src="[^"]*"\s+onerror="/);
    });

    it('does not render images inside code blocks', async () => {
      const result = renderMarkdown('```\n![alt](https://example.com/img.png)\n```');
      expect(result).not.toContain('<img');
      expect(result).toContain('<pre><code>');
    });

    it('handles placeholder pattern in raw text without crashing', async () => {
      const result = renderMarkdown('The pattern %%IMAGE_0%% is used internally');
      expect(result).toBeDefined();
    });

    it('renders multiple images', async () => {
      const text = '![a](https://example.com/1.png)\n![b](https://example.com/2.png)';
      const result = renderMarkdown(text);
      expect((result.match(/<img/g) || []).length).toBe(2);
    });

    it('mixes images with other markdown', async () => {
      const text = '**bold** and ![img](https://example.com/pic.png) and `code`';
      const result = renderMarkdown(text);
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<img class="response-img"');
      expect(result).toContain('<code>code</code>');
    });
  });

  describe('resize handle', () => {
    it('renders a resize handle in the bubble', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const shadow = document.querySelector('#dobby-ai-bubble').shadowRoot;
      const handle = shadow.querySelector('.resize-handle');
      expect(handle).not.toBeNull();
    });

    it('resizes bubble on mousedown + mousemove on handle', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const shadow = document.querySelector('#dobby-ai-bubble').shadowRoot;
      const handle = shadow.querySelector('.resize-handle');
      const bubble = shadow.querySelector('.bubble');

      // jsdom getBoundingClientRect returns 0; delta must exceed min constraints (300x200)
      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 300, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      // Bubble should have resized (0 + 400 = 400 > min 300, 0 + 300 = 300 > min 200)
      expect(parseInt(bubble.style.width)).toBe(400);
      expect(parseInt(bubble.style.height)).toBe(300);
    });

    it('enforces minimum size of 300x200', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const shadow = document.querySelector('#dobby-ai-bubble').shadowRoot;
      const handle = shadow.querySelector('.resize-handle');
      const bubble = shadow.querySelector('.bubble');

      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 430, clientY: 520, bubbles: true }));
      // Drag far to the left/up to shrink below minimum
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(parseInt(bubble.style.width)).toBeGreaterThanOrEqual(300);
      expect(parseInt(bubble.style.height)).toBeGreaterThanOrEqual(200);
    });

    it('stops resizing after mouseup', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const shadow = document.querySelector('#dobby-ai-bubble').shadowRoot;
      const handle = shadow.querySelector('.resize-handle');
      const bubble = shadow.querySelector('.bubble');

      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 300, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      const widthAfterRelease = bubble.style.width;
      // Further mousemove should not change size
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 700, clientY: 700, bubbles: true }));
      expect(bubble.style.width).toBe(widthAfterRelease);
    });

    it('close button still works after resize', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const shadow = document.querySelector('#dobby-ai-bubble').shadowRoot;
      const handle = shadow.querySelector('.resize-handle');
      const bubble = shadow.querySelector('.bubble');

      // Resize first
      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 300, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      // Close should still work
      shadow.querySelector('.close-btn').click();
      expect(document.querySelector('#dobby-ai-bubble')).toBeNull();
    });

    it('cleans up resize listeners when bubble is hidden during resize', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const shadow = document.querySelector('#dobby-ai-bubble').shadowRoot;
      const handle = shadow.querySelector('.resize-handle');

      // Start resize but don't release
      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 430, clientY: 520, bubbles: true }));

      // Hide bubble while resize is active
      expect(() => hideBubble()).not.toThrow();
      expect(document.querySelector('#dobby-ai-bubble')).toBeNull();
    });
  });

  describe('pin button', () => {
    it('renders a pin button in the bubble header', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const shadow = document.querySelector('#dobby-ai-bubble').shadowRoot;
      const pinBtn = shadow.querySelector('.pin-btn');
      expect(pinBtn).not.toBeNull();
      expect(pinBtn.title).toBe('Pin');
    });

    it('toggles pinned state on click', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const host = document.querySelector('#dobby-ai-bubble');
      const shadow = host.shadowRoot;
      const pinBtn = shadow.querySelector('.pin-btn');

      expect(host._isPinned).toBe(false);
      expect(pinBtn.classList.contains('pinned')).toBe(false);

      pinBtn.click();
      expect(host._isPinned).toBe(true);
      expect(pinBtn.classList.contains('pinned')).toBe(true);
      expect(pinBtn.title).toBe('Unpin');

      pinBtn.click();
      expect(host._isPinned).toBe(false);
      expect(pinBtn.classList.contains('pinned')).toBe(false);
      expect(pinBtn.title).toBe('Pin');
    });

    it('close button still works when pinned', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const host = document.querySelector('#dobby-ai-bubble');
      const shadow = host.shadowRoot;
      shadow.querySelector('.pin-btn').click(); // pin it
      expect(host._isPinned).toBe(true);
      shadow.querySelector('.close-btn').click();
      expect(document.querySelector('#dobby-ai-bubble')).toBeNull();
    });

    it('Escape key closes bubble when pinned', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const host = document.querySelector('#dobby-ai-bubble');
      const shadow = host.shadowRoot;
      shadow.querySelector('.pin-btn').click(); // pin it
      expect(host._isPinned).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(document.querySelector('#dobby-ai-bubble')).toBeNull();
    });

    it('pin resets to unpinned on new bubble open', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const host1 = document.querySelector('#dobby-ai-bubble');
      host1.shadowRoot.querySelector('.pin-btn').click(); // pin it
      expect(host1._isPinned).toBe(true);
      // Open new bubble (replaces the old one)
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test2');
      const host2 = document.querySelector('#dobby-ai-bubble');
      expect(host2._isPinned).toBe(false);
    });
  });

  describe('draggable when pinned', () => {
    it('header has draggable class when pinned', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const host = document.querySelector('#dobby-ai-bubble');
      const shadow = host.shadowRoot;
      const header = shadow.querySelector('.bubble-header');
      const pinBtn = shadow.querySelector('.pin-btn');

      expect(header.classList.contains('draggable')).toBe(false);
      pinBtn.click();
      expect(header.classList.contains('draggable')).toBe(true);
      pinBtn.click(); // unpin
      expect(header.classList.contains('draggable')).toBe(false);
    });

    it('header is not draggable when unpinned', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const shadow = document.querySelector('#dobby-ai-bubble').shadowRoot;
      const header = shadow.querySelector('.bubble-header');

      // Try to drag — should not move
      const host = document.querySelector('#dobby-ai-bubble');
      const initialLeft = host.style.left;

      header.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(host.style.left).toBe(initialLeft);
    });

    it('moves bubble when dragging header while pinned', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const host = document.querySelector('#dobby-ai-bubble');
      const shadow = host.shadowRoot;
      const pinBtn = shadow.querySelector('.pin-btn');
      const header = shadow.querySelector('.bubble-header');

      pinBtn.click(); // pin it

      const initialLeft = parseInt(host.style.left);
      const initialTop = parseInt(host.style.top);

      header.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 250, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(parseInt(host.style.left)).toBe(initialLeft + 100);
      expect(parseInt(host.style.top)).toBe(initialTop + 150);
    });

    it('stops dragging on mouseup', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const host = document.querySelector('#dobby-ai-bubble');
      const shadow = host.shadowRoot;
      shadow.querySelector('.pin-btn').click();
      const header = shadow.querySelector('.bubble-header');

      header.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      const leftAfterDrop = host.style.left;
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300, bubbles: true }));
      expect(host.style.left).toBe(leftAfterDrop);
    });

    it('does not drag when clicking pin button', async () => {
      await showBubble({ top: 100, bottom: 120, left: 50, right: 200 }, 'test');
      const host = document.querySelector('#dobby-ai-bubble');
      const shadow = host.shadowRoot;
      const pinBtn = shadow.querySelector('.pin-btn');
      pinBtn.click(); // pin it

      const initialLeft = host.style.left;
      // mousedown on pin button should not start drag
      pinBtn.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(host.style.left).toBe(initialLeft);
    });
  });

  describe('accessibility — ARIA labels', () => {
    it('icon-only header buttons have aria-labels', async () => {
      await showBubble({ bottom: 100, left: 50, right: 250 }, []);
      const shadow = _getBubbleContainer().shadowRoot;
      expect(shadow.querySelector('.close-btn').getAttribute('aria-label')).toBe('Close chat');
      expect(shadow.querySelector('.pin-btn').getAttribute('aria-label')).toBe('Pin chat bubble');
      expect(shadow.querySelector('.history-btn').getAttribute('aria-label')).toBe('View history');
      expect(shadow.querySelector('.follow-up-input').getAttribute('aria-label')).toBe('Ask a follow-up');
    });
  });

  describe('accessibility — focus management', () => {
    it('moves focus to the custom preset input when opening in preset mode', async () => {
      await showBubbleWithPresets({ bottom: 100, left: 50, right: 250 }, 'some selected text', null, null);
      const shadow = _getBubbleContainer().shadowRoot;
      const input = shadow.querySelector('.preset-input');
      expect(shadow.activeElement).toBe(input);
    });
  });

  describe('accessibility — focus trap', () => {
    it('Tab from last focusable wraps to the first', async () => {
      await showBubbleWithPresets({ bottom: 100, left: 50, right: 250 }, 'some selected text', null, null);
      const shadow = _getBubbleContainer().shadowRoot;
      const bubble = shadow.querySelector('.bubble');
      const focusable = Array.from(bubble.querySelectorAll(
        'button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
      ));
      const last = focusable[focusable.length - 1];
      const first = focusable[0];
      last.focus();
      const evt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      last.dispatchEvent(evt);
      expect(evt.defaultPrevented).toBe(true);
      expect(shadow.activeElement).toBe(first);
    });

    it('Shift+Tab from first focusable wraps to the last', async () => {
      await showBubbleWithPresets({ bottom: 100, left: 50, right: 250 }, 'some selected text', null, null);
      const shadow = _getBubbleContainer().shadowRoot;
      const bubble = shadow.querySelector('.bubble');
      const focusable = Array.from(bubble.querySelectorAll(
        'button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
      ));
      const last = focusable[focusable.length - 1];
      const first = focusable[0];
      first.focus();
      const evt = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
      first.dispatchEvent(evt);
      expect(evt.defaultPrevented).toBe(true);
      expect(shadow.activeElement).toBe(last);
    });
  });

  describe('accessibility — keyboard-operable preset chips', () => {
    it('chips have role=button and tabindex=0', async () => {
      await showBubbleWithPresets({ bottom: 100, left: 50, right: 250 }, 'some selected text', null, null);
      const shadow = _getBubbleContainer().shadowRoot;
      const chip = shadow.querySelector('.preset-chip');
      expect(chip).not.toBeNull();
      expect(chip.getAttribute('role')).toBe('button');
      expect(chip.getAttribute('tabindex')).toBe('0');
    });

    it('Enter on a chip activates it (same path as click)', async () => {
      await showBubbleWithPresets({ bottom: 100, left: 50, right: 250 }, 'some selected text', null, null);
      const shadow = _getBubbleContainer().shadowRoot;
      const chip = shadow.querySelector('.preset-chip');
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      // launchFromPreset builds messages and activates the response section
      expect(promptModule.buildChatMessages).toHaveBeenCalled();
      const responseSection = shadow.querySelector('.response-section');
      expect(responseSection.classList.contains('active')).toBe(true);
    });

    it('Space on a chip activates it (same path as click)', async () => {
      await showBubbleWithPresets({ bottom: 100, left: 50, right: 250 }, 'some selected text', null, null);
      const shadow = _getBubbleContainer().shadowRoot;
      const chip = shadow.querySelector('.preset-chip');
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(promptModule.buildChatMessages).toHaveBeenCalled();
      const responseSection = shadow.querySelector('.response-section');
      expect(responseSection.classList.contains('active')).toBe(true);
    });
  });

  describe('image lightbox', () => {
    it('opens lightbox overlay when image is clicked', async () => {
      await showBubble({ bottom: 100, left: 50, right: 250 }, []);
      const container = _getBubbleContainer();
      const shadow = container.shadowRoot;
      const responseText = shadow.querySelector('.response-text');
      responseText.innerHTML = '<img class="response-img" src="https://example.com/img.png" alt="test">';

      const img = shadow.querySelector('.response-img');
      img.click();

      const lightbox = shadow.querySelector('.img-lightbox');
      expect(lightbox).not.toBeNull();
      expect(lightbox.querySelector('img').src).toBe('https://example.com/img.png');
    });

    it('closes lightbox when overlay is clicked', async () => {
      await showBubble({ bottom: 100, left: 50, right: 250 }, []);
      const container = _getBubbleContainer();
      const shadow = container.shadowRoot;
      const responseText = shadow.querySelector('.response-text');
      responseText.innerHTML = '<img class="response-img" src="https://example.com/img.png" alt="test">';

      shadow.querySelector('.response-img').click();
      expect(shadow.querySelector('.img-lightbox')).not.toBeNull();

      shadow.querySelector('.img-lightbox').click();
      expect(shadow.querySelector('.img-lightbox')).toBeNull();
    });
  });
});
