// src/content/bubble/core.js — Main bubble orchestration
import {
  bubbleHost, setBubbleHost,
  currentMessages, setCurrentMessages,
  responseText, appendResponseText, setResponseText,
  currentRequest, setCurrentRequest,
  renderTimer, setRenderTimer,
  clearRawResponses,
} from '../shared/state.js';
import { Z_INDEX, TIMING } from '../shared/constants.js';
import { removeElement, stopShadowRootKeyboardEventPropagation } from '../shared/dom-utils.js';
import { detectTheme, watchThemeChanges } from '../../shared/theme.js';
import { getStyles } from './styles.js';
import { renderMarkdown, escapeHtml } from './markdown.js';
import { startStreaming, handleFollowUp } from './stream.js';
import { showHistoryPanel } from './history.js';
import { detectContentType } from '../detection.js';
import { getSuggestedPresetsForType } from '../presets.js';
import { buildChatMessages } from '../prompt.js';
import { recordPresetUsage, buildTypeKey } from '../shared/preset-usage.js';
import { BRAND_MARK_DATA_URI, BRAND_NAME } from '../../shared/brand.js';

export { detectTheme };

function truncatePreview(text, maxLen = 120) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

function createBubbleHost(selectionRect) {
  const host = document.createElement('div');
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
  host._escHandler = (e) => { if (e.key === 'Escape') hideBubble(); };
  document.addEventListener('keydown', host._escHandler);

  host._themeCleanup = watchThemeChanges((theme) => {
    if (!host.shadowRoot) return;
    const styleEl = host.shadowRoot.querySelector('style');
    if (styleEl) styleEl.textContent = getStyles(theme);
  });

  setBubbleHost(host);
  return host;
}

function buildBubbleHTML(previewText, previewLabel, showPresets, images) {
  const hasPreview = previewText || (images && images.length > 0);
  let previewHtml = '';
  if (hasPreview) {
    let imgHtml = '';
    if (images && images.length > 0) {
      imgHtml = '<div class="image-preview">' +
        images.map(img => {
          const url = img.image_url ? img.image_url.url : '';
          return `<img src="${escapeHtml(url)}" alt="Preview" onerror="this.style.display='none'">`;
        }).join('') + '</div>';
    }
    previewHtml = `<div class="selected-text-preview">
      <div class="label">${escapeHtml(previewLabel || (images && images.length > 0 ? 'Image' : 'Selected text'))}</div>
      ${imgHtml}
      ${previewText ? `<div class="text">${escapeHtml(previewText)}</div>` : ''}
    </div>`;
  }
  return `
    <div class="bubble-header">
      <span class="bubble-logo">
        <img class="bubble-logo-mark" src="${BRAND_MARK_DATA_URI}" alt="" aria-hidden="true">
        <span>${BRAND_NAME}</span>
      </span>
      <span class="bubble-status"></span>
      <button class="pin-btn" title="Pin">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 17v5"/><path d="M9 11V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7"/><path d="M5 15h14l-1.5-4H6.5L5 15z"/>
        </svg>
      </button>
      <button class="close-btn" title="Close">\u2715</button>
    </div>
    ${previewHtml}
    ${showPresets ? '<div class="presets-section"></div>' : ''}
    <div class="response-section">
      <div class="bubble-body">
        <div class="response-text"></div>
        <span class="cursor blink"></span>
      </div>
      <div class="bubble-footer">
        <input class="follow-up-input" placeholder="Ask a follow-up..." disabled />
        <button class="action-btn history-btn" title="History">\ud83d\udd50</button>
      </div>
    </div>
    <div class="resize-handle" title="Drag to resize">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="8" y1="4" x2="4" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="10" y1="8" x2="8" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </div>
  `;
}

