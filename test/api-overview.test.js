/**
 * @jest-environment node
 *
 * The route streams via the AI SDK, whose stream utilities (`ai/test`) require
 * the Node Web Streams globals (`TransformStream`) the default jsdom environment
 * lacks. No database and no real AI Gateway credentials are touched: the model is a
 * `MockLanguageModelV3` and the catalog is injected, so this runs in the default
 * `npm run check` gate.
 */
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import {
  OVERVIEW_MODEL,
  createOverviewPostHandler,
} from "../app/api/recipes/overview/route";
import { validateOverviewOutput } from "../lib/aiOverview";
import { createRateLimiter } from "../lib/rateLimit";

/** @type {import("../lib/recipes").OverviewCatalogRow[]} */
const catalog = [
  {
    id: "r1",
    title: "Tomato Bowl",
    tags: ["italian", "vegetarian", "dinner"],
    difficulty: "easy",
    prepMinutes: 20,
    cookMinutes: 60,
    servings: 2,
    dietary: ["vegetarian", "gluten-free"],
    allergens: [],
    nutritionComplete: true,
    perServing: { calories: 25, protein: 1.5, carbs: 5, fat: 0.2 },
  },
  {
    id: "r2",
    title: "Steak Plate",
    tags: ["american", "dinner", "high-protein"],
    difficulty: "medium",
    prepMinutes: 10,
    cookMinutes: 25,
    servings: 1,
    dietary: ["high-protein"],
    allergens: ["soy"],
    nutritionComplete: true,
    perServing: { calories: 600, protein: 45, carbs: 2, fat: 30 },
  },
];

/**
 * Builds a `MockLanguageModelV3` that streams the given JSON object as a single
 * text-delta, matching the strict installed V3 stream-part/finish/usage shape.
 *
 * @param {string} json
 */
const buildModel = (json) =>
  new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        /** @type {import("@ai-sdk/provider").LanguageModelV3StreamPart[]} */
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "0" },
          { type: "text-delta", id: "0", delta: json },
          { type: "text-end", id: "0" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: {
                total: 10,
                noCache: 10,
                cacheRead: 0,
                cacheWrite: 0,
              },
              outputTokens: { total: 20, text: 20, reasoning: 0 },
            },
          },
        ],
      }),
    }),
  });

/**
 * Drains the streamed response body to its full text (the raw model JSON, as the
 * client `useObject` would parse it) and parses it.
 *
 * @param {Response} response
 */
const readStreamedObject = async (response) => {
  const text = await response.text();
  return JSON.parse(text);
};

/**
 * @param {object} body
 */
