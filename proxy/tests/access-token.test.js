// proxy/tests/access-token.test.js
import { describe, it, expect, vi } from 'vitest';
import { issueAccessToken, verifyAccessToken } from '../src/access-token.js';

function createMockKV(data = {}) {
  const store = { ...data };
  return {
    get: vi.fn((key) => Promise.resolve(store[key] || null)),
    put: vi.fn((key, value, opts) => {
      store[key] = String(value);
      return Promise.resolve();
    }),
    _store: store,
  };
}

describe('proxy access tokens', () => {
  it('issues and verifies an IP-bound access token', async () => {
    const kv = createMockKV();

    const issued = await issueAccessToken('1.2.3.4', kv);

    expect(issued).toEqual(expect.objectContaining({
      token: expect.any(String),
      expiresAt: expect.any(String),
    }));
    const verified = await verifyAccessToken(issued.token, '1.2.3.4', kv);
    expect(verified).toEqual(expect.objectContaining({ valid: true, tokenHash: expect.any(String) }));
  });

  it('rejects missing, unknown, and IP-mismatched tokens', async () => {
    const kv = createMockKV();
    const issued = await issueAccessToken('1.2.3.4', kv);

    await expect(verifyAccessToken(null, '1.2.3.4', kv)).resolves.toEqual({
      valid: false,
      reason: 'missing proxy access token',
    });
    await expect(verifyAccessToken('unknown-token', '1.2.3.4', kv)).resolves.toEqual({
      valid: false,
      reason: 'invalid proxy access token',
    });
    await expect(verifyAccessToken(issued.token, '5.6.7.8', kv)).resolves.toEqual({
      valid: false,
      reason: 'proxy access token IP mismatch',
    });
  });

  it('rate-limits token issuance per IP per day', async () => {
    const kv = createMockKV();
    kv.get.mockImplementation((key) => {
      if (key.startsWith('access:issue:')) return Promise.resolve('10');
      return Promise.resolve(null);
    });

    await expect(issueAccessToken('1.2.3.4', kv)).resolves.toEqual({
      error: 'Access token issuance limit reached',
      retryAfter: 3600,
    });
  });
});
