import { describe, expect, it, vi } from 'vitest';
import { classifyRateLimit, createRequestLog, writeRequestLog } from '../src/request-log.js';

function makeEnv() {
  return { ALLOWED_ORIGINS: 'chrome-extension://published-id' };
}

describe('request logging', () => {
  it('records only allowlisted metadata', () => {
    const request = new Request('https://proxy.workers.dev/chat?secret=do-not-log', {
      method: 'POST',
      headers: { Origin: 'chrome-extension://published-id' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'do not log this prompt' }] }),
    });
    const log = createRequestLog(request, makeEnv());

    expect(log).toMatchObject({ route: 'chat', origin: 'allowed', signature: 'unchecked' });
    expect(JSON.stringify(log)).not.toContain('do not log');
    expect(JSON.stringify(log)).not.toContain('secret');
  });

  it('classifies rate-limit decisions without retaining their full error text', () => {
    expect(classifyRateLimit('Rate limit: per-minute limit reached')).toBe('minute');
    expect(classifyRateLimit('Daily limit reached')).toBe('day');
    expect(classifyRateLimit('Service busy, try later')).toBe('global');
    expect(classifyRateLimit('IP blocked for abuse')).toBe('blocked');
  });

  it('emits one structured log object', () => {
    const logger = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createRequestLog(new Request('https://proxy.workers.dev/chat'), makeEnv());

    writeRequestLog(log);

    expect(logger).toHaveBeenCalledWith(log);
    logger.mockRestore();
  });
});
