// proxy/src/rate-limit-do.js
import { checkRateLimit, incrementCounters, LIMITS } from './rate-limit.js';

// Wraps Durable Object transactional storage as a get/put/delete store compatible
// with the interface rate-limit.js expects. DO storage has no TTL support, so the
// `opts` argument (expirationTtl) is accepted but ignored — stale bucket keys are
// pruned explicitly by incrementCounters on every write (previous-window keys are
// deleted), bounding storage to O(1) active keys per IP.
function doStorage(storage) {
  return {
    get(key) {
      return storage.get(key);
    },
    put(key, value, _opts) {
      return storage.put(key, value);
    },
    delete(key) {
      return storage.delete(key);
    },
  };
}

// RateLimiter is a single Durable Object class that serves two roles:
//
//   Per-IP instance  (idFromName("<ip>"))
//     Holds per-minute, per-day, and burst counters for that IP.
//     Calls the __global__ instance's /global/check-increment endpoint ONCE
//     (after per-IP checks pass, before per-IP increment) so the global cap
//     decision and increment are one serialized atomic operation — no TOCTOU
//     gap between reading and writing the global counter.
//
//   Global instance  (idFromName("__global__"))
//     Holds only the rl:global:<day> counter. The /global/check-increment
//     endpoint performs read → check → conditional-increment inside ONE
//     blockConcurrencyWhile call so concurrent per-IP DOs are serialized here
//     and cannot both read 499 < 500 and both pass before either increments.
//
// Using one class for both roles avoids a second DO binding and keeps
// wrangler.toml simple (one durable_objects entry, one migration).
//
// The Cloudflare runtime passes (state, env) to the constructor; env provides
// env.RATE_LIMITER so per-IP instances can reach the __global__ sibling.
export class RateLimiter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = doStorage(state.storage);
  }

  // ── Global-counter endpoint (served by the __global__ instance) ─────────────
  //
  // Atomically checks and conditionally increments the global daily counter in
  // ONE blockConcurrencyWhile callback. The read and the write happen inside the
  // same serialized gate, so two concurrent callers cannot both observe count < cap
  // and both increment — the TOCTOU that existed when check and increment were
  // separate round-trips.
  async _handleGlobalCheckIncrement(request) {
    const { dayKey, prevDayKey } = await request.json();
    const result = await this.state.blockConcurrencyWhile(async () => {
      const count = parseInt(await this.storage.get(dayKey)) || 0;
      if (count >= LIMITS.globalPerDay) {
        return { allowed: false };
      }
      // Increment and prune previous-day key atomically with the decision.
      await Promise.all([
        this.storage.put(dayKey, String(count + 1), {}),
        this.storage.delete(prevDayKey),
      ]);
      return { allowed: true };
    });
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Helper used by per-IP instances to call the __global__ instance ──────────

  _globalStub() {
    if (!this.env || !this.env.RATE_LIMITER) return null;
    return this.env.RATE_LIMITER.get(
      this.env.RATE_LIMITER.idFromName('__global__')
    );
  }

  // Calls the __global__ DO's single atomic check-increment endpoint.
  // Returns { allowed: true } if the global cap has not been reached (and
  // increments it), or { allowed: false } if the cap is exhausted.
  //
  // Fail-closed on any error: if the binding is absent or the DO call fails we
  // deny the request rather than letting it through. This is the deliberate
  // choice because the global counter is a cost backstop — failing open under
  // an infra fault could allow unbounded spend.
  async _globalCheckIncrement(dayKey, prevDayKey) {
    const stub = this._globalStub();
    if (!stub) {
      // No binding available (e.g. misconfigured env) — fail closed.
      return { allowed: false, missing: true };
    }
    let res;
    try {
      res = await stub.fetch(new Request('https://rate-limiter/global/check-increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayKey, prevDayKey }),
      }));
    } catch {
      // Network/DO error — fail closed.
      return { allowed: false, error: true };
    }
    if (!res.ok) {
      // Non-2xx from __global__ DO — fail closed.
      return { allowed: false, error: true };
    }
    try {
      return await res.json();
    } catch {
      // Malformed/empty body — fail closed (keeps the fail-closed guarantee total).
      return { allowed: false, error: true };
    }
  }

  // ── Main dispatch ────────────────────────────────────────────────────────────

  async fetch(request) {
    const url = new URL(request.url);

    // Global-counter sub-route (handled by the __global__ instance).
    if (url.pathname === '/global/check-increment') {
      return this._handleGlobalCheckIncrement(request);
    }

    // Per-IP rate-limit check+increment (handled by per-IP instances).
    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid DO request' }), { status: 400 });
    }

    const { ip, purpose } = payload;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const globalKey = `rl:global:${today}`;
    const prevGlobalKey = `rl:global:${yesterday}`;

    // blockConcurrencyWhile serializes all concurrent requests to this per-IP
    // instance so the read (checkRateLimit) and write (incrementCounters) cannot
    // race — fixing the eventual-consistency issue that existed with KV.
    const result = await this.state.blockConcurrencyWhile(async () => {
      // 1. Check per-IP limits (minute/day/burst) against this instance's storage.
      //    Pass this.storage as globalStore too so checkRateLimit does not read the
      //    global key locally — global cap enforcement is delegated to __global__.
      const perIpResult = await checkRateLimit(
        ip, this.storage, purpose, this.storage
      );
      if (!perIpResult.allowed) return perIpResult;

      // 2. Atomically check-and-increment the service-wide global daily cap via
      //    the __global__ DO. This is ONE round-trip: decision + mutation happen
      //    inside a single blockConcurrencyWhile on __global__, so concurrent
      //    per-IP DOs cannot both read below-cap and both increment past it.
      const globalResult = await this._globalCheckIncrement(globalKey, prevGlobalKey);
      if (!globalResult.allowed) {
        return { allowed: false, reason: 'Service busy, try later', retryAfter: 3600 };
      }

      // 3. Global cap passed and has been incremented. Now increment per-IP
      //    counters. Order matters: global increment first so a denial here never
      //    leaves the global counter inflated without a corresponding per-IP write
      //    (the global counter is a cost backstop; slight over-caution is correct).
      await incrementCounters(ip, this.storage, purpose, this.storage);

      return perIpResult;
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
