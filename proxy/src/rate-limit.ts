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
  return new Date().toISOString().split('T')[0]!;
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
  tokenHash?: string,
): Promise<RateLimitResult> {
  // Check block list first (shared across both purposes)
  const blocked = await kv.get(`blocked:${ip}`);
  if (blocked) {
    return { allowed: false, reason: 'IP blocked for abuse', retryAfter: 3600 };
  }

  const prefix = keyPrefix(purpose);
  const limits = purpose === 'autosuggest' ? AUTOSUGGEST_LIMITS : LIMITS;
  const subject = tokenHash ? `${ip}:${tokenHash}` : ip;

  const minKey = `${prefix}:min:${subject}:${minuteBucket()}`;
  const dayKey = `${prefix}:day:${subject}:${dayBucket()}`;
  const ipMinKey = `${prefix}:ipmin:${ip}:${minuteBucket()}`;
  const ipDayKey = `${prefix}:ipday:${ip}:${dayBucket()}`;
  const globalKey = `rl:global:${dayBucket()}`;

  const [minCount, dayCount, ipMinCount, ipDayCount, globalCount] = await Promise.all([
    kv.get(minKey).then((v) => parseInt(v!) || 0),
    kv.get(dayKey).then((v) => parseInt(v!) || 0),
    tokenHash ? kv.get(ipMinKey).then((v) => parseInt(v!) || 0) : Promise.resolve(0),
    tokenHash ? kv.get(ipDayKey).then((v) => parseInt(v!) || 0) : Promise.resolve(0),
    kv.get(globalKey).then((v) => parseInt(v!) || 0),
  ]);

  if (minCount >= limits.perMinute || ipMinCount >= limits.perMinute) {
    return { allowed: false, reason: 'Rate limit: per-minute limit reached', retryAfter: 60 };
  }

  if (dayCount >= limits.perDay || ipDayCount >= limits.perDay) {
    return { allowed: false, reason: 'Daily limit reached', remaining: 0 };
  }

  if (globalCount >= LIMITS.globalPerDay) {
    return { allowed: false, reason: 'Service busy, try later', retryAfter: 3600 };
  }

  const tokenRemaining = limits.perDay - dayCount - 1;
  const ipRemaining = tokenHash ? limits.perDay - ipDayCount - 1 : tokenRemaining;
  return { allowed: true, remaining: Math.min(tokenRemaining, ipRemaining) };
}

export async function incrementCounters(
  ip: string,
  kv: KVNamespaceLike,
  purpose: ProxyPurpose = 'chat',
  tokenHash?: string,
): Promise<void> {
  const prefix = keyPrefix(purpose);
  const subject = tokenHash ? `${ip}:${tokenHash}` : ip;

  const minKey = `${prefix}:min:${subject}:${minuteBucket()}`;
  const dayKey = `${prefix}:day:${subject}:${dayBucket()}`;
  const ipMinKey = `${prefix}:ipmin:${ip}:${minuteBucket()}`;
  const ipDayKey = `${prefix}:ipday:${ip}:${dayBucket()}`;
  const globalKey = `rl:global:${dayBucket()}`;
  const burstKey = `rl:10s:${ip}:${tenSecBucket()}`;

  const [minCount, dayCount, ipMinCount, ipDayCount, globalCount, burstCount] = await Promise.all([
    kv.get(minKey).then((v) => parseInt(v!) || 0),
    kv.get(dayKey).then((v) => parseInt(v!) || 0),
    tokenHash ? kv.get(ipMinKey).then((v) => parseInt(v!) || 0) : Promise.resolve(0),
    tokenHash ? kv.get(ipDayKey).then((v) => parseInt(v!) || 0) : Promise.resolve(0),
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
  if (tokenHash) {
    puts.push(
      kv.put(ipMinKey, String(ipMinCount + 1), { expirationTtl: 120 }),
      kv.put(ipDayKey, String(ipDayCount + 1), { expirationTtl: 86400 }),
    );
  }

  // Abuse detection: 10+ requests in 10 seconds → 1-hour block
  if (burstCount + 1 >= 10) {
    puts.push(kv.put(`blocked:${ip}`, '1', { expirationTtl: 3600 }));
  }

  await Promise.all(puts);
}
