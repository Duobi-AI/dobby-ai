// tests/api.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPort = {
  postMessage: vi.fn(),
  onMessage: { addListener: vi.fn() },
  onDisconnect: { addListener: vi.fn() },
  disconnect: vi.fn(),
};

global.chrome = {
  runtime: {
    connect: vi.fn(() => mockPort),
    lastError: null,
  },
};

const { requestChat } = await import('../src/content/api.js');

describe('requestChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.runtime.lastError = null;
  });

  it('connects to background with chat-stream port name', () => {
    requestChat([], vi.fn(), vi.fn(), vi.fn());
    expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: 'chat-stream' });
  });

  it('sends CHAT_REQUEST with messages', () => {
    const messages = [{ role: 'user', content: 'hi' }];
    requestChat(messages, vi.fn(), vi.fn(), vi.fn());
    expect(mockPort.postMessage).toHaveBeenCalledWith({
      type: 'CHAT_REQUEST',
      messages,
    });
  });

  it('calls onToken for token messages', () => {
    const onToken = vi.fn();
    requestChat([], onToken, vi.fn(), vi.fn());

    const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];
    messageHandler({ type: 'token', text: 'Hello' });
    expect(onToken).toHaveBeenCalledWith('Hello');
  });

  it('calls onDone and disconnects for done messages', () => {
    const onDone = vi.fn();
    requestChat([], vi.fn(), onDone, vi.fn());

    const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];
    messageHandler({ type: 'done' });
    expect(onDone).toHaveBeenCalled();
    expect(mockPort.disconnect).toHaveBeenCalled();
  });

  it('calls onError for error messages', () => {
    const onError = vi.fn();
    requestChat([], vi.fn(), vi.fn(), onError);

    const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];
    messageHandler({ type: 'error', code: 500, message: 'Server error' });
    expect(onError).toHaveBeenCalledWith(500, 'Server error');
  });

  it('calls onError with rate limit data', () => {
    const onError = vi.fn();
    requestChat([], vi.fn(), vi.fn(), onError);

    const messageHandler = mockPort.onMessage.addListener.mock.calls[0][0];
    messageHandler({ type: 'rate_limited', remaining: 0 });
    expect(onError).toHaveBeenCalledWith('RATE_LIMITED', expect.any(String), expect.objectContaining({ remaining: 0 }));
  });

  it('returns cancel function that disconnects port', () => {
    const handle = requestChat([], vi.fn(), vi.fn(), vi.fn());
    handle.cancel();
    expect(mockPort.disconnect).toHaveBeenCalled();
  });

  // Errata item 7: disconnect test
  it('calls onError on disconnect with lastError', () => {
    const onError = vi.fn();
    requestChat([], vi.fn(), vi.fn(), onError);
    chrome.runtime.lastError = { message: 'disconnected' };
    const disconnectHandler = mockPort.onDisconnect.addListener.mock.calls[0][0];
    disconnectHandler();
    expect(onError).toHaveBeenCalledWith('DISCONNECTED', 'Connection lost');
    chrome.runtime.lastError = null;
  });
});

describe('requestAutosuggest', () => {
  let requestAutosuggest, port;

  beforeEach(async () => {
    port = {
      postMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
      disconnect: vi.fn(),
    };
    chrome.runtime.connect = vi.fn(() => port);

    const mod = await import('../src/content/api.js');
    requestAutosuggest = mod.requestAutosuggest;
  });

  it('connects with autosuggest-stream port name', () => {
    requestAutosuggest([], vi.fn(), vi.fn(), vi.fn());
    expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: 'autosuggest-stream' });
  });

  it('sends AUTOSUGGEST_REQUEST message', () => {
    const messages = [{ role: 'user', content: 'hello' }];
    requestAutosuggest(messages, vi.fn(), vi.fn(), vi.fn());
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'AUTOSUGGEST_REQUEST', messages });
  });

  it('calls onToken for each token', () => {
    const onToken = vi.fn();
    requestAutosuggest([], onToken, vi.fn(), vi.fn());
    const handler = port.onMessage.addListener.mock.calls[0][0];
    handler({ type: 'token', text: 'world' });
    expect(onToken).toHaveBeenCalledWith('world');
  });

  it('calls onDone on completion', () => {
    const onDone = vi.fn();
    requestAutosuggest([], vi.fn(), onDone, vi.fn());
    const handler = port.onMessage.addListener.mock.calls[0][0];
    handler({ type: 'done' });
    expect(onDone).toHaveBeenCalled();
    expect(port.disconnect).toHaveBeenCalled();
  });

  it('forwards Retry-After details for an autosuggest rate limit', () => {
    const onError = vi.fn();
    requestAutosuggest([], vi.fn(), vi.fn(), onError);
    const handler = port.onMessage.addListener.mock.calls[0][0];

    handler({ type: 'rate_limited', remaining: 0, retryAfter: 300 });

    expect(onError).toHaveBeenCalledWith(
      'RATE_LIMITED',
      'Autosuggest limit reached',
      { retryAfter: 300 },
    );
  });

  it('returns cancel function that disconnects port', () => {
    const result = requestAutosuggest([], vi.fn(), vi.fn(), vi.fn());
    result.cancel();
    expect(port.disconnect).toHaveBeenCalled();
  });
});
