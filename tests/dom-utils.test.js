// tests/dom-utils.test.js
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  removeElement,
  stopShadowRootKeyboardEventPropagation,
  isClickInsideUI,
  getSelectedText,
  getSelectionRect,
} = await import('../src/content/shared/dom-utils.js');

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('removeElement', () => {
  it('removes element from its parent', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    removeElement(el);
    expect(el.parentNode).toBeNull();
  });

  it('is safe when element has no parent', () => {
    const el = document.createElement('div');
    expect(() => removeElement(el)).not.toThrow();
  });

  it('is safe when called with null', () => {
    expect(() => removeElement(null)).not.toThrow();
  });

  it('is safe when called with undefined', () => {
    expect(() => removeElement(undefined)).not.toThrow();
  });
});

describe('stopShadowRootKeyboardEventPropagation', () => {
  it.each(['keydown', 'keypress', 'keyup'])('keeps %s events inside the shadow root', (eventType) => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    shadow.appendChild(input);
    document.body.appendChild(host);

    const inputListener = vi.fn();
    const pageListener = vi.fn();
    input.addEventListener(eventType, inputListener);
    document.addEventListener(eventType, pageListener);
    stopShadowRootKeyboardEventPropagation(shadow);

    input.dispatchEvent(new KeyboardEvent(eventType, {
      key: 's',
      bubbles: true,
      composed: true,
    }));

    expect(inputListener).toHaveBeenCalledOnce();
    expect(pageListener).not.toHaveBeenCalled();
    document.removeEventListener(eventType, pageListener);
  });

  it('does not block non-keyboard events', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    shadow.appendChild(button);
    document.body.appendChild(host);

    const pageListener = vi.fn();
    document.addEventListener('click', pageListener);
    stopShadowRootKeyboardEventPropagation(shadow);

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(pageListener).toHaveBeenCalledOnce();
    document.removeEventListener('click', pageListener);
  });
});

describe('isClickInsideUI', () => {
  it('returns true when target is inside trigger button', () => {
    const trigger = document.createElement('div');
    trigger.id = 'dobby-ai-trigger';
    const child = document.createElement('span');
    trigger.appendChild(child);
    document.body.appendChild(trigger);
    expect(isClickInsideUI(child)).toBe(true);
    trigger.remove();
  });

  it('returns true when target is inside bubble container', () => {
    const bubble = document.createElement('div');
    const child = document.createElement('span');
    bubble.appendChild(child);
    const getBubble = vi.fn(() => bubble);
    expect(isClickInsideUI(child, getBubble)).toBe(true);
  });

  it('returns false when target is outside UI elements', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const getBubble = vi.fn(() => null);
    expect(isClickInsideUI(el, getBubble)).toBe(false);
    el.remove();
  });

  it('returns false when getBubbleContainer is not provided', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(isClickInsideUI(el)).toBe(false);
    el.remove();
  });

  it('detects click inside toolbar host', () => {
    const host = document.createElement('div');
    host.id = 'dobby-ai-toolbar-host';
    document.body.appendChild(host);
    const child = document.createElement('span');
    host.appendChild(child);
    expect(isClickInsideUI(child, () => null)).toBe(true);
    host.remove();
  });
});

describe('getSelectedText', () => {
  it('returns trimmed selection text', () => {
    window.getSelection = vi.fn(() => ({ toString: () => '  hello world  ' }));
    expect(getSelectedText()).toBe('hello world');
  });

  it('returns empty string when no selection', () => {
    window.getSelection = vi.fn(() => ({ toString: () => '' }));
    expect(getSelectedText()).toBe('');
  });
});

describe('getSelectionRect', () => {
  it('returns bounding rect when range exists', () => {
    const mockRect = { top: 10, right: 200, bottom: 30, left: 100 };
    window.getSelection = vi.fn(() => ({
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => mockRect }),
    }));
    expect(getSelectionRect()).toEqual(mockRect);
  });

  it('returns fallback when no range', () => {
    window.getSelection = vi.fn(() => ({ rangeCount: 0 }));
    const result = getSelectionRect();
    expect(result).toHaveProperty('top');
    expect(result).toHaveProperty('bottom');
    expect(result).toHaveProperty('left');
    expect(result).toHaveProperty('right');
  });
});