function wireCommonEvents(shadow) {
  shadow.querySelector('.close-btn').addEventListener('click', hideBubble);
  const pinBtn = shadow.querySelector('.pin-btn');
  const header = shadow.querySelector('.bubble-header');

  const updateDraggable = () => {
    header.classList.toggle('draggable', bubbleHost._isPinned);
  };

  if (pinBtn) {
    pinBtn.addEventListener('click', () => {
      bubbleHost._isPinned = !bubbleHost._isPinned;
      pinBtn.classList.toggle('pinned', bubbleHost._isPinned);
      pinBtn.title = bubbleHost._isPinned ? 'Unpin' : 'Pin';
      updateDraggable();
    });
  }

  // Drag-by-header when pinned
  header.addEventListener('mousedown', (e) => {
    if (!bubbleHost._isPinned) return;
    // Don't drag when clicking buttons inside header
    if (e.target.closest && e.target.closest('.pin-btn, .close-btn')) return;

    e.preventDefault();
    header.classList.add('dragging');

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(bubbleHost.style.left) || 0;
    const startTop = parseInt(bubbleHost.style.top) || 0;

    const onMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      const newLeft = startLeft + moveEvent.clientX - startX;
      const newTop = startTop + moveEvent.clientY - startY;
      bubbleHost.style.left = newLeft + 'px';
      bubbleHost.style.top = newTop + 'px';
    };

    const onMouseUp = () => {
      header.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Store cleanup for hideBubble
    bubbleHost._dragCleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  });
  shadow.querySelector('.history-btn').addEventListener('click', () => {
    showHistoryPanel(shadow);
  });
  shadow.querySelector('.follow-up-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const question = e.target.value.trim();
      e.target.value = '';
      handleFollowUp(shadow, question);
    }
  });
  // Image lightbox via event delegation
  shadow.querySelector('.bubble-body').addEventListener('click', (e) => {
    if (e.target.classList.contains('response-img')) {
      const overlay = document.createElement('div');
      overlay.className = 'img-lightbox';
      overlay.tabIndex = 0;
      const img = document.createElement('img');
      img.src = e.target.src;
      img.alt = e.target.alt;
      overlay.appendChild(img);
      const dismiss = () => overlay.remove();
      overlay.addEventListener('click', dismiss);
      overlay.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { ev.stopPropagation(); dismiss(); }
      });
      shadow.appendChild(overlay);
      overlay.focus();
    }
  });
  // Resize handle
  const resizeHandle = shadow.querySelector('.resize-handle');
  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const bubble = shadow.querySelector('.bubble');
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = bubble.getBoundingClientRect().width;
      const startHeight = bubble.getBoundingClientRect().height;

      const onMouseMove = (moveEvent) => {
        moveEvent.preventDefault();
        const newWidth = Math.min(
          Math.max(300, startWidth + moveEvent.clientX - startX),
          window.innerWidth * 0.8
        );
        const newHeight = Math.min(
          Math.max(200, startHeight + moveEvent.clientY - startY),
          window.innerHeight * 0.8
        );
        bubble.style.width = newWidth + 'px';
        bubble.style.height = newHeight + 'px';
        bubble.style.maxHeight = 'none';
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      // Store cleanup reference for hideBubble
      bubbleHost._resizeCleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    });
  }
}

function activateResponseSection(shadow, messages) {
  const presetsSection = shadow.querySelector('.presets-section');
  if (presetsSection) presetsSection.classList.add('collapsed');
  const responseSection = shadow.querySelector('.response-section');
  responseSection.classList.add('active');
  shadow.querySelector('.bubble-status').textContent = 'thinking...';
  startStreaming(shadow, messages);
}

async function initBubble(selectionRect, selectedText, previewLabel, showPresets, images) {
  hideBubble();
  setResponseText('');

  createBubbleHost(selectionRect);
  bubbleHost._isPinned = false;
  const shadow = bubbleHost.attachShadow({ mode: 'open' });
  stopShadowRootKeyboardEventPropagation(shadow);
  shadow.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideBubble();
  });

  const style = document.createElement('style');
  style.textContent = getStyles(await detectTheme());
  shadow.appendChild(style);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = buildBubbleHTML(truncatePreview(selectedText), previewLabel, showPresets, images);
  shadow.appendChild(bubble);

  wireCommonEvents(shadow);
  document.body.appendChild(bubbleHost);
  return shadow;
}

function launchFromPreset(shadow, selectedText, instruction, images) {
  const messages = buildChatMessages(selectedText, instruction, true, images);
  setCurrentMessages(messages);

  // Update preview label to show chosen instruction
  const label = shadow.querySelector('.selected-text-preview .label');
  if (label) label.textContent = instruction;

  activateResponseSection(shadow, messages);
}

