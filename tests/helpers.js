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
