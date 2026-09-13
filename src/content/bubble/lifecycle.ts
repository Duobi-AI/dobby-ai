// Deep lifecycle module for the Chat response bubble.
// React sees snapshots and invokes actions; mutable request, host, and geometry state stays here.

import { useSyncExternalStore, type MouseEvent as ReactMouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { Z_INDEX } from '../shared/constants.js';
import { removeElement } from '../shared/dom-utils.js';
import { watchThemeChanges } from '../../shared/theme.js';
import { getStyles } from './styles.js';
import { removeSelectionHighlight } from '../trigger/selection-highlight.js';
import type {
  BubbleHost,
  ChatMessage,
  Cleanup,
  HistoryEntry,
  SelectionRect,
  StreamRequestHandle,
} from '../../shared/types';

export type BubbleViewMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  responseIdx?: number;
  errorMessage?: string;
  onRetry?: () => void;
};

export type BubbleBodyMode = 'conversation' | 'history' | 'rate-limit';

export type BubbleViewState = {
  status: string;
  previewLabel: string | null;
  responseActive: boolean;
  presetsCollapsed: boolean;
  messages: BubbleViewMessage[];
  restoredResponse: string | null;
  cursorVisible: boolean;
  followUpDisabled: boolean;
  bodyMode: BubbleBodyMode;
  historyEntries: HistoryEntry[];
  historyMessage: string | null;
  pinned: boolean;
};

export type BubbleLifecycleSnapshot = Readonly<{
  status: string;
  previewLabel: string | null;
  responseActive: boolean;
  presetsCollapsed: boolean;
  messages: readonly BubbleViewMessage[];
  restoredResponse: string | null;
  cursorVisible: boolean;
  followUpDisabled: boolean;
  bodyMode: BubbleBodyMode;
  historyEntries: readonly HistoryEntry[];
  historyMessage: string | null;
  pinned: boolean;
}>;

const initialState: BubbleViewState = {
  status: '',
  previewLabel: null,
  responseActive: false,
  presetsCollapsed: false,
  messages: [],
  restoredResponse: null,
  cursorVisible: true,
  followUpDisabled: true,
  bodyMode: 'conversation',
  historyEntries: [],
  historyMessage: null,
  pinned: false,
};

let state = initialState;
let nextMessageId = 1;
let bubbleHost: BubbleHost | null = null;
let currentMessages: ChatMessage[] = [];
let responseText = '';
let currentRequest: StreamRequestHandle | null = null;
let renderTimer: ReturnType<typeof setTimeout> | null = null;
let rawResponses: string[] = [];
let reactCleanup: Cleanup | null = null;
let themeCleanup: Cleanup | null = null;
let dragCleanup: Cleanup | null = null;
let resizeCleanup: Cleanup | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  flushSync(() => {
    listeners.forEach((listener) => listener());
  });
}

function update(patch: Partial<BubbleViewState>): void {
  state = { ...state, ...patch };
  emit();
}

function updateMessage(id: number, patch: Partial<BubbleViewMessage>): void {
  update({
    messages: state.messages.map((message) => (
      message.id === id ? { ...message, ...patch } : message
    )),
  });
}

export function getBubbleLifecycleState(): BubbleLifecycleSnapshot {
  return state;
}

export function getBubbleViewState(): BubbleLifecycleSnapshot {
  return getBubbleLifecycleState();
}

