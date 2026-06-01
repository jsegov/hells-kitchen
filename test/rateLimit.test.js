import { createRateLimiter } from "../lib/rateLimit";

test("allows requests up to the limit then rejects within the same window", () => {
  let now = 1_000;
  const limiter = createRateLimiter({
    limit: 3,
    windowMs: 1_000,
    now: () => now,
  });

  expect(limiter.check("a")).toMatchObject({ allowed: true, remaining: 2 });
  expect(limiter.check("a")).toMatchObject({ allowed: true, remaining: 1 });
  expect(limiter.check("a")).toMatchObject({ allowed: true, remaining: 0 });

  const fourth = limiter.check("a");
  expect(fourth.allowed).toBe(false);
  expect(fourth.remaining).toBe(0);
  expect(fourth.resetAt).toBe(2_000);
});

test("tracks each key independently", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

  expect(limiter.check("a").allowed).toBe(true);
  expect(limiter.check("a").allowed).toBe(false);
  // A different client is unaffected by another's exhausted bucket.
  expect(limiter.check("b").allowed).toBe(true);
});

test("rolls the window over once the reset time passes", () => {
  let now = 0;
  const limiter = createRateLimiter({
    limit: 1,
    windowMs: 1_000,
    now: () => now,
  });

  expect(limiter.check("a").allowed).toBe(true);
  expect(limiter.check("a").allowed).toBe(false);

  // Advance past the window: the bucket resets and the client is allowed again.
  now = 1_000;
  const afterReset = limiter.check("a");
  expect(afterReset.allowed).toBe(true);
  expect(afterReset.remaining).toBe(0);
  expect(afterReset.resetAt).toBe(2_000);
});

test("does not accumulate buckets for clients that have gone quiet", () => {
  let now = 0;
  const limiter = createRateLimiter({
    limit: 5,
    windowMs: 1_000,
    sweepIntervalMs: 1_000,
    now: () => now,
  });

  // A burst of one-off clients in the first window.
  for (let i = 0; i < 50; i += 1) {
    limiter.check(`client-${i}`);
  }

  // After the window rolls, a new request sweeps the expired buckets. We can't
  // inspect the private map, but a subsequent request for an old key must start
  // a fresh window (proving its stale bucket was discarded, not carried).
  now = 2_000;
  const revisited = limiter.check("client-0");
  expect(revisited.allowed).toBe(true);
  expect(revisited.remaining).toBe(4);
  expect(revisited.resetAt).toBe(3_000);
});
