import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const authIpStore = new Map<string, RateLimitRecord>();

// Periodic cleanup every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of authIpStore.entries()) {
    if (now > record.resetTime) {
      authIpStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export interface RateLimitOptions {
  windowMs?: number; // Time window in ms
  max?: number;      // Max allowed requests in the window
  message?: string;
}

/**
 * In-memory sliding rate limiter middleware for authentication routes.
 * Protects against credential brute-forcing, dictionary attacks, and denial of service.
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const max = options.max || (process.env.NODE_ENV === 'test' ? 1000 : 30); // 30 req/min default, high in tests
  const message = options.message || 'Too many authentication attempts. Please try again later.';

  return (req: Request, res: Response, next: NextFunction): void => {
    // If rate limiting is explicitly disabled in environment, pass through
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.baseUrl}${req.path}:${ip}`;
    const now = Date.now();

    const record = authIpStore.get(key);

    if (!record || now > record.resetTime) {
      authIpStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', max - 1);
      res.setHeader('RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      const retryAfterSecs = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSecs);
      res.status(429).json({
        error: message,
        retryAfter: retryAfterSecs,
      });
      return;
    }

    next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  message: 'Too many authentication attempts. Please slow down and try again later.',
});
