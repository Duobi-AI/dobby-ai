// tests/content.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

let messageListeners = [];
let mockStorageValues = { dobbyEnabled: true, screenshotEnabled: true, autosuggestEnabled: false };
let deferFeatureSettingsLoad = false;
let releaseFeatureSettingsLoad = null;
const mockContentState = vi.hoisted(() => ({ dobbyEnabled: true, autosuggestEnabled: false }));

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
        if (Array.isArray(key)) {
          const values = Object.fromEntries(key.filter((name) => name in mockStorageValues).map((name) => [name, mockStorageValues[name]]));
          if (deferFeatureSettingsLoad) {
            releaseFeatureSettingsLoad = () => cb(values);
            return;
          }
          return cb(values);
        }
        cb(key in mockStorageValues ? { [key]: mockStorageValues[key] } : {});
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
  cancelPendingBubbleOpenings: vi.fn(),
  createBubbleOpeningGuard: vi.fn(() => () => true),
  hideBubble: vi.fn(),
  getBubbleContainer: vi.fn(),
  isBubblePinned: vi.fn(() => false),
}));

vi.mock('../src/content/prompt.js', () => ({
  buildChatMessages: vi.fn(() => [{ role: 'user', content: 'mock' }]),
}));

vi.mock('../src/content/image-capture.js', () => ({
  captureImage: vi.fn(),
}));

vi.mock('../src/content/trigger/selection.js', () => ({
  registerListeners: vi.fn(),
  disableTriggerModes: vi.fn(),
}));

vi.mock('../src/content/shared/state.js', () => ({
  setDobbyEnabled: vi.fn((enabled) => { mockContentState.dobbyEnabled = enabled; }),
  setScreenshotEnabled: vi.fn(),
  setAutosuggestEnabled: vi.fn((enabled) => { mockContentState.autosuggestEnabled = enabled; }),
  get dobbyEnabled() { return mockContentState.dobbyEnabled; },
  screenshotEnabled: true,
  get autosuggestEnabled() { return mockContentState.autosuggestEnabled; },
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

const { showBubble, showBubbleWithPresets, showHistoryBubble, hideBubble, getBubbleContainer, cancelPendingBubbleOpenings } = await import('../src/content/bubble/core.js');
const { buildChatMessages } = await import('../src/content/prompt.js');
const { captureImage } = await import('../src/content/image-capture.js');
const { initAutosuggest, destroyAutosuggest } = await import('../src/content/autosuggest/index.js');
const { disableTriggerModes } = await import('../src/content/trigger/selection.js');

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

  describe('master toggle and auto-suggest', () => {
    it('pauses auto-suggest while Dobby is off and resumes its saved preference when turned back on', () => {
      const dobbyToggle = messageListeners[0];
      const autosuggestToggle = messageListeners[2];

      mockContentState.dobbyEnabled = true;
      mockContentState.autosuggestEnabled = false;
      autosuggestToggle({ type: 'AUTOSUGGEST_TOGGLE', enabled: true });
      expect(initAutosuggest).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      dobbyToggle({ type: 'DOBBY_TOGGLE', enabled: false });
      expect(cancelPendingBubbleOpenings).toHaveBeenCalledTimes(1);
      expect(destroyAutosuggest).toHaveBeenCalledTimes(1);
      expect(hideBubble).toHaveBeenCalledTimes(1);

      expect(disableTriggerModes).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      dobbyToggle({ type: 'DOBBY_TOGGLE', enabled: true });
      expect(initAutosuggest).toHaveBeenCalledTimes(1);
      expect(destroyAutosuggest).not.toHaveBeenCalled();
    });
  });

  describe('SHOW_BUBBLE with text', () => {
    it('calls buildChatMessages and showBubble with text', () => {
      const listener = messageListeners[3]; // SHOW_BUBBLE listener
      listener({ type: 'SHOW_BUBBLE', text: 'hello world' });

      expect(buildChatMessages).toHaveBeenCalledWith(
        'hello world',
        'Explain the following',
        true,
        undefined,
        expect.objectContaining({ extractionMode: 'body', url: expect.any(String) }),
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

    it('ignores AI bubble requests while Dobby is off', () => {
      mockContentState.dobbyEnabled = false;
      messageListeners[3]({ type: 'SHOW_BUBBLE', text: 'hello world' });

      expect(buildChatMessages).not.toHaveBeenCalled();
      expect(showBubble).not.toHaveBeenCalled();
      expect(showBubbleWithPresets).not.toHaveBeenCalled();

      mockContentState.dobbyEnabled = true;
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
      const host = { contains: () => false };
      getBubbleContainer.mockReturnValue(host);
      const { isBubblePinned } = await import('../src/content/bubble/core.js');
      isBubblePinned.mockReturnValue(true);

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

  it('keeps AI actions blocked until the saved master setting loads', async () => {
    mockStorageValues = { dobbyEnabled: false, screenshotEnabled: true, autosuggestEnabled: true };
    mockContentState.dobbyEnabled = false;
    mockContentState.autosuggestEnabled = false;
    deferFeatureSettingsLoad = true;
    messageListeners = [];
    vi.resetModules();

    await import('../src/content/index.js');
    const { initAutosuggest, destroyAutosuggest } = await import('../src/content/autosuggest/index.js');
    const { buildChatMessages: freshBuildChatMessages } = await import('../src/content/prompt.js');
    const { showBubble: freshShowBubble } = await import('../src/content/bubble/core.js');

    messageListeners[3]({ type: 'SHOW_BUBBLE', text: 'hello before settings load' });
    expect(freshBuildChatMessages).not.toHaveBeenCalled();
    expect(freshShowBubble).not.toHaveBeenCalled();

    deferFeatureSettingsLoad = false;
    releaseFeatureSettingsLoad?.();
    releaseFeatureSettingsLoad = null;

    expect(mockContentState.dobbyEnabled).toBe(false);
    expect(mockContentState.autosuggestEnabled).toBe(true);
    expect(initAutosuggest).not.toHaveBeenCalled();
    expect(destroyAutosuggest).toHaveBeenCalledTimes(1);
  });
});
