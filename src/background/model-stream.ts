// Response request execution shared by the Chat response and Autosuggestion adapters.

import { AUTOSUGGEST_MAX_SUGGESTION_TOKENS } from '../shared/autosuggest-limits.js';
import { DEFAULT_OPENAI_MODEL, DEFAULT_REASONING_EFFORT } from '../shared/model-config.js';
import { getLocalStorage, removeLocalStorage, setLocalStorage } from '../shared/storage.js';
import {
  clearAutosuggestCooldown,
  getAutosuggestCooldownRemaining,
  recordAutosuggestRateLimit,
} from './autosuggest-cooldown.js';
import {
  clearProxyCooldown,
  getProxyCooldownRemaining,
  ProxyCooldownError,
  recordProxyTemporaryFailure,
} from './proxy-cooldown.js';
import type {
  ChatMessage,
  UsageRequestKind,
  UsageState,
  UsageUpdateDetails,
} from '../shared/types';

const PROXY_BASE_URL = 'https://dobby-ai-proxy.zhongnansu.workers.dev';
const PROXY_URL = `${PROXY_BASE_URL}/chat`;
const PROXY_ACCESS_TOKEN_URL = `${PROXY_BASE_URL}/access-token`;
const USAGE_STORAGE_KEY = 'dobbyUsage';
const PROXY_ACCESS_TOKEN_STORAGE_KEY = 'proxyAccessToken';
const PROXY_ACCESS_TOKEN_HEADER = 'X-Dobby-Access-Token';
// HMAC_SECRET is intentionally in extension source — it is request-shape validation, not auth.
// Free proxy calls also require a server-issued access token and proxy-side quota checks.
const HMAC_SECRET = 'dobby-ai-v2-hmac-key-change-in-production';
// Set to your dev token to bypass rate limits during development; leave empty for normal user behavior
const DEV_BYPASS_TOKEN = '';
let proxyAccessTokenRequest: Promise<string> | null = null;

export type ResponseStreamKind = 'chat' | 'autosuggest';

export type ResponseStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; remaining: number | null; usingOwnKey: boolean }
  | { type: 'rate_limited'; remaining: number; resetAt?: string | number; retryAfter?: number }
  | { type: 'error'; code: number; message: string };

export type ResponseStreamRequest = {
  kind: ResponseStreamKind;
  messages: ChatMessage[];
  onEvent: (event: ResponseStreamEvent) => void;
};

export type ResponseStreamHandle = {
  cancel: () => void;
  completion: Promise<void>;
};

type ResponseStreamDependencies = {
  readUserApiKey: () => Promise<string | undefined>;
  fetch: typeof globalThis.fetch;
  fetchProxy: (
    messages: ChatMessage[],
    purpose: ResponseStreamKind,
    signal: AbortSignal,
    auth: { timestamp: number; signature: string },
  ) => Promise<Response>;
  getAutosuggestCooldownRemaining: () => Promise<number>;
  recordAutosuggestRateLimit: (retryAfterHeader: string | null) => Promise<number>;
  clearAutosuggestCooldown: () => Promise<void>;
  now: () => number;
  sign: (messages: ChatMessage[], timestamp: number, secret: string) => Promise<string>;
  recordUsage: (kind: UsageRequestKind, details?: UsageUpdateDetails) => Promise<void>;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
};

function getUtcDay(): string {
  return new Date().toISOString().split('T')[0]!;
}

function createEmptyUsage(): UsageState {
  return {
    day: getUtcDay(),
    chatRequests: 0,
    autosuggestRequests: 0,
    screenshotRequests: 0,
    freeChatRemaining: null,
    usingOwnKey: false,
    lastUpdated: Date.now(),
  };
}

export async function recordUsage(kind: UsageRequestKind, details: UsageUpdateDetails = {}): Promise<void> {
  try {
    const stored = await getLocalStorage(USAGE_STORAGE_KEY);
    const current = stored[USAGE_STORAGE_KEY];
    const usage = current && current.day === getUtcDay() ? { ...current } : createEmptyUsage();

    if (!details.rateLimited) {
      if (kind === 'chat') usage.chatRequests = (usage.chatRequests || 0) + 1;
      if (kind === 'autosuggest') usage.autosuggestRequests = (usage.autosuggestRequests || 0) + 1;
      if (kind === 'screenshot') usage.screenshotRequests = (usage.screenshotRequests || 0) + 1;
    }

    if (kind === 'chat' && details.remaining != null && !details.usingOwnKey) {
      usage.freeChatRemaining = details.remaining;
    }
    if (details.remaining === 0 && !details.usingOwnKey) {
      usage.freeChatRemaining = 0;
    }
    if (details.usingOwnKey != null) {
      usage.usingOwnKey = details.usingOwnKey;
    }
    usage.lastUpdated = Date.now();

    await setLocalStorage({ [USAGE_STORAGE_KEY]: usage });
  } catch (e) {
    console.warn('[Dobby AI] Failed to record usage:', (e as Error).message);
  }
}

