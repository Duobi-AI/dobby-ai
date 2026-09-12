// src/background/index.js — Dobby AI API relay + streaming hub
// All API calls from content scripts route through here (MV3 cross-origin constraint)

import { getLocalStorage, setLocalStorage } from '../shared/storage.js';
import {
  recordUsage,
  responseStreamExecutor,
  type ResponseStreamEvent,
  type ResponseStreamHandle,
} from './model-stream.js';

import type {
  AutosuggestBackgroundPort,
  AutosuggestStreamRequest,
  BackgroundRuntimeMessage,
  CaptureScreenshotResponse,
  ChatBackgroundPort,
  ChatStreamRequest,
  ContentRuntimeMessage,
  ToggleMessageType,
  ValidateApiKeyResponse,
} from '../shared/types';

export { generateSignature, parseSSEStream } from './model-stream.js';

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

  if (info.mediaType === 'image' && info.srcUrl) {
    sendContentMessage(tab!.id, { type: 'SHOW_BUBBLE', image: info.srcUrl }).catch(() => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Dobby AI',
        message: 'Cannot run on this page. Try a regular webpage.',
      });
    });
    return;
  }

  const text = (info.selectionText || '').trim();
  if (!text) return;

  sendContentMessage(tab!.id, { type: 'SHOW_BUBBLE', text }).catch(() => {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Dobby AI',
      message: 'Cannot run on this page. Try a regular webpage.',
    });
  });
});

// --- Keyboard Commands ---

function sendContentMessage(tabId: number | undefined, message: ContentRuntimeMessage): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId as number, message);
}

function notifyActiveTab(message: ContentRuntimeMessage): void {
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

function toggleStoredSetting(
  storageKey: 'dobbyEnabled' | 'screenshotEnabled',
  messageType: ToggleMessageType,
): void {
  getLocalStorage(storageKey, (data) => {
    const current = data[storageKey] !== false;
    const enabled = !current;
    setLocalStorage({ [storageKey]: enabled }, () => {
      notifyActiveTab({ type: messageType, enabled });
    });
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-dobby') toggleStoredSetting('dobbyEnabled', 'DOBBY_TOGGLE');
  if (command === 'toggle-screenshot-mode') toggleStoredSetting('screenshotEnabled', 'SCREENSHOT_TOGGLE');
});

// --- Model stream adapters ---

function postChatEvent(port: ChatBackgroundPort, event: ResponseStreamEvent): void {
  try {
    switch (event.type) {
      case 'token': port.postMessage(event); break;
      case 'done': port.postMessage(event); break;
      case 'rate_limited': port.postMessage(event); break;
      case 'error': port.postMessage(event); break;
    }
  } catch (e) {
    console.warn('[Dobby AI] port.postMessage failed:', (e as Error).message);
  }
}

function postAutosuggestEvent(port: AutosuggestBackgroundPort, event: ResponseStreamEvent): void {
  try {
    switch (event.type) {
      case 'token': port.postMessage(event); break;
      case 'done': port.postMessage({ type: 'done' }); break;
      case 'rate_limited': port.postMessage({ type: 'rate_limited', remaining: event.remaining, retryAfter: event.retryAfter }); break;
      case 'error': port.postMessage(event); break;
    }
  } catch {
    // The content script may disconnect while an Autosuggestion is in flight.
  }
}

function registerChatStreamAdapter(port: chrome.runtime.Port): void {
  const chatPort = port as ChatBackgroundPort;
  let activeRequest: ResponseStreamHandle | null = null;
  chatPort.onMessage.addListener(async (msg: ChatStreamRequest) => {
    if (msg.type !== 'CHAT_REQUEST') return;
    activeRequest = responseStreamExecutor.execute({
      kind: 'chat',
      messages: msg.messages,
      onEvent: (event) => postChatEvent(chatPort, event),
    });
    await activeRequest.completion;
  });
  port.onDisconnect.addListener(() => activeRequest?.cancel());
}

function registerAutosuggestStreamAdapter(port: chrome.runtime.Port): void {
  const autosuggestPort = port as AutosuggestBackgroundPort;
  let activeRequest: ResponseStreamHandle | null = null;
  autosuggestPort.onMessage.addListener(async (msg: AutosuggestStreamRequest) => {
    if (msg.type !== 'AUTOSUGGEST_REQUEST') return;
    activeRequest = responseStreamExecutor.execute({
      kind: 'autosuggest',
      messages: msg.messages,
      onEvent: (event) => postAutosuggestEvent(autosuggestPort, event),
    });
    await activeRequest.completion;
  });
  port.onDisconnect.addListener(() => activeRequest?.cancel());
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'chat-stream') registerChatStreamAdapter(port);
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'autosuggest-stream') registerAutosuggestStreamAdapter(port);
});

// --- API Key Validation ---

chrome.runtime.onMessage.addListener((
  msg: BackgroundRuntimeMessage,
  sender,
  sendResponse: (response: CaptureScreenshotResponse | ValidateApiKeyResponse) => void,
) => {
  if (msg.type === 'CAPTURE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab(null as unknown as number, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ error: 'Screenshot failed' });
      } else {
        recordUsage('screenshot');
        sendResponse({ dataUrl });
      }
    });
    return true;
  }
  if (msg.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (msg.type === 'VALIDATE_API_KEY') {
    fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${msg.apiKey}` },
    })
      .then((res) => {
        if (res.ok) {
          setLocalStorage({ userApiKey: msg.apiKey });
          sendResponse({ valid: true });
        } else {
          sendResponse({ valid: false, error: 'Invalid API key' });
        }
      })
      .catch(() => sendResponse({ valid: false, error: 'Network error' }));
    return true;
  }
});
