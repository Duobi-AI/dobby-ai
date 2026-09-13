import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/rate-limit-do.js';
import { LIMITS } from '../src/rate-limit.js';

class MemoryStorage {
  values = new Map();

  async get(key) {
    return this.values.get(key) ?? null;
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    return this.values.delete(key);
  }
}

function createBinding() {
  const instances = new Map();
  const storages = new Map();
  const binding = {
    idFromName: (name) => name,
    get: (id) => {
      if (!instances.has(id)) {
        const storage = new MemoryStorage();
        storages.set(id, storage);
        let queue = Promise.resolve();
        const state = {
          storage,
          blockConcurrencyWhile(callback) {
            const result = queue.then(callback);
            queue = result.catch(() => {});
            return result;
          },
        };
        instances.set(id, new RateLimiter(state, { RATE_LIMITER: binding }));
      }
      return { fetch: (input, init) => instances.get(id).fetch(new Request(input, init)) };
    },
  };
  return { binding, instances, storages };
}

function request(body) {
  return new Request('https://rate-limiter/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('RateLimiter Durable Object', () => {
  it('serializes per-IP checks so concurrent requests cannot exceed the minute limit', async () => {
    const { binding } = createBinding();
    const stub = binding.get(binding.idFromName('1.2.3.4'));
    const responses = await Promise.all(Array.from({ length: LIMITS.perMinute + 2 }, () => (
      stub.fetch(request({ ip: '1.2.3.4', purpose: 'chat', tokenHash: 'token' }))
    )));
    const results = await Promise.all(responses.map((response) => response.json()));

    expect(results.filter((result) => result.allowed)).toHaveLength(LIMITS.perMinute);
    expect(results.filter((result) => !result.allowed)).toHaveLength(2);
  });

  it('serializes the shared global counter at the configured cap', async () => {
    const { binding, storages } = createBinding();
    const globalStub = binding.get(binding.idFromName('__global__'));
    const dayKey = 'rl:global:test-day';
    const previousDayKey = 'rl:global:previous-day';
    await storages.get('__global__').put(dayKey, String(LIMITS.globalPerDay - 1));

    const makeGlobalRequest = () => globalStub.fetch(new Request('https://rate-limiter/global/check-increment', {
      method: 'POST',
      body: JSON.stringify({ dayKey, previousDayKey }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const results = await Promise.all([makeGlobalRequest(), makeGlobalRequest()]);
    const allowed = await Promise.all(results.map((response) => response.json()));

    expect(allowed.filter((result) => result.allowed)).toHaveLength(1);
    expect(allowed.filter((result) => !result.allowed)).toHaveLength(1);
  });
});
