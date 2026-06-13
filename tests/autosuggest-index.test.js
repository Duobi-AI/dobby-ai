// tests/autosuggest-index.test.js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resetAutosuggestState,
  setAutosuggestEnabled,
  autosuggestCurrentSuggestion,
  setAutosuggestCurrentSuggestion,
} from '../src/content/shared/state.js';
import { showGhostText } from '../src/content/autosuggest/ghost-text.js';
import { requestAutosuggest } from '../src/content/api.js';

// Mock the API module
vi.mock('../src/content/api.js', () => ({
  requestAutosuggest: vi.fn((messages, onToken, onDone) => {
    onToken('suggestion text');
    onDone();
    return { cancel: vi.fn() };
  }),
  requestChat: vi.fn(),
}));

describe('autosuggest lifecycle', () => {
  let initAutosuggest, destroyAutosuggest;
  let textarea;
  let editor;

  beforeEach(async () => {
    vi.useFakeTimers();
    resetAutosuggestState();
    setAutosuggestEnabled(true);
    vi.clearAllMocks();

    textarea = document.createElement('textarea');
    textarea.style.cssText = 'font-size:16px;font-family:monospace;padding:8px;line-height:20px;';
    document.body.appendChild(textarea);
    editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    editor.textContent = 'Hello rich editor';
    document.body.appendChild(editor);

    textarea.getBoundingClientRect = vi.fn(() => ({
      top: 100, left: 50, width: 400, height: 200, bottom: 300, right: 450,
    }));
    window.getComputedStyle = vi.fn(() => ({
      fontSize: '16px', fontFamily: 'monospace', lineHeight: '20px',
      paddingTop: '8px', paddingLeft: '8px', paddingRight: '8px', paddingBottom: '8px',
      borderTopWidth: '1px', borderLeftWidth: '1px',
      letterSpacing: 'normal', wordSpacing: 'normal',
    }));

    const mod = await import('../src/content/autosuggest/index.js');
    initAutosuggest = mod.initAutosuggest;
    destroyAutosuggest = mod.destroyAutosuggest;
  });

  afterEach(() => {
    destroyAutosuggest();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('attaches focus listeners when initAutosuggest() called', () => {
    const spy = vi.spyOn(document, 'addEventListener');
    initAutosuggest();
    const focusinCall = spy.mock.calls.find((c) => c[0] === 'focusin');
    const focusoutCall = spy.mock.calls.find((c) => c[0] === 'focusout');
    expect(focusinCall).toBeDefined();
    expect(focusoutCall).toBeDefined();
  });

  it('does not register duplicate document listeners on repeated initAutosuggest() calls', () => {
    const spy = vi.spyOn(document, 'addEventListener');

    initAutosuggest();
    initAutosuggest();
    initAutosuggest();

    expect(spy.mock.calls.filter((c) => c[0] === 'focusin')).toHaveLength(1);
    expect(spy.mock.calls.filter((c) => c[0] === 'focusout')).toHaveLength(1);
  });

  it('does not attach duplicate textarea listeners after repeated initAutosuggest() calls', () => {
    const addSpy = vi.spyOn(textarea, 'addEventListener');
    const removeSpy = vi.spyOn(textarea, 'removeEventListener');

    initAutosuggest();
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(addSpy.mock.calls.filter((c) => c[0] === 'input')).toHaveLength(1);
    expect(addSpy.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(1);
    expect(removeSpy.mock.calls.filter((c) => c[0] === 'input')).toHaveLength(0);
    expect(removeSpy.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(0);
  });

  it('monitors a nested target through its contenteditable root', () => {
    const child = document.createElement('span');
    editor.appendChild(child);
    const addSpy = vi.spyOn(editor, 'addEventListener');

    initAutosuggest();
    child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(addSpy.mock.calls.filter((c) => c[0] === 'input')).toHaveLength(1);
    expect(addSpy.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(1);
  });

  it('starts monitoring textarea on focus', () => {
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    textarea.value = 'Hello world this is a test';
    textarea.selectionStart = textarea.value.length;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-dobby-autosuggest]')).toBeNull();
  });

  it('does not request suggestions while an IME composition is active', () => {
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    textarea.value = 'Hello world this is composing';
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    vi.advanceTimersByTime(1000);

    expect(requestAutosuggest).not.toHaveBeenCalled();
  });

  it('ignores late tokens from a superseded request', () => {
    let lateToken;
    requestAutosuggest.mockImplementationOnce((messages, onToken) => {
      lateToken = onToken;
      return { cancel: vi.fn() };
    });

    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    textarea.value = 'First request text';
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(500);

    textarea.value = 'Newer request text';
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    lateToken('stale suggestion');

    expect(document.querySelector('[data-dobby-autosuggest]')).toBeNull();
  });

  it('Tab key accepts suggestion when one is visible', () => {
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    setAutosuggestCurrentSuggestion('world');

    // Show ghost text overlay so acceptSuggestion has something to work with
    textarea.value = 'Hello ';
    textarea.selectionStart = 6;
    showGhostText(textarea, 'world');

    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    textarea.dispatchEvent(event);
    expect(textarea.value).toBe('Hello world');
  });

  it('Escape key dismisses suggestion', () => {
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    setAutosuggestCurrentSuggestion('world');

    textarea.value = 'Hello ';
    textarea.selectionStart = 6;
    showGhostText(textarea, 'world');

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-dobby-autosuggest]')).toBeNull();
  });

  it('scrolling the active editor dismisses the suggestion', () => {
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    textarea.value = 'Hello ';
    textarea.selectionStart = 6;
    showGhostText(textarea, 'world');

    textarea.dispatchEvent(new Event('scroll'));

    expect(document.querySelector('[data-dobby-autosuggest]')).toBeNull();
  });

  it('destroyAutosuggest removes all listeners', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    initAutosuggest();
    destroyAutosuggest();
    const focusinRemove = removeSpy.mock.calls.find((c) => c[0] === 'focusin');
    const focusoutRemove = removeSpy.mock.calls.find((c) => c[0] === 'focusout');
    expect(focusinRemove).toBeDefined();
    expect(focusoutRemove).toBeDefined();
  });

  it('destroyAutosuggest removes listeners after repeated initAutosuggest() calls', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    initAutosuggest();
    initAutosuggest();
    destroyAutosuggest();

    expect(removeSpy.mock.calls.filter((c) => c[0] === 'focusin')).toHaveLength(1);
    expect(removeSpy.mock.calls.filter((c) => c[0] === 'focusout')).toHaveLength(1);
  });

  it('cleans up on textarea blur', () => {
    initAutosuggest();
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(document.querySelector('[data-dobby-autosuggest]')).toBeNull();
  });
});
