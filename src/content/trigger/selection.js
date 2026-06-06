// src/content/trigger/selection.js — Event listeners and selection helpers

import {
  triggerButton,
  dobbyEnabled,
  setDobbyEnabled,
  screenshotEnabled,
  longPressState,
  screenshotState,
  selectionChangeTimer,
  setSelectionChangeTimer,
  scrollTimer,
  setScrollTimer,
  setTriggerButton,
} from '../shared/state.js';
import { isClickInsideUI, getSelectedText, getSelectionRect, removeElement } from '../shared/dom-utils.js';
import { getBubbleContainer } from '../bubble/core.js';
import { TIMING } from '../shared/constants.js';
import { showTrigger, hideTrigger, createTriggerButton } from './button.js';
import { startScreenshotMode, cancelScreenshotMode } from './screenshot.js';
import { _showProgressRing, _removeProgressRing } from './progress-ring.js';

const INTERACTIVE_TAGS = new Set([
  'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'VIDEO', 'AUDIO', 'LABEL', 'OPTION',
]);

// Applies the most recent drag rect to the DOM, then clears the pending rAF flag
// so the next mousemove can schedule a fresh frame. Coordinates are read from
// screenshotState.pendingRect (the latest move), keeping the final rect exact.
function _applyPendingDragRect() {
  screenshotState.rafId = null;
  const pending = screenshotState.pendingRect;
  if (!pending || !screenshotState.rect) return;
  Object.assign(screenshotState.rect.style, {
    left: pending.x + 'px',
    top: pending.y + 'px',
    width: pending.w + 'px',
    height: pending.h + 'px',
  });
}

export function isInteractiveElement(el) {
  if (!el || !el.tagName) return false;
  if (INTERACTIVE_TAGS.has(el.tagName)) return true;
  if (el.isContentEditable) return true;
  if (el.closest && el.closest('button, a, select, label, [role="button"], [role="slider"], [role="scrollbar"]')) return true;
  return false;
}

export function isScrollbarClick(e) {
  // Page-level scrollbars
  if (e.clientX >= document.documentElement.clientWidth ||
    e.clientY >= document.documentElement.clientHeight) return true;
  // Element-level scrollbars (e.g. scrollable divs)
  const el = e.target;
  if (el && el.getBoundingClientRect) {
    const rect = el.getBoundingClientRect();
    const clickOffsetX = e.clientX - rect.left;
    const clickOffsetY = e.clientY - rect.top;
    if (el.scrollHeight > el.clientHeight && clickOffsetX > el.clientWidth) return true;
    if (el.scrollWidth > el.clientWidth && clickOffsetY > el.clientHeight) return true;
  }
  return false;
}

