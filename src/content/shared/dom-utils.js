// src/content/shared/dom-utils.js — Shared DOM utility functions

export function removeElement(el) {
  if (el?.parentNode) el.parentNode.removeChild(el);
}

export function stopShadowRootKeyboardEventPropagation(shadowRoot) {
  for (const eventType of ['keydown', 'keypress', 'keyup']) {
    shadowRoot.addEventListener(eventType, (event) => {
      // Keep composed keyboard events from reaching host-page bubble listeners.
      event.stopPropagation();
    });
  }
}

export function isClickInsideUI(target, getBubbleContainer) {
  const trigger = document.getElementById('dobby-ai-trigger');
  if (trigger?.contains(target)) return true;
  const toolbarHost = document.getElementById('dobby-ai-toolbar-host');
  if (toolbarHost?.contains(target)) return true;
  if (typeof getBubbleContainer === 'function') {
    const bc = getBubbleContainer();
    if (bc?.contains(target)) return true;
  }
  return false;
}

export function getSelectedText() {
  return window.getSelection().toString().trim();
}

export function getSelectionRect() {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    return selection.getRangeAt(0).getBoundingClientRect();
  }
  return { top: 180, right: 300, bottom: 200, left: 100 };
}
