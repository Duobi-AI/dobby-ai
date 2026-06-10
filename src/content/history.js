// @ts-check

/** @typedef {import('../shared/types').HistoryEntry} HistoryEntry */
/** @typedef {import('../shared/types').HistoryEntryDraft} HistoryEntryDraft */

// history.js — Chat history storage (chrome.storage.local)

export const MAX_HISTORY = 100;
const MAX_RESPONSE_LENGTH = 2000;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Save a completed conversation to history.
 * @param {HistoryEntryDraft} entry
 * @returns {Promise<void>}
 */
export function saveConversation(entry) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['chatHistory'], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[Dobby AI] Failed to read history:', chrome.runtime.lastError.message);
        resolve();
        return;
      }
      const history = /** @type {HistoryEntry[]} */ (result.chatHistory || []);

      // Errata #12: null safety for missing response
      const resp = entry.response || '';
      const newEntry = {
        id: generateId(),
        text: entry.text,
        instruction: entry.instruction,
        response: resp.length > MAX_RESPONSE_LENGTH
          ? resp.substring(0, MAX_RESPONSE_LENGTH)
          : resp,
        pageUrl: entry.pageUrl,
        pageTitle: entry.pageTitle,
        timestamp: Date.now(),
      };

      history.unshift(newEntry);

      // FIFO eviction
      if (history.length > MAX_HISTORY) {
        history.length = MAX_HISTORY;
      }

      chrome.storage.local.set({ chatHistory: history }, resolve);
    });
  });
}

/**
 * Get all history entries, most recent first.
 * @returns {Promise<HistoryEntry[]>}
 */
export function getHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['chatHistory'], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[Dobby AI] Failed to read history:', chrome.runtime.lastError.message);
        resolve([]);
        return;
      }
      resolve(/** @type {HistoryEntry[]} */ (result.chatHistory || []));
    });
  });
}

/**
 * Clear all history.
 * @returns {Promise<void>}
 */
export function clearHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ chatHistory: [] }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Dobby AI] Failed to clear history:', chrome.runtime.lastError.message);
      }
      resolve();
    });
  });
}
