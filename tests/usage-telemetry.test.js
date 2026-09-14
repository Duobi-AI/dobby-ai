// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

const installationId = '123e4567-e89b-12d3-a456-426614174000';
const storage = { telemetryInstallationId: installationId };
const mockStorageGet = vi.fn(async () => ({ ...storage }));
const mockStorageSet = vi.fn(async (values) => Object.assign(storage, values));

global.chrome = {
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
  },
  runtime: {
    getManifest: () => ({ version: '1.4.5' }),
  },
};

const { sendUsageRequestTelemetry } = await import('../src/background/usage-telemetry.js');

describe('per-request usage telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the request mode and outcome without sensitive request data', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 204 }));

    await sendUsageRequestTelemetry({
      kind: 'chat',
      mode: 'byok',
      outcome: 'success',
    }, { fetch });

    expect(fetch).toHaveBeenCalledWith(
      'https://dobby-ai-proxy.zhongnansu.workers.dev/telemetry',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          event: 'usage_request',
          schema_version: 2,
          mode: 'byok',
          installation_id: installationId,
          extension_version: '1.4.5',
          request_kind: 'chat',
          outcome: 'success',
        }),
      }),
    );
    expect(fetch.mock.calls[0][1].body).not.toContain('apiKey');
    expect(fetch.mock.calls[0][1].body).not.toContain('prompt');
  });

  it('sends one event for each tracked request', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 204 }));

    await sendUsageRequestTelemetry({ kind: 'chat', mode: 'free', outcome: 'success' }, { fetch });
    await sendUsageRequestTelemetry({ kind: 'autosuggest', mode: 'free', outcome: 'rate_limited' }, { fetch });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('always sends telemetry because usage metrics are mandatory', async () => {
    mockStorageGet.mockResolvedValueOnce({ telemetryInstallationId: installationId });
    const fetch = vi.fn();

    await sendUsageRequestTelemetry({ kind: 'screenshot', mode: 'free', outcome: 'success' }, { fetch });

    expect(fetch).toHaveBeenCalledOnce();
  });
});
