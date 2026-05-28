// proxy/tests/index.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AUTOSUGGEST_MAX_SUGGESTION_TOKENS } from '../../src/shared/autosuggest-limits.js';

// Mock modules before importing handler
vi.mock('../src/validate.js', () => ({
  validatePayload: vi.fn(() => ({ valid: true })),
  verifyHmac: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../src/openai.js', () => ({
  createChatStream: vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      body: new ReadableStream(),
    })
  ),
}));

import handler from '../src/index.js';
import { validatePayload, verifyHmac } from '../src/validate.js';
import { createChatStream } from '../src/openai.js';

// Result that the mock RateLimiter Durable Object stub will return for each request.
let doRateResult = { allowed: true, remaining: 29 };
// Records the payloads ({ ip, purpose }) the DO stub was asked to check.
let doCalls = [];

// Hand-rolled Durable Object namespace stub: idFromName(ip) -> stub, and the stub's
// fetch() returns the configured doRateResult as a JSON Response, mirroring the real DO.
function makeRateLimiterBinding() {
  doCalls = [];
  return {
    idFromName: vi.fn((name) => ({ name })),
    get: vi.fn((id) => ({
      fetch: vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        doCalls.push(body);
        return new Response(JSON.stringify(doRateResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    })),
  };
}

function makeRequest(path, options = {}) {
  const url = `https://proxy.workers.dev${path}`;
  const method = options.method || 'GET';
  const headers = new Headers(options.headers || {});
  if (!headers.has('CF-Connecting-IP')) headers.set('CF-Connecting-IP', '1.2.3.4');
  const body = options.body ? JSON.stringify(options.body) : undefined;
  return new Request(url, { method, headers, body });
}

function makeEnv(overrides = {}) {
  return {
    OPENAI_API_KEY: 'sk-test',
    HMAC_SECRET: 'test-secret',
    ENABLED: 'true',
    ALLOWED_ORIGINS: 'chrome-extension://test-id,https://localhost',
    RATE_LIMITER: makeRateLimiterBinding(),
    ...overrides,
  };
}

describe('CORS preflight', () => {
  it('returns 204 with CORS headers for OPTIONS', async () => {
    const req = makeRequest('/chat', { method: 'OPTIONS' });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('returns CORS headers matching request origin', async () => {
    const req = makeRequest('/chat', {
      method: 'OPTIONS',
      headers: { Origin: 'chrome-extension://test-id' },
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('chrome-extension://test-id');
  });

  it('does not match unknown origins', async () => {
    const req = makeRequest('/chat', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.com' },
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe('https://evil.com');
  });
});

describe('kill switch', () => {
  it('returns 503 when ENABLED is false', async () => {
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1 },
    });
    const res = await handler.fetch(req, makeEnv({ ENABLED: 'false' }));
    expect(res.status).toBe(503);
  });
});

describe('routing', () => {
  it('returns 404 for non-/chat paths', async () => {
    const req = makeRequest('/other', { method: 'POST' });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(404);
  });

  it('returns 405 for GET /chat', async () => {
    const req = makeRequest('/chat', { method: 'GET' });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(405);
  });
});

describe('POST /chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validatePayload.mockReturnValue({ valid: true });
    verifyHmac.mockResolvedValue(true);
    doRateResult = { allowed: true, remaining: 29 };
    createChatStream.mockResolvedValue({ ok: true, status: 200, body: new ReadableStream() });
  });

  it('returns 400 when payload validation fails', async () => {
    validatePayload.mockReturnValue({ valid: false, error: 'bad payload' });
    const req = makeRequest('/chat', {
      method: 'POST',
      body: {},
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(400);
  });

  it('returns 403 when HMAC fails', async () => {
    verifyHmac.mockResolvedValue(false);
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'bad', timestamp: 1 },
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    doRateResult = { allowed: false, reason: 'Daily limit', remaining: 0 };
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1 },
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.remaining).toBe(0);
  });

  it('streams SSE response on success', async () => {
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1 },
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(doCalls.length).toBe(1);
  });

  it('returns remaining count in X-RateLimit-Remaining header', async () => {
    doRateResult = { allowed: true, remaining: 15 };
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1 },
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('15');
  });

  it('forwards OpenAI error status', async () => {
    createChatStream.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('OpenAI error'),
    });
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1 },
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(502);
  });

  it('passes purpose to checkRateLimit and incrementCounters', async () => {
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1, purpose: 'autosuggest' },
      headers: { 'Content-Type': 'application/json' },
    });
    await handler.fetch(req, makeEnv());
    expect(doCalls).toEqual([{ ip: '1.2.3.4', purpose: 'autosuggest' }]);
  });

  it('defaults purpose to chat when not specified', async () => {
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1 },
      headers: { 'Content-Type': 'application/json' },
    });
    await handler.fetch(req, makeEnv());
    expect(doCalls).toEqual([{ ip: '1.2.3.4', purpose: 'chat' }]);
  });

  it('passes the shared autosuggest token limit to createChatStream for autosuggest', async () => {
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1, purpose: 'autosuggest' },
      headers: { 'Content-Type': 'application/json' },
    });
    await handler.fetch(req, makeEnv());
    expect(createChatStream).toHaveBeenCalledWith(
      expect.any(Array),
      'sk-test',
      undefined,
      AUTOSUGGEST_MAX_SUGGESTION_TOKENS
    );
  });

  it('passes maxTokens=undefined to createChatStream for chat', async () => {
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1 },
      headers: { 'Content-Type': 'application/json' },
    });
    await handler.fetch(req, makeEnv());
    expect(createChatStream).toHaveBeenCalledWith(
      expect.any(Array),
      'sk-test',
      undefined,
      undefined
    );
  });

  it('returns 413 for oversized request body', async () => {
    const oversizedBody = JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(2200000) }] });
    const req = new Request('https://proxy.workers.dev/chat', {
      method: 'POST',
      headers: new Headers({ 'CF-Connecting-IP': '1.2.3.4', 'Content-Type': 'application/json' }),
      body: oversizedBody,
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(413);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('https://proxy.workers.dev/chat', {
      method: 'POST',
      headers: new Headers({ 'CF-Connecting-IP': '1.2.3.4', 'Content-Type': 'text/plain' }),
      body: 'not json',
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(400);
  });
});

