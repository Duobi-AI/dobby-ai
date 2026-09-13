import { checkRateLimit, incrementCounters, LIMITS } from './rate-limit.js';
import type { ProxyPurpose } from '../../src/shared/types';
import type { RateLimitResult, RateLimitStore, RateLimiterNamespaceLike } from './types';

type DurableStorageLike = {
  get(key: string): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean | void>;
};

type DurableObjectStateLike = {
  storage: DurableStorageLike;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
};

type RateLimitRequest = {
  ip?: string;
  purpose?: ProxyPurpose;
  tokenHash?: string;
};

function createStore(storage: DurableStorageLike): RateLimitStore {
  return {
    async get(key) {
      const value = await storage.get(key);
      return value == null ? null : String(value);
    },
    put(key, value) {
      return storage.put(key, value);
    },
    delete(key) {
      return storage.delete(key);
    },
  };
}

export class RateLimiter {
  private readonly store: RateLimitStore;

  constructor(
    private readonly state: DurableObjectStateLike,
    private readonly env: { RATE_LIMITER?: RateLimiterNamespaceLike },
  ) {
    this.store = createStore(state.storage);
  }

  private globalStub() {
    const binding = this.env.RATE_LIMITER;
    if (!binding) return null;
    return binding.get(binding.idFromName('__global__'));
  }

  private async checkAndIncrementGlobal(dayKey: string, previousDayKey: string): Promise<{ allowed: boolean }> {
    const stub = this.globalStub();
    if (!stub) return { allowed: false };

    try {
      const response = await stub.fetch('https://rate-limiter/global/check-increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayKey, previousDayKey }),
      });
      if (!response.ok) return { allowed: false };
      const result = await response.json() as { allowed?: unknown };
      return { allowed: result.allowed === true };
    } catch {
      return { allowed: false };
    }
  }

  private async handleGlobalCheckIncrement(request: Request): Promise<Response> {
    let payload: { dayKey?: unknown; previousDayKey?: unknown };
    try {
      payload = await request.json() as typeof payload;
    } catch {
      return Response.json({ error: 'Invalid global rate-limit request' }, { status: 400 });
    }
    if (typeof payload.dayKey !== 'string' || typeof payload.previousDayKey !== 'string') {
      return Response.json({ error: 'Invalid global rate-limit request' }, { status: 400 });
    }
    const dayKey = payload.dayKey;
    const previousDayKey = payload.previousDayKey;

    const result = await this.state.blockConcurrencyWhile(async () => {
      const current = Number.parseInt((await this.store.get(dayKey)) || '', 10) || 0;
      if (current >= LIMITS.globalPerDay) return { allowed: false };
      await this.state.storage.put(dayKey, String(current + 1));
      await this.state.storage.delete(previousDayKey);
      return { allowed: true };
    });
    return Response.json(result);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/global/check-increment') {
      return this.handleGlobalCheckIncrement(request);
    }

    let payload: RateLimitRequest;
    try {
      payload = await request.json() as RateLimitRequest;
    } catch {
      return Response.json({ error: 'Invalid rate-limit request' }, { status: 400 });
    }

    if (!payload.ip || (payload.purpose !== 'chat' && payload.purpose !== 'autosuggest')) {
      return Response.json({ error: 'Invalid rate-limit request' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0]!;
    const previousDay = new Date(Date.now() - 86400000).toISOString().split('T')[0]!;
    const globalKey = `rl:global:${today}`;
    const previousGlobalKey = `rl:global:${previousDay}`;

    // Keep the per-IP decision and write in the same serialized section. The
    // shared global decision is serialized by the dedicated global instance.
    const result = await this.state.blockConcurrencyWhile(async (): Promise<RateLimitResult> => {
      const perIpResult = await checkRateLimit(
        payload.ip!,
        this.store,
        payload.purpose,
        payload.tokenHash,
        null,
      );
      if (!perIpResult.allowed) return perIpResult;

      const globalResult = await this.checkAndIncrementGlobal(globalKey, previousGlobalKey);
      if (!globalResult.allowed) {
        return { allowed: false, reason: 'Service busy, try later', retryAfter: 3600 };
      }

      await incrementCounters(payload.ip!, this.store, payload.purpose, payload.tokenHash, null);
      return perIpResult;
    });

    return Response.json(result);
  }
}
