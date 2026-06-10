// @ts-check

// src/content/index.js — Content script entry point
// Imports establish module initialization order

import { setDobbyEnabled, setAutosuggestEnabled, setScreenshotEnabled } from './shared/state.js';
import { initAutosuggest, destroyAutosuggest } from './autosuggest/index.js';
import { registerListeners } from './trigger/selection.js';
import { hideTrigger } from './trigger/button.js';
import { showBubbleWithPresets, showBubble, showHistoryBubble, hideBubble, getBubbleContainer } from './bubble/core.js';
import { buildChatMessages } from './prompt.js';
import { captureImage } from './image-capture.js';
import { isClickInsideUI } from './shared/dom-utils.js';
import { loadUsageData } from './shared/preset-usage.js';
import { getLocalStorage } from '../shared/storage.js';

/** @typedef {import('../shared/types').ContentRuntimeMessage} ContentRuntimeMessage */

// Load initial enabled state
getLocalStorage('dobbyEnabled', (data) => {
  setDobbyEnabled(data.dobbyEnabled !== false);
});

// Load preset usage data for reordering
loadUsageData();

// Load screenshot mode state
getLocalStorage('screenshotEnabled', (data) => {
  setScreenshotEnabled(data.screenshotEnabled !== false); // default: enabled
});

// Load autosuggest state
getLocalStorage('autosuggestEnabled', (data) => {
  const enabled = data.autosuggestEnabled === true;
  setAutosuggestEnabled(enabled);
  if (enabled) initAutosuggest();
});

chrome.runtime.onMessage.addListener((/** @type {ContentRuntimeMessage} */ msg) => {
  if (msg.type === 'DOBBY_TOGGLE') {
    setDobbyEnabled(msg.enabled);
    if (!msg.enabled) hideTrigger();
  }
});

chrome.runtime.onMessage.addListener((/** @type {ContentRuntimeMessage} */ msg) => {
  if (msg.type === 'SCREENSHOT_TOGGLE') {
    setScreenshotEnabled(msg.enabled);
  }
});

chrome.runtime.onMessage.addListener((/** @type {ContentRuntimeMessage} */ msg) => {
  if (msg.type === 'AUTOSUGGEST_TOGGLE') {
    setAutosuggestEnabled(msg.enabled);
    if (msg.enabled) {
      initAutosuggest();
    } else {
      destroyAutosuggest();
    }
  }
});

// Context menu and popup action message handler
chrome.runtime.onMessage.addListener((/** @type {ContentRuntimeMessage} */ msg) => {
  if (msg.type === 'SHOW_HISTORY') {
    const rect = {
      top: window.innerHeight / 3 - 8,
      bottom: window.innerHeight / 3,
      left: window.innerWidth / 4,
      right: window.innerWidth * 3 / 4,
    };
    (async () => { await showHistoryBubble(rect); })();
    return;
  }

  if (msg.type === 'SHOW_BUBBLE') {
    const rect = {
      top: window.innerHeight / 3 - 8,
      bottom: window.innerHeight / 3,
      left: window.innerWidth / 4,
      right: window.innerWidth * 3 / 4,
    };

    if (msg.image) {
      (async () => {
        let images = [];
        const captured = await captureImage(msg.image);
        if (captured) images = [captured];
        if (images.length > 0) {
          await showBubbleWithPresets(rect, '', null, images);
        } else {
          await showBubble(rect, [{ role: 'user', content: "Couldn't capture this image" }], '', 'Error');
        }
      })();
      return;
    }

    const instruction = 'Explain the following';
    const messages = buildChatMessages(msg.text, instruction, true);
    (async () => { await showBubble(rect, messages, msg.text, instruction); })();
  }
});

// Dismiss bubble on click outside
setTimeout(() => {
  document.addEventListener('mousedown', (e) => {
    const bubble = getBubbleContainer();
    if (bubble && !bubble.contains(e.target)) {
      if (isClickInsideUI(e.target, getBubbleContainer)) return;
      if (bubble._isPinned) return;
      hideBubble();
    }
  });
}, 100);

// Register selection and long-press listeners
registerListeners();
