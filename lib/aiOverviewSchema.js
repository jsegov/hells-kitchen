import { jsonSchema } from "ai";

/**
 * @typedef {"discovery" | "off_topic" | "how_to" | "analytics"} OverviewIntent
 */

/** @type {OverviewIntent[]} */
export const OVERVIEW_INTENTS = [
  "discovery",
  "off_topic",
  "how_to",
  "analytics",
];

export const DEFAULT_OVERVIEW_INTENT = /** @type {OverviewIntent} */ (
  "discovery"
);

/**
 * @param {string[]} [catalogIds]
 * @returns {import("json-schema").JSONSchema7}
 */
export function createOverviewJsonSchema(catalogIds = []) {
  const recommendedRecipeIdItems =
    /** @type {import("json-schema").JSONSchema7} */ (
      catalogIds.length > 0
        ? { type: "string", enum: Array.from(new Set(catalogIds)) }
        : { type: "string" }
    );

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      overview: {
        type: "string",
        description:
          "A short, plain-prose recommendation (2-4 sentences). No markdown, no lists.",
      },
      recommendedRecipeIds: {
        type: "array",
        description:
          "Recipe ids chosen ONLY from the provided catalog, ranked best first. Use an empty array only when no catalog recipe fits.",
        items: recommendedRecipeIdItems,
      },
      intent: {
        type: "string",
        description:
          "Classify the request. Use 'discovery' for recipe recommendations.",
        enum: OVERVIEW_INTENTS,
      },
      suggestedFilters: {
        type: "object",
        description:
          "Deterministic browse filters that map this answer back to the recipe page. Use empty arrays when no filter applies.",
        additionalProperties: false,
        properties: {
          diet: { type: "array", items: { type: "string" } },
          tag: { type: "array", items: { type: "string" } },
        },
        required: ["diet", "tag"],
      },
    },
    required: [
      "overview",
      "recommendedRecipeIds",
      "intent",
      "suggestedFilters",
    ],
  };
}

/**
 * Plain JSON Schema handed to the model via the AI SDK `jsonSchema()` helper.
 * This module is intentionally browser-safe; server data access lives in
 * `lib/aiOverview.js`.
 *
 * @type {import("json-schema").JSONSchema7}
 */
export const OVERVIEW_JSON_SCHEMA = createOverviewJsonSchema();

/**
 * @param {string[]} [catalogIds]
 */
export const createOverviewSchema = (catalogIds = []) =>
  jsonSchema(
    /** @type {import("ai").JSONSchema7} */ (
      createOverviewJsonSchema(catalogIds)
    ),
  );

export const OVERVIEW_SCHEMA = createOverviewSchema();
