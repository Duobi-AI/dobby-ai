// proxy/src/rate-limit.js
const LIMITS = {
  perMinute: 5,
  perDay: 30,
  // Lowered from 5000 to 500 as a cost backstop. NOTE: the real cost backstop is
  // an upstream OpenAI account hard spend cap (an external dashboard setting, out of code scope).
  globalPerDay: 500,
};

const AUTOSUGGEST_LIMITS = {
  perMinute: 20,
  perDay: 200,
};

function minuteBucket() {
  return Math.floor(Date.now() / 60000);
}

function dayBucket() {
  return new Date().toISOString().split('T')[0];
}

function prevDayBucket() {
  const d = new Date(Date.now() - 86400000);
  return d.toISOString().split('T')[0];
}

function tenSecBucket() {
  return Math.floor(Date.now() / 10000);
}

function keyPrefix(purpose) {
  return purpose === 'autosuggest' ? 'as' : 'rl';
}

function toCount(v) {
  return parseInt(v) || 0;
}

// checkRateLimit reads per-IP counters from `store` and the global daily counter
// from `globalStore` (falls back to `store` when not provided, e.g. KV tests).
export async function checkRateLimit(ip, store, purpose = 'chat', globalStore = store) {
  // Check block list first (shared across both purposes)
  const blocked = await store.get(`blocked:${ip}`);
  if (blocked) {
    return { allowed: false, reason: 'IP blocked for abuse', retryAfter: 3600 };
  }

  const prefix = keyPrefix(purpose);
  const limits = purpose === 'autosuggest' ? AUTOSUGGEST_LIMITS : LIMITS;

  const minKey = `${prefix}:min:${ip}:${minuteBucket()}`;
  const dayKey = `${prefix}:day:${ip}:${dayBucket()}`;
  const globalKey = `rl:global:${dayBucket()}`;

  const [minCount, dayCount, globalCount] = await Promise.all([
    store.get(minKey).then(toCount),
    store.get(dayKey).then(toCount),
    globalStore.get(globalKey).then(toCount),
  ]);

  if (minCount >= limits.perMinute) {
    return { allowed: false, reason: 'Rate limit: per-minute limit reached', retryAfter: 60 };
  }

  if (dayCount >= limits.perDay) {
    return { allowed: false, reason: 'Daily limit reached', remaining: 0 };
  }

  if (globalCount >= LIMITS.globalPerDay) {
    return { allowed: false, reason: 'Service busy, try later', retryAfter: 3600 };
  }

  return { allowed: true, remaining: limits.perDay - dayCount - 1 };
}

// incrementCounters writes per-IP counters to `store` and the global daily counter
// to `globalStore` (falls back to `store` when not provided, e.g. KV tests).
// Each write also deletes the previous window's key to prevent unbounded storage growth.
export async function incrementCounters(ip, store, purpose = 'chat', globalStore = store) {
  const prefix = keyPrefix(purpose);

  const minBucket = minuteBucket();
  const day = dayBucket();
  const tenSecB = tenSecBucket();

  const minKey = `${prefix}:min:${ip}:${minBucket}`;
  const dayKey = `${prefix}:day:${ip}:${day}`;
  const globalKey = `rl:global:${day}`;
  const burstKey = `rl:10s:${ip}:${tenSecB}`;

  // Previous-window keys for pruning stale buckets (bounds storage growth per IP to O(1))
  const prevMinKey = `${prefix}:min:${ip}:${minBucket - 1}`;
  const prevDayKey = `${prefix}:day:${ip}:${prevDayBucket()}`;
  const prevGlobalKey = `rl:global:${prevDayBucket()}`;
  const prevBurstKey = `rl:10s:${ip}:${tenSecB - 1}`;

  const [minCount, dayCount, globalCount, burstCount] = await Promise.all([
    store.get(minKey).then(toCount),
    store.get(dayKey).then(toCount),
    globalStore.get(globalKey).then(toCount),
    store.get(burstKey).then(toCount),
  ]);

  const puts = [
    store.put(minKey, String(minCount + 1), { expirationTtl: 120 }),
    store.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 }),
    globalStore.put(globalKey, String(globalCount + 1), { expirationTtl: 86400 }),
    store.put(burstKey, String(burstCount + 1), { expirationTtl: 60 }),
    // Prune previous-window keys; errors are non-fatal (delete may no-op if absent)
    store.delete(prevMinKey),
    store.delete(prevDayKey),
    globalStore.delete(prevGlobalKey),
    store.delete(prevBurstKey),
  ];

  // Abuse detection: 10+ requests in 10 seconds → 1-hour block
  if (burstCount + 1 >= 10) {
    puts.push(store.put(`blocked:${ip}`, '1', { expirationTtl: 3600 }));
  }

  await Promise.all(puts);
}

// Atomic check-and-increment intended to run inside a Durable Object, where a
// single-threaded execution model serializes reads and writes for a given IP.
// `store` holds per-IP counters; `globalStore` holds the service-wide global daily
// counter (a separate DO instance so the cap is truly cross-IP, not per-IP).
// Only increments when the request is allowed — limit decision and increment cannot race.
export async function checkAndIncrement(ip, store, purpose = 'chat', globalStore = store) {
  const result = await checkRateLimit(ip, store, purpose, globalStore);
  if (!result.allowed) {
    return result;
  }
  await incrementCounters(ip, store, purpose, globalStore);
  return result;
}

export { LIMITS, AUTOSUGGEST_LIMITS };
