// tests/content.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

let messageListeners = [];

// Mock chrome APIs — capture message listeners
global.chrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn((fn) => { messageListeners.push(fn); }),
    },
  },
  storage: {
    local: {
      get: vi.fn((key, cb) => {
        if (key === 'dobbyEnabled') return cb({ dobbyEnabled: true });
        if (key === 'screenshotEnabled') return cb({ screenshotEnabled: true });
        if (key === 'autosuggestEnabled') return cb({ autosuggestEnabled: false });
        cb({});
      }),
      set: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
};

// Mock all modules that src/content/index.js imports
vi.mock('../src/content/bubble/core.js', () => ({
  showBubble: vi.fn(),
  showBubbleWithPresets: vi.fn(),
  showHistoryBubble: vi.fn(),
  hideBubble: vi.fn(),
  getBubbleContainer: vi.fn(),
}));

vi.mock('../src/content/prompt.js', () => ({
  buildChatMessages: vi.fn(() => [{ role: 'user', content: 'mock' }]),
}));

vi.mock('../src/content/image-capture.js', () => ({
  captureImage: vi.fn(),
}));

vi.mock('../src/content/trigger/selection.js', () => ({
  registerListeners: vi.fn(),
}));

vi.mock('../src/content/trigger/button.js', () => ({
  hideTrigger: vi.fn(),
}));

vi.mock('../src/content/shared/state.js', () => ({
  setDobbyEnabled: vi.fn(),
  setScreenshotEnabled: vi.fn(),
  setAutosuggestEnabled: vi.fn(),
  screenshotEnabled: true,
  autosuggestEnabled: false,
}));

vi.mock('../src/content/autosuggest/index.js', () => ({
  initAutosuggest: vi.fn(),
  destroyAutosuggest: vi.fn(),
}));

vi.mock('../src/content/shared/dom-utils.js', () => ({
  isClickInsideUI: vi.fn((target, getBubble) => {
    // Check trigger by id
    const trigger = document.getElementById('dobby-ai-trigger');
    if (trigger && trigger.contains(target)) return true;
    // Check toolbar host by id
    const toolbarHost = document.getElementById('dobby-ai-toolbar-host');
    if (toolbarHost && toolbarHost.contains(target)) return true;
    // Check bubble
    if (typeof getBubble === 'function') {
      const bc = getBubble();
      if (bc && bc.contains(target)) return true;
    }
    return false;
  }),
}));

const { showBubble, showBubbleWithPresets, showHistoryBubble, hideBubble, getBubbleContainer } = await import('../src/content/bubble/core.js');
const { buildChatMessages } = await import('../src/content/prompt.js');
const { captureImage } = await import('../src/content/image-capture.js');

// Import the entry point — this registers the message listeners
await import('../src/content/index.js');

// Find the SHOW_BUBBLE listener (the fourth one registered, after DOBBY_TOGGLE, SCREENSHOT_TOGGLE, and AUTOSUGGEST_TOGGLE)
function getShowBubbleListener() {
  return messageListeners[3];
}

describe('content/index.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SHOW_BUBBLE with text', () => {
    it('calls buildChatMessages and showBubble with text', () => {
      const listener = messageListeners[3]; // SHOW_BUBBLE listener
      listener({ type: 'SHOW_BUBBLE', text: 'hello world' });

      expect(buildChatMessages).toHaveBeenCalledWith(
        'hello world',
        'Explain the following',
        true,
      );
      expect(showBubble).toHaveBeenCalledWith(
        expect.objectContaining({ bottom: expect.any(Number), left: expect.any(Number), right: expect.any(Number) }),
        [{ role: 'user', content: 'mock' }],
        'hello world',
        'Explain the following',
      );
    });
  });

  describe('SHOW_BUBBLE with image (successful capture)', () => {
    it('calls captureImage and showBubbleWithPresets', async () => {
      captureImage.mockResolvedValue({ type: 'image', data: 'base64data' });

      const listener = messageListeners[3];
      listener({ type: 'SHOW_BUBBLE', image: 'https://example.com/img.png' });

      await vi.waitFor(() => {
        expect(captureImage).toHaveBeenCalledWith('https://example.com/img.png');
        expect(showBubbleWithPresets).toHaveBeenCalledWith(
          expect.objectContaining({ bottom: expect.any(Number) }),
          '',
          null,
          [{ type: 'image', data: 'base64data' }],
        );
      });
    });
  });

  describe('SHOW_BUBBLE with image (capture fails)', () => {
    it('calls showBubble with error when captureImage returns null', async () => {
      captureImage.mockResolvedValue(null);

      const listener = messageListeners[3];
      listener({ type: 'SHOW_BUBBLE', image: 'https://example.com/img.png' });

      await vi.waitFor(() => {
        expect(showBubble).toHaveBeenCalledWith(
          expect.objectContaining({ bottom: expect.any(Number) }),
          [{ role: 'user', content: "Couldn't capture this image" }],
          '',
          'Error',
        );
      });
    });
  });

  describe('non-SHOW_BUBBLE messages', () => {
    it('are ignored', () => {
      const listener = messageListeners[3];
      listener({ type: 'OTHER_TYPE' });

      expect(showBubble).not.toHaveBeenCalled();
      expect(showBubbleWithPresets).not.toHaveBeenCalled();
      expect(buildChatMessages).not.toHaveBeenCalled();
    });
  });

  describe('SHOW_HISTORY from popup', () => {
    it('opens the history bubble', () => {
      const listener = messageListeners[3];
      listener({ type: 'SHOW_HISTORY' });

      expect(showHistoryBubble).toHaveBeenCalledWith(
        expect.objectContaining({ bottom: expect.any(Number), left: expect.any(Number), right: expect.any(Number) }),
      );
    });
  });

  describe('click outside bubble', () => {
    it('calls hideBubble when clicking outside the bubble', async () => {
      const bubbleEl = document.createElement('div');
      bubbleEl.id = 'test-bubble';
      document.body.appendChild(bubbleEl);

      getBubbleContainer.mockReturnValue(bubbleEl);

      // The mousedown listener is registered after 100ms setTimeout
      await new Promise((r) => setTimeout(r, 150));

      const outsideTarget = document.createElement('div');
      document.body.appendChild(outsideTarget);

      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: outsideTarget });
      document.dispatchEvent(event);

      expect(hideBubble).toHaveBeenCalled();
    });

    it('does not call hideBubble when clicking the trigger', async () => {
      const bubbleEl = document.createElement('div');
      document.body.appendChild(bubbleEl);
      getBubbleContainer.mockReturnValue(bubbleEl);

      const trigger = document.createElement('div');
      trigger.id = 'dobby-ai-trigger';
      document.body.appendChild(trigger);

      await new Promise((r) => setTimeout(r, 150));

      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: trigger });
      document.dispatchEvent(event);

      expect(hideBubble).not.toHaveBeenCalled();
    });

    it('does not call hideBubble when clicking inside the bubble', async () => {
      const bubbleEl = document.createElement('div');
      const innerEl = document.createElement('span');
      bubbleEl.appendChild(innerEl);
      document.body.appendChild(bubbleEl);
      getBubbleContainer.mockReturnValue(bubbleEl);

      await new Promise((r) => setTimeout(r, 150));

      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: innerEl });
      document.dispatchEvent(event);

      expect(hideBubble).not.toHaveBeenCalled();
    });

    it('does not call hideBubble when bubble is pinned', async () => {
      const host = { _isPinned: true, contains: () => false };
      getBubbleContainer.mockReturnValue(host);

      await new Promise((r) => setTimeout(r, 150));

      const outsideTarget = document.createElement('div');
      document.body.appendChild(outsideTarget);

      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: outsideTarget });
      document.dispatchEvent(event);

      expect(hideBubble).not.toHaveBeenCalled();
    });

    it('does not call hideBubble when no bubble exists', async () => {
      getBubbleContainer.mockReturnValue(null);

      await new Promise((r) => setTimeout(r, 150));

      const outsideTarget = document.createElement('div');
      document.body.appendChild(outsideTarget);

      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: outsideTarget });
      document.dispatchEvent(event);

      expect(hideBubble).not.toHaveBeenCalled();
    });

    it('does not call hideBubble when clicking the toolbar host', async () => {
      const bubbleEl = document.createElement('div');
      document.body.appendChild(bubbleEl);
      getBubbleContainer.mockReturnValue(bubbleEl);

      const toolbarHost = document.createElement('div');
      toolbarHost.id = 'dobby-ai-toolbar-host';
      document.body.appendChild(toolbarHost);

      await new Promise((r) => setTimeout(r, 150));

      const event = new MouseEvent('mousedown', { bubbles: true });
      Object.defineProperty(event, 'target', { value: toolbarHost });
      document.dispatchEvent(event);

      expect(hideBubble).not.toHaveBeenCalled();
    });
  });
});