export function registerListeners() {
  // Listen for text selection
  document.addEventListener('mouseup', (e) => {
    if (isClickInsideUI(e.target, getBubbleContainer)) return;

    const cursorX = e.clientX;
    const cursorY = e.clientY;
    setTimeout(() => {
      const text = getSelectedText();

      if (text.length >= 3 && dobbyEnabled) {
        const sel = window.getSelection();
        const anchorNode = sel.anchorNode || null;
        showTrigger(cursorX, cursorY, { text, anchorNode, selection: sel }).catch(() => {});
      } else {
        hideTrigger();
      }
    }, TIMING.MOUSEUP_DELAY);
  });

  // Fallback: selectionchange fires even when sites (Gmail, etc.) capture mouseup
  document.addEventListener('selectionchange', () => {
    clearTimeout(selectionChangeTimer);
    setSelectionChangeTimer(setTimeout(() => {
      const text = getSelectedText();
      const selection = window.getSelection();
      if (text.length >= 3 && dobbyEnabled && selection.rangeCount > 0) {
        // Only show if trigger isn't already visible
        if (!triggerButton || triggerButton.style.display === 'none') {
          const anchorNode = selection.anchorNode || null;
          const rect = getSelectionRect();
          showTrigger(rect.right, rect.bottom, { text, anchorNode, selection }).catch(() => {});
        }
      }
    }, TIMING.SELECTION_DEBOUNCE));
  });

  // Hide trigger on scroll, re-show after scroll stops
  window.addEventListener('scroll', () => {
    hideTrigger();
    clearTimeout(scrollTimer);
    setScrollTimer(setTimeout(() => {
      const text = getSelectedText();
      const selection = window.getSelection();
      if (text.length >= 3 && dobbyEnabled && selection.rangeCount > 0) {
        const anchorNode = selection.anchorNode || null;
        const rect = getSelectionRect();
        showTrigger(rect.right, rect.top, { text, anchorNode, selection }).catch(() => {});
      }
    }, TIMING.SCROLL_DEBOUNCE));
  }, true);

  // Hide on click away
  document.addEventListener('mousedown', (e) => {
    if (isClickInsideUI(e.target, getBubbleContainer)) return;
    hideTrigger();
  });

  // Long-press mousedown handler
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // left click only
    if (isInteractiveElement(e.target)) return;
    if (isScrollbarClick(e)) return;
    if (isClickInsideUI(e.target, getBubbleContainer)) return;
    if (screenshotState.overlay) return;

    if (!dobbyEnabled || !screenshotEnabled) return;

    longPressState.startX = e.clientX;
    longPressState.startY = e.clientY;

    longPressState.ringTimer = setTimeout(() => {
      longPressState.ringTimer = null;
      _showProgressRing(e.clientX, e.clientY);
    }, TIMING.PROGRESS_RING_DELAY);

    longPressState.timer = setTimeout(() => {
      startScreenshotMode();
    }, TIMING.LONG_PRESS_DURATION);
  });

  // Long-press mousemove handler (cancel on movement)
  document.addEventListener('mousemove', (e) => {
    if (longPressState.timer) {
      const dx = Math.abs(e.clientX - longPressState.startX);
      const dy = Math.abs(e.clientY - longPressState.startY);
      if (dx > TIMING.MOVEMENT_THRESHOLD || dy > TIMING.MOVEMENT_THRESHOLD) {
        clearTimeout(longPressState.timer);
        longPressState.timer = null;
        if (longPressState.ringTimer) { clearTimeout(longPressState.ringTimer); longPressState.ringTimer = null; }
        _removeProgressRing();
      }
    }

    // Screenshot region drag — coalesce DOM updates to at most one per animation frame
    if (screenshotState.overlay && screenshotState.rect && screenshotState.dragStarted) {
      // Store the latest pointer-derived rect; the scheduled rAF applies the freshest value.
      screenshotState.pendingRect = {
        x: Math.min(screenshotState.startX, e.clientX),
        y: Math.min(screenshotState.startY, e.clientY),
        w: Math.abs(e.clientX - screenshotState.startX),
        h: Math.abs(e.clientY - screenshotState.startY),
      };
      if (screenshotState.rafId === null) {
        screenshotState.rafId = requestAnimationFrame(_applyPendingDragRect);
      }
    }
  });

  // Long-press mouseup handler (cancel timer on early release)
  document.addEventListener('mouseup', (e) => {
    if (longPressState.timer) {
      clearTimeout(longPressState.timer);
      longPressState.timer = null;
      if (longPressState.ringTimer) { clearTimeout(longPressState.ringTimer); longPressState.ringTimer = null; }
      _removeProgressRing();
    }
  }, true);

}

export function _resetTriggerForTesting() {
  removeElement(triggerButton);
  setTriggerButton(null);
  setDobbyEnabled(true);
  if (longPressState.timer) { clearTimeout(longPressState.timer); longPressState.timer = null; }
  if (longPressState.ringTimer) { clearTimeout(longPressState.ringTimer); longPressState.ringTimer = null; }
  longPressState.startX = 0;
  longPressState.startY = 0;
  _removeProgressRing();
  cancelScreenshotMode();
}

export function _setDobbyEnabled(val) { setDobbyEnabled(val); }
