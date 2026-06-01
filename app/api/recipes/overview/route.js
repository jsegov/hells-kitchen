import { NextResponse } from "next/server";
import { createOverviewService } from "../../../../lib/aiOverview";
import { NO_STORE_HEADERS } from "../../../../lib/apiCache";
import { createRateLimiter } from "../../../../lib/rateLimit";
import { getRecipeOverviewCatalog } from "../../../../lib/recipes";

// Streaming + AI Gateway authentication both require the Node runtime.
export const runtime = "nodejs";

/**
 * Upper bound on the freeform query. The client soft-limits its input too; this
 * is the server-side guard against abuse and runaway prompt cost (plan §7/§12).
 */
const MAX_QUERY_LEN = 300;
const MAX_BODY_BYTES = 2_048;

/**
 * Per-client request budget for the LLM call (plan §12). Pairs with
 * {@link MAX_QUERY_LEN} to bound abuse and cost. NOTE: the default limiter is
 * in-memory and therefore PER-INSTANCE — on a serverless fleet (Vercel) this
 * MUST be swapped for a durable, shared store (Upstash/Vercel KV) for a true
 * global limit; that is logged as an open decision (plan §12/§13). The limiter
 * is injected through {@link createOverviewPostHandler} so production can wire a
 * KV-backed one without changing this handler.
 */
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Default AI Gateway model for in-context discovery.
 */
export const OVERVIEW_MODEL = "google/gemini-3-flash";

/**
 * Derives a best-effort client key for throttling. Only trusted deployment
 * headers are considered; plain `x-forwarded-for` can be client-spoofable in
 * some setups, so the conservative fallback is one shared anonymous bucket.
 *
 * @param {Request} request
 * @returns {string}
 */
function clientKeyFromRequest(request) {
  const forwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return "anonymous";
}

/**
 * @param {Request} request
 */
function isRequestBodyTooLarge(request) {
  const contentLength = request.headers.get("content-length");

  if (!contentLength) {
    return false;
  }

  const byteLength = Number(contentLength);
  return Number.isFinite(byteLength) && byteLength > MAX_BODY_BYTES;
}

/**
 * @param {Request} request
 * @returns {Promise<{ ok: true, body: unknown } | { ok: false, tooLarge?: boolean }>}
 */
async function readJsonBody(request) {
  if (isRequestBodyTooLarge(request)) {
    return { ok: false, tooLarge: true };
  }

  const text = await request.text().catch(() => null);

  if (text === null) {
    return { ok: false };
  }

  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { ok: false, tooLarge: true };
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Coerces a parsed request body into a usable query string, or null when it is
 * missing, the wrong type, empty after trimming, or over {@link MAX_QUERY_LEN}.
 *
 * @param {unknown} body
 * @returns {string | null}
 */
function validateQuery(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const { query } = /** @type {{ query?: unknown }} */ (body);

  if (typeof query !== "string") {
    return null;
  }

  const trimmed = query.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_QUERY_LEN) {
    return null;
  }

  return trimmed;
}

/**
 * Builds the POST handler with its dependencies injected, mirroring the
 * `createRecipeRepository` / `recipeData.js` `dataLayer` seam: production wires
 * the real AI Gateway model + cached catalog loader; tests pass a
 * `MockLanguageModelV3` and a fake catalog with no network or key.
 *
 * @param {{
 *   createModel?: () => import("ai").LanguageModel | string,
 *   loadCatalog?: () => Promise<import("../../../../lib/recipes").OverviewCatalogRow[]>,
 *   rateLimiter?: import("../../../../lib/rateLimit").RateLimiter,
 *   clientKey?: (request: Request) => string,
 * }} [deps]
 * @returns {(request: Request) => Promise<Response>}
 */
export function createOverviewPostHandler({
  createModel = () => OVERVIEW_MODEL,
  loadCatalog = getRecipeOverviewCatalog,
  rateLimiter = createRateLimiter({
    limit: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  }),
  clientKey = clientKeyFromRequest,
} = {}) {
  return async function handlePost(request) {
    // Throttle per client BEFORE the (paid) model call. A rejected request
    // never reaches the provider, so this caps cost as well as abuse.
    const limit = rateLimiter.check(clientKey(request));
    if (!limit.allowed) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((limit.resetAt - Date.now()) / 1000),
      );
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": String(retryAfterSeconds),
          },
        },
      );
    }

    const bodyResult = await readJsonBody(request);

    if (!bodyResult.ok) {
      return NextResponse.json(
        {
          error: bodyResult.tooLarge
            ? "Request body is too large."
            : "A non-empty query of at most 300 characters is required.",
        },
        {
          status: bodyResult.tooLarge ? 413 : 400,
          headers: NO_STORE_HEADERS,
        },
      );
    }

    const query = validateQuery(bodyResult.body);

    if (query === null) {
      return NextResponse.json(
        { error: "A non-empty query of at most 300 characters is required." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    try {
      const catalog = await loadCatalog();
      const service = createOverviewService({
        model: createModel(),
        loadCatalog: () => Promise.resolve(catalog),
      });
      const result = await service.streamOverview(query, {
        abortSignal: request.signal,
      });

      return result.toTextStreamResponse({ headers: NO_STORE_HEADERS });
    } catch (error) {
      // Never surface — or log — the key or the raw provider error. Only the
      // error's class name is recorded for debugging; provider error messages
      // can embed request context, so they are not logged or returned.
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error(`AI Overview request failed (${errorName})`);
      return NextResponse.json(
        { error: "Unable to generate a recommendation right now." },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }
  };
}

const handlePost = createOverviewPostHandler();

/**
 * AI Overview endpoint: streams a structured `{ overview, recommendedRecipeIds,
 * intent, suggestedFilters }` object the client renders progressively. Thin over
 * `lib/aiOverview.js` (the analogue of how `app/api/recipes` is thin over
 * `lib/recipes.js`). Always no-store — responses are per-query, never CDN-cached.
 *
 * @param {Request} request
 */
export function POST(request) {
  return handlePost(request);
}
