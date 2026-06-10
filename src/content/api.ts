// api.js — Content script communication with background service worker
// All API calls go through background.js (MV3 cross-origin restriction)

import type {
  AutosuggestDoneHandler,
  AutosuggestErrorHandler,
  AutosuggestStreamPort,
  CaptureScreenshotResponse,
  ChatDoneHandler,
  ChatErrorHandler,
  ChatMessage,
  ChatStreamPort,
  ChatTokenHandler,
  StreamRequestHandle,
} from '../shared/types';
import { CAPTURE_SCREENSHOT_MESSAGE } from '../shared/runtime-messages';

export function requestChat(
  messages: ChatMessage[],
  onToken: ChatTokenHandler,
  onDone: ChatDoneHandler,
  onError: ChatErrorHandler,
): StreamRequestHandle {
  const port = chrome.runtime.connect({ name: 'chat-stream' }) as ChatStreamPort;

  port.postMessage({ type: 'CHAT_REQUEST', messages });

  port.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'token':
        onToken(msg.text);
        break;
      case 'done':
        onDone({ remaining: msg.remaining, usingOwnKey: msg.usingOwnKey });
        port.disconnect();
        break;
      case 'error':
        onError(msg.code, msg.message);
        port.disconnect();
        break;
      case 'rate_limited':
        onError('RATE_LIMITED', 'Daily limit reached', { remaining: msg.remaining, resetAt: msg.resetAt });
        port.disconnect();
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      onError('DISCONNECTED', 'Connection lost');
    }
  });

  return { cancel: () => port.disconnect() };
}

export function requestAutosuggest(
  messages: ChatMessage[],
  onToken: ChatTokenHandler,
  onDone: AutosuggestDoneHandler,
  onError: AutosuggestErrorHandler,
): StreamRequestHandle {
  const port = chrome.runtime.connect({ name: 'autosuggest-stream' }) as AutosuggestStreamPort;

  port.postMessage({ type: 'AUTOSUGGEST_REQUEST', messages });

  port.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'token':
        onToken(msg.text);
        break;
      case 'done':
        onDone();
        port.disconnect();
        break;
      case 'error':
        onError(msg.code, msg.message);
        port.disconnect();
        break;
      case 'rate_limited':
        onError('RATE_LIMITED', 'Autosuggest limit reached');
        port.disconnect();
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      onError('DISCONNECTED', 'Connection lost');
    }
  });

  return { cancel: () => port.disconnect() };
}

export function requestVisibleTabScreenshot(): Promise<CaptureScreenshotResponse> {
  return chrome.runtime.sendMessage(CAPTURE_SCREENSHOT_MESSAGE) as Promise<CaptureScreenshotResponse>;
}
