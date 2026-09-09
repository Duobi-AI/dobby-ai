import { getLocalStorage, setLocalStorage } from '../shared/storage.js';
import type { ProxyCooldown } from '../shared/types';

export const PROXY_COOLDOWN_STORAGE_KEY = 'proxyCooldown';
export const PROXY_COOLDOWN_INITIAL_SECONDS = 60;
export const PROXY_COOLDOWN_MAX_SECONDS = 24 * 60 * 60;

function clampSeconds(seconds: number): number {
  return Math.min(PROXY_COOLDOWN_MAX_SECONDS, Math.max(1, Math.ceil(seconds)));
}

function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return clampSeconds(seconds);

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return undefined;
  return clampSeconds((retryAt - now) / 1000);
}

export async function getProxyCooldownRemaining(now = Date.now()): Promise<number> {
  const stored = await getLocalStorage(PROXY_COOLDOWN_STORAGE_KEY);
  const value = stored[PROXY_COOLDOWN_STORAGE_KEY] as ProxyCooldown | undefined;
  if (!value || !Number.isFinite(value.until)) return 0;
  return Math.max(0, Math.ceil((value.until - now) / 1000));
}

export async function recordProxyTemporaryFailure(
  retryAfterHeader: string | null,
  now = Date.now(),
): Promise<number> {
  const stored = await getLocalStorage(PROXY_COOLDOWN_STORAGE_KEY);
  const previous = stored[PROXY_COOLDOWN_STORAGE_KEY] as ProxyCooldown | undefined;
  const priorFailures = previous?.until && previous.until >= now - PROXY_COOLDOWN_MAX_SECONDS * 1000
    ? previous.consecutiveFailures || 0
    : 0;
  const consecutiveFailures = priorFailures + 1;
  const exponentialDelay = PROXY_COOLDOWN_INITIAL_SECONDS * (2 ** (consecutiveFailures - 1));
  const retryAfter = parseRetryAfter(retryAfterHeader, now) || 0;
  const delay = clampSeconds(Math.max(retryAfter, exponentialDelay));

  await setLocalStorage({
    [PROXY_COOLDOWN_STORAGE_KEY]: {
      until: now + delay * 1000,
      consecutiveFailures,
    },
  });
  return delay;
}

export async function clearProxyCooldown(): Promise<void> {
  await setLocalStorage({ [PROXY_COOLDOWN_STORAGE_KEY]: undefined });
}

export class ProxyCooldownError extends Error {
  readonly status = 503;

  constructor(readonly retryAfter: number) {
    super(`Proxy temporarily unavailable. Try again in ${retryAfter} seconds.`);
    this.name = 'ProxyCooldownError';
  }
}
