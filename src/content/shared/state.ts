// src/content/shared/state.js — Central mutable state for content scripts
import type {
  BubbleHost,
  ChatMessage,
  LongPressState,
  ScreenshotState,
  StreamRequestHandle,
  ToolbarHost,
  ToolbarState,
} from '../../shared/types';

// Bubble state
export let bubbleHost: BubbleHost | null = null;
export let currentMessages: ChatMessage[] = [];
export let responseText = '';
export let currentRequest: StreamRequestHandle | null = null;
export let renderTimer: ReturnType<typeof setTimeout> | null = null;

export function setBubbleHost(v: BubbleHost | null) { bubbleHost = v; }
export function setCurrentMessages(v: ChatMessage[]) { currentMessages = v; }
export function setResponseText(v: string) { responseText = v; }
export function appendResponseText(v: string) { responseText += v; }
export function setCurrentRequest(v: StreamRequestHandle | null) { currentRequest = v; }
export function setRenderTimer(v: ReturnType<typeof setTimeout> | null) { renderTimer = v; }

// Raw AI response tracking (for copy button)
export let rawResponses: string[] = [];
export function pushRawResponse(text: string) { rawResponses.push(text); return rawResponses.length - 1; }
export function clearRawResponses() { rawResponses.length = 0; }

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
export let autosuggestActiveTextarea: HTMLTextAreaElement | null = null;
export let autosuggestCurrentSuggestion = '';
export let autosuggestOverlayHost: HTMLDivElement | null = null;
export let autosuggestPendingRequest: StreamRequestHandle | null = null;
export let autosuggestDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function setAutosuggestEnabled(v: boolean) { autosuggestEnabled = v; }
export function setAutosuggestActiveTextarea(v: HTMLTextAreaElement | null) { autosuggestActiveTextarea = v; }
export function setAutosuggestCurrentSuggestion(v: string) { autosuggestCurrentSuggestion = v; }
export function setAutosuggestOverlayHost(v: HTMLDivElement | null) { autosuggestOverlayHost = v; }
export function setAutosuggestPendingRequest(v: StreamRequestHandle | null) { autosuggestPendingRequest = v; }
export function setAutosuggestDebounceTimer(v: ReturnType<typeof setTimeout> | null) { autosuggestDebounceTimer = v; }

export function resetAutosuggestState() {
  autosuggestEnabled = false;
  autosuggestActiveTextarea = null;
  autosuggestCurrentSuggestion = '';
  autosuggestOverlayHost = null;
  autosuggestPendingRequest = null;
  autosuggestDebounceTimer = null;
}
