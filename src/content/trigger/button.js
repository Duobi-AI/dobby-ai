// src/content/trigger/button.js — Toolbar creation, expand/collapse, morph-to-chat
// Evolves the original trigger button into a three-state toolbar:
//   collapsed (icon only) → expanded (hover, preset buttons) → morphed (inline chat)

import { getToolbarStyles } from './styles.js';
import { detectTheme, showBubble } from '../bubble/core.js';
import { buildChatMessages } from '../prompt.js';
import { Z_INDEX, TIMING } from '../shared/constants.js';
import {
  setToolbarHost, setToolbarState, toolbarState,
  triggerButton, setTriggerButton,
} from '../shared/state.js';
import { detectContentType } from '../detection.js';
import { getSuggestedPresetsForType } from '../presets.js';
import { captureImage } from '../image-capture.js';
import { recordPresetUsage, buildTypeKey } from '../shared/preset-usage.js';

// --- Cockapoo icon SVG ---
const cockapooSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="30" r="22" fill="#C4956A"/>
  <circle cx="14" cy="22" r="8" fill="#B8845A"/>
  <circle cx="50" cy="22" r="8" fill="#B8845A"/>
  <circle cx="20" cy="12" r="7" fill="#D4A574"/>
  <circle cx="44" cy="12" r="7" fill="#D4A574"/>
  <circle cx="32" cy="10" r="7" fill="#C4956A"/>
  <circle cx="26" cy="8" r="5" fill="#BF8F60"/>
  <circle cx="38" cy="8" r="5" fill="#BF8F60"/>
  <ellipse cx="10" cy="34" rx="7" ry="12" fill="#A07048" transform="rotate(-10 10 34)"/>
  <ellipse cx="54" cy="34" rx="7" ry="12" fill="#A07048" transform="rotate(10 54 34)"/>
  <ellipse cx="32" cy="34" rx="14" ry="11" fill="#E8C9A0"/>
  <circle cx="24" cy="28" r="3.5" fill="#2D1B0E"/>
  <circle cx="40" cy="28" r="3.5" fill="#2D1B0E"/>
  <circle cx="25.2" cy="27" r="1.2" fill="white"/>
  <circle cx="41.2" cy="27" r="1.2" fill="white"/>
  <ellipse cx="32" cy="35" rx="4" ry="3" fill="#2D1B0E"/>
  <ellipse cx="32" cy="34.5" rx="1.5" ry="0.8" fill="#5A3A1E" opacity="0.4"/>
  <path d="M28 38 Q32 42 36 38" fill="none" stroke="#2D1B0E" stroke-width="1.2" stroke-linecap="round"/>
  <ellipse cx="32" cy="41" rx="2.5" ry="3" fill="#E87B7B"/>
