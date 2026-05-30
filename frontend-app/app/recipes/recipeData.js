export const DEFAULT_API_BASE_URL = "http://localhost:8080";

/**
 * @typedef {object} RecipeListItem
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} servings
 * @property {string} prepTime
 * @property {string} cookTime
 * @property {string} difficulty
 * @property {number} ingredientCount
 * @property {string[]} tags
 */

/**
 * @typedef {object} RecipesResponse
 * @property {boolean} ok
 * @property {number=} status
 * @property {() => Promise<unknown>} json
 */

/**
 * @typedef {(url: string, options: { cache: "no-store" }) => Promise<RecipesResponse>} RecipesFetch
 */

/**
 * @param {string=} apiBaseUrl
 */
export function getRecipesUrl(apiBaseUrl = process.env.API_BASE_URL) {
  const baseUrl = apiBaseUrl || DEFAULT_API_BASE_URL;

  return `${baseUrl.replace(/\/$/, "")}/api/recipes`;
}

/**
 * @param {{ apiBaseUrl?: string, fetchImpl?: RecipesFetch }} [options]
 * @returns {Promise<{ recipes: RecipeListItem[], error: string | null }>}
 */
export async function getRecipes({
  apiBaseUrl,
  fetchImpl = /** @type {RecipesFetch} */ (globalThis.fetch),
} = {}) {
  try {
    const response = await fetchImpl(getRecipesUrl(apiBaseUrl), {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        recipes: [],
        error: `Unable to load recipes (${response.status})`,
      };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return {
        recipes: [],
        error: "Invalid data format received from the recipe service.",
      };
    }

    if (!Array.isArray(data)) {
      return {
        recipes: [],
        error: "Invalid data format received from the recipe service.",
      };
    }

    return {
      recipes: /** @type {RecipeListItem[]} */ (data),
      error: null,
    };
  } catch (error) {
    return {
      recipes: [],
      error: "Unable to reach the recipe service.",
    };
  }
}

/**
 * @param {string | null | undefined} difficulty
 */
export function formatDifficulty(difficulty) {
  if (!difficulty) {
    return "Unrated";
  }

  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}
