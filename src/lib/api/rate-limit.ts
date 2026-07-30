/**
 * Throttling for the write endpoints.
 *
 * A fixed-window counter held in process memory, for the same reason the store
 * defaults to memory: the platform has to run from a clean clone with no
 * infrastructure. On one instance the count is exact; across serverless
 * instances it degrades to a per-instance limit rather than failing open on an
 * unreachable Redis. Moving it to shared storage means replacing
 * `consumeRateLimit` and nothing else.
 *
 * On the citizen-report path this is the load-bearing control. Corroboration
 * counting decides what volume *buys*; only this decides how much volume there
 * can be, and arithmetic downstream cannot tell four submissions from four
 * people if nothing limits how many submissions there are.
 */

export interface RateLimitRule {
  /** Requests allowed within one window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the window rolls over — the value for `Retry-After`. */
  retryAfterSec: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

// On `globalThis` for the same reason the store is: it must survive hot reloads
// in development and be shared across requests on one instance.
const globalRef = globalThis as typeof globalThis & {
  __floodpilotRateLimit?: Map<string, Bucket>;
};

/** Count one request against `key` and say whether it is over the limit. */
export function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
): RateLimitVerdict {
  const buckets = (globalRef.__floodpilotRateLimit ??= new Map());
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 5000) sweep(buckets, now);
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= rule.limit,
    retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/**
 * Throttling key for the network address a request arrived from.
 *
 * Hashed, because a raw address sitting in a map for ten minutes is personal
 * data the platform has no reason to hold — and deliberately **not** an
 * identity. Delhi NCR mobile traffic is CGNAT'd hard enough that one address is
 * hundreds of unrelated people, so keying anything that counts distinct
 * reporters off this would collapse them into each other and look correct while
 * being wrong.
 *
 * Behind a proxy that sets none of these headers every caller shares one
 * bucket. That is the safe direction to fail, and in this deployment Netlify
 * always sets the first one.
 */
export async function ipRateLimitKey(request: Request): Promise<string> {
  const headers = request.headers;
  const address =
    headers.get("x-nf-client-connection-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown";

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${address}::floodpilot-rate-limit-v1`),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Expired buckets are dead weight on an instance that stays up for days. */
function sweep(buckets: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
