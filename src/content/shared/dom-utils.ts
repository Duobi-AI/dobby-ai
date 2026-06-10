// src/content/shared/dom-utils.js — Shared DOM utility functions

export function removeElement(el: Node | null) {
  if (el?.parentNode) el.parentNode.removeChild(el);
}

export function stopShadowRootKeyboardEventPropagation(shadowRoot: ShadowRoot) {
  for (const eventType of ['keydown', 'keypress', 'keyup']) {
    shadowRoot.addEventListener(eventType, (event) => {
      // Keep composed keyboard events from reaching host-page bubble listeners.
      event.stopPropagation();
    });
  }
}

export function isClickInsideUI(target: EventTarget | null, getBubbleContainer: () => HTMLElement | null) {
  const trigger = document.getElementById('dobby-ai-trigger');
  if (trigger?.contains(target as Node | null)) return true;
  const toolbarHost = document.getElementById('dobby-ai-toolbar-host');
  if (toolbarHost?.contains(target as Node | null)) return true;
  if (typeof getBubbleContainer === 'function') {
    const bc = getBubbleContainer();
    if (bc?.contains(target as Node | null)) return true;
  }
  return false;
}

export function getSelectedText(): string {
  return window.getSelection()!.toString().trim();
}

export function getSelectionRect(): DOMRect | { top: number; right: number; bottom: number; left: number } {
  const selection = window.getSelection();
  if (selection!.rangeCount > 0) {
    return selection!.getRangeAt(0).getBoundingClientRect();
  }
  return { top: 180, right: 300, bottom: 200, left: 100 };
}
