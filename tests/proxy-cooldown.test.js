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
  PROXY_COOLDOWN_STORAGE_KEY,
  getProxyCooldownRemaining,
  recordProxyTemporaryFailure,
} = await import('../src/background/proxy-cooldown.js');

describe('proxy cooldown', () => {
  beforeEach(() => {
    for (const key of Object.keys(storage)) delete storage[key];
    vi.clearAllMocks();
  });

  it('honors Retry-After and persists a shared proxy cooldown', async () => {
    const now = 1_000_000;
    const delay = await recordProxyTemporaryFailure('600', now);

    expect(delay).toBe(600);
    expect(storage[PROXY_COOLDOWN_STORAGE_KEY]).toEqual({
      until: now + 600_000,
      consecutiveFailures: 1,
    });
    await expect(getProxyCooldownRemaining(now + 100_001)).resolves.toBe(500);
  });

  it('backs off exponentially and caps a missing Retry-After', async () => {
    const now = 1_000_000;
    await expect(recordProxyTemporaryFailure(null, now)).resolves.toBe(60);
    await expect(recordProxyTemporaryFailure(null, now + 61_000)).resolves.toBe(120);
  });
});
