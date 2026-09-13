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
    delete storage.dobbyUsage;
  });

  it('sends the selected usage mode without sensitive request data', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 204 }));
    storage.dobbyUsage = {
      day: '2026-09-13',
      chatRequests: 8,
      autosuggestRequests: 31,
      screenshotRequests: 2,
      freeChatRemaining: 42,
      usingOwnKey: true,
      lastUpdated: now,
      modeUsage: {
        free: {
          chatRequests: 3,
          autosuggestRequests: 11,
          successfulRequests: 12,
          providerErrors: 1,
          timeouts: 0,
          rateLimited: 1,
        },
        byok: {
          chatRequests: 5,
          autosuggestRequests: 20,
          successfulRequests: 22,
          providerErrors: 2,
          timeouts: 1,
          rateLimited: 0,
        },
      },
    };

    await sendDailyUsageHeartbeat('byok', { fetch, now: () => now });

    expect(fetch).toHaveBeenCalledWith(
      'https://dobby-ai-proxy.zhongnansu.workers.dev/telemetry',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          event: 'daily_active',
          schema_version: 1,
          mode: 'byok',
          installation_id: installationId,
          extension_version: '1.4.5',
          usage: {
            free: {
              chat_requests: 3,
              autosuggest_requests: 11,
              successful_requests: 12,
              provider_errors: 1,
              timeouts: 0,
              rate_limited: 1,
            },
            byok: {
              chat_requests: 5,
              autosuggest_requests: 20,
              successful_requests: 22,
              provider_errors: 2,
              timeouts: 1,
              rate_limited: 0,
            },
            screenshot_requests: 2,
          },
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

  it('always sends telemetry because usage metrics are mandatory', async () => {
    mockStorageGet.mockResolvedValueOnce({ telemetryInstallationId: installationId });
    const fetch = vi.fn();

    await sendDailyUsageHeartbeat('free', { fetch, now: () => now });

    expect(fetch).toHaveBeenCalledOnce();
  });
});
