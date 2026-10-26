import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { AppError } from './error-handler.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  max: number;
  windowMs: number;
  keyGenerator?: (req: AuthenticatedRequest) => string;
}

/**
 * Small, route-scoped limiter for the single Render instance.
 * Keys are authenticated user ids, never message text or tokens.
 */
export function createRateLimiter({ max, windowMs, keyGenerator = defaultKeyGenerator }: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = keyGenerator(req);
    const existing = entries.get(key);
    const entry = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs };

    // Opportunistically remove expired entries so this map cannot grow forever.
    if (entries.size > 1000) {
      for (const [entryKey, value] of entries) {
        if (value.resetAt <= now) entries.delete(entryKey);
      }
    }

    entry.count += 1;
    entries.set(key, entry);

    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(resetSeconds));
      next(new AppError('RATE_LIMITED', 'Reply generation limit reached. Please try again later.', 429, {
        retryAfterSeconds: resetSeconds,
      }));
      return;
    }

    next();
  };
}

function defaultKeyGenerator(req: AuthenticatedRequest): string {
  return req.userId ?? 'anonymous';
}
