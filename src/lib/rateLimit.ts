/**
 * Fixed-window rate limiter.
 *
 * Fixes audit finding S-4 (no rate limiting anywhere) and S-6 (the unauthenticated
 * verification endpoint could drain paid LLM/NewsAPI quota).
 *
 * In-process by design: it needs no infrastructure and is exactly correct for a
 * single instance (`next start`, a container, a VM).
 *
 * ON SERVERLESS (Vercel), READ THIS: each concurrent instance keeps its own
 * counters, so the effective limit is `limit × number of warm instances`, and
 * counters reset when an instance is recycled. That still blocks the abuse this
 * is here to stop — a single client hammering one endpoint — but it is NOT a
 * hard global quota. If you need one, swap `store` for Redis (Upstash works
 * well on Vercel); the `consume()` contract stays identical and no caller
 * changes.
 */

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the current window resets. */
  resetAt: number;
  /** Seconds the caller should wait. Only meaningful when `ok` is false. */
  retryAfter: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

/** Removes expired buckets so the map cannot grow without bound. */
function sweep(now: number) {
  if (store.size < 5000) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export function consume(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  sweep(now);

  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, limit, remaining: limit - 1, resetAt, retryAfter: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    ok: true,
    limit,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    retryAfter: 0,
  };
}

/** Test/maintenance helper. */
export function resetRateLimits() {
  store.clear();
}

/**
 * Best-effort client identity. Prefers the authenticated user, then the
 * proxy-forwarded IP, and falls back to a shared bucket so an unidentifiable
 * flood is still throttled rather than exempt.
 */
export function clientKey(request: Request, scope: string, userId?: string | null): string {
  if (userId) return `${scope}:user:${userId}`;

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

  return `${scope}:ip:${ip}`;
}

/** Standard headers so clients can back off intelligently. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
  };
  if (!result.ok) headers['Retry-After'] = String(result.retryAfter);
  return headers;
}

/** Policy table — one place to see every limit in the system. */
export const LIMITS = {
  login: { limit: 10, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  verify: { limit: 20, windowMs: 60 * 60_000 },
  check: { limit: 15, windowMs: 60 * 60_000 },
  read: { limit: 120, windowMs: 60_000 },
} as const;
