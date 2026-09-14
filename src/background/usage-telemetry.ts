import { getLocalStorage, setLocalStorage } from '../shared/storage.js';
import type { UsageOutcome, UsageRequestKind } from '../shared/types/storage';

const TELEMETRY_URL = 'https://dobby-ai-proxy.zhongnansu.workers.dev/telemetry';

export type UsageMode = 'free' | 'byok';
export type UsageTelemetryRequest = {
  kind: UsageRequestKind;
  mode: UsageMode;
  outcome: UsageOutcome;
};

type TelemetryDependencies = {
  fetch: typeof globalThis.fetch;
  createInstallationId: () => string;
  getExtensionVersion: () => string;
};

let installationIdInFlight: Promise<string> | null = null;

function getDefaultDependencies(): TelemetryDependencies {
  return {
    fetch: (...args) => globalThis.fetch(...args),
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

async function getInstallationId(dependencies: TelemetryDependencies): Promise<string> {
  const { telemetryInstallationId } = await getLocalStorage('telemetryInstallationId');
  if (telemetryInstallationId) return telemetryInstallationId;

  if (!installationIdInFlight) {
    const installationId = dependencies.createInstallationId();
    installationIdInFlight = Promise.resolve(setLocalStorage({ telemetryInstallationId: installationId }))
      .then(() => installationId)
      .finally(() => {
        installationIdInFlight = null;
      });
  }
  return installationIdInFlight;
}

async function sendUsageRequest(
  request: UsageTelemetryRequest,
  dependencies: TelemetryDependencies,
): Promise<void> {
  const installationId = await getInstallationId(dependencies);
  await dependencies.fetch(TELEMETRY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'usage_request',
      schema_version: 2,
      mode: request.mode,
      installation_id: installationId,
      extension_version: dependencies.getExtensionVersion(),
      request_kind: request.kind,
      outcome: request.outcome,
    }),
  });
}

export function sendUsageRequestTelemetry(
  request: UsageTelemetryRequest,
  overrides: Partial<TelemetryDependencies> = {},
): Promise<void> {
  return sendUsageRequest(request, { ...getDefaultDependencies(), ...overrides }).catch(() => {});
}
