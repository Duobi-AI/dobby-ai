// @ts-check

// src/background/index.js — Dobby AI API relay + streaming hub
// All API calls from content scripts route through here (MV3 cross-origin constraint)

import { AUTOSUGGEST_MAX_SUGGESTION_TOKENS } from '../shared/autosuggest-limits.js';
import { getLocalStorage, setLocalStorage } from '../shared/storage.js';

/** @typedef {import('../shared/types').AutosuggestBackgroundPort} AutosuggestBackgroundPort */
/** @typedef {import('../shared/types').AutosuggestStreamRequest} AutosuggestStreamRequest */
/** @typedef {import('../shared/types').BackgroundRuntimeMessage} BackgroundRuntimeMessage */
/** @typedef {import('../shared/types').CaptureScreenshotResponse} CaptureScreenshotResponse */
/** @typedef {import('../shared/types').ChatMessage} ChatMessage */
/** @typedef {import('../shared/types').ChatBackgroundPort} ChatBackgroundPort */
/** @typedef {import('../shared/types').ChatStreamRequest} ChatStreamRequest */
/** @typedef {import('../shared/types').ContentRuntimeMessage} ContentRuntimeMessage */
/** @typedef {import('../shared/types').ToggleMessageType} ToggleMessageType */
/** @typedef {import('../shared/types').UsageRequestKind} UsageRequestKind */
/** @typedef {import('../shared/types').UsageState} UsageState */
/** @typedef {import('../shared/types').UsageUpdateDetails} UsageUpdateDetails */
/** @typedef {import('../shared/types').ValidateApiKeyResponse} ValidateApiKeyResponse */

const PROXY_URL = 'https://dobby-ai-proxy.zhongnansu.workers.dev/chat';
const USAGE_STORAGE_KEY = 'dobbyUsage';
// HMAC_SECRET is intentionally in extension source — it's light obfuscation per spec.
// Real defense is IP rate limiting on the proxy.
const HMAC_SECRET = 'dobby-ai-v2-hmac-key-change-in-production';
// Set to your dev token to bypass rate limits during development; leave empty for normal user behavior
const DEV_BYPASS_TOKEN = '';

/** @returns {string} */
function getUtcDay() {
  return new Date().toISOString().split('T')[0];
}

/** @returns {UsageState} */
function createEmptyUsage() {
  return {
    day: getUtcDay(),
    chatRequests: 0,
    autosuggestRequests: 0,
    screenshotRequests: 0,
    freeChatRemaining: null,
    usingOwnKey: false,
    lastUpdated: Date.now(),
  };
}

/**
 * @param {UsageRequestKind} kind
 * @param {UsageUpdateDetails} [details]
 */
async function recordUsage(kind, details = {}) {
  try {
    const stored = await getLocalStorage(USAGE_STORAGE_KEY);
    const current = stored[USAGE_STORAGE_KEY];
    const usage = current && current.day === getUtcDay() ? { ...current } : createEmptyUsage();

    if (!details.rateLimited) {
      if (kind === 'chat') usage.chatRequests = (usage.chatRequests || 0) + 1;
      if (kind === 'autosuggest') usage.autosuggestRequests = (usage.autosuggestRequests || 0) + 1;
      if (kind === 'screenshot') usage.screenshotRequests = (usage.screenshotRequests || 0) + 1;
    }

    if (kind === 'chat' && details.remaining != null && !details.usingOwnKey) {
      usage.freeChatRemaining = details.remaining;
    }
    if (details.remaining === 0 && !details.usingOwnKey) {
      usage.freeChatRemaining = 0;
    }
    if (details.usingOwnKey != null) {
      usage.usingOwnKey = details.usingOwnKey;
    }
    usage.lastUpdated = Date.now();

    await setLocalStorage({ [USAGE_STORAGE_KEY]: usage });
  } catch (e) {
    console.warn('[Dobby AI] Failed to record usage:', e.message);
  }
}

// --- Context Menu ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'dobby-ai',
    title: 'Dobby AI',
    contexts: ['selection', 'image'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'dobby-ai') return;

  // Image context menu click
  if (info.mediaType === 'image' && info.srcUrl) {
    sendContentMessage(tab.id, { type: 'SHOW_BUBBLE', image: info.srcUrl }).catch(() => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Dobby AI',
        message: 'Cannot run on this page. Try a regular webpage.',
      });
    });
    return;
  }

  // Text selection context menu click
  const text = (info.selectionText || '').trim();
  if (!text) return;

  sendContentMessage(tab.id, { type: 'SHOW_BUBBLE', text }).catch(() => {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Dobby AI',
      message: 'Cannot run on this page. Try a regular webpage.',
    });
  });
});

