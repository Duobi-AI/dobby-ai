// tests/constants.test.js
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';

const { FONT_STACK, Z_INDEX, TIMING } = await import('../src/content/shared/constants.js');

describe('constants', () => {
  it('exports Z_INDEX with correct layer ordering', () => {
    expect(Z_INDEX.TRIGGER).toBe(2147483647);
    expect(Z_INDEX.SCREENSHOT_OVERLAY).toBe(2147483646);
    expect(Z_INDEX.BUBBLE).toBe(2147483647);
    expect(Z_INDEX.PROGRESS_RING).toBe(2147483645);
    expect(Z_INDEX.LIGHTBOX).toBe(2147483647);
  });

  it('exports the shared font stack', () => {
    expect(FONT_STACK).toContain('apple-system');
  });

  it('exports TIMING constants', () => {
    expect(TIMING.LONG_PRESS_DURATION).toBe(1000);
    expect(TIMING.PROGRESS_RING_DELAY).toBe(500);
    expect(TIMING.MOVEMENT_THRESHOLD).toBe(5);
    expect(TIMING.SELECTION_DEBOUNCE).toBe(300);
    expect(TIMING.SCROLL_DEBOUNCE).toBe(150);
    expect(TIMING.RENDER_DEBOUNCE).toBe(50);
    expect(TIMING.TOOLTIP_AUTO_HIDE).toBe(2000);
    expect(TIMING.MOUSEUP_DELAY).toBe(10);
  });
});
