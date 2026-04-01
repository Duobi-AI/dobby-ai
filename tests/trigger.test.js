// tests/trigger.test.js
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { setupChromeMocks, mockSelection as sharedMockSelection } from './helpers.js';

// Mock the bubble module (trigger modules import from it)
vi.mock('../src/content/bubble/core.js', () => ({
  showBubbleWithPresets: vi.fn(),
  showBubble: vi.fn(),
  hideBubble: vi.fn(),
  getBubbleContainer: vi.fn(() => null),
  detectTheme: vi.fn(() => Promise.resolve('light')),
}));

// Mock image-capture (path must match what the source modules use)
vi.mock('../src/content/image-capture.js', () => ({
  captureImage: vi.fn(),
  captureScreenshot: vi.fn(),
}));

// Mock api.js (new dependency of button.js)
vi.mock('../src/content/api.js', () => ({
  requestChat: vi.fn(() => ({ cancel: vi.fn() })),
}));

// Mock detection.js
vi.mock('../src/content/detection.js', () => ({
  detectContentType: vi.fn(() => ({ type: 'default', subType: null, confidence: 1.0, wordCount: 5, charCount: 25 })),
}));

// Mock presets.js
vi.mock('../src/content/presets.js', () => ({
  getSuggestedPresetsForType: vi.fn(() => [
    { label: 'Summarize', instruction: 'Summarize the following' },
    { label: 'Explain simply', instruction: 'Explain the following in simple terms' },
  ]),
  getAllPresetsForType: vi.fn(() => [
    { label: 'Translate', instruction: 'Translate the following to English' },
  ]),
}));

// Mock prompt.js
vi.mock('../src/content/prompt.js', () => ({
  buildChatMessages: vi.fn((text, instruction) => [
    { role: 'system', content: 'You are Dobby AI' },
    { role: 'user', content: `${instruction}:\n\n${text}` },
  ]),
}));

// Set up chrome API mocks before module imports
setupChromeMocks();

const { createTriggerButton, showTrigger, hideTrigger, extractImagesFromSelection } = await import('../src/content/trigger/button.js');
const { startScreenshotMode, cancelScreenshotMode } = await import('../src/content/trigger/screenshot.js');
const { _showProgressRing, _removeProgressRing } = await import('../src/content/trigger/progress-ring.js');
const { _resetTriggerForTesting, _setDobbyEnabled, registerListeners } = await import('../src/content/trigger/selection.js');
const { showBubbleWithPresets } = await import('../src/content/bubble/core.js');
const { captureScreenshot } = await import('../src/content/image-capture.js');

// Register event listeners once (mirrors production behavior where they register at load time)
registerListeners();

// Helper to get the toolbar host (replaces getElementById('dobby-ai-trigger'))
function getHost() {
  return document.getElementById('dobby-ai-toolbar-host');
}

