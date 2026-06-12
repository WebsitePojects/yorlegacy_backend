import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rateLimit } from './rate-limit.js';

beforeAll(() => {
  process.env.YOR_FORCE_RATE_LIMIT = '1';
});

afterAll(() => {
  delete process.env.YOR_FORCE_RATE_LIMIT;
});

function makeRes() {
  const res: { statusCode: number; body: unknown; status: (code: number) => typeof res; json: (body: unknown) => void } = {
    statusCode: 0,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
    }
  };
  return res;
}

describe('rateLimit', () => {
  it('allows requests under the limit and blocks the request over it', () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 3, keyPrefix: 'test-a' });
    const req = { ip: '1.2.3.4' } as never;

    for (let index = 0; index < 3; index += 1) {
      const res = makeRes();
      const next = vi.fn();
      middleware(req, res as never, next);
      expect(next).toHaveBeenCalledOnce();
    }

    const blockedRes = makeRes();
    const blockedNext = vi.fn();
    middleware(req, blockedRes as never, blockedNext);
    expect(blockedNext).not.toHaveBeenCalled();
    expect(blockedRes.statusCode).toBe(429);
  });

  it('tracks limits per IP', () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: 'test-b' });

    const firstRes = makeRes();
    const firstNext = vi.fn();
    middleware({ ip: '1.1.1.1' } as never, firstRes as never, firstNext);
    expect(firstNext).toHaveBeenCalledOnce();

    const otherRes = makeRes();
    const otherNext = vi.fn();
    middleware({ ip: '2.2.2.2' } as never, otherRes as never, otherNext);
    expect(otherNext).toHaveBeenCalledOnce();
  });

  it('resets after the window passes', () => {
    vi.useFakeTimers();
    try {
      const middleware = rateLimit({ windowMs: 1000, max: 1, keyPrefix: 'test-c' });
      const req = { ip: '3.3.3.3' } as never;

      middleware(req, makeRes() as never, vi.fn());

      const blockedRes = makeRes();
      middleware(req, blockedRes as never, vi.fn());
      expect(blockedRes.statusCode).toBe(429);

      vi.advanceTimersByTime(1100);

      const allowedNext = vi.fn();
      middleware(req, makeRes() as never, allowedNext);
      expect(allowedNext).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
