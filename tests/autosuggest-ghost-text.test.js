// tests/autosuggest-ghost-text.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetAutosuggestState, autosuggestCurrentSuggestion } from '../src/content/shared/state.js';

describe('ghost text overlay', () => {
  let showGhostText, hideGhostText, acceptSuggestion;
  let textarea;

  beforeEach(async () => {
    resetAutosuggestState();
    textarea = document.createElement('textarea');
    textarea.value = 'Hello ';
    textarea.selectionStart = 6;
    textarea.selectionEnd = 6;
    textarea.style.cssText = 'font-size:16px;font-family:monospace;padding:8px;line-height:20px;';
    document.body.appendChild(textarea);

    textarea.getBoundingClientRect = vi.fn(() => ({
      top: 100, left: 50, width: 400, height: 200, bottom: 300, right: 450,
    }));

    // Mock getComputedStyle
    window.getComputedStyle = vi.fn(() => ({
      fontSize: '16px',
      fontFamily: 'monospace',
      lineHeight: '20px',
      paddingTop: '8px',
      paddingLeft: '8px',
      paddingRight: '8px',
      paddingBottom: '8px',
      borderTopWidth: '1px',
      borderLeftWidth: '1px',
      letterSpacing: 'normal',
      wordSpacing: 'normal',
    }));

    const mod = await import('../src/content/autosuggest/ghost-text.js');
    showGhostText = mod.showGhostText;
    hideGhostText = mod.hideGhostText;
    acceptSuggestion = mod.acceptSuggestion;
  });

  afterEach(() => {
    hideGhostText();
    document.body.innerHTML = '';
    resetAutosuggestState();
  });

  it('creates a shadow DOM overlay with suggestion text', () => {
    showGhostText(textarea, 'world, how are you?');
    const host = document.querySelector('[data-dobby-autosuggest]');
    expect(host).not.toBeNull();
    expect(host.shadowRoot).not.toBeNull();
    const ghostSpan = host.shadowRoot.querySelector('.ghost-text');
    expect(ghostSpan.textContent).toBe('world, how are you?');
  });

  it('positions overlay over the textarea', () => {
    showGhostText(textarea, 'world');
    const host = document.querySelector('[data-dobby-autosuggest]');
    expect(host.style.position).toBe('absolute');
  });

  it('updates existing overlay on repeat calls', () => {
    showGhostText(textarea, 'world');
    showGhostText(textarea, 'world, how are you?');
    const hosts = document.querySelectorAll('[data-dobby-autosuggest]');
    expect(hosts).toHaveLength(1);
  });

  it('hides overlay when called', () => {
    showGhostText(textarea, 'world');
    hideGhostText();
    const host = document.querySelector('[data-dobby-autosuggest]');
    expect(host).toBeNull();
  });

  it('acceptSuggestion inserts text into textarea at cursor', () => {
    showGhostText(textarea, 'world');
    acceptSuggestion(textarea);
    expect(textarea.value).toBe('Hello world');
    expect(textarea.selectionStart).toBe(11);
  });

  it('acceptSuggestion hides overlay after accepting', () => {
    showGhostText(textarea, 'world');
    acceptSuggestion(textarea);
    const host = document.querySelector('[data-dobby-autosuggest]');
    expect(host).toBeNull();
  });

  it('acceptSuggestion dispatches input event for framework compatibility', () => {
    showGhostText(textarea, 'world');
    const inputSpy = vi.fn();
    textarea.addEventListener('input', inputSpy);
    acceptSuggestion(textarea);
    expect(inputSpy).toHaveBeenCalled();
  });

  it('reuses the same host and shadow root across repeat calls', () => {
    showGhostText(textarea, 'world');
    const host1 = document.querySelector('[data-dobby-autosuggest]');
    const shadow1 = host1.shadowRoot;
    showGhostText(textarea, 'world, how are you?');
    const host2 = document.querySelector('[data-dobby-autosuggest]');
    expect(host2).toBe(host1);
    expect(host2.shadowRoot).toBe(shadow1);
  });

  it('updates ghost text content on repeat calls', () => {
    showGhostText(textarea, 'world');
    showGhostText(textarea, 'updated text');
    const host = document.querySelector('[data-dobby-autosuggest]');
    expect(host.shadowRoot.querySelector('.ghost-text').textContent).toBe('updated text');
  });

  it('does not recompute getComputedStyle on repeat calls for the same textarea', () => {
    window.getComputedStyle.mockClear();
    showGhostText(textarea, 'world');
    expect(window.getComputedStyle).toHaveBeenCalledTimes(1);
    showGhostText(textarea, 'world again');
    showGhostText(textarea, 'world once more');
    // Still only the single computation from the first call
    expect(window.getComputedStyle).toHaveBeenCalledTimes(1);
  });

  it('recomputes getComputedStyle when switching to a different textarea', () => {
    showGhostText(textarea, 'world');
    window.getComputedStyle.mockClear();

    const other = document.createElement('textarea');
    other.value = 'Hi ';
    other.selectionStart = 3;
    other.getBoundingClientRect = vi.fn(() => ({
      top: 10, left: 20, width: 300, height: 150, bottom: 160, right: 320,
    }));
    document.body.appendChild(other);

    showGhostText(other, 'there');
    expect(window.getComputedStyle).toHaveBeenCalledTimes(1);
    const host = document.querySelector('[data-dobby-autosuggest]');
    expect(host.shadowRoot.querySelector('.ghost-text').textContent).toBe('there');
    expect(host.style.top).toBe('10px');
  });

  it('recomputes styles after hideGhostText resets cached state', () => {
    showGhostText(textarea, 'world');
    hideGhostText();
    window.getComputedStyle.mockClear();
    showGhostText(textarea, 'world');
    // Host was torn down on hide, so styles must be recomputed
    expect(window.getComputedStyle).toHaveBeenCalledTimes(1);
  });

  it('hides overlay and does not desync when same textarea ref is detached before call', () => {
    showGhostText(textarea, 'world');
    expect(document.querySelector('[data-dobby-autosuggest]')).not.toBeNull();

    // Detach the textarea from the DOM (SPA re-render scenario)
    textarea.remove();
    expect(textarea.isConnected).toBe(false);

    // Calling showGhostText with the same (now-detached) ref must hide, not desync
    showGhostText(textarea, 'world again');
    expect(document.querySelector('[data-dobby-autosuggest]')).toBeNull();
  });

  it('hides overlay when getBoundingClientRect returns 0x0 (invisible/moved node)', () => {
    showGhostText(textarea, 'world');
    expect(document.querySelector('[data-dobby-autosuggest]')).not.toBeNull();

    // Simulate node that is connected but reports a zero-area rect
    textarea.getBoundingClientRect = vi.fn(() => ({
      top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0,
    }));

    showGhostText(textarea, 'world again');
    expect(document.querySelector('[data-dobby-autosuggest]')).toBeNull();
  });

  it('recomputes getComputedStyle when same textarea ref is detached (stale cache)', () => {
    showGhostText(textarea, 'world');
    // Re-attach a fresh textarea with same variable name (simulate SPA swap)
    textarea.remove();
    const fresh = document.createElement('textarea');
    fresh.value = 'Hi ';
    fresh.selectionStart = 3;
    fresh.getBoundingClientRect = vi.fn(() => ({
      top: 10, left: 20, width: 300, height: 150, bottom: 160, right: 320,
    }));
    document.body.appendChild(fresh);
    window.getComputedStyle.mockClear();

    showGhostText(fresh, 'there');
    // fresh !== styledTextarea, so styles must be recomputed
    expect(window.getComputedStyle).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-dobby-autosuggest]')).not.toBeNull();
  });
});
