export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  intervalMs: number;
  maxRequests: number;
  maxTrackedIps?: number;
}

const globalForRateLimit = globalThis as unknown as {
  rateLimitStore?: Map<string, RateLimitEntry>;
};

const store =
  globalForRateLimit.rateLimitStore ?? new Map<string, RateLimitEntry>();

if (process.env.NODE_ENV !== 'production') {
  globalForRateLimit.rateLimitStore = store;
}

export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const { intervalMs, maxRequests, maxTrackedIps = 5000 } = options;
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetTime) {
    if (!existing && store.size >= maxTrackedIps) {
      const oldestKey = store.keys().next().value;
      if (oldestKey !== undefined) {
        store.delete(oldestKey);
      }
    }

    const resetTime = now + intervalMs;
    store.set(key, { count: 1, resetTime });

    return {
      allowed: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - 1),
      resetInSeconds: Math.ceil(intervalMs / 1000),
    };
  }

  existing.count += 1;
  const resetInSeconds = Math.max(
    1,
    Math.ceil((existing.resetTime - now) / 1000)
  );

  if (existing.count > maxRequests) {
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetInSeconds,
    };
  }

  return {
    allowed: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - existing.count),
    resetInSeconds,
  };
}

export function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || '127.0.0.1';
  }

  return '127.0.0.1';
}

