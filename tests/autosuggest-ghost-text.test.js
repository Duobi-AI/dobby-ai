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
      fontWeight: '400',
      fontStyle: 'normal',
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

  it('positions contenteditable ghost text at the caret', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    editor.textContent = 'Hello ';
    document.body.appendChild(editor);
    editor.getBoundingClientRect = vi.fn(() => ({
      top: 100, left: 50, width: 400, height: 40, bottom: 140, right: 450,
    }));
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    range.getBoundingClientRect = vi.fn(() => ({
      top: 110, left: 120, width: 0, height: 20, bottom: 130, right: 120,
    }));
    range.cloneRange = vi.fn(() => range);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    showGhostText(editor, 'world');

    const host = document.querySelector('[data-dobby-autosuggest]');
    expect(host.style.left).toBe('120px');
    expect(host.shadowRoot.querySelector('.ghost-container').classList.contains('contenteditable')).toBe(true);
  });

  it('wraps contenteditable ghost text inside the editor near the right edge', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    editor.textContent = 'Hello ';
    document.body.appendChild(editor);
    editor.getBoundingClientRect = vi.fn(() => ({
      top: 100, left: 50, width: 400, height: 80, bottom: 180, right: 450,
    }));
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    range.getBoundingClientRect = vi.fn(() => ({
      top: 110, left: 430, width: 0, height: 20, bottom: 130, right: 430,
    }));
    range.cloneRange = vi.fn(() => range);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    showGhostText(editor, 'world');

    const host = document.querySelector('[data-dobby-autosuggest]');
    expect(host.style.top).toBe('130px');
    expect(host.style.left).toBe('50px');
    expect(host.style.maxWidth).toBe('400px');
  });
});