const postRequest = (body) =>
  new Request("http://localhost/api/recipes/overview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/**
 * @param {string} json
 */
const enabledHandler = (json) =>
  createOverviewPostHandler({
    createModel: () => buildModel(json),
    loadCatalog: () => Promise.resolve(catalog),
  });

test("streams an overview whose ids resolve to the catalog subset (honesty boundary)", async () => {
  // The model claims a real id, a hallucinated id, another real id, and junk.
  const handler = enabledHandler(
    JSON.stringify({
      overview: "Two solid dinners.",
      recommendedRecipeIds: ["r2", "does-not-exist", "r1", "fabricated"],
      intent: "discovery",
    }),
  );

  const response = await handler(postRequest({ query: "a quick dinner" }));

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");

  const rawText = await response.text();
  // Sanity: the stream carries the model's raw claims verbatim, so the filter
  // below is a real subset reduction (not a vacuous pass on already-clean data).
  expect(rawText).toContain("does-not-exist");
  const streamed = JSON.parse(rawText);
  // The stream carries the model's claims verbatim (live prose UX); the honesty
  // guarantee is that those claims, passed through the boundary the rest of the
  // pipeline uses, collapse to the catalog subset in model order.
  const validated = validateOverviewOutput(streamed, catalog);
  expect(validated.recommendedRecipeIds).toEqual(["r2", "r1"]);
});

test("empty recommendation set streams through as a first-class state, not an error", async () => {
  const handler = enabledHandler(
    JSON.stringify({
      overview: "Nothing in the catalog fits that.",
      recommendedRecipeIds: [],
      intent: "discovery",
    }),
  );

  const response = await handler(postRequest({ query: "ostrich tartare" }));

  expect(response.status).toBe(200);

  const validated = validateOverviewOutput(
    await readStreamedObject(response),
    catalog,
  );
  expect(validated.recommendedRecipeIds).toEqual([]);
  expect(validated.overview).toBe("Nothing in the catalog fits that.");
});

test("uses Gemini 3 Flash through AI Gateway by default", () => {
  expect(OVERVIEW_MODEL).toBe("google/gemini-3-flash");
});

test("does not preflight local Gateway credentials when a model is injected", async () => {
  const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
  const originalOidcToken = process.env.VERCEL_OIDC_TOKEN;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  const handler = enabledHandler(
    JSON.stringify({
      overview: "ok",
      recommendedRecipeIds: [],
      intent: "discovery",
    }),
  );

  const response = await handler(postRequest({ query: "anything" }));

  if (originalGatewayKey === undefined) {
    delete process.env.AI_GATEWAY_API_KEY;
  } else {
    process.env.AI_GATEWAY_API_KEY = originalGatewayKey;
  }
  if (originalOidcToken === undefined) {
    delete process.env.VERCEL_OIDC_TOKEN;
  } else {
    process.env.VERCEL_OIDC_TOKEN = originalOidcToken;
  }

  expect(response.status).toBe(200);
});

test("returns 400 on a missing query", async () => {
  const handler = enabledHandler("{}");

  const response = await handler(postRequest({}));

  expect(response.status).toBe(400);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

test("returns 400 on a non-JSON body", async () => {
  const handler = enabledHandler("{}");

  const response = await handler(
    new Request("http://localhost/api/recipes/overview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    }),
  );

  expect(response.status).toBe(400);
});

test("returns 413 on an oversized body", async () => {
  const handler = enabledHandler("{}");

  const response = await handler(
    new Request("http://localhost/api/recipes/overview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "short",
        padding: "a".repeat(2_100),
      }),
    }),
  );

  expect(response.status).toBe(413);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

test("returns 400 on an over-long query", async () => {
  const handler = enabledHandler("{}");

  const response = await handler(postRequest({ query: "a".repeat(301) }));

  expect(response.status).toBe(400);
});

test("throttles a client past the per-window limit with a 429 + Retry-After, before any model work", async () => {
  let modelBuilt = 0;
  const handler = createOverviewPostHandler({
    createModel: () => {
      modelBuilt += 1;
      return buildModel(
        JSON.stringify({
          overview: "ok",
          recommendedRecipeIds: [],
          intent: "discovery",
        }),
      );
    },
    loadCatalog: () => Promise.resolve(catalog),
    rateLimiter: createRateLimiter({ limit: 2, windowMs: 60_000 }),
    clientKey: () => "test-client",
  });

  expect((await handler(postRequest({ query: "one" }))).status).toBe(200);
  expect((await handler(postRequest({ query: "two" }))).status).toBe(200);

  const throttled = await handler(postRequest({ query: "three" }));
  expect(throttled.status).toBe(429);
  expect(throttled.headers.get("Cache-Control")).toBe("no-store");
  expect(Number(throttled.headers.get("Retry-After"))).toBeGreaterThan(0);
  // The rejected request never reached the provider (cost guard).
  expect(modelBuilt).toBe(2);
});

test("rate limit fires before body parsing on rejected requests", async () => {
  let modelBuilt = 0;
  const handler = createOverviewPostHandler({
    createModel: () => {
      modelBuilt += 1;
      return buildModel(
        JSON.stringify({
          overview: "ok",
          recommendedRecipeIds: [],
          intent: "discovery",
        }),
      );
    },
    loadCatalog: () => Promise.resolve(catalog),
    rateLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
    clientKey: () => "test-client",
  });

  expect((await handler(postRequest({ query: "one" }))).status).toBe(200);

  const throttled = await handler(
    new Request("http://localhost/api/recipes/overview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    }),
  );

  expect(throttled.status).toBe(429);
  expect(modelBuilt).toBe(1);
});

test("rate-limit buckets are per client key", async () => {
  let key = "client-a";
  const handler = createOverviewPostHandler({
    createModel: () =>
      buildModel(
        JSON.stringify({
          overview: "ok",
          recommendedRecipeIds: [],
          intent: "discovery",
        }),
      ),
    loadCatalog: () => Promise.resolve(catalog),
    rateLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
    clientKey: () => key,
  });

  expect((await handler(postRequest({ query: "a1" }))).status).toBe(200);
  // Same client, second request in the window → throttled.
  expect((await handler(postRequest({ query: "a2" }))).status).toBe(429);

  // A different client has its own untouched budget.
  key = "client-b";
  expect((await handler(postRequest({ query: "b1" }))).status).toBe(200);
});

test("plain x-forwarded-for is not trusted for default rate-limit buckets", async () => {
  const handler = createOverviewPostHandler({
    createModel: () =>
      buildModel(
        JSON.stringify({
          overview: "ok",
          recommendedRecipeIds: [],
          intent: "discovery",
        }),
      ),
    loadCatalog: () => Promise.resolve(catalog),
    rateLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
  });

  const withForwardedFor = (/** @type {string} */ value) =>
    new Request("http://localhost/api/recipes/overview", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": value,
      },
      body: JSON.stringify({ query: "a quick dinner" }),
    });

  expect((await handler(withForwardedFor("203.0.113.1"))).status).toBe(200);
  expect((await handler(withForwardedFor("203.0.113.2"))).status).toBe(429);
});

test("trusted Vercel forwarding header gets distinct rate-limit buckets", async () => {
  const handler = createOverviewPostHandler({
    createModel: () =>
      buildModel(
        JSON.stringify({
          overview: "ok",
          recommendedRecipeIds: [],
          intent: "discovery",
        }),
      ),
    loadCatalog: () => Promise.resolve(catalog),
    rateLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
  });

  const withVercelForwardedFor = (/** @type {string} */ value) =>
    new Request("http://localhost/api/recipes/overview", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vercel-forwarded-for": value,
      },
      body: JSON.stringify({ query: "a quick dinner" }),
    });

  expect((await handler(withVercelForwardedFor("203.0.113.1"))).status).toBe(
    200,
  );
  expect((await handler(withVercelForwardedFor("203.0.113.2"))).status).toBe(
    200,
  );
});

