// src/content/index.js — Content script entry point
// Imports establish module initialization order

import {
  autosuggestEnabled,
  dobbyEnabled,
  setDobbyEnabled,
  setAutosuggestEnabled,
  setScreenshotEnabled,
} from './shared/state.js';
import { initAutosuggest, destroyAutosuggest } from './autosuggest/index.js';
import { registerListeners, disableTriggerModes } from './trigger/selection.js';
import { showBubbleWithPresets, showBubble, showHistoryBubble, hideBubble, getBubbleContainer, isBubblePinned, cancelPendingBubbleOpenings, createBubbleOpeningGuard } from './bubble/core.js';
import { buildChatMessages } from './prompt.js';
import { gatherCurrentTabContext } from './page-context.js';
import { captureImage } from './image-capture.js';
import { isClickInsideUI } from './shared/dom-utils.js';
import { loadUsageData } from './shared/preset-usage.js';
import { getLocalStorage } from '../shared/storage.js';
import type { ContentRuntimeMessage, ImageContentPart } from '../shared/types';

function syncAutosuggestAvailability(): void {
  if (dobbyEnabled && autosuggestEnabled) {
    initAutosuggest();
  } else {
    destroyAutosuggest();
  }
}

// Load preset usage data for reordering
loadUsageData();

// Load related feature preferences together so auto-suggest cannot briefly start
// before the master setting is known.
getLocalStorage(['dobbyEnabled', 'screenshotEnabled', 'autosuggestEnabled'], (data) => {
  setDobbyEnabled(data.dobbyEnabled !== false);
  setScreenshotEnabled(data.screenshotEnabled !== false); // default: enabled
  setAutosuggestEnabled(data.autosuggestEnabled === true);
  syncAutosuggestAvailability();
});

chrome.runtime.onMessage.addListener((msg: ContentRuntimeMessage) => {
  if (msg.type === 'DOBBY_TOGGLE') {
    setDobbyEnabled(msg.enabled);
    if (!msg.enabled) {
      cancelPendingBubbleOpenings();
      disableTriggerModes();
      hideBubble();
    }
    syncAutosuggestAvailability();
  }
});

chrome.runtime.onMessage.addListener((msg: ContentRuntimeMessage) => {
  if (msg.type === 'SCREENSHOT_TOGGLE') {
    setScreenshotEnabled(msg.enabled);
  }
});

chrome.runtime.onMessage.addListener((msg: ContentRuntimeMessage) => {
  if (msg.type === 'AUTOSUGGEST_TOGGLE') {
    setAutosuggestEnabled(msg.enabled);
    syncAutosuggestAvailability();
  }
});

// Context menu and popup action message handler
chrome.runtime.onMessage.addListener((msg: ContentRuntimeMessage) => {
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
    if (!dobbyEnabled) return;

    const rect = {
      top: window.innerHeight / 3 - 8,
      bottom: window.innerHeight / 3,
      left: window.innerWidth / 4,
      right: window.innerWidth * 3 / 4,
    };

    if (msg.image) {
      const isOpeningAllowed = createBubbleOpeningGuard();
      (async () => {
        let images: ImageContentPart[] = [];
        const captured = await captureImage(msg.image);
        if (!isOpeningAllowed()) return;
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
    const text = msg.text as string;
    const pageContext = gatherCurrentTabContext({ selectedText: text });
    const messages = buildChatMessages(text, instruction, true, undefined, pageContext);
    (async () => { await showBubble(rect, messages, text, instruction); })();
  }
});

// Dismiss bubble on click outside
setTimeout(() => {
  document.addEventListener('mousedown', (e) => {
    const bubble = getBubbleContainer();
    if (bubble && !bubble.contains(e.target as Node | null)) {
      if (isClickInsideUI(e.target, getBubbleContainer)) return;
      if (isBubblePinned()) return;
      hideBubble();
    }
  });
}, 100);

// Register selection and long-press listeners
registerListeners();
