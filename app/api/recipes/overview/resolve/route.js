import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "../../../../../lib/apiCache";
import { validateOverviewOutput } from "../../../../../lib/aiOverview";
import {
  getRecipeList,
  getRecipeOverviewCatalog,
} from "../../../../../lib/recipes";

export const runtime = "nodejs";

const MAX_FINALIZE_BODY_BYTES = 4_096;
const MAX_RESOLVED_RECIPES = 25;
const MAX_FALLBACK_RECIPES = 4;

/**
 * @typedef {object} OverviewResolveDeps
 * @property {() => Promise<import("../../../../../lib/recipes").RecipeListItem[]>} loadRecipes
 * @property {() => Promise<import("../../../../../lib/recipes").OverviewCatalogRow[]>} loadCatalog
 */

/**
 * @param {Request} request
 */
async function readRawOverviewObject(request) {
  const contentLength = request.headers.get("content-length");
  const byteLength = contentLength ? Number(contentLength) : 0;

  if (Number.isFinite(byteLength) && byteLength > MAX_FINALIZE_BODY_BYTES) {
    return { ok: false, tooLarge: true };
  }

  const text = await request.text().catch(() => null);

  if (text === null) {
    return { ok: false };
  }

  if (Buffer.byteLength(text) > MAX_FINALIZE_BODY_BYTES) {
    return { ok: false, tooLarge: true };
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isObject = (value) => Boolean(value) && typeof value === "object";

/**
 * @param {unknown} body
 * @returns {{ rawOverview: unknown, query: string }}
 */
function parseResolveBody(body) {
  if (isObject(body) && "rawOverview" in body) {
    return {
      rawOverview: body.rawOverview,
      query: typeof body.query === "string" ? body.query.trim() : "",
    };
  }

  return { rawOverview: body, query: "" };
}

/**
 * @param {string} value
 */
const normalizeComparableText = (value) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * @param {string} value
 */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * @param {string} haystack
 * @param {string} needle
 */
function titleMentionIndex(haystack, needle) {
  const title = normalizeComparableText(needle);

  if (!title) {
    return -1;
  }

  const match = new RegExp(
    `(^|[^a-z0-9])${escapeRegex(title)}([^a-z0-9]|$)`,
  ).exec(haystack);

  return match?.index ?? -1;
}

/**
 * @param {import("../../../../../lib/recipes").OverviewCatalogRow} row
 * @param {{ diet: string[], tag: string[] }} filters
 */
function rowMatchesFilters(row, filters) {
  return (
    filters.diet.every((diet) => row.dietary.includes(diet)) &&
    filters.tag.every((tag) => row.tags.includes(tag))
  );
}

/**
 * @param {object} options
 * @param {import("../../../../../lib/aiOverview").OverviewOutput} options.validated
 * @param {import("../../../../../lib/recipes").OverviewCatalogRow[]} options.catalog
 * @param {import("../../../../../lib/recipes").RecipeListItem[]} options.recipes
 * @param {string} options.query
 * @returns {import("../../../../../lib/recipes").RecipeListItem[]}
 */
function selectFallbackRecipes({ validated, catalog, recipes, query }) {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const searchableText = normalizeComparableText(
    [validated.overview, query].filter(Boolean).join(" "),
  );

  const mentionedRows = catalog
    .map((row, index) => ({
      row,
      index,
      mentionIndex: titleMentionIndex(searchableText, row.title),
    }))
    .filter((entry) => entry.mentionIndex >= 0)
    .sort((a, b) => a.mentionIndex - b.mentionIndex || a.index - b.index)
    .map((entry) => entry.row);

  const hasFilters =
    validated.suggestedFilters.diet.length > 0 ||
    validated.suggestedFilters.tag.length > 0;
  const filteredRows = hasFilters
    ? catalog.filter((row) =>
        rowMatchesFilters(row, validated.suggestedFilters),
      )
    : [];

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {import("../../../../../lib/recipes").RecipeListItem[]} */
  const fallbackRecipes = [];

  for (const row of [...mentionedRows, ...filteredRows]) {
    if (seen.has(row.id)) {
      continue;
    }

    const recipe = byId.get(row.id);
    if (!recipe) {
      continue;
    }

    seen.add(row.id);
    fallbackRecipes.push(recipe);

    if (fallbackRecipes.length >= MAX_FALLBACK_RECIPES) {
      break;
    }
  }

  return fallbackRecipes;
}

/**
 * Builds the finalization handler for the AI Overview. The streamed object is
 * provisional; this endpoint is the server-side authority that validates the
 * complete object against the catalog and resolves real card DTOs.
 *
 * @param {OverviewResolveDeps} deps
 */
export function createOverviewResolveHandler({ loadRecipes, loadCatalog }) {
  /**
   * @param {Request} request
   */
  return async function handleResolve(request) {
    try {
      const bodyResult = await readRawOverviewObject(request);

      if (!bodyResult.ok) {
        return NextResponse.json(
          {
            error: bodyResult.tooLarge
              ? "Request body is too large."
              : "A completed overview object is required.",
          },
          {
            status: bodyResult.tooLarge ? 413 : 400,
            headers: NO_STORE_HEADERS,
          },
        );
      }

      const catalog = await loadCatalog();
      const { rawOverview, query } = parseResolveBody(bodyResult.body);
      const validated = validateOverviewOutput(rawOverview, catalog);
      const recommendedIds =
        validated.intent !== "off_topic"
          ? validated.recommendedRecipeIds.slice(0, MAX_RESOLVED_RECIPES)
          : [];

      const recipes = recommendedIds.length ? await loadRecipes() : [];
      const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
      let resolvedRecipes = recommendedIds.reduce((acc, id) => {
        const recipe = byId.get(id);
        if (recipe) {
          acc.push(recipe);
        }
        return acc;
      }, /** @type {import("../../../../../lib/recipes").RecipeListItem[]} */ ([]));

      if (resolvedRecipes.length === 0 && validated.intent === "discovery") {
        const fallbackRecipes = recipes.length ? recipes : await loadRecipes();
        resolvedRecipes = selectFallbackRecipes({
          validated,
          catalog,
          recipes: fallbackRecipes,
          query,
        });
      }

      return NextResponse.json(
        {
          ...validated,
          recommendedRecipeIds: resolvedRecipes.map((recipe) => recipe.id),
          recipes: resolvedRecipes,
        },
        { headers: NO_STORE_HEADERS },
      );
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error(`Failed to finalize overview recipes (${errorName})`);
      return NextResponse.json(
        { error: "Failed to finalize recommended recipes" },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }
  };
}

const resolveHandler = createOverviewResolveHandler({
  loadRecipes: () => getRecipeList(),
  loadCatalog: () => getRecipeOverviewCatalog(),
});

/**
 * @param {Request} request
 */
export function POST(request) {
  return resolveHandler(request);
}
