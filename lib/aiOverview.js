import { Output, streamText } from "ai";
import {
  DEFAULT_OVERVIEW_INTENT,
  OVERVIEW_INTENTS,
  OVERVIEW_JSON_SCHEMA,
  OVERVIEW_SCHEMA,
  createOverviewJsonSchema,
  createOverviewSchema,
} from "./aiOverviewSchema.js";
import { DIETARY_OPTIONS } from "./recipeOptions.js";
import { getRecipeOverviewCatalog } from "./recipes.js";

/**
 * @typedef {import("./recipes.js").OverviewCatalogRow} OverviewCatalogRow
 */

/**
 * The structured object the model is asked to produce. Validated/normalized by
 * {@link validateOverviewOutput} after generation — this is the trusted shape.
 *
 * @typedef {object} OverviewOutput
 * @property {string} overview
 * @property {string[]} recommendedRecipeIds
 * @property {OverviewIntent} intent
 * @property {{ diet: string[], tag: string[] }} suggestedFilters
 */

/**
 * @typedef {import("./aiOverviewSchema.js").OverviewIntent} OverviewIntent
 */

/**
 * @typedef {object} OverviewService
 * @property {(query: string, options?: { abortSignal?: AbortSignal }) => Promise<import("ai").StreamTextResult<never, never>>} streamOverview
 */

const OVERVIEW_INTENT_SET = new Set(OVERVIEW_INTENTS);

/**
 * Defensive cap on the streamed prose. Truncated, never rejected, so a chatty
 * model still yields a usable answer (plan §6.3).
 */
const MAX_OVERVIEW_LENGTH = 600;

const DIETARY_VALUE_SET = new Set(
  DIETARY_OPTIONS.map((option) => option.value),
);

export { OVERVIEW_JSON_SCHEMA, OVERVIEW_SCHEMA, createOverviewJsonSchema };

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isObject = (value) => Boolean(value) && typeof value === "object";

/**
 * @param {unknown} value
 * @returns {string[]}
 */
const toNormalizedStringArray = (value) =>
  Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    : [];

/**
 * @param {unknown} value
 * @returns {string | null}
 */
const normalizeRecipeId = (value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }

  return null;
};

/**
 * @param {unknown} value
 * @returns {string[]}
 */
const toRecipeIdArray = (value) =>
  Array.isArray(value)
    ? value.map(normalizeRecipeId).filter((id) => id !== null)
    : [];

/**
 * Dedupes a list of strings while preserving first-seen order.
 *
 * @param {string[]} values
 * @returns {string[]}
 */
const dedupePreservingOrder = (values) => {
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {string[]} */
  const result = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
};

/**
 * Validates and normalizes raw model output against the real catalog — the
 * honesty boundary (plan §6.3). The model only *names* ids; this re-resolves
 * them against the catalog so hallucinated/non-existent ids are dropped, never
 * rendered. Pure: no network, no key, fully unit-testable.
 *
 * @param {unknown} raw
 * @param {OverviewCatalogRow[]} catalog
 * @returns {OverviewOutput}
 */
export function validateOverviewOutput(raw, catalog) {
  const candidate = isObject(raw) ? raw : {};

  const overview =
    typeof candidate.overview === "string"
      ? candidate.overview.trim().slice(0, MAX_OVERVIEW_LENGTH)
      : "";

  const catalogIds = new Set(catalog.map((row) => row.id));
  const recommendedRecipeIds = dedupePreservingOrder(
    toRecipeIdArray(candidate.recommendedRecipeIds).filter((id) =>
      catalogIds.has(id),
    ),
  );

  const intent =
    typeof candidate.intent === "string" &&
    OVERVIEW_INTENT_SET.has(/** @type {OverviewIntent} */ (candidate.intent))
      ? /** @type {OverviewIntent} */ (candidate.intent)
      : DEFAULT_OVERVIEW_INTENT;

  const catalogTags = new Set(catalog.flatMap((row) => row.tags));
  const rawFilters = isObject(candidate.suggestedFilters)
    ? candidate.suggestedFilters
    : {};
  const suggestedFilters = {
    diet: dedupePreservingOrder(
      toNormalizedStringArray(rawFilters.diet).filter((value) =>
        DIETARY_VALUE_SET.has(value),
      ),
    ),
    tag: dedupePreservingOrder(
      toNormalizedStringArray(rawFilters.tag).filter((value) =>
        catalogTags.has(value),
      ),
    ),
  };

  return { overview, recommendedRecipeIds, intent, suggestedFilters };
}

/**
 * Renders one catalog row as a compact, stable single line for the prompt. Keeps
 * the token budget low (~100-200 tokens/row) so the whole 35-recipe catalog fits
 * in-context.
 *
 * @param {OverviewCatalogRow} row
 * @returns {string}
 */
