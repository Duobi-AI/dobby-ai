import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { HistoryEntry } from '../../shared/types';

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
};

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
};

let state = initialState;
let nextMessageId = 1;
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

export function getBubbleViewState(): BubbleViewState {
  return state;
}

export function subscribeBubbleView(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBubbleViewState(): BubbleViewState {
  return useSyncExternalStore(subscribeBubbleView, getBubbleViewState, getBubbleViewState);
}

export function resetBubbleView(): void {
  state = initialState;
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
  update({
    bodyMode: 'history',
    historyEntries: entries,
    historyMessage,
  });
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
