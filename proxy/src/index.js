// proxy/src/index.js
import { validatePayload, verifyHmac } from './validate.js';
import { createChatStream } from './openai.js';
import { AUTOSUGGEST_MAX_SUGGESTION_TOKENS } from '../../src/shared/autosuggest-limits.js';

export { RateLimiter } from './rate-limit-do.js';

// Routes an atomic check-and-increment through the per-IP RateLimiter Durable Object.
// All rate-limit reads and writes happen inside the DO so they are strongly
// consistent and serialized (no read-then-write race across concurrent requests).
async function checkRateLimitDO(env, ip, purpose) {
  const id = env.RATE_LIMITER.idFromName(ip);
  const stub = env.RATE_LIMITER.get(id);
  const res = await stub.fetch('https://rate-limiter/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, purpose }),
  });
  return res.json();
}

const MAX_BODY_SIZE = 2097152; // 2MB

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const allowOrigin = allowed.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Dev-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function corsResponse(request, env) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request, env) });
}

function jsonResponse(data, status = 200, corsHeaders = {}, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...extraHeaders },
  });
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return corsResponse(request, env);
    }

    const url = new URL(request.url);

    if (url.pathname !== '/chat') {
      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    if (env.ENABLED === 'false') {
      return jsonResponse({ error: 'Service temporarily disabled' }, 503, corsHeaders);
    }

    // Read body as text and check size (Content-Length header is optional and can be omitted)
    let bodyText;
    try {
      bodyText = await request.text();
    } catch {
      return jsonResponse({ error: 'Failed to read request body' }, 400, corsHeaders);
    }

    if (bodyText.length > MAX_BODY_SIZE) {
      return jsonResponse({ error: 'Request body too large (max 2MB)' }, 413, corsHeaders);
    }

    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
    }

    const validation = validatePayload(body);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400, corsHeaders);
    }

    const hmacValid = await verifyHmac(body, env.HMAC_SECRET);
    if (!hmacValid) {
      return jsonResponse({ error: 'Invalid signature' }, 403, corsHeaders);
    }

    const purpose = body.purpose || 'chat';
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const devBypass = env.DEV_BYPASS_TOKEN
      && request.headers.get('X-Dev-Token') === env.DEV_BYPASS_TOKEN;
    const rateResult = devBypass
      ? { allowed: true, remaining: null }
      : await checkRateLimitDO(env, ip, purpose);
    if (!rateResult.allowed) {
      return jsonResponse(
        { error: rateResult.reason, remaining: rateResult.remaining ?? 0 },
        429,
        corsHeaders,
        { 'Retry-After': String(rateResult.retryAfter || 60) }
      );
    }

    const maxTokens = purpose === 'autosuggest' ? AUTOSUGGEST_MAX_SUGGESTION_TOKENS : undefined;
    const openaiResponse = await createChatStream(body.messages, env.OPENAI_API_KEY, undefined, maxTokens);

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