// --- Keyboard Commands ---

/**
 * @param {number | undefined} tabId
 * @param {ContentRuntimeMessage} message
 */
function sendContentMessage(tabId, message) {
  return chrome.tabs.sendMessage(/** @type {number} */ (tabId), message);
}

/** @param {ContentRuntimeMessage} message */
function notifyActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs?.[0]?.id;
    if (!tabId) return;
    sendContentMessage(tabId, message).catch(() => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Dobby AI',
        message: 'Cannot run on this page. Try a regular webpage.',
      });
    });
  });
}

/**
 * @param {'dobbyEnabled' | 'screenshotEnabled'} storageKey
 * @param {ToggleMessageType} messageType
 */
function toggleStoredSetting(storageKey, messageType) {
  getLocalStorage(storageKey, (data) => {
    const current = data[storageKey] !== false;
    const enabled = !current;
    setLocalStorage({ [storageKey]: enabled }, () => {
      notifyActiveTab({ type: messageType, enabled });
    });
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-dobby') {
    toggleStoredSetting('dobbyEnabled', 'DOBBY_TOGGLE');
  }
  if (command === 'toggle-screenshot-mode') {
    toggleStoredSetting('screenshotEnabled', 'SCREENSHOT_TOGGLE');
  }
});

// --- HMAC Signing ---

/**
 * @param {ChatMessage[]} messages
 * @param {number} timestamp
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function generateSignature(messages, timestamp, secret) {
  const payload = `${timestamp}${JSON.stringify(messages)}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- SSE Stream Parsing ---

/**
 * @param {ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>} reader
 * @returns {AsyncGenerator<string>}
 */
export async function* parseSSEStream(reader) {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch (e) {
          console.warn('[Dobby AI] Skipping malformed SSE JSON:', data);
        }
      }
    }
  }
}

// --- Chat Stream Port Handler ---

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'chat-stream') return;

  const chatPort = /** @type {ChatBackgroundPort} */ (port);
  let abortController = null;

  chatPort.onMessage.addListener(async (/** @type {ChatStreamRequest} */ msg) => {
    if (msg.type !== 'CHAT_REQUEST') return;

    abortController = new AbortController();
    const { messages } = msg;

    // 30-second timeout per spec
    const timeout = setTimeout(() => abortController.abort(), 30000);

    try {
      const stored = await getLocalStorage('userApiKey');
      let response;

      if (stored.userApiKey) {
        // Direct to OpenAI with user's own key
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${stored.userApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4.1-mini',
            messages,
            stream: true,
            max_tokens: 1000,
          }),
          signal: abortController.signal,
        });
      } else {
        // Via proxy with HMAC signing
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await generateSignature(messages, timestamp, HMAC_SECRET);
        const headers = { 'Content-Type': 'application/json' };
        if (DEV_BYPASS_TOKEN) headers['X-Dev-Token'] = DEV_BYPASS_TOKEN;
        response = await fetch(PROXY_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages, signature, timestamp }),
          signal: abortController.signal,
        });
      }

      if (response.status === 429) {
        let data;
        try { data = await response.json(); } catch (e) { console.warn('[Dobby AI] Failed to parse rate limit response'); data = { remaining: 0 }; }
        await recordUsage('chat', { remaining: data.remaining ?? 0, usingOwnKey: false, rateLimited: true });
        try { chatPort.postMessage({ type: 'rate_limited', remaining: data.remaining ?? 0, resetAt: data.resetAt }); } catch (e) { console.warn('[Dobby AI] port.postMessage failed:', e.message); }
        return;
      }

      if (!response.ok) {
        let errBody = '';
        try { errBody = await response.text(); } catch (e) { /* ignore */ }
        console.error('[Dobby AI] API error:', response.status, errBody);
        const errMsg = errBody ? `Request failed (${response.status}): ${errBody.substring(0, 200)}` : 'Request failed';
        try { chatPort.postMessage({ type: 'error', code: response.status, message: errMsg }); } catch (e) { console.warn('[Dobby AI] port.postMessage failed:', e.message); }
        return;
      }

      const usingOwnKey = !!stored.userApiKey;
      const remaining = usingOwnKey ? null : parseInt(response.headers.get('X-RateLimit-Remaining')) || 0;

      const reader = response.body.getReader();
      for await (const token of parseSSEStream(reader)) {
        try { chatPort.postMessage({ type: 'token', text: token }); } catch (e) { console.warn('[Dobby AI] port.postMessage failed:', e.message); break; }
      }
      await recordUsage('chat', { remaining, usingOwnKey });
      try { chatPort.postMessage({ type: 'done', remaining, usingOwnKey }); } catch (e) { console.warn('[Dobby AI] port.postMessage failed:', e.message); }
    } catch (err) {
      if (err.name === 'AbortError') {
        try { chatPort.postMessage({ type: 'error', code: 0, message: 'Request timed out' }); } catch (e) { console.warn('[Dobby AI] port.postMessage failed:', e.message); }
      } else {
        try { chatPort.postMessage({ type: 'error', code: 0, message: err.message }); } catch (e) { console.warn('[Dobby AI] port.postMessage failed:', e.message); }
      }
    } finally {
      clearTimeout(timeout);
    }
  });

  port.onDisconnect.addListener(() => {
    abortController?.abort();
  });
});

