import { describe, it, expect, beforeEach } from 'vitest';
import {
  rawResponses,
  pushRawResponse,
  clearRawResponses,
} from '../src/content/shared/state.js';

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
