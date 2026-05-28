// proxy/tests/rate-limit.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit, incrementCounters, checkAndIncrement } from '../src/rate-limit.js';
import { RateLimiter } from '../src/rate-limit-do.js';

function createMockKV(data = {}) {
  const store = { ...data };
  return {
    get: vi.fn((key) => Promise.resolve(store[key] || null)),
    put: vi.fn((key, value, opts) => {
      store[key] = String(value);
      return Promise.resolve();
    }),
    delete: vi.fn((key) => {
      delete store[key];
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
      if (key.startsWith('rl:global:')) return Promise.resolve('500');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('busy');
  });

  it('allows just below the lowered global daily cap', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('rl:global:')) return Promise.resolve('499');
      return Promise.resolve(null);
    });

    const result = await checkRateLimit('1.2.3.4', kv);
    expect(result.allowed).toBe(true);
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
});

describe('incrementCounters', () => {
  it('increments minute, day, and global counters', async () => {
    const kv = createMockKV();
    await incrementCounters('1.2.3.4', kv);

    // 4 puts (min, day, global, burst) + 4 deletes (previous-window pruning)
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
      if (key.startsWith('rl:global:')) return Promise.resolve('500');
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

// A consistent in-memory store mirroring Durable Object storage semantics:
// get returns the stored value directly (numbers, not strings) and writes are
// immediately visible to subsequent reads — i.e. strongly consistent, no KV lag.
function createConsistentStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => (map.has(key) ? map.get(key) : null)),
    put: vi.fn(async (key, value) => {
      map.set(key, value);
    }),
    delete: vi.fn(async (key) => {
      map.delete(key);
    }),
    _map: map,
  };
}

describe('checkAndIncrement', () => {
  it('allows and increments on the first request', async () => {
    const store = createConsistentStore();
    const result = await checkAndIncrement('1.2.3.4', store, 'chat');
    expect(result.allowed).toBe(true);
    // minute, day, global, burst counters all written
    expect(store.put).toHaveBeenCalledTimes(4);
  });

  it('does not increment when the request is denied', async () => {
    const store = createConsistentStore();
    store.get.mockImplementation(async (key) =>
      key.startsWith('rl:day:') ? '30' : null
    );
    const result = await checkAndIncrement('1.2.3.4', store, 'chat');
    expect(result.allowed).toBe(false);
    expect(store.put).not.toHaveBeenCalled();
  });

  it('enforces the per-minute cap across sequential calls (no read-then-write race)', async () => {
    const store = createConsistentStore();
    const results = [];
    // perMinute for chat is 5; the 6th sequential call must be blocked.
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await checkAndIncrement('9.9.9.9', store, 'chat'));
    }
    const allowed = results.filter((r) => r.allowed).length;
    expect(allowed).toBe(5);
    expect(results[5].allowed).toBe(false);
    expect(results[5].reason).toContain('per-minute');
  });
});

// Hand-rolled Durable Object state stub: serializes work via blockConcurrencyWhile
// and backs storage with a strongly-consistent in-memory map.
function createDOState() {
  const store = createConsistentStore();
  let chain = Promise.resolve();
  return {
    storage: store,
    blockConcurrencyWhile: vi.fn((fn) => {
      // Serialize callbacks the way a real DO does: each runs only after the prior settles.
      const next = chain.then(() => fn());
      chain = next.catch(() => {});
      return next;
    }),
  };
}

function doRequest(ip, purpose) {
  return new Request('https://rate-limiter/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, purpose }),
  });
}

// Creates a fake env.RATE_LIMITER binding backed by real RateLimiter DO instances
// in memory. Instances are created lazily and cached by name so the __global__
// instance is shared across all per-IP instances — matching the real Cloudflare
// behaviour where idFromName("__global__") always resolves to the same DO.
function createRateLimiterBinding() {
  const instances = new Map();

  function getOrCreate(name) {
    if (!instances.has(name)) {
      const state = createDOState();
      // Instances get a reference back to this binding so per-IP DOs can reach
      // __global__ via env.RATE_LIMITER — mirroring the real runtime.
      const env = { RATE_LIMITER: binding };  // forward ref; binding is defined below
      instances.set(name, new RateLimiter(state, env));
    }
    return instances.get(name);
  }

  const binding = {
    idFromName: (name) => ({ name }),
    get: ({ name }) => getOrCreate(name),
  };
  return binding;
}

