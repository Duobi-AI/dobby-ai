import { describe, it, expect, vi } from 'vitest';
import { createResponseStreamExecutor, generateSignature } from '../src/background/model-stream.js';

function makeResponse(chunks, headers = new Map([['X-RateLimit-Remaining', '25']])) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () => index < chunks.length
          ? Promise.resolve({ done: false, value: encoder.encode(chunks[index++]) })
          : Promise.resolve({ done: true }),
      }),
    },
    headers: { get: (name) => headers.get(name) },
  };
}

function makeDependencies(overrides = {}) {
  const timers = [];
  const dependencies = {
    readUserApiKey: vi.fn(async () => undefined),
    fetch: vi.fn(async () => makeResponse([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: [DONE]\n\n',
    ])),
    now: vi.fn(() => 123000),
    sign: vi.fn(async () => 'signature'),
    recordUsage: vi.fn(async () => {}),
    fetchProxy: vi.fn(async (messages, purpose, signal, auth) => {
      const body = purpose === 'autosuggest'
        ? { messages, signature: auth.signature, timestamp: auth.timestamp, purpose }
        : { messages, signature: auth.signature, timestamp: auth.timestamp };
      return dependencies.fetch('https://dobby-ai-proxy.zhongnansu.workers.dev/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    }),
    getAutosuggestCooldownRemaining: vi.fn(async () => 0),
    recordAutosuggestRateLimit: vi.fn(async () => 60),
    clearAutosuggestCooldown: vi.fn(async () => {}),
    setTimeout: vi.fn((callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    }),
    clearTimeout: vi.fn(),
    timers,
  };
  Object.assign(dependencies, overrides);
  return dependencies;
}

function run(executor, kind = 'chat') {
  const events = [];
  executor.execute({
    kind,
    messages: [{ role: 'user', content: 'test' }],
    onEvent: (event) => events.push(event),
  });
  return new Promise((resolve) => {
    const check = () => {
      if (events.some((event) => event.type === 'done' || event.type === 'error' || event.type === 'rate_limited')) {
        resolve(events);
      } else {
        setTimeout(check, 0);
      }
    };
    check();
  });
}

describe('response stream executor', () => {
  it('executes a proxy response request and emits stream events through its interface', async () => {
    const dependencies = makeDependencies();
    const executor = createResponseStreamExecutor(dependencies);

    const events = await run(executor);

    expect(events).toEqual([
      { type: 'token', text: 'Hello' },
      { type: 'done', remaining: 25, usingOwnKey: false },
    ]);
    expect(dependencies.sign).toHaveBeenCalledWith(
      [{ role: 'user', content: 'test' }],
      123,
      expect.any(String),
    );
    const body = JSON.parse(dependencies.fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      messages: [{ role: 'user', content: 'test' }],
      signature: 'signature',
      timestamp: 123,
    });
  });

  it('parses split and malformed SSE frames behind the execution interface', async () => {
    const dependencies = makeDependencies({
      fetch: vi.fn(async () => makeResponse([
        'data: {bad json}\n\n',
        'data: {"choices":[{"delta":{"conte',
        'nt":"Hi"}}]}\n\ndata: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: [DONE]\n\n',
      ])),
    });

    const events = await run(createResponseStreamExecutor(dependencies));

    expect(events).toEqual([
      { type: 'token', text: 'Hi' },
      { type: 'done', remaining: 25, usingOwnKey: false },
    ]);
  });

  it('keeps the production proxy signature behind the execution interface', async () => {
    const dependencies = makeDependencies();
    dependencies.sign = generateSignature;

    await run(createResponseStreamExecutor(dependencies));

    const body = JSON.parse(dependencies.fetch.mock.calls[0][1].body);
    expect(body.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('uses the Autosuggestion policy and keeps its done event distinct', async () => {
    const dependencies = makeDependencies();
    const executor = createResponseStreamExecutor(dependencies);

    const events = await run(executor, 'autosuggest');

    expect(events.at(-1)).toEqual({ type: 'done', remaining: null, usingOwnKey: false });
    expect(JSON.parse(dependencies.fetch.mock.calls[0][1].body).purpose).toBe('autosuggest');
    expect(dependencies.recordUsage).toHaveBeenCalledWith('autosuggest', {
      remaining: undefined,
      usingOwnKey: false,
    });
  });

  it('reports a Chat timeout but keeps Autosuggestion timeout silent', async () => {
    const createHangingDependencies = () => {
      const dependencies = makeDependencies({
        fetch: vi.fn((url, options) => new Promise((_, reject) => {
          options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        })),
      });
      return dependencies;
    };

    const chatDependencies = createHangingDependencies();
    const chatEvents = [];
    createResponseStreamExecutor(chatDependencies).execute({
      kind: 'chat',
      messages: [],
      onEvent: (event) => chatEvents.push(event),
    });
    await vi.waitFor(() => expect(chatDependencies.fetch).toHaveBeenCalled());
    chatDependencies.timers[0].callback();
    await vi.waitFor(() => expect(chatEvents).toEqual([
      { type: 'error', code: 0, message: 'Request timed out' },
    ]));
    expect(chatDependencies.timers[0].delay).toBe(30000);

    const autosuggestDependencies = createHangingDependencies();
    const autosuggestEvents = [];
    createResponseStreamExecutor(autosuggestDependencies).execute({
      kind: 'autosuggest',
      messages: [],
      onEvent: (event) => autosuggestEvents.push(event),
    });
    await vi.waitFor(() => expect(autosuggestDependencies.fetch).toHaveBeenCalled());
    autosuggestDependencies.timers[0].callback();
    await Promise.resolve();
    expect(autosuggestDependencies.timers[0].delay).toBe(10000);
    expect(autosuggestEvents).toEqual([]);
  });

  it('cancels an in-flight request without converting cancellation into an error', async () => {
    const dependencies = makeDependencies({
      fetch: vi.fn((url, options) => new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      })),
    });
    const events = [];
    const handle = createResponseStreamExecutor(dependencies).execute({
      kind: 'chat',
      messages: [],
      onEvent: (event) => events.push(event),
    });

    await vi.waitFor(() => expect(dependencies.fetch).toHaveBeenCalled());
    handle.cancel();
    await Promise.resolve();
    expect(events).toEqual([]);
  });
});
