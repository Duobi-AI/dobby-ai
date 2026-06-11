// src/content/bubble/history.js — History panel UI
import { setCurrentMessages, setResponseText } from '../shared/state.js';
import { getHistory, clearHistory } from '../history.js';
import { showHistoryView, showRestoredHistoryResponse } from './view-model.js';
import type { ChatMessage, HistoryEntry } from '../../shared/types';

export async function showHistoryPanel(shadow: ShadowRoot): Promise<void> {
  const entries = await getHistory();
  showHistoryView(entries);
}

export function restoreHistoryEntry(entry: HistoryEntry): void {
  const msgs: ChatMessage[] = [];
  if (entry.instruction) msgs.push({ role: 'system', content: entry.instruction });
  if (entry.text) msgs.push({ role: 'user', content: entry.text });
  if (entry.response) msgs.push({ role: 'assistant', content: entry.response });
  setCurrentMessages(msgs);
  setResponseText(entry.response || '');
  showRestoredHistoryResponse(entry.response || '');
}

export async function clearHistoryPanel(): Promise<void> {
  await clearHistory();
  showHistoryView([], 'History cleared');
}
