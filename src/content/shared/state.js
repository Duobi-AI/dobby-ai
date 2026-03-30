// src/content/shared/state.js — Central mutable state for content scripts

// Bubble state
export let bubbleHost = null;
export let currentMessages = [];
export let responseText = '';
export let currentRequest = null;
export let renderTimer = null;

export function setBubbleHost(v) { bubbleHost = v; }
export function setCurrentMessages(v) { currentMessages = v; }
export function setResponseText(v) { responseText = v; }
export function appendResponseText(v) { responseText += v; }
export function setCurrentRequest(v) { currentRequest = v; }
export function setRenderTimer(v) { renderTimer = v; }

// Raw AI response tracking (for copy button)
export let rawResponses = [];
export function pushRawResponse(text) { rawResponses.push(text); return rawResponses.length - 1; }
export function clearRawResponses() { rawResponses = []; }

// Trigger state
export let triggerButton = null;
export let dobbyEnabled = true;

export function setTriggerButton(v) { triggerButton = v; }
export function setDobbyEnabled(v) { dobbyEnabled = v; }

// Toolbar state
export let toolbarHost = null;
export let toolbarState = 'collapsed'; // 'collapsed' | 'expanded' | 'input' | 'morphed'

export function setToolbarHost(host) { toolbarHost = host; }
export function setToolbarState(state) { toolbarState = state; }

// Screenshot mode toggle
export let screenshotEnabled = true;
export function setScreenshotEnabled(v) { screenshotEnabled = v; }

// Screenshot state
export const screenshotState = {
  overlay: null,
  startX: 0,
  startY: 0,
  rect: null,
  dragStarted: false,
};

export function resetScreenshotState() {
  screenshotState.overlay = null;
  screenshotState.startX = 0;
  screenshotState.startY = 0;
  screenshotState.rect = null;
  screenshotState.dragStarted = false;
}

// Long-press state
export const longPressState = {
  timer: null,
  startX: 0,
  startY: 0,
  ring: null,
  ringTimer: null,
};

// Timer state (for selection/scroll debounce)
export let selectionChangeTimer = null;
export let scrollTimer = null;

export function setSelectionChangeTimer(v) { selectionChangeTimer = v; }
export function setScrollTimer(v) { scrollTimer = v; }

// Autosuggest state
export let autosuggestEnabled = false;
export let autosuggestActiveTextarea = null;
export let autosuggestCurrentSuggestion = '';
export let autosuggestOverlayHost = null;
export let autosuggestPendingRequest = null;
export let autosuggestDebounceTimer = null;

export function setAutosuggestEnabled(v) { autosuggestEnabled = v; }
export function setAutosuggestActiveTextarea(v) { autosuggestActiveTextarea = v; }
export function setAutosuggestCurrentSuggestion(v) { autosuggestCurrentSuggestion = v; }
export function setAutosuggestOverlayHost(v) { autosuggestOverlayHost = v; }
export function setAutosuggestPendingRequest(v) { autosuggestPendingRequest = v; }
export function setAutosuggestDebounceTimer(v) { autosuggestDebounceTimer = v; }

export function resetAutosuggestState() {
  autosuggestEnabled = false;
  autosuggestActiveTextarea = null;
  autosuggestCurrentSuggestion = '';
  autosuggestOverlayHost = null;
  autosuggestPendingRequest = null;
  autosuggestDebounceTimer = null;
}
