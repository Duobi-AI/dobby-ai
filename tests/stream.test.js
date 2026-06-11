// tests/stream.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupChromeMocks } from './helpers.js';

setupChromeMocks();

vi.mock('../src/content/api.js', () => ({
  requestChat: vi.fn(() => ({ cancel: vi.fn() })),
}));
vi.mock('../src/content/history.js', () => ({
  saveConversation: vi.fn(() => Promise.resolve()),
}));
vi.mock('../src/content/prompt.js', () => ({
  buildFollowUp: vi.fn((msgs, q) => [...msgs, { role: 'user', content: q }]),
}));
vi.mock('../src/content/bubble/markdown.js', () => ({
  renderMarkdown: vi.fn((text) => `<p>${text}</p>`),
}));

const apiModule = await import('../src/content/api.js');
const promptModule = await import('../src/content/prompt.js');
const { startStreaming, handleFollowUp, showRateLimitUI } = await import('../src/content/bubble/stream.js');
const stateModule = await import('../src/content/shared/state.js');
const viewModel = await import('../src/content/bubble/view-model.js');

// Create a minimal shadow DOM with all elements stream.js needs
function createTestShadow() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <div class="bubble-body">
      <div class="response-text"></div>
      <div class="bubble-status">thinking...</div>
      <span class="cursor hidden"></span>
      <input class="follow-up-input" />
    </div>
  `;
  return shadow;
}

// Stores the callbacks passed to requestChat so tests can invoke them
let lastCallbacks = {};

describe('stream.js', () => {
  let shadow;

  beforeEach(() => {
    document.body.innerHTML = '';
    shadow = createTestShadow();
    lastCallbacks = {};
    vi.clearAllMocks();
    apiModule.requestChat.mockImplementation((messages, onToken, onDone, onError) => {
      lastCallbacks = { onToken, onDone, onError };
      return { cancel: vi.fn() };
    });
    promptModule.buildFollowUp.mockImplementation((msgs, q) => [...msgs, { role: 'user', content: q }]);
    stateModule.setResponseText('');
    stateModule.setCurrentMessages([]);
    stateModule.setRenderTimer(null);
    stateModule.setCurrentRequest(null);
    viewModel.resetBubbleView();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ─── showRateLimitUI ──────────────────────────────────────────────────────

  describe('showRateLimitUI', () => {
    it('switches the bubble view to the rate-limit state', () => {
      showRateLimitUI(shadow);
      expect(viewModel.getBubbleViewState().bodyMode).toBe('rate-limit');
    });

    it('hides the streaming cursor', () => {
      showRateLimitUI(shadow);
      expect(viewModel.getBubbleViewState().cursorVisible).toBe(false);
    });

    it('does not mutate the legacy shadow DOM directly', () => {
      const before = shadow.innerHTML;
      showRateLimitUI(shadow);
      expect(shadow.innerHTML).toBe(before);
    });
  });

  // ─── startStreaming — error / retry branch ────────────────────────────────

  describe('startStreaming — error/retry branch', () => {
    it('creates an error-msg div with the provided message', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hello' }]);
      lastCallbacks.onError('NETWORK_ERROR', 'Network failed.', {});

      expect(viewModel.getBubbleViewState().messages.at(-1).errorMessage).toBe('Network failed.');
    });

    it('falls back to default message when none is provided', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hello' }]);
      lastCallbacks.onError('UNKNOWN', '', {});

      expect(viewModel.getBubbleViewState().messages.at(-1).errorMessage).toBe('Something went wrong.');
    });

    it('appends a retry button inside the error-msg div', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hello' }]);
      lastCallbacks.onError('TIMEOUT', 'Request timed out.', {});

      expect(viewModel.getBubbleViewState().messages.at(-1).onRetry).toBeTypeOf('function');
    });

    it('retry click removes error div, resets responseText, and re-calls startStreaming', () => {
      const messages = [{ role: 'user', content: 'hello' }];
      startStreaming(shadow, messages);
      lastCallbacks.onError('TIMEOUT', 'Timed out.', {});

      expect(viewModel.getBubbleViewState().messages.at(-1).errorMessage).toBe('Timed out.');
      expect(apiModule.requestChat).toHaveBeenCalledTimes(1);

      viewModel.getBubbleViewState().messages.at(-1).onRetry();

      expect(viewModel.getBubbleViewState().messages.at(-1).errorMessage).toBeUndefined();
      expect(apiModule.requestChat).toHaveBeenCalledTimes(2);
    });

    it('RATE_LIMITED error delegates to showRateLimitUI', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hello' }]);
      lastCallbacks.onError('RATE_LIMITED', '', {});

      expect(viewModel.getBubbleViewState().bodyMode).toBe('rate-limit');
    });

    it('hides the cursor on non-RATE_LIMITED error', () => {
      const cursorEl = shadow.querySelector('.cursor');
      cursorEl.classList.remove('hidden');

      startStreaming(shadow, [{ role: 'user', content: 'hello' }]);
      lastCallbacks.onError('SERVER_ERROR', 'Oops.', {});

      expect(viewModel.getBubbleViewState().cursorVisible).toBe(false);
    });
  });

  // ─── handleFollowUp ───────────────────────────────────────────────────────

  describe('handleFollowUp', () => {
    it('appends a .message-user bubble with the question text', () => {
      handleFollowUp(shadow, 'What does this mean?');

      const userMsg = viewModel.getBubbleViewState().messages[0];
      expect(userMsg.role).toBe('user');
      expect(userMsg.content).toBe('What does this mean?');
    });

    it('calls buildFollowUp with existing messages and the new question', () => {
      const existing = [{ role: 'user', content: 'initial' }];
      stateModule.setCurrentMessages(existing);

      handleFollowUp(shadow, 'follow up?');

      expect(promptModule.buildFollowUp).toHaveBeenCalledWith(existing, 'follow up?');
    });

    it('triggers startStreaming — requestChat is called once', () => {
      handleFollowUp(shadow, 'tell me more');

      expect(apiModule.requestChat).toHaveBeenCalledTimes(1);
    });

    it('resets responseText to empty before starting the new stream', () => {
      stateModule.setResponseText('previous response');

      handleFollowUp(shadow, 'another question');

      // responseText is reset by handleFollowUp before startStreaming runs
      expect(stateModule.responseText).toBe('');
    });
  });

  // ─── startStreaming — render debounce timer flush on done ─────────────────

  describe('startStreaming — render debounce timer flush on done', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('sets renderTimer when a token arrives (debounce is pending)', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);

      lastCallbacks.onToken('Hello');

      expect(stateModule.renderTimer).not.toBeNull();
    });

    it('clears renderTimer immediately when done fires before debounce expires', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);

      lastCallbacks.onToken('Hello');
      expect(stateModule.renderTimer).not.toBeNull(); // timer pending

      lastCallbacks.onDone(null); // done fires before debounce delay

      expect(stateModule.renderTimer).toBeNull();
    });

    it('debounce timer fires and clears itself when not interrupted by done', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);

      lastCallbacks.onToken('Hello');
      expect(stateModule.renderTimer).not.toBeNull();

      vi.advanceTimersByTime(100); // past 50ms RENDER_DEBOUNCE

      expect(stateModule.renderTimer).toBeNull();
    });

    it('no error when runAllTimers called after done has already cleared the timer', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);

      lastCallbacks.onToken('word');
      lastCallbacks.onDone(null);

      expect(() => vi.runAllTimers()).not.toThrow();
      expect(stateModule.renderTimer).toBeNull();
    });
  });

  // ─── startStreaming — token / done callbacks (supporting coverage) ─────────

  describe('startStreaming — token callback', () => {
    it('sets status to "thinking..." initially', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);
      expect(viewModel.getBubbleViewState().status).toBe('thinking...');
    });

    it('updates status to "typing..." on first token', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);
      lastCallbacks.onToken('Hello');
      expect(viewModel.getBubbleViewState().status).toBe('typing...');
    });

    it('disables the follow-up input while streaming', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);
      expect(viewModel.getBubbleViewState().followUpDisabled).toBe(true);
    });
  });

  describe('startStreaming — done callback', () => {
    it('re-enables follow-up input when streaming completes', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);
      lastCallbacks.onDone(null);
      expect(viewModel.getBubbleViewState().followUpDisabled).toBe(false);
    });

    it('shows remaining count in status when usageInfo.remaining is present', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);
      lastCallbacks.onDone({ remaining: 18 });
      expect(viewModel.getBubbleViewState().status).toBe('18/30 free');
    });

    it('shows "your API key" when usageInfo.usingOwnKey is true', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);
      lastCallbacks.onDone({ usingOwnKey: true });
      expect(viewModel.getBubbleViewState().status).toBe('your API key');
    });

    it('clears status text when usageInfo is null', () => {
      startStreaming(shadow, [{ role: 'user', content: 'hi' }]);
      lastCallbacks.onDone(null);
      expect(viewModel.getBubbleViewState().status).toBe('');
    });
  });
});