// Show bubble with preset selection first, then expand to show response
export async function showBubbleWithPresets(selectionRect, selectedText, anchorNode, images) {
  const hasImages = images && images.length > 0;
  const isImageOnly = hasImages && !selectedText.trim();
  const previewLabel = isImageOnly ? 'Image' : 'Selected text';
  const shadow = await initBubble(selectionRect, selectedText, previewLabel, true, images);

  // Detect content type and populate presets
  let detected;
  if (isImageOnly) {
    detected = { type: 'image', subType: null, confidence: 'high' };
  } else {
    detected = detectContentType(selectedText, anchorNode);
  }

  const presets = getSuggestedPresetsForType(detected.type, detected.subType);

  const presetsSection = shadow.querySelector('.presets-section');

  // Detection badge
  if (detected.type !== 'default') {
    const badge = document.createElement('div');
    badge.className = 'detection-badge';
    badge.textContent = isImageOnly ? 'image' : `${detected.subType || detected.type} detected`;
    presetsSection.appendChild(badge);
  }

  // Preset chips
  const chipsRow = document.createElement('div');
  chipsRow.className = 'preset-chips';
  presets.slice(0, 4).forEach((preset) => {
    const chip = document.createElement('div');
    chip.className = 'preset-chip';
    chip.textContent = preset.label;
    chip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      recordPresetUsage(buildTypeKey(detected.type, detected.subType), preset.label);
      launchFromPreset(shadow, selectedText, preset.instruction, images);
    });
    chipsRow.appendChild(chip);
  });
  presetsSection.appendChild(chipsRow);

  // Custom input
  const customInput = document.createElement('input');
  customInput.className = 'preset-input';
  customInput.placeholder = isImageOnly ? 'Or ask something about this image...' : 'Or type a custom prompt...';
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && customInput.value.trim()) {
      launchFromPreset(shadow, selectedText, customInput.value.trim(), images);
    }
    if (e.key === 'Escape') hideBubble();
  });
  presetsSection.appendChild(customInput);
}

// Direct bubble (used by context menu — no preset selection needed)
export async function showBubble(selectionRect, messages, selectedText, instruction, images) {
  setCurrentMessages(messages);
  const shadow = await initBubble(selectionRect, selectedText, instruction || 'Selected text', false, images);
  activateResponseSection(shadow, messages);
}

export async function showHistoryBubble(selectionRect) {
  const shadow = await initBubble(selectionRect, '', 'History', false, null);
  const responseSection = shadow.querySelector('.response-section');
  if (responseSection) responseSection.classList.add('active');
  const status = shadow.querySelector('.bubble-status');
  if (status) status.textContent = 'history';
  await showHistoryPanel(shadow);
}

export function hideBubble() {
  if (renderTimer) { clearTimeout(renderTimer); setRenderTimer(null); }
  if (currentRequest) {
    currentRequest.cancel();
    setCurrentRequest(null);
  }
  if (bubbleHost) {
    if (bubbleHost._dragCleanup) {
      bubbleHost._dragCleanup();
    }
    if (bubbleHost._resizeCleanup) {
      bubbleHost._resizeCleanup();
    }
    if (bubbleHost._escHandler) document.removeEventListener('keydown', bubbleHost._escHandler);
    if (bubbleHost._themeCleanup) {
      bubbleHost._themeCleanup();
    }
    removeElement(bubbleHost);
  }
  setBubbleHost(null);
  setCurrentMessages([]);
  setResponseText('');
  clearRawResponses();
}

export function appendToken(text) {
  if (!bubbleHost) return;
  const shadow = bubbleHost.shadowRoot;
  const responseEl = shadow.querySelector('.response-text');
  appendResponseText(text);
  // Write into the latest .message-ai div to preserve previous messages
  let aiMsg = responseEl.querySelector('.message-ai:last-child');
  if (!aiMsg) {
    aiMsg = document.createElement('div');
    aiMsg.className = 'message-ai';
    responseEl.appendChild(aiMsg);
  }
  aiMsg.innerHTML = renderMarkdown(responseText);
}

export function setBubbleStatus(status) {
  if (!bubbleHost) return;
  const el = bubbleHost.shadowRoot.querySelector('.bubble-status');
  if (el) el.textContent = status;
}

export function getBubbleContainer() {
  return bubbleHost;
}
