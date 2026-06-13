// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getEditableRoot,
  getEditorText,
  hasCollapsedCaret,
  insertSuggestion,
} from '../src/content/autosuggest/editor.js';

function placeCaret(editor, node = editor.firstChild, offset = node?.textContent?.length || 0) {
  const range = document.createRange();
  range.setStart(node || editor, offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
});

describe('autosuggest editor adapter', () => {
  it('detects textareas and the nearest inherited contenteditable root', () => {
    const textarea = document.createElement('textarea');
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const child = document.createElement('span');
    editor.appendChild(child);
    document.body.append(textarea, editor);

    expect(getEditableRoot(textarea)).toBe(textarea);
    expect(getEditableRoot(child)).toBe(editor);
  });

  it('does not cross a contenteditable=false boundary', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const disabled = document.createElement('span');
    disabled.setAttribute('contenteditable', 'false');
    editor.appendChild(disabled);
    document.body.appendChild(editor);

    expect(getEditableRoot(disabled)).toBeNull();
  });

  it('reads textarea and contenteditable text', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Textarea value';
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    editor.textContent = 'Rich editor value';

    expect(getEditorText(textarea)).toBe('Textarea value');
    expect(getEditorText(editor)).toBe('Rich editor value');
  });

  it('requires a collapsed caret inside the editor', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    editor.textContent = 'Hello';
    document.body.appendChild(editor);
    placeCaret(editor);

    expect(hasCollapsedCaret(editor)).toBe(true);

    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    expect(hasCollapsedCaret(editor)).toBe(false);
  });

  it('inserts into a textarea and dispatches input', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Hello ';
    textarea.selectionStart = 6;
    textarea.selectionEnd = 6;
    const inputSpy = vi.fn();
    textarea.addEventListener('input', inputSpy);

    expect(insertSuggestion(textarea, 'world')).toBe(true);
    expect(textarea.value).toBe('Hello world');
    expect(textarea.selectionStart).toBe(11);
    expect(inputSpy).toHaveBeenCalledOnce();
  });

  it('falls back to Range insertion for contenteditable editors', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    editor.textContent = 'Hello ';
    document.body.appendChild(editor);
    placeCaret(editor);
    document.execCommand = vi.fn(() => false);
    const inputSpy = vi.fn();
    editor.addEventListener('input', inputSpy);

    expect(insertSuggestion(editor, 'world')).toBe(true);
    expect(editor.textContent).toBe('Hello world');
    expect(inputSpy).toHaveBeenCalledOnce();
    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'world');
  });
});