export function subscribeBubbleLifecycle(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBubbleLifecycleState(): BubbleLifecycleSnapshot {
  return useSyncExternalStore(
    subscribeBubbleLifecycle,
    getBubbleLifecycleState,
    getBubbleLifecycleState,
  );
}

// Compatibility name for non-React callers and existing tests.
export function subscribeBubbleView(listener: () => void): () => void {
  return subscribeBubbleLifecycle(listener);
}

export function useBubbleViewState(): BubbleLifecycleSnapshot {
  return useBubbleLifecycleState();
}

export function resetBubbleView(): void {
  state = { ...initialState };
  nextMessageId = 1;
  emit();
}

export function activateBubbleResponse(): void {
  update({
    responseActive: true,
    presetsCollapsed: true,
    bodyMode: 'conversation',
    status: 'thinking...',
  });
}

export function setBubbleViewStatus(status: string): void {
  update({ status });
}

export function setBubblePreviewLabel(previewLabel: string): void {
  update({ previewLabel });
}

export function startAssistantResponse(): number {
  const id = nextMessageId++;
  update({
    bodyMode: 'conversation',
    restoredResponse: null,
    messages: [...state.messages, { id, role: 'assistant', content: '' }],
    status: 'thinking...',
    cursorVisible: true,
    followUpDisabled: true,
  });
  return id;
}

export function setAssistantResponse(id: number, content: string): void {
  updateMessage(id, { content });
}

export function completeAssistantResponse(id: number, content: string, responseIdx?: number): void {
  updateMessage(id, { content, responseIdx, errorMessage: undefined, onRetry: undefined });
  update({ cursorVisible: false, followUpDisabled: false });
}

export function failAssistantResponse(id: number, message: string, onRetry: () => void): void {
  updateMessage(id, { errorMessage: message, onRetry });
  update({ cursorVisible: false, status: '' });
}

export function removeBubbleMessage(id: number): void {
  update({ messages: state.messages.filter((message) => message.id !== id) });
}

export function addUserResponse(content: string): void {
  const restoredMessages = state.restoredResponse
    ? [{ id: nextMessageId++, role: 'assistant' as const, content: state.restoredResponse }]
    : state.messages;
  const id = nextMessageId++;
  update({
    bodyMode: 'conversation',
    restoredResponse: null,
    messages: [...restoredMessages, { id, role: 'user', content }],
  });
}

export function showRateLimitView(): void {
  update({ bodyMode: 'rate-limit', cursorVisible: false });
}

export function showHistoryView(entries: HistoryEntry[], historyMessage: string | null = null): void {
  update({ bodyMode: 'history', historyEntries: entries, historyMessage });
}

export function showRestoredHistoryResponse(response: string): void {
  update({
    bodyMode: 'conversation',
    responseActive: true,
    presetsCollapsed: true,
    restoredResponse: response,
    messages: [],
    cursorVisible: false,
    followUpDisabled: false,
  });
}

export function getCurrentMessages(): ChatMessage[] {
  return currentMessages;
}

export function setCurrentMessages(messages: ChatMessage[]): void {
  currentMessages = messages;
}

export function getResponseText(): string {
  return responseText;
}

export function setResponseText(text: string): void {
  responseText = text;
}

export function appendResponseText(text: string): void {
  responseText += text;
}

export function getCurrentRequest(): StreamRequestHandle | null {
  return currentRequest;
}

export function setCurrentRequest(request: StreamRequestHandle | null): void {
  currentRequest = request;
}

export function getRenderTimer(): ReturnType<typeof setTimeout> | null {
  return renderTimer;
}

export function setRenderTimer(timer: ReturnType<typeof setTimeout> | null): void {
  renderTimer = timer;
}

export function pushRawResponse(text: string): number {
  rawResponses.push(text);
  return rawResponses.length - 1;
}

export function getRawResponse(index: number): string | undefined {
  return rawResponses[index];
}

export function getRawResponses(): readonly string[] {
  return rawResponses;
}

export function clearRawResponses(): void {
  rawResponses = [];
}

function clearDocumentInteractionListeners(): void {
  dragCleanup?.();
  resizeCleanup?.();
  dragCleanup = null;
  resizeCleanup = null;
}

export function openBubbleHost(selectionRect: SelectionRect): BubbleHost {
  // Replacing a bubble during selection flow must not clear its highlight.
  closeBubble(true);

  const host = document.createElement('div') as BubbleHost;
  host.id = 'dobby-ai-bubble';
  const bubbleHeight = 420;
  const gap = 8;
  const preferredTop = selectionRect.bottom + gap;
  const wouldOverflow = preferredTop + bubbleHeight > window.innerHeight;
  const top = wouldOverflow
    ? Math.max(gap, (selectionRect.top || selectionRect.bottom) - bubbleHeight - gap)
    : preferredTop;
  Object.assign(host.style, {
    position: 'fixed',
    zIndex: String(Z_INDEX.BUBBLE),
    left: `${Math.max(8, (selectionRect.left + selectionRect.right) / 2 - 190)}px`,
    top: `${top}px`,
  });

  host._isPinned = false;
  host._escHandler = (event) => {
    if (event.key === 'Escape') closeBubble();
  };
  document.addEventListener('keydown', host._escHandler);

  themeCleanup = watchThemeChanges((theme) => {
    if (!host.shadowRoot) return;
    const styleEl = host.shadowRoot.querySelector('style');
    if (styleEl) styleEl.textContent = getStyles(theme);
  });
  host._themeCleanup = themeCleanup;
  bubbleHost = host;
  update({ pinned: false });
  return host;
}

export function setBubbleReactCleanup(cleanup: Cleanup | null): void {
  reactCleanup = cleanup;
  if (bubbleHost) bubbleHost._reactCleanup = cleanup || undefined;
}

export function getBubbleHost(): BubbleHost | null {
  return bubbleHost;
}

export function isBubblePinned(): boolean {
  return state.pinned;
}

export function toggleBubblePin(): void {
  const pinned = !state.pinned;
  if (bubbleHost) bubbleHost._isPinned = pinned;
  update({ pinned });
}

export function beginBubbleDrag(event: ReactMouseEvent<HTMLDivElement>): void {
  const host = bubbleHost;
  const header = event.currentTarget as HTMLElement | null;
  if (!host || !header || !state.pinned) return;
  if ((event.target as Element).closest?.('.pin-btn, .close-btn')) return;

  event.preventDefault();
  header.classList.add('dragging');
  const startX = event.clientX;
  const startY = event.clientY;
  const startLeft = parseInt(host.style.left, 10) || 0;
  const startTop = parseInt(host.style.top, 10) || 0;

  const onMouseMove = (moveEvent: MouseEvent) => {
    moveEvent.preventDefault();
    host.style.left = `${startLeft + moveEvent.clientX - startX}px`;
    host.style.top = `${startTop + moveEvent.clientY - startY}px`;
  };
  const onMouseUp = () => {
    header.classList.remove('dragging');
    dragCleanup = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  clearDocumentInteractionListeners();
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  dragCleanup = () => {
    header.classList.remove('dragging');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}

export function beginBubbleResize(event: ReactMouseEvent<HTMLDivElement>): void {
  const handle = event.currentTarget as HTMLElement | null;
  const bubble = handle?.closest<HTMLElement>('.bubble');
  if (!handle || !bubble) return;

  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = bubble.getBoundingClientRect().width;
  const startHeight = bubble.getBoundingClientRect().height;

  const onMouseMove = (moveEvent: MouseEvent) => {
    moveEvent.preventDefault();
    const newWidth = Math.min(Math.max(300, startWidth + moveEvent.clientX - startX), window.innerWidth * 0.8);
    const newHeight = Math.min(Math.max(200, startHeight + moveEvent.clientY - startY), window.innerHeight * 0.8);
    bubble.style.width = `${newWidth}px`;
    bubble.style.height = `${newHeight}px`;
    bubble.style.maxHeight = 'none';
  };
  const onMouseUp = () => {
    resizeCleanup = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  clearDocumentInteractionListeners();
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  resizeCleanup = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}

export function closeBubble(preserveSelectionHighlight = false): void {
  if (!preserveSelectionHighlight) removeSelectionHighlight();
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = null;
  currentRequest?.cancel();
  currentRequest = null;
  clearDocumentInteractionListeners();

  if (bubbleHost) {
    if (bubbleHost._escHandler) document.removeEventListener('keydown', bubbleHost._escHandler);
    themeCleanup?.();
    themeCleanup = null;
    reactCleanup?.();
    reactCleanup = null;
    removeElement(bubbleHost);
  }
  bubbleHost = null;
  currentMessages = [];
  responseText = '';
  rawResponses = [];
  resetBubbleView();
}