describe('RateLimiter Durable Object', () => {
  it('returns an allowed result and increments storage', async () => {
    const state = createDOState();
    const limiter = new RateLimiter(state, { RATE_LIMITER: createRateLimiterBinding() });
    const res = await limiter.fetch(doRequest('5.5.5.5', 'chat'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowed).toBe(true);
    expect(body.remaining).toBe(29);
    expect(state.blockConcurrencyWhile).toHaveBeenCalledTimes(1);
  });

  it('enforces the per-minute cap under concurrent requests (atomic, no race)', async () => {
    const binding = createRateLimiterBinding();
    const state = createDOState();
    const limiter = new RateLimiter(state, { RATE_LIMITER: binding });
    // Fire 8 requests concurrently; chat perMinute cap is 5.
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => limiter.fetch(doRequest('7.7.7.7', 'chat')))
    );
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const allowed = bodies.filter((b) => b.allowed).length;
    expect(allowed).toBe(5);
    expect(bodies.filter((b) => !b.allowed)).toHaveLength(3);
  });

  it('returns 400 for an unparseable request body', async () => {
    const state = createDOState();
    const limiter = new RateLimiter(state);
    const res = await limiter.fetch(
      new Request('https://rate-limiter/check', { method: 'POST', body: 'not-json' })
    );
    expect(res.status).toBe(400);
  });

  it('global cap is truly shared across different IPs (not per-IP)', async () => {
    // Use a binding where LIMITS.globalPerDay would be 2 — we cannot override the
    // constant, so instead we saturate the real cap (500) via the __global__ DO
    // directly, then verify a fresh IP is blocked.
    const binding = createRateLimiterBinding();

    // Pre-fill the __global__ DO's counter to globalPerDay (500) by calling its
    // /global/increment endpoint directly 500 times — too slow; instead write
    // directly to the __global__ instance's storage.
    const today = new Date().toISOString().split('T')[0];
    const globalKey = `rl:global:${today}`;
    const globalInstance = binding.get(binding.idFromName('__global__'));
    // Write the count directly to the __global__ DO's underlying storage map.
    await globalInstance.storage.put(globalKey, String(500));

    // IP-A: should be blocked by global cap.
    const stateA = createDOState();
    const limiterA = new RateLimiter(stateA, { RATE_LIMITER: binding });
    const resA = await limiterA.fetch(doRequest('10.0.0.1', 'chat'));
    const bodyA = await resA.json();
    expect(bodyA.allowed).toBe(false);
    expect(bodyA.reason).toContain('busy');

    // IP-B (different IP, same global state): also blocked.
    const stateB = createDOState();
    const limiterB = new RateLimiter(stateB, { RATE_LIMITER: binding });
    const resB = await limiterB.fetch(doRequest('10.0.0.2', 'chat'));
    const bodyB = await resB.json();
    expect(bodyB.allowed).toBe(false);
    expect(bodyB.reason).toContain('busy');
  });

  it('two IPs share global cap: first two pass, third is globally throttled', async () => {
    // Seed the global counter at globalPerDay - 1 (499) so that one more request
    // passes and the next is blocked, regardless of which IP sends it.
    const binding = createRateLimiterBinding();
    const today = new Date().toISOString().split('T')[0];
    const globalKey = `rl:global:${today}`;
    const globalInstance = binding.get(binding.idFromName('__global__'));
    await globalInstance.storage.put(globalKey, String(499));

    // IP-A: consumes the last slot.
    const stateA = createDOState();
    const limiterA = new RateLimiter(stateA, { RATE_LIMITER: binding });
    const resA = await limiterA.fetch(doRequest('11.0.0.1', 'chat'));
    expect((await resA.json()).allowed).toBe(true);

    // IP-B: global cap now at 500 — blocked even though it has no per-IP history.
    const stateB = createDOState();
    const limiterB = new RateLimiter(stateB, { RATE_LIMITER: binding });
    const resB = await limiterB.fetch(doRequest('11.0.0.2', 'chat'));
    const bodyB = await resB.json();
    expect(bodyB.allowed).toBe(false);
    expect(bodyB.reason).toContain('busy');
  });

  it('old bucket keys are pruned on increment (no unbounded storage growth)', async () => {
    const binding = createRateLimiterBinding();
    const state = createDOState();
    const limiter = new RateLimiter(state, { RATE_LIMITER: binding });

    // Manually plant a stale previous-minute key in per-IP storage.
    const prevMinBucket = Math.floor(Date.now() / 60000) - 1;
    const staleKey = `rl:min:2.2.2.2:${prevMinBucket}`;
    await state.storage._map.set(staleKey, '3');
    expect(state.storage._map.has(staleKey)).toBe(true);

    // After one allowed request the stale key must be deleted.
    await limiter.fetch(doRequest('2.2.2.2', 'chat'));
    expect(state.storage._map.has(staleKey)).toBe(false);
  });

  it('concurrent requests from DIFFERENT IPs cannot exceed global cap (no TOCTOU race)', async () => {
    // Seed the global counter at globalPerDay - 1 (499) leaving exactly ONE slot.
    // Fire 4 requests concurrently from two different IP DOs (2 requests each).
    // Without the atomic check-increment fix both IPs would read 499 < 500 and
    // both pass, yielding 2+ allowed. With the fix exactly 1 is allowed total.
    const binding = createRateLimiterBinding();
    const today = new Date().toISOString().split('T')[0];
    const globalKey = `rl:global:${today}`;
    const globalInstance = binding.get(binding.idFromName('__global__'));
    await globalInstance.storage.put(globalKey, String(499));

    // Two independent per-IP DO instances, each with their own serialization chain.
    const stateA = createDOState();
    const limiterA = new RateLimiter(stateA, { RATE_LIMITER: binding });
    const stateB = createDOState();
    const limiterB = new RateLimiter(stateB, { RATE_LIMITER: binding });

    // Concurrently fire 2 requests from IP-A and 2 from IP-B (4 total, 1 slot left).
    const responses = await Promise.all([
      limiterA.fetch(doRequest('20.0.0.1', 'chat')),
      limiterB.fetch(doRequest('20.0.0.2', 'chat')),
      limiterA.fetch(doRequest('20.0.0.1', 'chat')),
      limiterB.fetch(doRequest('20.0.0.2', 'chat')),
    ]);
    const bodies = await Promise.all(responses.map((r) => r.json()));
    const allowed = bodies.filter((b) => b.allowed);
    const denied  = bodies.filter((b) => !b.allowed);

    // Exactly one request may pass (the single remaining global slot).
    expect(allowed).toHaveLength(1);
    // The other three must be denied — either by global cap or per-IP minute cap.
    expect(denied).toHaveLength(3);
    // The global-cap denials carry the 'busy' reason.
    const busyDenials = denied.filter((b) => b.reason && b.reason.includes('busy'));
    expect(busyDenials.length).toBeGreaterThanOrEqual(1);
  });
});
