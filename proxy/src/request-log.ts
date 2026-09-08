import type { ProxyEnv } from './types';

export type RequestLog = {
  event: 'dobby_request';
  request_id: string;
  method: string;
  route: 'chat' | 'access_token' | 'other';
  origin: 'allowed' | 'missing' | 'other';
  country?: string;
  asn?: number;
  purpose: 'unknown' | 'chat' | 'autosuggest' | 'invalid';
  signature: 'unchecked' | 'valid' | 'invalid';
  dev_bypass: boolean;
  stage: 'routing' | 'payload' | 'signature' | 'rate_check' | 'rate_write' | 'upstream';
  outcome: 'preflight' | 'not_found' | 'method_not_allowed' | 'disabled' |
    'access_token_issued' | 'access_token_limited' |
    'invalid_access_token' |
    'body_read_failed' | 'body_too_large' | 'invalid_json' | 'invalid_payload' |
    'invalid_signature' | 'rate_limited' | 'upstream_error' | 'stream_started' | 'exception';
  status?: number;
  body_chars?: number;
  remaining?: number;
  rate_limit?: 'minute' | 'day' | 'global' | 'blocked' | 'other';
  upstream_status?: number;
  headers_duration_ms?: number;
};

// Allowlist fields and values: never log raw bodies, headers, URLs, or error messages.
export function createRequestLog(request: Request, env: ProxyEnv): RequestLog {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const cf = (request as Request & { cf?: { country?: unknown; asn?: unknown } }).cf;
  return {
    event: 'dobby_request',
    request_id: crypto.randomUUID(),
    method: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(request.method)
      ? request.method : 'OTHER',
    route: new URL(request.url).pathname === '/chat'
      ? 'chat'
      : new URL(request.url).pathname === '/access-token' ? 'access_token' : 'other',
    origin: !origin ? 'missing' : allowed.includes(origin) ? 'allowed' : 'other',
    country: typeof cf?.country === 'string' && /^[A-Z]{2}$/.test(cf.country) ? cf.country : undefined,
    asn: typeof cf?.asn === 'number' && Number.isSafeInteger(cf.asn) && cf.asn > 0 ? cf.asn : undefined,
    purpose: 'unknown',
    signature: 'unchecked',
    dev_bypass: false,
    stage: 'routing',
    outcome: 'exception',
  };
}

export function classifyRateLimit(reason?: string): RequestLog['rate_limit'] {
  switch (reason) {
    case 'Rate limit: per-minute limit reached': return 'minute';
    case 'Daily limit reached': return 'day';
    case 'Service busy, try later': return 'global';
    case 'IP blocked for abuse': return 'blocked';
    default: return 'other';
  }
}

export function writeRequestLog(log: RequestLog): void {
  // An unavailable log sink must never interrupt the proxy or its response stream.
  try { console.log(log); } catch { /* best effort */ }
}