beforeEach(() => {
  _resetTriggerForTesting();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('createTriggerButton', () => {
  it('creates toolbar host with cockapoo icon in shadow DOM', async () => {
    await createTriggerButton();
    const host = getHost();
    expect(host).not.toBeNull();
    const shadow = host.shadowRoot;
    const img = shadow.querySelector('.toolbar-icon img');
    expect(img).not.toBeNull();
    expect(img.alt).toBe('Dobby AI');
  });

  it('is idempotent', async () => {
    await createTriggerButton();
    await createTriggerButton();
    expect(document.querySelectorAll('#dobby-ai-toolbar-host').length).toBe(1);
  });

  it('has correct host styling', async () => {
    await createTriggerButton();
    const host = getHost();
    expect(host.style.position).toBe('fixed');
    expect(host.style.zIndex).toBe('2147483647');
    expect(host.style.display).toBe('none');
  });
});

describe('showTrigger', () => {
  it('makes toolbar visible and positions it near cursor', async () => {
    await showTrigger(200, 100);
    const host = getHost();
    expect(host.style.display).toBe('block');
  });

  it('positions below-right of cursor', async () => {
    await showTrigger(200, 100);
    const host = getHost();
    expect(host.style.left).toBe('212px'); // x + 12
    expect(host.style.top).toBe('110px'); // y + 10
  });

  it('clamps left position to prevent off-screen rendering', async () => {
    await showTrigger(1020, 100);
    const host = getHost();
    expect(parseInt(host.style.left)).toBeLessThanOrEqual(980);
  });

  it('clamps top position to viewport bottom', async () => {
    await showTrigger(100, 800);
    const host = getHost();
    expect(parseInt(host.style.top)).toBeLessThanOrEqual(732);
  });
});

describe('hideTrigger', () => {
  it('removes toolbar host from DOM', async () => {
    await showTrigger(100, 100);
    hideTrigger();
    expect(getHost()).toBeNull();
  });

  it('is safe to call when no button exists', async () => {
    expect(() => hideTrigger()).not.toThrow();
  });
});

describe('event-driven behavior', () => {
  function mockSelection(text) {
    sharedMockSelection(text);
  }

  it('mouseup with selection >= 3 chars shows trigger', async () => {
    vi.useFakeTimers();
    mockSelection('hello world');

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    vi.advanceTimersByTime(20);
    // flush microtask queue multiple times so async showTrigger/createToolbar resolve
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const host = getHost();
    expect(host).not.toBeNull();
    expect(host.style.display).toBe('block');
    vi.useRealTimers();
  });

  it('mouseup with selection < 3 chars hides trigger', async () => {
    vi.useFakeTimers();
    // First show it
    await showTrigger(100, 100);
    mockSelection('ab');

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    vi.advanceTimersByTime(20);

    expect(getHost()).toBeNull();
    vi.useRealTimers();
  });

  it('mouseup does not show trigger when dobbyEnabled is false', async () => {
    vi.useFakeTimers();
    _setDobbyEnabled(false);
    mockSelection('hello world');

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    vi.advanceTimersByTime(20);

    // Should not exist or should be hidden
    const host = getHost();
    if (host) {
      expect(host.style.display).toBe('none');
    } else {
      expect(host).toBeNull();
    }
    vi.useRealTimers();
  });

  it('click-away hides trigger', async () => {
    await showTrigger(200, 100);
    expect(getHost()).not.toBeNull();

    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(getHost()).toBeNull();
  });

  it('uses img element with data URI (no innerHTML)', async () => {
    await createTriggerButton();
    const host = getHost();
    const shadow = host.shadowRoot;
    const img = shadow.querySelector('.toolbar-icon img');
    expect(img.src).toContain('data:image/svg+xml');
  });

  it('showTrigger passes selection data when provided', async () => {
    const anchorNode = document.createElement('p');
    await showTrigger(200, 100, { text: 'test text', anchorNode });
    const host = getHost();
    expect(host._selectedText).toBe('test text');
    expect(host._anchorNode).toBe(anchorNode);
  });
});

describe('screenshot mode', () => {
  beforeEach(() => {
    cancelScreenshotMode();
  });

  it('startScreenshotMode creates overlay with banner', async () => {
    startScreenshotMode();
    const overlays = document.querySelectorAll('div[style*="crosshair"]');
    expect(overlays.length).toBe(1);
    expect(overlays[0].textContent).toContain('Drag to select a region');
    cancelScreenshotMode();
  });

  it('cancelScreenshotMode removes the overlay', async () => {
    startScreenshotMode();
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    cancelScreenshotMode();
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
  });

  it('ESC key cancels screenshot mode', async () => {
    startScreenshotMode();
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
  });

  it('mouseup without prior mousedown on overlay does not dismiss it', async () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    // Simulate the mouseup from long-press release (no mousedown on overlay)
    overlay.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100, bubbles: true }));
    // Overlay should still be present
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    cancelScreenshotMode();
  });

  it('click-without-drag resets selection instead of dismissing overlay', async () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    // mousedown then mouseup at same position (no drag)
    overlay.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
    overlay.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100, bubbles: true }));
    // Overlay should still be present (not dismissed)
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    cancelScreenshotMode();
  });

  it('cancelScreenshotMode is safe to call when not in screenshot mode', async () => {
    expect(() => cancelScreenshotMode()).not.toThrow();
  });

  function simulateDrag(overlay, startX, startY, endX, endY) {
    overlay.dispatchEvent(new MouseEvent('mousedown', { clientX: startX, clientY: startY, bubbles: true }));
    overlay.dispatchEvent(new MouseEvent('mouseup', { clientX: endX, clientY: endY, bubbles: true }));
  }

  it('shows confirmation toolbar after valid drag selection', async () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    const toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    expect(toolbar).not.toBeNull();
    expect(toolbar.textContent).toContain('Capture');
    expect(toolbar.textContent).toContain('Reselect');
    expect(toolbar.textContent).toContain('Cancel');
    cancelScreenshotMode();
  });

  it('updates banner text after selection', async () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    expect(overlay.textContent).toContain('Confirm selection or reselect');
    cancelScreenshotMode();
  });

  it('reselect button resets selection and restores banner', async () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    const toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    const reselectBtn = toolbar.querySelectorAll('button')[1]; // second button
    reselectBtn.click();
    // Toolbar should be removed
    expect(overlay.querySelector('[data-screenshot-toolbar]')).toBeNull();
    // Overlay should still be present
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    // Banner should reset
    expect(overlay.textContent).toContain('Drag to select a region');
    cancelScreenshotMode();
  });

  it('cancel button in toolbar removes overlay', async () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    const toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    const cancelBtn = toolbar.querySelectorAll('button')[2]; // third button
    cancelBtn.click();
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
  });

  it('capture button calls captureScreenshot and dismisses overlay', async () => {
    captureScreenshot.mockResolvedValue('data:image/png;base64,abc');
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    const toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    const captureBtn = toolbar.querySelectorAll('button')[0]; // first button
    captureBtn.click();
    await vi.waitFor(() => {
      expect(captureScreenshot).toHaveBeenCalled();
    });
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
  });

  it('does not show toolbar for too-small drag', async () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 55, 55); // 5x5 < 10x10 threshold
    expect(overlay.querySelector('[data-screenshot-toolbar]')).toBeNull();
    cancelScreenshotMode();
  });

  it('re-drag on overlay clears existing toolbar', async () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    expect(overlay.querySelector('[data-screenshot-toolbar]')).not.toBeNull();
    // Start a new drag (mousedown on overlay outside toolbar)
    overlay.dispatchEvent(new MouseEvent('mousedown', { clientX: 300, clientY: 300, bubbles: true }));
    expect(overlay.querySelector('[data-screenshot-toolbar]')).toBeNull();
    cancelScreenshotMode();
  });

  it('mousemove after selection does not resize rectangle', async () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    simulateDrag(overlay, 50, 50, 200, 200);
    // Toolbar is showing — selection is locked
    const rect = overlay.querySelector('div[style*="dashed"], div[style*="solid"]');
    const widthAfterSelection = rect.style.width;
    const heightAfterSelection = rect.style.height;
    // Move mouse — should NOT resize
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 400, bubbles: true }));
    expect(rect.style.width).toBe(widthAfterSelection);
    expect(rect.style.height).toBe(heightAfterSelection);
    cancelScreenshotMode();
  });


  it('re-drag after reselect shows new toolbar', async () => {
    startScreenshotMode();
    const overlay = document.querySelector('div[style*="crosshair"]');
    // First drag
    simulateDrag(overlay, 50, 50, 200, 200);
    let toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    toolbar.querySelectorAll('button')[1].click(); // reselect
    // Second drag
    simulateDrag(overlay, 100, 100, 300, 300);
    toolbar = overlay.querySelector('[data-screenshot-toolbar]');
    expect(toolbar).not.toBeNull();
    cancelScreenshotMode();
  });

  it('does not start screenshot mode when clicking on scrollbar area', async () => {
    vi.useFakeTimers();
    _setDobbyEnabled(true);
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 1024, configurable: true });
    document.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 1030, clientY: 100, bubbles: true,
    }));
    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    vi.useRealTimers();
  });

  it('does not start screenshot mode when clicking on element-level scrollbar', async () => {
    vi.useFakeTimers();
    _setDobbyEnabled(true);
    const scrollable = document.createElement('div');
    // Make element scrollable: content taller than visible area
    Object.defineProperty(scrollable, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(scrollable, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(scrollable, 'clientWidth', { value: 280, configurable: true });
    scrollable.getBoundingClientRect = () => ({ left: 100, top: 50, right: 400, bottom: 250, width: 300, height: 200 });
    document.body.appendChild(scrollable);
    // Click on the scrollbar area (offsetX 290 > clientWidth 280)
    scrollable.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 390, clientY: 100, bubbles: true,
    }));
    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    scrollable.remove();
    vi.useRealTimers();
  });

  it('does not start screenshot mode when clicking on interactive elements', async () => {
    vi.useFakeTimers();
    _setDobbyEnabled(true);
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true,
    }));
    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    button.remove();
    vi.useRealTimers();
  });

  it('does not start screenshot mode when clicking on a link', async () => {
    vi.useFakeTimers();
    _setDobbyEnabled(true);
    const link = document.createElement('a');
    link.href = '#';
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true,
    }));
    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    link.remove();
    vi.useRealTimers();
  });

  it('does not start screenshot mode when clicking inside a role=button element', async () => {
    vi.useFakeTimers();
    _setDobbyEnabled(true);
    const div = document.createElement('div');
    div.setAttribute('role', 'button');
    const span = document.createElement('span');
    div.appendChild(span);
    document.body.appendChild(div);
    span.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true,
    }));
    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(0);
    div.remove();
    vi.useRealTimers();
  });
});