// --- Autosuggest Stream Port Handler ---

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'autosuggest-stream') return;

  const autosuggestPort = /** @type {AutosuggestBackgroundPort} */ (port);
  let abortController = null;

  autosuggestPort.onMessage.addListener(async (/** @type {AutosuggestStreamRequest} */ msg) => {
    if (msg.type !== 'AUTOSUGGEST_REQUEST') return;

    abortController = new AbortController();
    const { messages } = msg;

    // Shorter timeout for autosuggest (10s vs 30s for chat)
    const timeout = setTimeout(() => abortController.abort(), 10000);

    try {
      const stored = await getLocalStorage('userApiKey');
      let response;

      if (stored.userApiKey) {
        // Direct to OpenAI with user's own key
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${stored.userApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4.1-mini',
            messages,
            stream: true,
            max_tokens: AUTOSUGGEST_MAX_SUGGESTION_TOKENS,
          }),
          signal: abortController.signal,
        });
      } else {
        // Via proxy with HMAC signing — include purpose for rate limiting
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await generateSignature(messages, timestamp, HMAC_SECRET);
        const headers = { 'Content-Type': 'application/json' };
        if (DEV_BYPASS_TOKEN) headers['X-Dev-Token'] = DEV_BYPASS_TOKEN;
        response = await fetch(PROXY_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages, signature, timestamp, purpose: 'autosuggest' }),
          signal: abortController.signal,
        });
      }

      if (response.status === 429) {
        let data;
        try { data = await response.json(); } catch (e) { data = { remaining: 0 }; }
        await recordUsage('autosuggest', { usingOwnKey: false, rateLimited: true });
        try { autosuggestPort.postMessage({ type: 'rate_limited', remaining: data.remaining ?? 0 }); } catch (e) { /* port closed */ }
        return;
      }

      if (!response.ok) {
        let errBody = '';
        try { errBody = await response.text(); } catch (e) { /* ignore */ }
        console.error('[Dobby AI] Autosuggest API error:', response.status, errBody);
        try { autosuggestPort.postMessage({ type: 'error', code: response.status, message: 'Autosuggest request failed: ' + errBody.substring(0, 200) }); } catch (e) { /* port closed */ }
        return;
      }

      const reader = response.body.getReader();
      for await (const token of parseSSEStream(reader)) {
        try { autosuggestPort.postMessage({ type: 'token', text: token }); } catch (e) { break; }
      }
      await recordUsage('autosuggest', { usingOwnKey: !!stored.userApiKey });
      try { autosuggestPort.postMessage({ type: 'done' }); } catch (e) { /* port closed */ }
    } catch (err) {
      if (err.name !== 'AbortError') {
        try { autosuggestPort.postMessage({ type: 'error', code: 0, message: err.message }); } catch (e) { /* port closed */ }
      }
    } finally {
      clearTimeout(timeout);
    }
  });

  port.onDisconnect.addListener(() => {
    abortController?.abort();
  });
});

// --- API Key Validation ---

chrome.runtime.onMessage.addListener((
  /** @type {BackgroundRuntimeMessage} */ msg,
  sender,
  /** @type {(response: CaptureScreenshotResponse | ValidateApiKeyResponse) => void} */ sendResponse,
) => {
  if (msg.type === 'CAPTURE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ error: 'Screenshot failed' });
      } else {
        recordUsage('screenshot');
        sendResponse({ dataUrl });
      }
    });
    return true; // async sendResponse
  }
  if (msg.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (msg.type === 'VALIDATE_API_KEY') {
    fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${msg.apiKey}`,
      },
    })
      .then((res) => {
        if (res.ok) {
          setLocalStorage({ userApiKey: msg.apiKey });
          sendResponse({ valid: true });
        } else {
          sendResponse({ valid: false, error: 'Invalid API key' });
        }
      })
      .catch(() => {
        sendResponse({ valid: false, error: 'Network error' });
      });
    return true; // async sendResponse
  }
});
