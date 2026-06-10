// src/content/autosuggest/index.js — Main lifecycle: textarea detection, input -> debounce -> API -> ghost text
import {
  autosuggestEnabled,
  autosuggestActiveTextarea,
  autosuggestCurrentSuggestion,
  setAutosuggestActiveTextarea,
  setAutosuggestPendingRequest,
} from '../shared/state.js';
import { debouncedSuggest, cancelPending } from './debounce.js';
import { buildCompletionMessages, gatherPageContext } from './context.js';
import { showGhostText, hideGhostText, acceptSuggestion } from './ghost-text.js';
import { requestAutosuggest } from '../api.js';

let focusinHandler = null;
let focusoutHandler = null;

export function initAutosuggest() {
  if (!autosuggestEnabled) return;
  if (focusinHandler || focusoutHandler) return;

  focusinHandler = (e) => {
    if (e.target.tagName === 'TEXTAREA') attachToTextarea(e.target);
  };

  focusoutHandler = (e) => {
    if (e.target === autosuggestActiveTextarea) detachFromTextarea();
  };

  document.addEventListener('focusin', focusinHandler);
  document.addEventListener('focusout', focusoutHandler);
}

export function destroyAutosuggest() {
  detachFromTextarea();
  if (focusinHandler) {
    document.removeEventListener('focusin', focusinHandler);
    focusinHandler = null;
  }
  if (focusoutHandler) {
    document.removeEventListener('focusout', focusoutHandler);
    focusoutHandler = null;
  }
}

function attachToTextarea(textarea) {
  if (autosuggestActiveTextarea) detachFromTextarea();
  setAutosuggestActiveTextarea(textarea);
  textarea.addEventListener('input', handleInput);
  textarea.addEventListener('keydown', handleKeydown);
}

function detachFromTextarea() {
  const ta = autosuggestActiveTextarea;
  if (ta) {
    ta.removeEventListener('input', handleInput);
    ta.removeEventListener('keydown', handleKeydown);
  }
  cancelPending();
  hideGhostText();
  setAutosuggestActiveTextarea(null);
}

function handleInput(e) {
  hideGhostText();
  const text = e.target.value;
  debouncedSuggest(text, (t) => requestSuggestionFromAPI(t, e.target));
}

function handleKeydown(e) {
  if (e.key === 'Tab' && autosuggestCurrentSuggestion) {
    e.preventDefault();
    acceptSuggestion(autosuggestActiveTextarea);
  } else if (e.key === 'Escape' && autosuggestCurrentSuggestion) {
    hideGhostText();
  }
}

function requestSuggestionFromAPI(text, textarea) {
  const messages = buildCompletionMessages(text, gatherPageContext(textarea));

  let accumulated = '';
  const handle = requestAutosuggest(
    messages,
    (token) => {
      accumulated += token;
      showGhostText(textarea, accumulated);
    },
    () => {
      // Done — suggestion is now in state via showGhostText
    },
    (code, message) => {
      console.error('[Dobby Autosuggest] API error:', code, message);
      hideGhostText();
    }
  );
  setAutosuggestPendingRequest(handle);
}
