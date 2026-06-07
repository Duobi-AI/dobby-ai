// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  rawResponses,
  pushRawResponse,
  clearRawResponses,
} from '../src/content/shared/state.js';
import { createCopyButton } from '../src/content/bubble/stream.js';
import { getColorPalette } from '../src/shared/color-palette.js';

describe('rawResponses state', () => {
  beforeEach(() => {
    clearRawResponses();
  });

  it('starts empty', () => {
    expect(rawResponses).toEqual([]);
  });

  it('pushRawResponse appends to array and returns index', () => {
    const idx0 = pushRawResponse('hello **world**');
    const idx1 = pushRawResponse('second response');
    expect(idx0).toBe(0);
    expect(idx1).toBe(1);
    expect(rawResponses).toEqual(['hello **world**', 'second response']);
  });

  it('clearRawResponses resets to empty', () => {
    pushRawResponse('something');
    clearRawResponses();
    expect(rawResponses).toEqual([]);
  });
});

describe('copy button DOM', () => {
  beforeEach(() => {
    clearRawResponses();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('creates a button with copy-btn class', () => {
    pushRawResponse('test markdown');
    const div = document.createElement('div');
    createCopyButton(div, 0);
    const btn = div.querySelector('.copy-btn');
    expect(btn).toBeTruthy();
    expect(btn.title).toBe('Copy');
    expect(btn.dataset.responseIdx).toBe('0');
  });

  it('contains clipboard SVG icon', () => {
    pushRawResponse('test');
    const div = document.createElement('div');
    createCopyButton(div, 0);
    const btn = div.querySelector('.copy-btn');
    expect(btn.querySelector('svg')).toBeTruthy();
  });

  it('copies raw markdown on click', async () => {
    pushRawResponse('hello **bold**');
    const div = document.createElement('div');
    createCopyButton(div, 0);
    const btn = div.querySelector('.copy-btn');
    btn.click();
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello **bold**');
    });
  });

  it('adds copied class and swaps icon after click', async () => {
    vi.useFakeTimers();
    pushRawResponse('test');
    const div = document.createElement('div');
    createCopyButton(div, 0);
    const btn = div.querySelector('.copy-btn');
    btn.click();
    await vi.waitFor(() => {
      expect(btn.classList.contains('copied')).toBe(true);
    });
    // Should contain checkmark polyline
    expect(btn.innerHTML).toContain('polyline');
    vi.advanceTimersByTime(1500);
    expect(btn.classList.contains('copied')).toBe(false);
    // Should revert to clipboard rect icon
    expect(btn.innerHTML).toContain('rect');
    vi.useRealTimers();
  });

  it('does not copy if index has no response', async () => {
    const div = document.createElement('div');
    createCopyButton(div, 5);
    const btn = div.querySelector('.copy-btn');
    btn.click();
    // Give it a tick to process
    await new Promise((r) => setTimeout(r, 0));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('shows error feedback on clipboard write failure', async () => {
    vi.useFakeTimers();
    navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('denied'));
    pushRawResponse('test');
    const div = document.createElement('div');
    createCopyButton(div, 0);
    const btn = div.querySelector('.copy-btn');
    btn.click();
    await vi.waitFor(() => {
      expect(btn.title).toBe('Copy failed');
    });
    const expected = document.createElement('span');
    expected.style.color = getColorPalette('light').danger;
    expect(btn.style.color).toBe(expected.style.color);
    vi.advanceTimersByTime(1500);
    expect(btn.title).toBe('Copy');
    expect(btn.style.color).toBe('');
    vi.useRealTimers();
  });

  it('handles multiple independent copy buttons', async () => {
    pushRawResponse('first **response**');
    pushRawResponse('second `response`');
    const div1 = document.createElement('div');
    const div2 = document.createElement('div');
    createCopyButton(div1, 0);
    createCopyButton(div2, 1);

    div2.querySelector('.copy-btn').click();
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('second `response`');
    });
  });
});
