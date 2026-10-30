// A sliding-window rate limiter keyed by string. Counts are per server instance; a shared store would make them global.

interface RateLimiterOptions {
  /** Requests allowed per key inside one window. */
  limit: number;
  windowMs: number;
  /** Upper bound on remembered keys, so a flood of distinct keys cannot grow memory without limit. */
  maxTracked: number;
  /** Clock in milliseconds; injected so tests need no fake timers. */
  now?: () => number;
}

export interface RateLimiter {
  /** Records a request for `key` and reports whether it is over the limit. Rejected requests are not counted. */
  isLimited(key: string): boolean;
}

export function createRateLimiter({ limit, windowMs, maxTracked, now = Date.now }: RateLimiterOptions): RateLimiter {
  const hitsByKey = new Map<string, number[]>();

  function pruneIdleKeys(currentTime: number): void {
    for (const [key, hits] of hitsByKey) {
      const lastHit = hits.at(-1) ?? 0;
      if (currentTime - lastHit >= windowMs) {
        hitsByKey.delete(key);
      }
    }
  }

  function isLimited(key: string): boolean {
    const currentTime = now();
    const hitsInWindow = (hitsByKey.get(key) ?? []).filter((hit) => currentTime - hit < windowMs);

    if (hitsInWindow.length >= limit) {
      hitsByKey.set(key, hitsInWindow);
      return true;
    }

    hitsByKey.set(key, [...hitsInWindow, currentTime]);
    if (hitsByKey.size > maxTracked) {
      pruneIdleKeys(currentTime);
    }
    if (hitsByKey.size > maxTracked) {
      // Still full of active keys: trade accuracy for bounded memory by starting over.
      hitsByKey.clear();
    }
    return false;
  }

  return { isLimited };
}

/** The limiter shared by every AI route: 40 requests per client per 10 minutes. */
export const aiRateLimiter = createRateLimiter({ limit: 40, windowMs: 10 * 60_000, maxTracked: 5000 });
