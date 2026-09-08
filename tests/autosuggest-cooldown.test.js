import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = {};
global.chrome = {
  storage: {
    local: {
      get: vi.fn((key) => Promise.resolve({ [key]: storage[key] })),
      set: vi.fn((values) => {
        Object.assign(storage, values);
        return Promise.resolve();
      }),
    },
  },
};

const {
  AUTOSUGGEST_COOLDOWN_STORAGE_KEY,
  getAutosuggestCooldownRemaining,
  parseRetryAfter,
  recordAutosuggestRateLimit,
} = await import('../src/background/autosuggest-cooldown.js');

describe('autosuggest cooldown', () => {
  beforeEach(() => {
    for (const key of Object.keys(storage)) delete storage[key];
    vi.clearAllMocks();
  });

  it('parses delta-seconds and HTTP-date Retry-After values', () => {
    const now = Date.parse('2026-09-08T12:00:00.000Z');
    expect(parseRetryAfter('120', now)).toBe(120);
    expect(parseRetryAfter('Mon, 08 Sep 2026 12:02:00 GMT', now)).toBe(120);
    expect(parseRetryAfter('invalid', now)).toBeUndefined();
  });

  it('honors Retry-After and persists a shared cooldown', async () => {
    const now = 1_000_000;
    const delay = await recordAutosuggestRateLimit('600', now);

    expect(delay).toBe(600);
    expect(storage[AUTOSUGGEST_COOLDOWN_STORAGE_KEY]).toEqual({
      until: now + 600_000,
      consecutiveRateLimits: 1,
    });
    await expect(getAutosuggestCooldownRemaining(now + 100_001)).resolves.toBe(500);
  });

  it('increases repeated limits exponentially while bounding the delay', async () => {
    const now = 1_000_000;
    await recordAutosuggestRateLimit('1', now);
    await expect(recordAutosuggestRateLimit('1', now + 1_000)).resolves.toBe(120);
  });
});
