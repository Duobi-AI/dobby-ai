// proxy/src/rate-limit.ts
import type { ProxyPurpose } from '../../src/shared/types';
import type { KVNamespaceLike, RateLimitResult } from './types';

const LIMITS = {
  perMinute: 5,
  perDay: 30,
  globalPerDay: 5000,
};

const AUTOSUGGEST_LIMITS = {
  perMinute: 20,
  perDay: 200,
};

function minuteBucket(): number {
  return Math.floor(Date.now() / 60000);
}

function dayBucket(): string {
  return new Date().toISOString().split('T')[0];
}

function tenSecBucket(): number {
  return Math.floor(Date.now() / 10000);
}

function keyPrefix(purpose: ProxyPurpose): string {
  return purpose === 'autosuggest' ? 'as' : 'rl';
}

export async function checkRateLimit(
  ip: string,
  kv: KVNamespaceLike,
  purpose: ProxyPurpose = 'chat',
): Promise<RateLimitResult> {
  // Check block list first (shared across both purposes)
  const blocked = await kv.get(`blocked:${ip}`);
  if (blocked) {
    return { allowed: false, reason: 'IP blocked for abuse', retryAfter: 3600 };
  }

  const prefix = keyPrefix(purpose);
  const limits = purpose === 'autosuggest' ? AUTOSUGGEST_LIMITS : LIMITS;

  const minKey = `${prefix}:min:${ip}:${minuteBucket()}`;
  const dayKey = `${prefix}:day:${ip}:${dayBucket()}`;
  const globalKey = `rl:global:${dayBucket()}`;

  const [minCount, dayCount, globalCount] = await Promise.all([
    kv.get(minKey).then((v) => parseInt(v!) || 0),
    kv.get(dayKey).then((v) => parseInt(v!) || 0),
    kv.get(globalKey).then((v) => parseInt(v!) || 0),
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

export async function incrementCounters(
  ip: string,
  kv: KVNamespaceLike,
  purpose: ProxyPurpose = 'chat',
): Promise<void> {
  const prefix = keyPrefix(purpose);

  const minKey = `${prefix}:min:${ip}:${minuteBucket()}`;
  const dayKey = `${prefix}:day:${ip}:${dayBucket()}`;
  const globalKey = `rl:global:${dayBucket()}`;
  const burstKey = `rl:10s:${ip}:${tenSecBucket()}`;

  const [minCount, dayCount, globalCount, burstCount] = await Promise.all([
    kv.get(minKey).then((v) => parseInt(v!) || 0),
    kv.get(dayKey).then((v) => parseInt(v!) || 0),
    kv.get(globalKey).then((v) => parseInt(v!) || 0),
    kv.get(burstKey).then((v) => parseInt(v!) || 0),
  ]);

  // Note: KV is eventually consistent so counts are best-effort, which is acceptable for rate limiting
  const puts = [
    kv.put(minKey, String(minCount + 1), { expirationTtl: 120 }),
    kv.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 }),
    kv.put(globalKey, String(globalCount + 1), { expirationTtl: 86400 }),
    kv.put(burstKey, String(burstCount + 1), { expirationTtl: 60 }),
  ];

  // Abuse detection: 10+ requests in 10 seconds → 1-hour block
  if (burstCount + 1 >= 10) {
    puts.push(kv.put(`blocked:${ip}`, '1', { expirationTtl: 3600 }));
  }

  await Promise.all(puts);
}
