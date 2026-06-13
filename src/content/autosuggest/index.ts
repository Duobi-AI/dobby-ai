// src/content/autosuggest/index.js — Main lifecycle: editor detection, input -> debounce -> API -> ghost text
import {
  autosuggestEnabled,
  autosuggestActiveEditor,
  autosuggestCurrentSuggestion,
  setAutosuggestActiveEditor,
  setAutosuggestPendingRequest,
} from '../shared/state.js';
import { debouncedSuggest, cancelPending } from './debounce.js';
import { buildCompletionMessages, gatherPageContext } from './context.js';
import { showGhostText, hideGhostText, acceptSuggestion } from './ghost-text.js';
import { requestAutosuggest } from '../api.js';
import {
  getEditableRoot,
  getEditorText,
  hasCollapsedCaret,
  type AutosuggestEditor,
} from './editor.js';

let focusinHandler: ((event: FocusEvent) => void) | null = null;
let focusoutHandler: ((event: FocusEvent) => void) | null = null;
let isComposing = false;
let requestGeneration = 0;

export function initAutosuggest() {
  if (!autosuggestEnabled) return;
  if (focusinHandler || focusoutHandler) return;

  focusinHandler = (e: FocusEvent) => {
    const editor = getEditableRoot(e.target);
    if (editor) attachToEditor(editor);
  };

  focusoutHandler = (e: FocusEvent) => {
    const activeEditor = autosuggestActiveEditor;
    if (!activeEditor || !(e.target instanceof Node) || !activeEditor.contains(e.target)) return;
    if (e.relatedTarget instanceof Node && activeEditor.contains(e.relatedTarget)) return;
    detachFromEditor();
  };

  document.addEventListener('focusin', focusinHandler);
  document.addEventListener('focusout', focusoutHandler);
}

export function destroyAutosuggest() {
  detachFromEditor();
  if (focusinHandler) {
    document.removeEventListener('focusin', focusinHandler);
    focusinHandler = null;
  }
  if (focusoutHandler) {
    document.removeEventListener('focusout', focusoutHandler);
    focusoutHandler = null;
  }
}

function attachToEditor(editor: AutosuggestEditor) {
  if (autosuggestActiveEditor === editor) return;
  if (autosuggestActiveEditor) detachFromEditor();
  setAutosuggestActiveEditor(editor);
  editor.addEventListener('input', handleInput);
  editor.addEventListener('keydown', handleKeydown);
  editor.addEventListener('compositionstart', handleCompositionStart);
  editor.addEventListener('compositionend', handleCompositionEnd);
  editor.addEventListener('click', handleCaretChange);
  editor.addEventListener('scroll', handleCaretChange);
}

function detachFromEditor() {
  const editor = autosuggestActiveEditor;
  if (editor) {
    editor.removeEventListener('input', handleInput);
    editor.removeEventListener('keydown', handleKeydown);
    editor.removeEventListener('compositionstart', handleCompositionStart);
    editor.removeEventListener('compositionend', handleCompositionEnd);
    editor.removeEventListener('click', handleCaretChange);
    editor.removeEventListener('scroll', handleCaretChange);
  }
  isComposing = false;
  invalidateSuggestion();
  setAutosuggestActiveEditor(null);
}

function handleInput(e: Event) {
  invalidateSuggestion();
  const editor = autosuggestActiveEditor;
  if (!editor || !editor.isConnected || isComposing || (e as InputEvent).isComposing || !hasCollapsedCaret(editor)) {
    return;
  }
  const text = getEditorText(editor);
  debouncedSuggest(text, (t) => requestSuggestionFromAPI(t, editor));
}

function handleKeydown(event: Event) {
  const e = event as KeyboardEvent;
  const editor = autosuggestActiveEditor;
  if (e.key === 'Tab' && autosuggestCurrentSuggestion && editor) {
    if (acceptSuggestion(editor)) e.preventDefault();
  } else if (e.key === 'Escape' && autosuggestCurrentSuggestion) {
    invalidateSuggestion();
  } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    handleCaretChange();
  }
}

function handleCompositionStart() {
  isComposing = true;
  invalidateSuggestion();
}

function handleCompositionEnd() {
  isComposing = false;
}

function handleCaretChange() {
  invalidateSuggestion();
}

function invalidateSuggestion() {
  requestGeneration += 1;
  cancelPending();
  hideGhostText();
}

function requestSuggestionFromAPI(text: string, editor: AutosuggestEditor) {
  const messages = buildCompletionMessages(text, gatherPageContext(editor));
  const requestId = ++requestGeneration;

  let accumulated = '';
  const handle = requestAutosuggest(
    messages,
    (token) => {
      if (requestGeneration !== requestId) return;
      if (
        autosuggestActiveEditor !== editor
        || !editor.isConnected
        || getEditorText(editor) !== text
        || !hasCollapsedCaret(editor)
      ) {
        invalidateSuggestion();
        return;
      }
      accumulated += token;
      showGhostText(editor, accumulated);
    },
    () => {
      if (requestGeneration === requestId) setAutosuggestPendingRequest(null);
    },
    (code, message) => {
      if (requestGeneration !== requestId) return;
      setAutosuggestPendingRequest(null);
      console.error('[Dobby Autosuggest] API error:', code, message);
      hideGhostText();
    }
  );
  setAutosuggestPendingRequest(handle);
}
