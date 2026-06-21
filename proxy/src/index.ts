// proxy/src/index.ts
import { validatePayload, verifyHmac } from './validate.js';
import { checkRateLimit, incrementCounters } from './rate-limit.js';
import { createChatStream } from './openai.js';
import { ACCESS_TOKEN_HEADER, issueAccessToken, verifyAccessToken } from './access-token.js';
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
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return corsResponse(request, env);
    }

    const url = new URL(request.url);

    if (url.pathname !== '/chat' && url.pathname !== '/access-token') {
      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    if (env.ENABLED === 'false') {
      return jsonResponse({ error: 'Service temporarily disabled' }, 503, corsHeaders);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (url.pathname === '/access-token') {
      const tokenResult = await issueAccessToken(ip, env.RATE_LIMIT_KV);
      if ('error' in tokenResult) {
        return jsonResponse(
          { error: tokenResult.error },
          429,
          corsHeaders,
          { 'Retry-After': String(tokenResult.retryAfter) }
        );
      }
      return jsonResponse(tokenResult, 200, corsHeaders);
    }

    // Read body as text and check size (Content-Length header is optional and can be omitted)
    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      return jsonResponse({ error: 'Failed to read request body' }, 400, corsHeaders);
    }

    if (bodyText.length > MAX_BODY_SIZE) {
      return jsonResponse({ error: 'Request body too large (max 2MB)' }, 413, corsHeaders);
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
    }

    const validation = validatePayload(body);
    if (!validation.valid) {
      return jsonResponse({ error: (validation as { valid: false; error: string }).error }, 400, corsHeaders);
    }

    const hmacValid = await verifyHmac(body as ValidProxyPayload, env.HMAC_SECRET);
    if (!hmacValid) {
      return jsonResponse({ error: 'Invalid signature' }, 403, corsHeaders);
    }

    const purpose: ProxyPurpose = (body as ValidProxyPayload).purpose || 'chat';
    const devBypass = env.DEV_BYPASS_TOKEN
      && request.headers.get('X-Dev-Token') === env.DEV_BYPASS_TOKEN;
    const tokenResult = devBypass
      ? { valid: true as const, tokenHash: 'dev-bypass' }
      : await verifyAccessToken(request.headers.get(ACCESS_TOKEN_HEADER), ip, env.RATE_LIMIT_KV);
    if (!tokenResult.valid) {
      return jsonResponse({ error: tokenResult.reason }, 401, corsHeaders);
    }

    const rateResult = devBypass
      ? { allowed: true, remaining: null }
      : await checkRateLimit(ip, env.RATE_LIMIT_KV, purpose, tokenResult.tokenHash);
    if (!rateResult.allowed) {
      return jsonResponse(
        { error: rateResult.reason, remaining: rateResult.remaining ?? 0 },
        429,
        corsHeaders,
        { 'Retry-After': String(rateResult.retryAfter || 60) }
      );
    }

    if (!devBypass) await incrementCounters(ip, env.RATE_LIMIT_KV, purpose, tokenResult.tokenHash);

    const maxTokens = purpose === 'autosuggest' ? AUTOSUGGEST_MAX_SUGGESTION_TOKENS : undefined;
    const openaiResponse = await createChatStream((body as ValidProxyPayload).messages, env.OPENAI_API_KEY, undefined, maxTokens);

    if (!openaiResponse.ok) {
      return jsonResponse({ error: 'Upstream error' }, 502, corsHeaders);
    }

    return new Response(openaiResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...(rateResult.remaining != null ? { 'X-RateLimit-Remaining': String(rateResult.remaining) } : {}),
        ...corsHeaders,
      },
    });
  },
};