describe('progress ring', () => {
  beforeEach(() => {
    cancelScreenshotMode();
    // Remove any leftover progress ring style tags
    document.getElementById('dobby-progress-ring-styles')?.remove();
  });

  it('_showProgressRing creates an SVG element at given coordinates', async () => {
    _showProgressRing(200, 150);
    const ring = document.querySelector('[data-dobby-progress-ring]');
    expect(ring).not.toBeNull();
    expect(ring.style.position).toBe('fixed');
    expect(ring.style.pointerEvents).toBe('none');
    expect(ring.style.zIndex).toBe('2147483645');
    _removeProgressRing();
  });

  it('_showProgressRing centers the 28px ring on the coordinates', async () => {
    _showProgressRing(200, 150);
    const ring = document.querySelector('[data-dobby-progress-ring]');
    expect(ring.style.left).toBe('186px'); // 200 - 14
    expect(ring.style.top).toBe('136px');  // 150 - 14
    _removeProgressRing();
  });

  it('_showProgressRing injects CSS style tag on first call', async () => {
    expect(document.getElementById('dobby-progress-ring-styles')).toBeNull();
    _showProgressRing(100, 100);
    expect(document.getElementById('dobby-progress-ring-styles')).not.toBeNull();
    _removeProgressRing();
  });

  it('_showProgressRing does not duplicate style tag on second call', async () => {
    _showProgressRing(100, 100);
    _removeProgressRing();
    _showProgressRing(200, 200);
    expect(document.querySelectorAll('#dobby-progress-ring-styles').length).toBe(1);
    _removeProgressRing();
  });

  it('_removeProgressRing removes the ring element', async () => {
    _showProgressRing(100, 100);
    expect(document.querySelector('[data-dobby-progress-ring]')).not.toBeNull();
    _removeProgressRing();
    expect(document.querySelector('[data-dobby-progress-ring]')).toBeNull();
  });

  it('_removeProgressRing is safe to call when no ring exists', async () => {
    expect(() => _removeProgressRing()).not.toThrow();
  });

  it('_showProgressRing removes existing ring before creating new one', async () => {
    _showProgressRing(100, 100);
    _showProgressRing(200, 200);
    expect(document.querySelectorAll('[data-dobby-progress-ring]').length).toBe(1);
    const ring = document.querySelector('[data-dobby-progress-ring]');
    expect(ring.style.left).toBe('186px'); // 200 - 14
    _removeProgressRing();
  });

  it('ring contains SVG with camera icon', async () => {
    _showProgressRing(100, 100);
    const ring = document.querySelector('[data-dobby-progress-ring]');
    const svg = ring.querySelector('svg');
    expect(svg).not.toBeNull();
    // Should have circles (track + animated) and camera icon paths
    expect(svg.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2);
    _removeProgressRing();
  });

  it('ring does not appear when dobbyEnabled is false', async () => {
    vi.useFakeTimers();
    _setDobbyEnabled(false);
    document.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true
    }));
    expect(document.querySelector('[data-dobby-progress-ring]')).toBeNull();
    vi.useRealTimers();
  });

  it('ring is removed when startScreenshotMode fires', async () => {
    vi.useFakeTimers();
    await createTriggerButton();
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 1024, configurable: true });
    Object.defineProperty(document.documentElement, 'clientHeight', { value: 768, configurable: true });
    document.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true
    }));
    // Ring should not appear immediately (500ms delay)
    expect(document.querySelector('[data-dobby-progress-ring]')).toBeNull();
    // Advance past the 500ms delay — ring should now be visible
    vi.advanceTimersByTime(500);
    expect(document.querySelector('[data-dobby-progress-ring]')).not.toBeNull();
    // Advance past LONG_PRESS_DURATION to trigger startScreenshotMode
    vi.advanceTimersByTime(600);
    // Ring should be removed, overlay should exist
    expect(document.querySelector('[data-dobby-progress-ring]')).toBeNull();
    expect(document.querySelectorAll('div[style*="crosshair"]').length).toBe(1);
    cancelScreenshotMode();
    vi.useRealTimers();
  });

  it('ring is removed on early mouseup', async () => {
    vi.useFakeTimers();
    await createTriggerButton();
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 1024, configurable: true });
    Object.defineProperty(document.documentElement, 'clientHeight', { value: 768, configurable: true });
    document.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true
    }));
    // Advance past delay so ring appears
    vi.advanceTimersByTime(500);
    expect(document.querySelector('[data-dobby-progress-ring]')).not.toBeNull();
    // Release before long-press completes
    document.dispatchEvent(new MouseEvent('mouseup', {
      clientX: 100, clientY: 100, bubbles: true
    }));
    expect(document.querySelector('[data-dobby-progress-ring]')).toBeNull();
    vi.useRealTimers();
  });

  it('ring is removed when mouse moves beyond threshold', async () => {
    vi.useFakeTimers();
    await createTriggerButton();
    Object.defineProperty(document.documentElement, 'clientWidth', { value: 1024, configurable: true });
    Object.defineProperty(document.documentElement, 'clientHeight', { value: 768, configurable: true });
    document.dispatchEvent(new MouseEvent('mousedown', {
      button: 0, clientX: 100, clientY: 100, bubbles: true
    }));
    // Advance past delay so ring appears
    vi.advanceTimersByTime(500);
    expect(document.querySelector('[data-dobby-progress-ring]')).not.toBeNull();
    // Move beyond MOVEMENT_THRESHOLD (5px)
    document.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 110, clientY: 100, bubbles: true
    }));
    expect(document.querySelector('[data-dobby-progress-ring]')).toBeNull();
    vi.useRealTimers();
  });
});

describe('toolbar replaces old trigger tooltip', () => {
  it('toolbar host exists after createTriggerButton', async () => {
    await createTriggerButton();
    const host = getHost();
    expect(host).not.toBeNull();
  });

  it('toolbar shadow DOM contains icon element', async () => {
    await createTriggerButton();
    const host = getHost();
    const shadow = host.shadowRoot;
    const icon = shadow.querySelector('.toolbar-icon');
    expect(icon).not.toBeNull();
  });
});
