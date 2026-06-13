import type { NextFunction, Request, Response } from 'express';

// In-memory sliding-window limiter. Sufficient for the single-process PM2
// deployment; swap the bucket store for Redis if the API ever runs multi-node.
type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
};

const buckets = new Map<string, number[]>();
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

function sweepStale(now: number, windowMs: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) {
    return;
  }
  lastSweep = now;
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((timestamp) => now - timestamp < windowMs);
    if (fresh.length === 0) {
      buckets.delete(key);
    } else {
      buckets.set(key, fresh);
    }
  }
}

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Integration suites fire many requests from one address; the limiter has
    // dedicated unit tests, so skip enforcement in test runs.
    if (process.env.NODE_ENV === 'test' && process.env.YOR_FORCE_RATE_LIMIT !== '1') {
      next();
      return;
    }
    const now = Date.now();
    sweepStale(now, options.windowMs);

    const identity = req.authUser?.id ?? req.ip ?? 'unknown';
    const key = `${options.keyPrefix}:${identity}`;
    const hits = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < options.windowMs);

    if (hits.length >= options.max) {
      res.status(429).json({ message: 'Too many requests. Please try again shortly.' });
      return;
    }

    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}
