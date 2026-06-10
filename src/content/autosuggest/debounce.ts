// src/content/autosuggest/debounce.js — Typing pause detection and request cancellation
import { AUTOSUGGEST } from '../shared/constants.js';
import {
  autosuggestDebounceTimer,
  setAutosuggestDebounceTimer,
  autosuggestPendingRequest,
  setAutosuggestPendingRequest,
} from '../shared/state.js';

export function debouncedSuggest(text, callback) {
  cancelPending();
  if (text.length < AUTOSUGGEST.MIN_CHARS) return;
  const timer = setTimeout(() => {
    callback(text);
  }, AUTOSUGGEST.DEBOUNCE_MS);
  setAutosuggestDebounceTimer(timer);
}

export function cancelPending() {
  // Clear debounce timer
  const timer = autosuggestDebounceTimer;
  if (timer) {
    clearTimeout(timer);
    setAutosuggestDebounceTimer(null);
  }
  // Abort in-flight API request
  const pending = autosuggestPendingRequest;
  if (pending) {
    pending.cancel();
    setAutosuggestPendingRequest(null);
  }
}
