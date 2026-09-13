import type { ProxyChatPayload, ProxyPurpose } from '../../src/shared/types';

export type ProxyEnv = {
  OPENAI_API_KEY: string;
  HMAC_SECRET: string;
  ENABLED?: string;
  ALLOWED_ORIGINS?: string;
  DEV_BYPASS_TOKEN?: string;
  RATE_LIMIT_KV: KVNamespaceLike;
  RATE_LIMITER?: RateLimiterNamespaceLike;
};

export type KVPutOptions = {
  expirationTtl?: number;
};

export type KVNamespaceLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: KVPutOptions): Promise<void>;
};

export type RateLimitStore = KVNamespaceLike & {
  delete?: (key: string) => Promise<boolean | void>;
};

export type RateLimiterNamespaceLike = {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export type RateLimitResult = {
  allowed: boolean;
  remaining?: number | null;
  reason?: string;
  retryAfter?: number;
};

export type ValidProxyPayload = ProxyChatPayload & {
  purpose?: ProxyPurpose;
};
