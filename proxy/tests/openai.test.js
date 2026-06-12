// proxy/tests/openai.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChatStream } from '../src/openai.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('createChatStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls OpenAI with correct headers and body', async () => {
    mockFetch.mockResolvedValue({ ok: true, body: 'stream' });

    const messages = [{ role: 'user', content: 'hello' }];
    await createChatStream(messages, 'sk-test-key');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer sk-test-key',
        },
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-5.4-mini');
    expect(body.messages).toEqual(messages);
    expect(body.stream).toBe(true);
    expect(body.reasoning_effort).toBe('none');
    expect(body.max_completion_tokens).toBe(1000);
  });

  it('passes abort signal when provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, body: 'stream' });
    const controller = new AbortController();

    await createChatStream([{ role: 'user', content: 'hi' }], 'sk-key', controller.signal);

    expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('returns the fetch response directly', async () => {
    const fakeResponse = { ok: true, body: 'fake-stream', status: 200 };
    mockFetch.mockResolvedValue(fakeResponse);

    const result = await createChatStream([{ role: 'user', content: 'hi' }], 'sk-key');
    expect(result).toBe(fakeResponse);
  });

  it('returns error response without throwing', async () => {
    const errorResponse = { ok: false, status: 401, body: null };
    mockFetch.mockResolvedValue(errorResponse);

    const result = await createChatStream([{ role: 'user', content: 'hi' }], 'sk-key');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it('uses custom maxTokens when provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, body: 'stream' });

    await createChatStream([{ role: 'user', content: 'hi' }], 'sk-key', undefined, 200);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.max_completion_tokens).toBe(200);
  });

  it('falls back to default max_completion_tokens when maxTokens is not provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, body: 'stream' });

    await createChatStream([{ role: 'user', content: 'hi' }], 'sk-key');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.max_completion_tokens).toBe(1000);
  });
});
