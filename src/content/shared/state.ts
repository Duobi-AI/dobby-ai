// src/content/shared/state.js — Central mutable state for content scripts
import type {
  LongPressState,
  ScreenshotState,
  StreamRequestHandle,
  ToolbarHost,
  ToolbarState,
} from '../../shared/types';

// Trigger state
export let triggerButton: ToolbarHost | null = null;
export let dobbyEnabled = true;

export function setTriggerButton(v: ToolbarHost | null) { triggerButton = v; }
export function setDobbyEnabled(v: boolean) { dobbyEnabled = v; }

// Toolbar state
export let toolbarHost: ToolbarHost | null = null;
export let toolbarState: ToolbarState = 'collapsed';

export function setToolbarHost(host: ToolbarHost | null) { toolbarHost = host; }
export function setToolbarState(state: ToolbarState) { toolbarState = state; }

// Screenshot mode toggle
export let screenshotEnabled = true;
export function setScreenshotEnabled(v: boolean) { screenshotEnabled = v; }

// Screenshot state
export const screenshotState: ScreenshotState = {
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
export const longPressState: LongPressState = {
  timer: null,
  startX: 0,
  startY: 0,
  ring: null,
  ringTimer: null,
};

// Timer state (for selection/scroll debounce)
export let selectionChangeTimer: ReturnType<typeof setTimeout> | null = null;
export let scrollTimer: ReturnType<typeof setTimeout> | null = null;

export function setSelectionChangeTimer(v: ReturnType<typeof setTimeout> | null) { selectionChangeTimer = v; }
export function setScrollTimer(v: ReturnType<typeof setTimeout> | null) { scrollTimer = v; }

// Autosuggest state
export let autosuggestEnabled = false;
export let autosuggestActiveEditor: HTMLElement | null = null;
export let autosuggestCurrentSuggestion = '';
export let autosuggestOverlayHost: HTMLDivElement | null = null;
export let autosuggestPendingRequest: StreamRequestHandle | null = null;
export let autosuggestDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function setAutosuggestEnabled(v: boolean) { autosuggestEnabled = v; }
export function setAutosuggestActiveEditor(v: HTMLElement | null) { autosuggestActiveEditor = v; }
export function setAutosuggestCurrentSuggestion(v: string) { autosuggestCurrentSuggestion = v; }
export function setAutosuggestOverlayHost(v: HTMLDivElement | null) { autosuggestOverlayHost = v; }
export function setAutosuggestPendingRequest(v: StreamRequestHandle | null) { autosuggestPendingRequest = v; }
export function setAutosuggestDebounceTimer(v: ReturnType<typeof setTimeout> | null) { autosuggestDebounceTimer = v; }

export function resetAutosuggestState() {
  autosuggestEnabled = false;
  autosuggestActiveEditor = null;
  autosuggestCurrentSuggestion = '';
  autosuggestOverlayHost = null;
  autosuggestPendingRequest = null;
  autosuggestDebounceTimer = null;
}