</svg>`;

const iconDataUri = 'data:image/svg+xml,' + encodeURIComponent(cockapooSvg);

const pencilSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
const closeSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const sendSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
const SELECTION_IMAGE_WAIT_MS = 1000;

// --- Auto-hide timer ---
let autoHideTimer = null;

function startAutoHide(host) {
  clearAutoHide();
  autoHideTimer = setTimeout(() => {
    hideTrigger();
  }, TIMING.TOOLBAR_AUTO_HIDE);
}

function clearAutoHide() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

// --- Active stream handle (isolated from shared state) ---

// --- Toolbar creation ---

async function createToolbar() {
  const host = document.createElement('div');
  host.id = 'dobby-ai-toolbar-host';
  Object.assign(host.style, {
    position: 'fixed',
    zIndex: String(Z_INDEX.TRIGGER),
    display: 'none',
    lineHeight: '0',
  });

  const shadow = host.attachShadow({ mode: 'open', delegatesFocus: true });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = getToolbarStyles(await detectTheme());
  shadow.appendChild(style);

  // Build toolbar DOM
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  // --- Row: icon + expandable actions + morph header ---
  const row = document.createElement('div');
  row.className = 'toolbar-row';

  // Icon
  const iconDiv = document.createElement('div');
  iconDiv.className = 'toolbar-icon';
  const img = document.createElement('img');
  img.src = iconDataUri;
  img.alt = 'Dobby AI';
  iconDiv.appendChild(img);
  row.appendChild(iconDiv);

  // Expandable section (preset actions)
  const expandSection = document.createElement('div');
  expandSection.className = 'toolbar-expand';

  const sep1 = document.createElement('div');
  sep1.className = 'toolbar-sep';
  expandSection.appendChild(sep1);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'toolbar-actions';
  expandSection.appendChild(actionsDiv);

  const sep2 = document.createElement('div');
  sep2.className = 'toolbar-sep';
  expandSection.appendChild(sep2);

  // Pencil / close toggle button
  const pencilBtn = document.createElement('button');
  pencilBtn.className = 'toolbar-pencil';
  pencilBtn.innerHTML = pencilSvg;
  pencilBtn.title = 'Custom prompt';
  expandSection.appendChild(pencilBtn);

  // Input mode section (hidden by default, overlays expand section)
  const inputSection = document.createElement('div');
  inputSection.className = 'toolbar-input-section';

  const inputField = document.createElement('input');
  inputField.className = 'toolbar-input-field';
  inputField.type = 'text';
  inputField.placeholder = 'Ask about this...';
  inputSection.appendChild(inputField);

  const sendBtn = document.createElement('button');
  sendBtn.className = 'toolbar-send disabled';
  sendBtn.innerHTML = sendSvg;
  sendBtn.title = 'Send';
  inputSection.appendChild(sendBtn);

  row.appendChild(expandSection);
  row.appendChild(inputSection);
  toolbar.appendChild(row);

  shadow.appendChild(toolbar);

  // Live-update theme when storage changes
  host._storageChangeHandler = (changes) => {
    if (!changes.theme) return;
    const raw = changes.theme.newValue || 'auto';
    const theme = (raw === 'light' || raw === 'dark') ? raw
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    style.textContent = getToolbarStyles(theme);
  };
  chrome.storage.onChanged.addListener(host._storageChangeHandler);

  // --- Event handlers ---
  toolbar.addEventListener('mouseenter', () => {
    clearAutoHide();
    if (toolbarState === 'collapsed') {
      expandToolbar(host, shadow);
    }
  });

  toolbar.addEventListener('mouseleave', () => {
    if (toolbarState === 'expanded') {
      collapseToolbar(shadow);
      startAutoHide(host);
    }
    // If 'input' or 'morphed', do not collapse
  });

  // --- Input mode handlers ---
  pencilBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (toolbarState === 'input') {
      exitInputMode(shadow, pencilBtn, inputField, sendBtn, host);
    } else {
      enterInputMode(shadow, pencilBtn, inputField, sendBtn, host);
    }
  });

  inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = inputField.value.trim();
      if (text) {
        const detectedType = host._detectedType || 'default';
        const detectedSubType = host._detectedSubType || null;
        recordPresetUsage(buildTypeKey(detectedType, detectedSubType), 'Custom');
        morphIntoBubble(host, shadow, 'Custom', text);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      exitInputMode(shadow, pencilBtn, inputField, sendBtn, host);
    }
  });

  sendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const text = inputField.value.trim();
    if (text) {
      const detectedType = host._detectedType || 'default';
      const detectedSubType = host._detectedSubType || null;
      recordPresetUsage(buildTypeKey(detectedType, detectedSubType), 'Custom');
      morphIntoBubble(host, shadow, 'Custom', text);
    }
  });

  inputField.addEventListener('input', () => {
    if (inputField.value.trim()) {
      sendBtn.classList.remove('disabled');
    } else {
      sendBtn.classList.add('disabled');
    }
  });

  document.body.appendChild(host);
  setToolbarHost(host);
  // Also set triggerButton for backwards compat with selection.js hide logic
  setTriggerButton(host);

  return host;
}

// --- Expand / Collapse ---

function expandToolbar(host, shadow) {
  const toolbar = shadow.querySelector('.toolbar');
  const actionsDiv = shadow.querySelector('.toolbar-actions');

  // Lazily detect content type
  const text = host._selectedText || '';
  const anchorNode = host._anchorNode || null;
  const detected = detectContentType(text, anchorNode);
  let presets = getSuggestedPresetsForType(detected.type, detected.subType);

  // Store detected info for input mode
  host._detectedType = detected.type;
  host._detectedSubType = detected.subType;

  // Fallback if 0 presets
  if (!presets || presets.length === 0) {
    presets = [
      { label: 'Summarize', instruction: 'Summarize the following' },
      { label: 'Explain', instruction: 'Explain the following in simple terms' },
    ];
  }

  // Clear old actions
  actionsDiv.innerHTML = '';

  // Show first 2 presets
  const shownPresets = presets.slice(0, 2);
  shownPresets.forEach((preset) => {
    const btn = document.createElement('button');
    btn.className = 'toolbar-action';
    btn.textContent = preset.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      recordPresetUsage(buildTypeKey(detected.type, detected.subType), preset.label);
      morphIntoBubble(host, shadow, preset.label, preset.instruction);
    });
    actionsDiv.appendChild(btn);
  });

  // Measure natural width and set CSS variable
  toolbar.style.width = 'auto';
  toolbar.classList.add('expanded');
  const naturalWidth = toolbar.scrollWidth;
  toolbar.style.width = '';
  toolbar.style.setProperty('--toolbar-expanded-width', Math.max(naturalWidth + 8, 180) + 'px');
  // Re-add expanded class (was set above but width was auto)
  setToolbarState('expanded');
}

function collapseToolbar(shadow) {
  const toolbar = shadow.querySelector('.toolbar');
  toolbar.classList.remove('expanded');
  setToolbarState('collapsed');
}

// --- Morph into chat ---

function normalizeImages(images) {
  return Array.isArray(images) && images.length > 0 ? images : null;
}

function cloneSelectionForImageExtraction(selection) {
  try {
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!range) return null;
    const clonedRange = typeof range.cloneRange === 'function' ? range.cloneRange() : range;
    return {
      rangeCount: 1,
      getRangeAt: () => clonedRange,
    };
  } catch (err) {
    console.warn('[Dobby AI] Could not preserve selection for image extraction:', err.message);
    return null;
  }
}

function startSelectionImageExtraction(host, selectionRequestId) {
  if (host._images || host._imagesPromise || !host._selectionForImages) {
    return host._imagesPromise;
  }

  host._imagesPromise = extractImagesFromSelection(host._selectionForImages)
    .then((images) => {
      const normalized = normalizeImages(images);
      if (host._selectionRequestId === selectionRequestId) {
        host._images = normalized;
      }
      return normalized;
    })
    .catch((err) => {
      console.warn('[Dobby AI] Selection image extraction failed:', err.message);
      return null;
    });

  return host._imagesPromise;
}

function resolveSelectionImages(host, selectionRequestId, onResolved) {
  const finish = (images) => {
    if (!host.isConnected || host._selectionRequestId !== selectionRequestId) return;
    onResolved(normalizeImages(images));
  };

  const imagesPromise = startSelectionImageExtraction(host, selectionRequestId);

  if (imagesPromise) {
    let settled = false;
    let timeoutId = null;
    const finishOnce = (images) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      finish(images);
    };

    timeoutId = setTimeout(() => finishOnce(host._images), SELECTION_IMAGE_WAIT_MS);
    imagesPromise.then(finishOnce).catch(() => finishOnce(null));
  } else {
    finish(host._images);
  }
}

function morphIntoBubble(host, shadow, label, instruction) {
  if (host._isMorphing) return;
  host._isMorphing = true;

  const toolbar = shadow.querySelector('.toolbar');
  const selectionRequestId = host._selectionRequestId;

  clearAutoHide();
  removeSelectionHighlight();

  resolveSelectionImages(host, selectionRequestId, (images) => {
    // Get toolbar position — bubble will appear growing from here
    const hostRect = host.getBoundingClientRect();

    // Pass a rect that positions the bubble at the toolbar's origin.
    // createBubbleHost places bubble at selectionRect.bottom + 8,
    // so we set bottom = toolbar.top - 8 so the bubble top = toolbar.top.
    const selectionRect = {
      top: hostRect.top - 16,
      right: hostRect.right,
      bottom: hostRect.top - 8,
      left: hostRect.left,
      width: hostRect.width,
      height: hostRect.height,
    };

    // Build messages
    const text = host._selectedText || '';
    const messages = buildChatMessages(text, instruction, true, images);

    // Crossfade: start bubble creation and toolbar fade simultaneously.
    // showBubble is async (theme read) but the fade timer is independent of that.
    showBubble(selectionRect, messages, text, instruction, images)
      .catch((err) => console.error('[Dobby AI] Bubble creation failed:', err));

    // Fade out toolbar smoothly over the same duration as bubble entry animation
    toolbar.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
    toolbar.style.opacity = '0';
    toolbar.style.transform = 'scale(0.9)';

    // Remove toolbar after fade completes
    setTimeout(() => hideTrigger(), 220);
  });
}

// --- Selection highlight overlay ---
// When input mode is active, the browser clears the page's text selection highlight
// because focus moves to the shadow DOM input. These overlays preserve the visual highlight.

let selectionHighlights = [];

function showSelectionHighlight() {
  removeSelectionHighlight();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  for (const rect of rects) {
    if (rect.width === 0 || rect.height === 0) continue;
    const div = document.createElement('div');
    div.className = 'dobby-selection-highlight';
    Object.assign(div.style, {
      position: 'fixed',
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      background: 'rgba(124, 58, 237, 0.13)',
      pointerEvents: 'none',
      zIndex: '2147483646',
      borderRadius: '2px',
    });
    document.body.appendChild(div);
    selectionHighlights.push(div);
  }
}

function removeSelectionHighlight() {
  selectionHighlights.forEach(el => el.remove());
  selectionHighlights = [];
}

// --- Input mode ---

let outsideClickHandler = null;

function enterInputMode(shadow, pencilBtn, inputField, sendBtn, host) {
  clearAutoHide();

  // Show highlight overlay before focus steals the visual selection
  showSelectionHighlight();

  const expandSection = shadow.querySelector('.toolbar-expand');
  const actionsDiv = shadow.querySelector('.toolbar-actions');
  const inputSection = shadow.querySelector('.toolbar-input-section');
  const seps = expandSection.querySelectorAll('.toolbar-sep');

  actionsDiv.style.opacity = '0';
  actionsDiv.style.pointerEvents = 'none';
  seps.forEach(s => { s.style.opacity = '0'; });

  pencilBtn.innerHTML = closeSvg;
  pencilBtn.classList.add('close-mode');
  pencilBtn.title = 'Cancel';

  inputSection.classList.add('visible');

  inputField.value = '';
  sendBtn.classList.add('disabled');
  setTimeout(() => inputField.focus(), 50);

  setToolbarState('input');

  outsideClickHandler = (e) => {
    if (!host.contains(e.target) && !host.shadowRoot.contains(e.target)) {
      exitInputMode(shadow, pencilBtn, inputField, sendBtn, host);
    }
  };
  setTimeout(() => {
    document.addEventListener('mousedown', outsideClickHandler, true);
  }, 0);
}

function exitInputMode(shadow, pencilBtn, inputField, sendBtn, host) {
  removeSelectionHighlight();

  const expandSection = shadow.querySelector('.toolbar-expand');
  const actionsDiv = shadow.querySelector('.toolbar-actions');
  const inputSection = shadow.querySelector('.toolbar-input-section');
  const seps = expandSection.querySelectorAll('.toolbar-sep');

  inputSection.classList.remove('visible');

  actionsDiv.style.opacity = '';
  actionsDiv.style.pointerEvents = '';
  seps.forEach(s => { s.style.opacity = ''; });

  pencilBtn.innerHTML = pencilSvg;
  pencilBtn.classList.remove('close-mode');
  pencilBtn.title = 'Custom prompt';

  inputField.value = '';
  sendBtn.classList.add('disabled');

  setToolbarState('expanded');

  startAutoHide(host);

  if (outsideClickHandler) {
    document.removeEventListener('mousedown', outsideClickHandler, true);
    outsideClickHandler = null;
  }
}

// --- Public API ---

let toolbarCreating = null;

export async function showTrigger(x, y, selectionData = {}) {
  let host = document.getElementById('dobby-ai-toolbar-host');
  if (!host) {
    if (!toolbarCreating) {
      toolbarCreating = createToolbar();
    }
    host = await toolbarCreating;
    toolbarCreating = null;
  }

  // Store selection data on host
  const selectionRequestId = (host._selectionRequestId || 0) + 1;
  host._selectionRequestId = selectionRequestId;
  host._isMorphing = false;
  host._selectedText = selectionData.text || '';
  host._anchorNode = selectionData.anchorNode || null;
  host._images = normalizeImages(selectionData.images);
  host._imagesPromise = null;
  host._selectionForImages = host._images ? null : cloneSelectionForImageExtraction(selectionData.selection);

  // Position
  host.style.display = 'block';
  const hostWidth = 36;
  const hostHeight = 36;
  const maxLeft = window.innerWidth - hostWidth - 8;
  const maxTop = window.innerHeight - hostHeight - 8;
  host.style.left = `${Math.min(Math.max(8, x + 12), maxLeft)}px`;
  host.style.top = `${Math.min(Math.max(4, y + 10), maxTop)}px`;

  // Start auto-hide
  startAutoHide(host);
}

export function hideTrigger() {
  clearAutoHide();
  removeSelectionHighlight();
  if (typeof document === 'undefined') return;
  if (outsideClickHandler) {
    document.removeEventListener('mousedown', outsideClickHandler, true);
    outsideClickHandler = null;
  }
  const host = document.getElementById('dobby-ai-toolbar-host');
  if (host) {
    if (host._storageChangeHandler) {
      chrome.storage.onChanged.removeListener(host._storageChangeHandler);
    }
    host.remove();
  }
  setToolbarHost(null);
  setTriggerButton(null);
  setToolbarState('collapsed');
}

// --- Legacy compatibility: createTriggerButton maps to showTrigger ---
export async function createTriggerButton() {
  // For backwards compat: create toolbar in hidden state
  let host = document.getElementById('dobby-ai-toolbar-host');
  if (!host) {
    host = await createToolbar();
  }
}

// --- Image extraction from text selection (preserved from original) ---

export async function extractImagesFromSelection(selection, maxImages = 2) {
  const images = [];
  if (!selection || !selection.rangeCount) return images;

  const range = selection.getRangeAt(0);
  if (!range?.commonAncestorContainer || typeof range.intersectsNode !== 'function') {
    return images;
  }

  const container = range.commonAncestorContainer;
  const imgElements = container.nodeType === Node.ELEMENT_NODE
    ? container.querySelectorAll('img')
    : (container.parentElement ? container.parentElement.querySelectorAll('img') : []);

  for (const imgEl of imgElements) {
    if (images.length >= maxImages) break;
    if (!range.intersectsNode(imgEl)) continue;
    if (!imgEl.src) continue;

    if (typeof captureImage === 'function') {
      const captured = await captureImage(imgEl);
      if (captured) images.push(captured);
    }
  }
  return images;
}
