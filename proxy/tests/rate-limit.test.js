// proxy/tests/rate-limit.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit, incrementCounters } from '../src/rate-limit.js';

function createMockKV(data = {}) {
  const store = { ...data };
  return {
    get: vi.fn((key) => Promise.resolve(store[key] || null)),
    put: vi.fn((key, value, opts) => {
      store[key] = String(value);
      return Promise.resolve();
    }),
    _store: store,
  };
}

describe('checkRateLimit', () => {
  it('allows first request from new IP', async () => {
    const kv = createMockKV();
    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });

  it('blocks after 5 requests per minute', async () => {
    const kv = createMockKV();
    // Simulate 5 requests already made this minute
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:min:')) return Promise.resolve('5');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('per-minute');
    expect(result.retryAfter).toBeDefined();
  });

  it('blocks after 30 requests per day', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:day:')) return Promise.resolve('30');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily');
    expect(result.remaining).toBe(0);
  });

  it('blocks when global daily cap reached', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:global:')) return Promise.resolve('5000');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('busy');
  });

  it('blocks IP on abuse list', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key === 'blocked:1.2.3.4') return Promise.resolve('1');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('blocked');
  });

  it('returns remaining count', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:day:')) return Promise.resolve('10');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(19);
  });

  it('uses the proxy access token identity when provided', async () => {
    const kv = createMockKV();
    await checkRateLimit('1.2.3.4', kv, 'chat', 'token-hash');

    expect(kv.get).toHaveBeenCalledWith(expect.stringContaining('1.2.3.4:token-hash'));
  });

  it('still blocks when the caller IP has exhausted its daily quota across tokens', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:ipday:')) return Promise.resolve('30');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv, 'chat', 'token-hash');

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily');
  });
});

describe('incrementCounters', () => {
  it('increments minute, day, and global counters', async () => {
    const kv = createMockKV();
    await incrementCounters('1.2.3.4', kv);

    expect(kv.put).toHaveBeenCalledTimes(4);
    // Verify minute counter
    const minuteCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:min:'));
    expect(minuteCall).toBeDefined();
    expect(minuteCall[1]).toBe('1');
    expect(minuteCall[2]).toEqual({ expirationTtl: 120 });

    // Verify day counter
    const dayCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:day:'));
    expect(dayCall).toBeDefined();
    expect(dayCall[2]).toEqual({ expirationTtl: 86400 });

    // Verify global counter
    const globalCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:global:'));
    expect(globalCall).toBeDefined();
  });

  it('increments existing counters', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:min:')) return Promise.resolve('3');
      if (key.startsWith('rl:day:')) return Promise.resolve('15');
      if (key.startsWith('rl:global:')) return Promise.resolve('100');
      return Promise.resolve(null);
    });

    await incrementCounters('1.2.3.4', kv);

    const minuteCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:min:'));
    expect(minuteCall[1]).toBe('4');
    const dayCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:day:'));
    expect(dayCall[1]).toBe('16');
  });

  it('increments counters for the proxy access token identity when provided', async () => {
    const kv = createMockKV();
    await incrementCounters('1.2.3.4', kv, 'chat', 'token-hash');

    expect(kv.put).toHaveBeenCalledWith(
      expect.stringContaining('1.2.3.4:token-hash'),
      '1',
      expect.anything()
    );
  });

  it('also increments caller IP counters when a proxy access token is provided', async () => {
    const kv = createMockKV();
    await incrementCounters('1.2.3.4', kv, 'chat', 'token-hash');

    expect(kv.put).toHaveBeenCalledWith(
      expect.stringContaining('rl:ipday:1.2.3.4'),
      '1',
      expect.anything()
    );
  });

  it('blocks IP after 10+ requests in 10s window', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:10s:')) return Promise.resolve('9');
      return Promise.resolve(null);
    });
    await incrementCounters('1.2.3.4', kv);
    const blockCall = kv.put.mock.calls.find((c) => c[0] === 'blocked:1.2.3.4');
    expect(blockCall).toBeDefined();
    expect(blockCall[2]).toEqual({ expirationTtl: 3600 });
  });
});

describe('checkRateLimit with autosuggest purpose', () => {
  it('allows up to 20 requests per minute for autosuggest', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('as:min:')) return Promise.resolve('19');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv, 'autosuggest');
    expect(result.allowed).toBe(true);
  });

  it('blocks autosuggest after 20 requests per minute', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('as:min:')) return Promise.resolve('20');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv, 'autosuggest');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('per-minute');
  });

  it('allows up to 200 requests per day for autosuggest', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('as:day:')) return Promise.resolve('199');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv, 'autosuggest');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('blocks autosuggest after 200 requests per day', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('as:day:')) return Promise.resolve('200');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv, 'autosuggest');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily');
  });

  it('shares global daily limit with chat', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:global:')) return Promise.resolve('5000');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv, 'autosuggest');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('busy');
  });

  it('shares IP block list with chat', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key === 'blocked:1.2.3.4') return Promise.resolve('1');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv, 'autosuggest');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('blocked');
  });
});

describe('incrementCounters with autosuggest purpose', () => {
  it('uses as: key prefix for autosuggest', async () => {
    const kv = createMockKV();
    await incrementCounters('1.2.3.4', kv, 'autosuggest');

    const minuteCall = kv.put.mock.calls.find((c) => c[0].startsWith('as:min:'));
    expect(minuteCall).toBeDefined();
    expect(minuteCall[1]).toBe('1');

    const dayCall = kv.put.mock.calls.find((c) => c[0].startsWith('as:day:'));
    expect(dayCall).toBeDefined();
    expect(dayCall[1]).toBe('1');

    // Global counter still uses rl: prefix (shared)
    const globalCall = kv.put.mock.calls.find((c) => c[0].startsWith('rl:global:'));
    expect(globalCall).toBeDefined();
  });

  it('chat and autosuggest counters are independent', async () => {
    const kv = createMockKV();
    // Simulate 5 chat requests at minute limit
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:min:')) return Promise.resolve('5');
      return Promise.resolve(null);
    });

    // Chat should be blocked
    const chatResult = await checkRateLimit('1.2.3.4', kv, 'chat');
    expect(chatResult.allowed).toBe(false);

    // Autosuggest should still be allowed (different prefix)
    const asResult = await checkRateLimit('1.2.3.4', kv, 'autosuggest');
    expect(asResult.allowed).toBe(true);
  });
});
