// proxy/src/index.ts
import { validatePayload, verifyHmac } from './validate.js';
import { checkRateLimit, incrementCounters } from './rate-limit.js';
import { createChatStream } from './openai.js';
import { ACCESS_TOKEN_HEADER, issueAccessToken, verifyAccessToken } from './access-token.js';
import { classifyRateLimit, createRequestLog, writeRequestLog } from './request-log.js';
import { AUTOSUGGEST_MAX_SUGGESTION_TOKENS } from '../../src/shared/autosuggest-limits.js';
import type { ProxyPurpose } from '../../src/shared/types';
import type { ProxyEnv, ValidProxyPayload } from './types';

const MAX_BODY_SIZE = 2097152; // 2MB

function getCorsHeaders(request: Request, env: ProxyEnv): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const allowOrigin = allowed.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Dev-Token, X-Dobby-Access-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function corsResponse(request: Request, env: ProxyEnv): Response {
  return new Response(null, { status: 204, headers: getCorsHeaders(request, env) });
}

function jsonResponse(
  data: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...extraHeaders },
  });
}

export default {
  async fetch(request: Request, env: ProxyEnv): Promise<Response> {
    const startedAt = Date.now();
    const log = createRequestLog(request, env);
    const corsHeaders = getCorsHeaders(request, env);
    const respond = (
      outcome: typeof log.outcome,
      stage: typeof log.stage,
      response: Response,
      details: Partial<typeof log> = {},
    ): Response => {
      Object.assign(log, details, {
        outcome,
        stage,
        status: response.status,
        headers_duration_ms: Date.now() - startedAt,
      });
      writeRequestLog(log);
      return response;
    };

    if (request.method === 'OPTIONS') {
      return respond('preflight', 'routing', corsResponse(request, env));
    }

    const url = new URL(request.url);

    if (url.pathname !== '/chat' && url.pathname !== '/access-token') {
      return respond('not_found', 'routing', jsonResponse({ error: 'Not found' }, 404, corsHeaders));
    }

    if (request.method !== 'POST') {
      return respond('method_not_allowed', 'routing', jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders));
    }

    if (env.ENABLED === 'false') {
      return respond('disabled', 'routing', jsonResponse({ error: 'Service temporarily disabled' }, 503, corsHeaders));
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (url.pathname === '/access-token') {
      const tokenResult = await issueAccessToken(ip, env.RATE_LIMIT_KV);
      if ('error' in tokenResult) {
        return respond('access_token_limited', 'rate_check', jsonResponse(
          { error: tokenResult.error },
          429,
          corsHeaders,
          { 'Retry-After': String(tokenResult.retryAfter) }
        ));
      }
      return respond('access_token_issued', 'rate_check', jsonResponse(tokenResult, 200, corsHeaders));
    }

    // Read body as text and check size (Content-Length header is optional and can be omitted)
    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      return respond('body_read_failed', 'payload', jsonResponse({ error: 'Failed to read request body' }, 400, corsHeaders));
    }

    if (bodyText.length > MAX_BODY_SIZE) {
      return respond('body_too_large', 'payload', jsonResponse(
        { error: 'Request body too large (max 2MB)' }, 413, corsHeaders
      ), { body_chars: bodyText.length });
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return respond('invalid_json', 'payload', jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders), {
        body_chars: bodyText.length,
      });
    }

    const validation = validatePayload(body);
    if (!validation.valid) {
      return respond('invalid_payload', 'payload', jsonResponse(
        { error: (validation as { valid: false; error: string }).error }, 400, corsHeaders
      ), { body_chars: bodyText.length });
    }

    const hmacValid = await verifyHmac(body as ValidProxyPayload, env.HMAC_SECRET);
    if (!hmacValid) {
      return respond('invalid_signature', 'signature', jsonResponse(
        { error: 'Invalid signature' }, 403, corsHeaders
      ), { body_chars: bodyText.length, signature: 'invalid' });
    }

    const purpose: ProxyPurpose = (body as ValidProxyPayload).purpose || 'chat';
    const devBypass = env.DEV_BYPASS_TOKEN
      && request.headers.get('X-Dev-Token') === env.DEV_BYPASS_TOKEN;
    log.body_chars = bodyText.length;
    log.purpose = purpose === 'autosuggest' ? 'autosuggest' : 'chat';
    log.signature = 'valid';
    log.dev_bypass = Boolean(devBypass);
    const tokenResult = devBypass
      ? { valid: true as const, tokenHash: 'dev-bypass' }
      : await verifyAccessToken(request.headers.get(ACCESS_TOKEN_HEADER), ip, env.RATE_LIMIT_KV);
    if (!tokenResult.valid) {
      return respond('invalid_access_token', 'rate_check', jsonResponse(
        { error: tokenResult.reason }, 401, corsHeaders
      ));
    }

    const rateResult = devBypass
      ? { allowed: true, remaining: null }
      : await checkRateLimit(ip, env.RATE_LIMIT_KV, purpose, tokenResult.tokenHash);
    if (!rateResult.allowed) {
      return respond('rate_limited', 'rate_check', jsonResponse(
        { error: rateResult.reason, remaining: rateResult.remaining ?? 0 },
        429,
        corsHeaders,
        { 'Retry-After': String(rateResult.retryAfter || 60) }
      ), {
        remaining: rateResult.remaining ?? 0,
        rate_limit: classifyRateLimit(rateResult.reason),
      });
    }

    if (!devBypass) await incrementCounters(ip, env.RATE_LIMIT_KV, purpose, tokenResult.tokenHash);

    const maxTokens = purpose === 'autosuggest' ? AUTOSUGGEST_MAX_SUGGESTION_TOKENS : undefined;
    let openaiResponse: Response;
    try {
      openaiResponse = await createChatStream((body as ValidProxyPayload).messages, env.OPENAI_API_KEY, undefined, maxTokens);
    } catch {
      writeRequestLog({ ...log, stage: 'upstream', outcome: 'exception', headers_duration_ms: Date.now() - startedAt });
      throw new Error('OpenAI request failed');
    }

    if (!openaiResponse.ok) {
      return respond('upstream_error', 'upstream', jsonResponse(
        { error: 'Upstream error' }, 502, corsHeaders
      ), { upstream_status: openaiResponse.status });
    }

    return respond('stream_started', 'upstream', new Response(openaiResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...(rateResult.remaining != null ? { 'X-RateLimit-Remaining': String(rateResult.remaining) } : {}),
        ...corsHeaders,
      },
    }));
  },
};