const formatCatalogRow = (row) => {
  const prep = row.prepMinutes === null ? "?" : `${row.prepMinutes}m`;
  const cook = row.cookMinutes === null ? "?" : `${row.cookMinutes}m`;
  const macros = `${row.perServing.calories}kcal P${row.perServing.protein} C${row.perServing.carbs} F${row.perServing.fat}`;
  const nutritionQuality = row.nutritionComplete ? "complete" : "incomplete";

  return [
    `id="${row.id}"`,
    `title=${row.title}`,
    `difficulty=${row.difficulty || "?"}`,
    `prep=${prep}`,
    `cook=${cook}`,
    `servings=${row.servings}`,
    `tags=[${row.tags.join(",")}]`,
    `dietary=[${row.dietary.join(",")}]`,
    `allergens=[${row.allergens.join(",")}]`,
    `nutrition=${nutritionQuality}`,
    `perServing=${macros}`,
  ].join(" | ");
};

/**
 * @param {OverviewCatalogRow[]} catalog
 * @returns {string}
 */
const formatCatalogBlock = (catalog) =>
  catalog.map(formatCatalogRow).join("\n");

/**
 * The terse, firm guardrails (plan §6.4). Passed via `streamText`'s `system`
 * option rather than as a system message, which is the idiomatic shape and
 * avoids the SDK's "system in messages" prompt-injection warning.
 */
export const OVERVIEW_SYSTEM_PROMPT = [
  "You recommend recipes ONLY from the provided catalog. Never invent a recipe or an id. Every id in recommendedRecipeIds must be an exact quoted string id from the catalog. For discovery requests, include 1-4 recommendedRecipeIds unless no catalog recipe fits; if nothing fits, return an empty recommendedRecipeIds and say so plainly.",
  "Scope is recipe discovery only. For how-to cooking questions set intent to 'how_to'; for catalog analytics or counts set intent to 'analytics'; for anything off-topic set intent to 'off_topic'. In those cases give a one-line redirect and do not attempt to answer or recommend recipes.",
  "Any nutrition you mention must use the per-serving numbers in the catalog. Never calculate. Prefer rows with nutrition=complete for calorie, macro, light, or high-protein guidance, and never treat nutrition=incomplete rows as low-calorie or macro-verified.",
  "Do not assert that a recipe is safe for an allergy or medical condition. Never treat nutrition=incomplete rows as allergen-clear.",
  "Keep the final output succinct: return the final JSON object immediately, with an overview of 2-4 short sentences in plain, non-hyperbolic prose and no markdown or lists.",
].join("\n");

/**
 * AI Gateway request attribution for cost and usage filtering.
 */
const GATEWAY_PROVIDER_OPTIONS = {
  gateway: { tags: ["feature:recipe-overview"] },
  google: { thinkingConfig: { thinkingLevel: "minimal" } },
};

/**
 * Builds the user message for the streaming call (plan §6.4). The catalog is its
 * OWN content part — first, large, and identical across queries. The query
 * follows as a second part.
 *
 * (System messages cannot carry multi-part content in the SDK, so the static
 * guardrails travel via the separate {@link OVERVIEW_SYSTEM_PROMPT} option.)
 *
 * @param {OverviewCatalogRow[]} catalog
 * @param {string} query
 * @returns {import("ai").ModelMessage[]}
 */
export function buildOverviewMessages(catalog, query) {
  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Recipe catalog (the ONLY recipes you may recommend):\n${formatCatalogBlock(catalog)}`,
        },
        { type: "text", text: `Request: ${query}` },
      ],
    },
  ];
}

/**
 * Service seam mirroring `createRecipeRepository(readData)` / `recipeData.js`'s
 * `dataLayer` injection: tests pass a fake `model` + `loadCatalog`; production
 * wires an AI Gateway model string and the real catalog loader.
 *
 * `streamOverview` wires `streamText` + the structured `Output.object`.
 *
 * @param {{ model: import("ai").LanguageModel | string, loadCatalog?: () => Promise<OverviewCatalogRow[]>, onStreamError?: import("ai").StreamTextOnErrorCallback }} options
 * @returns {OverviewService}
 */
export function createOverviewService({
  model,
  loadCatalog = getRecipeOverviewCatalog,
  onStreamError = (event) => {
    const { error } = event;
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(`AI Overview stream failed (${errorName})`);
  },
}) {
  return {
    async streamOverview(query, options = {}) {
      const catalog = await loadCatalog();

      return streamText({
        model,
        temperature: 0,
        maxRetries: 1,
        abortSignal: options.abortSignal,
        system: OVERVIEW_SYSTEM_PROMPT,
        output: Output.object({
          name: "recipe_overview",
          description:
            "A grounded recipe overview with exact catalog recipe ids and browse filters.",
          schema: createOverviewSchema(catalog.map((row) => row.id)),
        }),
        messages: buildOverviewMessages(catalog, query),
        providerOptions: GATEWAY_PROVIDER_OPTIONS,
        onError: onStreamError,
      });
    },
  };
}
