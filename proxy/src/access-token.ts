// proxy/src/access-token.ts - Server-issued access tokens for free proxy calls
import type { KVNamespaceLike } from './types';

export const ACCESS_TOKEN_HEADER = 'X-Dobby-Access-Token';

const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const TOKEN_BYTES = 32;
const ISSUE_LIMIT_PER_DAY = 10;

type StoredAccessToken = {
  ip: string;
  createdAt: number;
  expiresAt: number;
};

type IssuedAccessToken = {
  token: string;
  expiresAt: string;
};

type AccessTokenIssueLimit = {
  error: string;
  retryAfter: number;
};

type AccessTokenValidation =
  | { valid: true; tokenHash: string }
  | { valid: false; reason: string };

function dayBucket(): string {
  return new Date().toISOString().split('T')[0]!;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function issueAccessToken(
  ip: string,
  kv: KVNamespaceLike,
): Promise<IssuedAccessToken | AccessTokenIssueLimit> {
  const issueKey = `access:issue:${ip}:${dayBucket()}`;
  const issueCount = await kv.get(issueKey).then((value) => parseInt(value!) || 0);
  if (issueCount >= ISSUE_LIMIT_PER_DAY) {
    return { error: 'Access token issuance limit reached', retryAfter: 3600 };
  }

  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  const token = base64Url(bytes);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + ACCESS_TOKEN_TTL_SECONDS * 1000;
  const record: StoredAccessToken = { ip, createdAt: now, expiresAt };

  await Promise.all([
    kv.put(issueKey, String(issueCount + 1), { expirationTtl: 86400 }),
    kv.put(`access:${tokenHash}`, JSON.stringify(record), { expirationTtl: ACCESS_TOKEN_TTL_SECONDS }),
  ]);

  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export async function verifyAccessToken(
  token: string | null,
  ip: string,
  kv: KVNamespaceLike,
): Promise<AccessTokenValidation> {
  if (!token) {
    return { valid: false, reason: 'missing proxy access token' };
  }

  const tokenHash = await sha256Hex(token);
  const raw = await kv.get(`access:${tokenHash}`);
  if (!raw) {
    return { valid: false, reason: 'invalid proxy access token' };
  }

  let record: StoredAccessToken;
  try {
    record = JSON.parse(raw) as StoredAccessToken;
  } catch {
    return { valid: false, reason: 'invalid proxy access token' };
  }

  if (record.expiresAt <= Date.now()) {
    return { valid: false, reason: 'expired proxy access token' };
  }

  if (record.ip !== ip) {
    return { valid: false, reason: 'proxy access token IP mismatch' };
  }

  return { valid: true, tokenHash };
}
