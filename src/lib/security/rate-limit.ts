import { env } from "@/lib/env";

/**
 * Rate limiter abstraction. Every auth/mutation endpoint is throttled per
 * identifier (email or IP) to blunt brute-force and enumeration
 * (codeguard-0-authentication-mfa, codeguard-0-api-web-services).
 *
 * Phase 1 ships a fixed-window in-memory limiter so the guard rails exist from
 * day one. It is swapped for a Redis token bucket in Phase 2 by implementing
 * `RateLimiter` - the call sites do not change.
 */
export interface RateLimiter {
  /** Returns true if the action is allowed, false if the limit is exceeded. */
  consume(key: string): Promise<boolean>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter implements RateLimiter {
  private readonly store = new Map<string, Bucket>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  async consume(key: string): Promise<boolean> {
    const now = Date.now();
    const bucket = this.store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count >= this.max) return false;
    bucket.count += 1;
    return true;
  }
}

export const authRateLimiter: RateLimiter = new InMemoryRateLimiter(
  env.AUTH_RATE_LIMIT_MAX,
  env.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000,
);

/** Extracts a best-effort client IP for rate-limit keys (never trusted for authZ). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