describe('dev bypass token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validatePayload.mockReturnValue({ valid: true });
    verifyHmac.mockResolvedValue(true);
    doRateResult = { allowed: true, remaining: 29 };
    createChatStream.mockResolvedValue({ ok: true, status: 200, body: new ReadableStream() });
  });

  it('skips rate limiting when X-Dev-Token matches DEV_BYPASS_TOKEN', async () => {
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1 },
      headers: { 'Content-Type': 'application/json', 'X-Dev-Token': 'my-secret-token' },
    });
    const env = makeEnv({ DEV_BYPASS_TOKEN: 'my-secret-token' });
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(200);
    expect(env.RATE_LIMITER.idFromName).not.toHaveBeenCalled();
    expect(doCalls.length).toBe(0);
  });

  it('applies rate limiting when X-Dev-Token does not match', async () => {
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1 },
      headers: { 'Content-Type': 'application/json', 'X-Dev-Token': 'wrong-token' },
    });
    const res = await handler.fetch(req, makeEnv({ DEV_BYPASS_TOKEN: 'my-secret-token' }));
    expect(res.status).toBe(200);
    expect(doCalls.length).toBe(1);
  });

  it('applies rate limiting when DEV_BYPASS_TOKEN is not set', async () => {
    const req = makeRequest('/chat', {
      method: 'POST',
      body: { messages: [{ role: 'user', content: 'hi' }], signature: 'x', timestamp: 1 },
      headers: { 'Content-Type': 'application/json', 'X-Dev-Token': 'some-token' },
    });
    const res = await handler.fetch(req, makeEnv());
    expect(res.status).toBe(200);
    expect(doCalls.length).toBe(1);
  });
});
