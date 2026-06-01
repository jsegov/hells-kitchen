/**
 * A minimal in-memory, fixed-window rate limiter for the AI Overview route.
 *
 * WHY IN-MEMORY (and the production caveat): this is a per-instance store. It is
 * the right, simplest choice for the take-home demo and for a single long-lived
 * Node process, but it does NOT hold across a serverless/edge fleet — on Vercel
 * each lambda invocation can land on a fresh instance with an empty map, so the
 * effective limit is per-instance, not global. For real abuse/cost protection in
 * production this MUST be backed by a durable, shared store (Upstash Redis or
 * Vercel KV with an atomic INCR + TTL). This is logged as an open decision in
 * the plan (§12/§13). The {@link createRateLimiter} factory is injectable so the
 * route can swap this for a KV-backed limiter without touching the handler.
 *
 * Limits the per-request *cost* of the LLM call (alongside `MAX_QUERY_LEN`) — the
 * key (e.g. a client IP or session) is bucketed into fixed windows; once a bucket
 * exceeds `limit`, further requests in that window are rejected until it rolls.
 */

/**
 * @typedef {object} RateLimitResult
 * @property {boolean} allowed   Whether the request is within the limit.
 * @property {number} remaining  Requests left in the current window (>= 0).
 * @property {number} resetAt    Epoch ms when the current window rolls over.
 */

/**
 * @typedef {object} RateLimiter
 * @property {(key: string) => RateLimitResult} check Records a hit for `key` and reports whether it is allowed.
 */

/**
 * Builds an in-memory fixed-window rate limiter. Injectable so tests can supply
 * a deterministic `now`, and so a durable (KV) limiter can be substituted in
 * production without changing the route (codebase seam ethos).
 *
 * @param {{ limit?: number, windowMs?: number, sweepIntervalMs?: number, now?: () => number }} [options]
 * @returns {RateLimiter}
 */
export function createRateLimiter({
  limit = 20,
  windowMs = 60_000,
  sweepIntervalMs = 60_000,
  now = Date.now,
} = {}) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const buckets = new Map();
  let lastSweep = now();

  return {
    check(key) {
      const timestamp = now();
      const existing = buckets.get(key);

      if (!existing || timestamp >= existing.resetAt) {
        // Sweep expired buckets periodically so a burst of unique keys does not
        // make every cache miss pay an O(N) cleanup cost.
        if (timestamp - lastSweep >= sweepIntervalMs) {
          for (const [otherKey, bucket] of buckets) {
            if (timestamp >= bucket.resetAt) {
              buckets.delete(otherKey);
            }
          }
          lastSweep = timestamp;
        }

        const resetAt = timestamp + windowMs;
        buckets.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: limit - 1, resetAt };
      }

      existing.count += 1;
      const allowed = existing.count <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - existing.count),
        resetAt: existing.resetAt,
      };
    },
  };
}
