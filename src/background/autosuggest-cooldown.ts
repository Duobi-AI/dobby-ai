import { getLocalStorage, setLocalStorage } from '../shared/storage.js';
import type { AutosuggestCooldown } from '../shared/types';

export const AUTOSUGGEST_COOLDOWN_STORAGE_KEY = 'autosuggestCooldown';
export const AUTOSUGGEST_COOLDOWN_INITIAL_SECONDS = 60;
export const AUTOSUGGEST_COOLDOWN_MAX_SECONDS = 24 * 60 * 60;

function clampSeconds(seconds: number): number {
  return Math.min(AUTOSUGGEST_COOLDOWN_MAX_SECONDS, Math.max(1, Math.ceil(seconds)));
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return clampSeconds(seconds);

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return undefined;
  return clampSeconds((retryAt - now) / 1000);
}

export async function getAutosuggestCooldownRemaining(now = Date.now()): Promise<number> {
  const stored = await getLocalStorage(AUTOSUGGEST_COOLDOWN_STORAGE_KEY);
  const value = stored[AUTOSUGGEST_COOLDOWN_STORAGE_KEY] as AutosuggestCooldown | undefined;
  if (!value || !Number.isFinite(value.until)) return 0;
  return Math.max(0, Math.ceil((value.until - now) / 1000));
}

export async function recordAutosuggestRateLimit(
  retryAfterHeader: string | null,
  now = Date.now(),
): Promise<number> {
  const stored = await getLocalStorage(AUTOSUGGEST_COOLDOWN_STORAGE_KEY);
  const previous = stored[AUTOSUGGEST_COOLDOWN_STORAGE_KEY] as AutosuggestCooldown | undefined;
  // Keep escalating after a client waits and receives another 429. A successful
  // autosuggest response clears this state, while a stale value ages out after a day.
  const priorFailures = previous?.until && previous.until >= now - AUTOSUGGEST_COOLDOWN_MAX_SECONDS * 1000
    ? previous.consecutiveRateLimits || 0
    : 0;
  const consecutiveRateLimits = priorFailures + 1;
  const exponentialDelay = AUTOSUGGEST_COOLDOWN_INITIAL_SECONDS * (2 ** (consecutiveRateLimits - 1));
  const retryAfter = parseRetryAfter(retryAfterHeader, now) || 0;
  const delay = clampSeconds(Math.max(retryAfter, exponentialDelay));

  await setLocalStorage({
    [AUTOSUGGEST_COOLDOWN_STORAGE_KEY]: {
      until: now + delay * 1000,
      consecutiveRateLimits,
    },
  });
  return delay;
}

export async function clearAutosuggestCooldown(): Promise<void> {
  await setLocalStorage({ [AUTOSUGGEST_COOLDOWN_STORAGE_KEY]: undefined });
}
