import { getLocalStorage, setLocalStorage } from '../shared/storage.js';
import type { ModeUsageState, UsageState } from '../shared/types/storage';

const TELEMETRY_URL = 'https://dobby-ai-proxy.zhongnansu.workers.dev/telemetry';

export type UsageMode = 'free' | 'byok';

type TelemetryDependencies = {
  fetch: typeof globalThis.fetch;
  now: () => number;
  createInstallationId: () => string;
  getExtensionVersion: () => string;
};

function getUsageSummary(usage?: UsageState) {
  const toTelemetryMetrics = (metrics?: ModeUsageState) => ({
    chat_requests: metrics?.chatRequests || 0,
    autosuggest_requests: metrics?.autosuggestRequests || 0,
    successful_requests: metrics?.successfulRequests || 0,
    provider_errors: metrics?.providerErrors || 0,
    timeouts: metrics?.timeouts || 0,
    rate_limited: metrics?.rateLimited || 0,
  });
  return {
    free: toTelemetryMetrics(usage?.modeUsage?.free),
    byok: toTelemetryMetrics(usage?.modeUsage?.byok),
    screenshot_requests: usage?.screenshotRequests || 0,
  };
}

let heartbeatInFlight: Promise<void> | null = null;

function getUtcDay(now: number): string {
  return new Date(now).toISOString().split('T')[0]!;
}

function getDefaultDependencies(): TelemetryDependencies {
  return {
    fetch: (...args) => globalThis.fetch(...args),
    now: () => Date.now(),
    createInstallationId: () => crypto.randomUUID(),
    getExtensionVersion: () => {
      try {
        return chrome.runtime.getManifest().version;
      } catch {
        return 'unknown';
      }
    },
  };
}

async function sendHeartbeat(mode: UsageMode, dependencies: TelemetryDependencies): Promise<void> {
  const stored = await getLocalStorage([
    'telemetryInstallationId',
    'telemetryLastSentDay',
    'dobbyUsage',
  ]);
  const day = getUtcDay(dependencies.now());
  if (stored.telemetryLastSentDay === day) return;

  const installationId = stored.telemetryInstallationId || dependencies.createInstallationId();
  if (!stored.telemetryInstallationId) {
    await setLocalStorage({ telemetryInstallationId: installationId });
  }

  const response = await dependencies.fetch(TELEMETRY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'daily_active',
      schema_version: 1,
      mode,
      installation_id: installationId,
      extension_version: dependencies.getExtensionVersion(),
      usage: getUsageSummary(stored.dobbyUsage),
    }),
  });
  if (response.ok) {
    await setLocalStorage({ telemetryLastSentDay: day });
  }
}

export function sendDailyUsageHeartbeat(
  mode: UsageMode,
  overrides: Partial<TelemetryDependencies> = {},
): Promise<void> {
  if (heartbeatInFlight) return heartbeatInFlight;

  heartbeatInFlight = sendHeartbeat(mode, { ...getDefaultDependencies(), ...overrides })
    .catch(() => {})
    .finally(() => {
      heartbeatInFlight = null;
    });
  return heartbeatInFlight;
}