test("passes request abort signal and model limits into the stream", async () => {
  const model = buildModel(
    JSON.stringify({
      overview: "ok",
      recommendedRecipeIds: [],
      intent: "discovery",
      suggestedFilters: { diet: [], tag: [] },
    }),
  );
  const handler = createOverviewPostHandler({
    createModel: () => model,
    loadCatalog: () => Promise.resolve(catalog),
  });
  const abortController = new AbortController();
  const request = new Request("http://localhost/api/recipes/overview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "a quick dinner" }),
    signal: abortController.signal,
  });

  const response = await handler(request);
  await response.text();

  expect(response.status).toBe(200);
  expect(model.doStreamCalls).toHaveLength(1);
  expect(model.doStreamCalls[0].maxOutputTokens).toBeUndefined();
  expect("timeout" in model.doStreamCalls[0]).toBe(false);
  expect(model.doStreamCalls[0].temperature).toBe(0);
  expect(
    JSON.parse(JSON.stringify(model.doStreamCalls[0].providerOptions)),
  ).toEqual({
    gateway: { tags: ["feature:recipe-overview"] },
    google: { thinkingConfig: { thinkingLevel: "minimal" } },
  });
  expect(model.doStreamCalls[0].abortSignal).toBeDefined();
  expect(model.doStreamCalls[0].abortSignal?.aborted).toBe(false);
  abortController.abort();
  expect(model.doStreamCalls[0].abortSignal?.aborted).toBe(true);
});

test("error path returns a generic 500 and never leaks the key or provider error", async () => {
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  const secret = "ai-gateway-super-secret-key";
  const providerError = new Error(
    `AI Gateway request failed using ${secret} at https://ai-gateway.vercel.sh`,
  );

  const handler = createOverviewPostHandler({
    createModel: () => {
      throw providerError;
    },
    loadCatalog: () => Promise.resolve(catalog),
  });

  const response = await handler(postRequest({ query: "a quick dinner" }));

  expect(response.status).toBe(500);
  expect(response.headers.get("Cache-Control")).toBe("no-store");

  const body = await response.json();
  expect(body).toEqual({
    error: "Unable to generate a recommendation right now.",
  });

  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(secret);
  expect(serialized).not.toContain("ai-gateway.vercel.sh");
  expect(errorSpy).toHaveBeenCalledWith("AI Overview request failed (Error)");
  errorSpy.mockRestore();
});
