// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

const now = Date.UTC(2026, 8, 13, 12);
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

const { sendDailyUsageHeartbeat } = await import('../src/background/usage-telemetry.js');

describe('daily usage telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete storage.telemetryLastSentDay;
  });

  it('sends the selected usage mode without sensitive request data', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 204 }));

    await sendDailyUsageHeartbeat('byok', { fetch, now: () => now });

    expect(fetch).toHaveBeenCalledWith(
      'https://dobby-ai-proxy.zhongnansu.workers.dev/telemetry',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          event: 'daily_active',
          mode: 'byok',
          installation_id: installationId,
          extension_version: '1.4.5',
        }),
      }),
    );
    expect(fetch.mock.calls[0][1].body).not.toContain('apiKey');
    expect(fetch.mock.calls[0][1].body).not.toContain('prompt');
    expect(storage.telemetryLastSentDay).toBe('2026-09-13');
  });

  it('sends at most one event per installation per UTC day', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 204 }));

    await sendDailyUsageHeartbeat('free', { fetch, now: () => now });
    await sendDailyUsageHeartbeat('free', { fetch, now: () => now });

    expect(fetch).toHaveBeenCalledOnce();
  });

  it('does not send telemetry when disabled', async () => {
    mockStorageGet.mockResolvedValueOnce({ telemetryEnabled: false });
    const fetch = vi.fn();

    await sendDailyUsageHeartbeat('free', { fetch, now: () => now });

    expect(fetch).not.toHaveBeenCalled();
  });
});