export async function generateSignature(
  messages: ChatMessage[],
  timestamp: number,
  secret: string,
): Promise<string> {
  const payload = `${timestamp}${JSON.stringify(messages)}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        console.warn('[Dobby AI] Skipping malformed SSE JSON:', data);
      }
    }
  }
}

type FetchRequest = typeof globalThis.fetch;

function isTemporaryProxyStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

async function fetchProxyAccessToken(fetchRequest: FetchRequest): Promise<string> {
  let response: Response;
  try {
    response = await fetchRequest(PROXY_ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    const retryAfter = await recordProxyTemporaryFailure(null);
    throw new ProxyCooldownError(retryAfter);
  }

  if (!response.ok) {
    if (response.status === 429 || isTemporaryProxyStatus(response.status)) {
      const retryAfter = await recordProxyTemporaryFailure(response.headers.get('Retry-After'));
      throw new ProxyCooldownError(retryAfter);
    }
    let errBody = '';
    try { errBody = await response.text(); } catch { /* keep generic error */ }
    throw new Error(errBody
      ? `Proxy access token failed (${response.status}): ${errBody.substring(0, 200)}`
      : 'Proxy access token failed');
  }

  const data = await response.json() as { token?: string };
  if (!data.token) throw new Error('Proxy access token response was missing token');

  await setLocalStorage({ [PROXY_ACCESS_TOKEN_STORAGE_KEY]: data.token });
  await clearProxyCooldown();
  return data.token;
}

async function getProxyAccessToken(
  fetchRequest: FetchRequest,
  forceRefresh: boolean,
): Promise<string> {
  if (!forceRefresh) {
    const stored = await getLocalStorage(PROXY_ACCESS_TOKEN_STORAGE_KEY);
    if (stored.proxyAccessToken) return stored.proxyAccessToken;
  } else {
    await removeLocalStorage(PROXY_ACCESS_TOKEN_STORAGE_KEY);
  }

  if (!proxyAccessTokenRequest) {
    const request = (async () => {
      const retryAfter = await getProxyCooldownRemaining();
      if (retryAfter > 0) throw new ProxyCooldownError(retryAfter);
      return fetchProxyAccessToken(fetchRequest);
    })();
    proxyAccessTokenRequest = request;
    void request.then(
      () => { if (proxyAccessTokenRequest === request) proxyAccessTokenRequest = null; },
      () => { if (proxyAccessTokenRequest === request) proxyAccessTokenRequest = null; },
    );
  }
  return proxyAccessTokenRequest;
}

async function fetchViaProxy(
  messages: ChatMessage[],
  purpose: ResponseStreamKind,
  signal: AbortSignal,
  auth: { timestamp: number; signature: string },
  fetchRequest: FetchRequest,
): Promise<Response> {
  const retryAfter = await getProxyCooldownRemaining();
  if (retryAfter > 0) throw new ProxyCooldownError(retryAfter);

  const request = async (forceRefreshToken: boolean): Promise<Response> => {
    const token = await getProxyAccessToken(fetchRequest, forceRefreshToken);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      [PROXY_ACCESS_TOKEN_HEADER]: token,
    };
    if (DEV_BYPASS_TOKEN) headers['X-Dev-Token'] = DEV_BYPASS_TOKEN;
    const body = purpose === 'autosuggest'
      ? { messages, signature: auth.signature, timestamp: auth.timestamp, purpose }
      : { messages, signature: auth.signature, timestamp: auth.timestamp };

    return fetchRequest(PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
  };

  const response = await request(false);
  if (isTemporaryProxyStatus(response.status)) {
    const retryAfter = await recordProxyTemporaryFailure(response.headers.get('Retry-After'));
    throw new ProxyCooldownError(retryAfter);
  }
  if (response.status !== 401) return response;

  const refreshedResponse = await request(true);
  if (isTemporaryProxyStatus(refreshedResponse.status)) {
    const retryAfter = await recordProxyTemporaryFailure(refreshedResponse.headers.get('Retry-After'));
    throw new ProxyCooldownError(retryAfter);
  }
  return refreshedResponse;
}

const productionDependencies: ResponseStreamDependencies = {
  readUserApiKey: async () => (await getLocalStorage('userApiKey')).userApiKey,
  fetch: (...args) => globalThis.fetch(...args),
  fetchProxy: (messages, purpose, signal, auth) => fetchViaProxy(
    messages,
    purpose,
    signal,
    auth,
    (...args) => globalThis.fetch(...args),
  ),
  getAutosuggestCooldownRemaining,
  recordAutosuggestRateLimit,
  clearAutosuggestCooldown,
  now: () => Date.now(),
  sign: generateSignature,
  recordUsage,
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};

type RequestConfig = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

function requestBody(kind: ResponseStreamKind, messages: ChatMessage[], apiKey?: string): RequestConfig {
  if (apiKey) {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_OPENAI_MODEL,
        messages,
        stream: true,
        reasoning_effort: DEFAULT_REASONING_EFFORT,
        max_completion_tokens: kind === 'chat' ? 1000 : AUTOSUGGEST_MAX_SUGGESTION_TOKENS,
      }),
    };
  }

  return {
    url: PROXY_URL,
    headers: {},
    body: '',
  };
}

export function createResponseStreamExecutor(
  overrides: Partial<ResponseStreamDependencies> = {},
): { execute: (request: ResponseStreamRequest) => ResponseStreamHandle } {
  const dependencies = { ...productionDependencies, ...overrides };

  return {
    execute(request): ResponseStreamHandle {
      const controller = new AbortController();
      let timedOut = false;
      const timeout = dependencies.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, request.kind === 'chat' ? 30000 : 10000);

      const run = async (): Promise<void> => {
        try {
          const apiKey = await dependencies.readUserApiKey();
          if (controller.signal.aborted) return;

          const timestamp = Math.floor(dependencies.now() / 1000);
          const requestConfig = requestBody(request.kind, request.messages, apiKey);
          let proxyAuth: { timestamp: number; signature: string } | undefined;
          if (!apiKey && request.kind === 'autosuggest') {
            const retryAfter = await dependencies.getAutosuggestCooldownRemaining();
            if (retryAfter > 0) {
              request.onEvent({ type: 'rate_limited', remaining: 0, retryAfter });
              return;
            }
          }
          if (!apiKey) {
            proxyAuth = {
              timestamp,
              signature: await dependencies.sign(request.messages, timestamp, HMAC_SECRET),
            };
          }

          const response = apiKey
            ? await dependencies.fetch(requestConfig.url, {
              method: 'POST',
              headers: requestConfig.headers,
              body: requestConfig.body,
              signal: controller.signal,
            })
            : await dependencies.fetchProxy(request.messages, request.kind, controller.signal, proxyAuth!);

          if (response.status === 429) {
            let data: { remaining?: number; resetAt?: string | number };
            try {
              data = await response.json();
            } catch {
              if (request.kind === 'chat') {
                console.warn('[Dobby AI] Failed to parse rate limit response');
              }
              data = { remaining: 0 };
            }
            const retryAfter = request.kind === 'autosuggest'
              ? await dependencies.recordAutosuggestRateLimit(response.headers.get('Retry-After'))
              : undefined;
            await dependencies.recordUsage(request.kind, {
              remaining: data.remaining ?? 0,
              usingOwnKey: false,
              rateLimited: true,
            });
            request.onEvent({ type: 'rate_limited', remaining: data.remaining ?? 0, resetAt: data.resetAt, retryAfter });
            return;
          }

          if (!response.ok) {
            let errBody = '';
            try {
              errBody = await response.text();
            } catch {
              // Keep the existing generic error outcome when the body is unreadable.
            }
            const prefix = request.kind === 'chat'
              ? `Request failed (${response.status})`
              : 'Autosuggest request failed:';
            const message = request.kind === 'chat'
              ? (errBody ? `${prefix}: ${errBody.substring(0, 200)}` : 'Request failed')
              : `${prefix} ${errBody.substring(0, 200)}`;
            console.error(`[Dobby AI] ${request.kind === 'chat' ? 'API' : 'Autosuggest API'} error:`, response.status, errBody);
            request.onEvent({ type: 'error', code: response.status, message });
            return;
          }

          const usingOwnKey = !!apiKey;
          const remaining = request.kind === 'chat' && !usingOwnKey
            ? parseInt(response.headers.get('X-RateLimit-Remaining') || '', 10) || 0
            : null;
          const reader = response.body!.getReader();
          for await (const token of parseSSEStream(reader)) {
            request.onEvent({ type: 'token', text: token });
          }
          await dependencies.recordUsage(request.kind, {
            remaining: request.kind === 'chat' ? remaining : undefined,
            usingOwnKey,
          });
          if (!apiKey && request.kind === 'autosuggest') {
            await dependencies.clearAutosuggestCooldown();
          }
          request.onEvent({ type: 'done', remaining, usingOwnKey });
        } catch (err) {
          if (controller.signal.aborted || (err as Error).name === 'AbortError') {
            if (timedOut && request.kind === 'chat') {
              request.onEvent({ type: 'error', code: 0, message: 'Request timed out' });
            }
            return;
          }
          const code = err instanceof ProxyCooldownError ? err.status : 0;
          request.onEvent({ type: 'error', code, message: (err as Error).message });
        } finally {
          dependencies.clearTimeout(timeout);
        }
      };

      const completion = run();
      return { cancel: () => controller.abort(), completion };
    },
  };
}

export const responseStreamExecutor = createResponseStreamExecutor();
