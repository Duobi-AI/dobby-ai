// tests/helpers.js — Shared test utilities for Dobby AI extension tests
import { vi } from 'vitest';

/**
 * Set up minimal chrome API mocks.
 */
export function setupChromeMocks(overrides = {}) {
  global.chrome = {
    runtime: {
      connect: vi.fn(() => ({
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn() },
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
      })),
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      lastError: undefined,
      ...(overrides.runtime || {}),
    },
    storage: {
      local: {
        get: vi.fn((keys, cb) => cb({})),
        set: vi.fn((data, cb) => { if (cb) cb(); }),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      ...(overrides.storage || {}),
    },
    contextMenus: {
      create: vi.fn(),
      onClicked: { addListener: vi.fn() },
      ...(overrides.contextMenus || {}),
    },
    tabs: {
      sendMessage: vi.fn(),
      captureVisibleTab: vi.fn(),
      ...(overrides.tabs || {}),
    },
    notifications: {
      create: vi.fn(),
      ...(overrides.notifications || {}),
    },
  };
}

/**
 * Set up common global dependency mocks for content script tests.
 */
export function setupContentScriptMocks() {
  global.detectContentType = vi.fn(() => ({ type: 'general', subType: null, confidence: 'high' }));
  global.detectContent = vi.fn(() => ({ type: 'general', subType: null, confidence: 'high' }));
  global.getSuggestedPresetsForType = vi.fn(() => [
    { id: 'explain', label: 'Explain this', instruction: 'Explain the following' },
    { id: 'summarize', label: 'Summarize', instruction: 'Summarize the following' },
  ]);
  global.buildChatMessages = vi.fn((text, instruction) => [
    { role: 'system', content: instruction },
    { role: 'user', content: text },
  ]);
  global.requestChat = vi.fn(() => ({ cancel: vi.fn() }));
  global.saveConversation = vi.fn(() => Promise.resolve());
  global.getHistory = vi.fn(() => Promise.resolve([]));
  global.clearHistory = vi.fn(() => Promise.resolve());
  global.buildFollowUp = vi.fn((msgs, q) => [...msgs, { role: 'user', content: q }]);
  global.showBubble = vi.fn();
  global.showBubbleWithPresets = vi.fn();
  global.hideBubble = vi.fn();
  global._getBubbleContainer = vi.fn(() => null);
}

/**
 * Create a mock selection object for testing text selection behavior.
 */
export function mockSelection(text, rect = { top: 100, right: 200, bottom: 120, left: 100 }) {
  const range = { getBoundingClientRect: () => rect };
  window.getSelection = vi.fn(() => ({
    toString: () => text,
    anchorNode: document.body,
    rangeCount: text ? 1 : 0,
    getRangeAt: () => range,
  }));
}
