import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Distributed rate limiting backed by Upstash Redis — safe across Vercel
 * serverless instances (unlike in-memory counters). Without configured
 * Redis credentials the limiter is a permissive no-op so local development
 * is not blocked; production MUST set UPSTASH_REDIS_* env vars.
 */

export const RATE_TIERS = {
  public: { requests: 60, window: "60 s" },
  auth: { requests: 5, window: "60 s" },
  booking: { requests: 10, window: "60 s" },
  admin: { requests: 30, window: "60 s" },
} as const;

export type RateTier = keyof typeof RATE_TIERS;

function buildLimiter(tier: RateTier): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const { requests, window } = RATE_TIERS[tier];
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window as `${number} s`),
    analytics: true,
  });
}

export type RateLimitResult =
  | { success: true }
  | { success: false; retryAfterSeconds: number };

export async function rateLimit(
  identifier: string,
  tier: RateTier,
): Promise<RateLimitResult> {
  const limiter = buildLimiter(tier);
  if (!limiter) return { success: true };

  const { success, reset } = await limiter.limit(`${tier}:${identifier}`);
  if (success) return { success: true };

  return {
    success: false,
    retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
  };
}

/** Client IP from request headers (works behind Vercel's proxy). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
