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
 * @typedef {object} Nutrition
 * @property {number} calories
 * @property {number} protein
 * @property {number} carbs
 * @property {number} fat
 */

/**
 * @typedef {object} RecipeIngredientDetail
 * @property {string} ingredientId
 * @property {string} name
 * @property {string} amount
 * @property {string} unit
 * @property {string} category
 * @property {Nutrition} nutrition
 */

/**
 * @typedef {object} RecipeDetail
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} servings
 * @property {string} prepTime
 * @property {string} cookTime
 * @property {string} difficulty
 * @property {string[]} tags
 * @property {string[]} instructions
 * @property {RecipeIngredientDetail[]} ingredients
 * @property {{ total: Nutrition, perServing: Nutrition, missingIngredientIds: string[] }} nutrition
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
 * @typedef {object} RecipeFilterInput
 * @property {unknown=} name
 * @property {unknown=} tag
 * @property {unknown=} ingredient
 */

/**
 * @typedef {object} RecipeFilters
 * @property {string[]} name
 * @property {string[]} tag
 * @property {string[]} ingredient
 */

/**
 * @param {string=} apiBaseUrl
 */
function getApiBaseUrl(apiBaseUrl = process.env.API_BASE_URL) {
  return (apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeFilterValues(value) {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((filterValue) => filterValue.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(normalizeFilterValues);
}

/**
 * @param {RecipeFilterInput=} filters
 * @returns {RecipeFilters}
 */
export function normalizeRecipeFilters(filters = {}) {
  if (!filters || typeof filters !== "object") {
    return {
      name: [],
      tag: [],
      ingredient: [],
    };
  }

  return {
    name: normalizeFilterValues(filters.name),
    tag: normalizeFilterValues(filters.tag),
    ingredient: normalizeFilterValues(filters.ingredient),
  };
}

/**
 * @param {RecipeFilterInput=} filters
 */
export function hasRecipeFilters(filters = {}) {
  const normalizedFilters = normalizeRecipeFilters(filters);

  return (
    normalizedFilters.name.length > 0 ||
    normalizedFilters.tag.length > 0 ||
    normalizedFilters.ingredient.length > 0
  );
}

/**
 * @param {RecipeFilterInput=} filters
 */
function getRecipesQueryString(filters = {}) {
  const normalizedFilters = normalizeRecipeFilters(filters);
  const params = new URLSearchParams();

  for (const value of normalizedFilters.name) {
    params.append("name", value);
  }

  for (const value of normalizedFilters.tag) {
    params.append("tag", value);
  }

  for (const value of normalizedFilters.ingredient) {
    params.append("ingredient", value);
  }

  return params.toString();
}

/**
 * @param {string=} apiBaseUrl
 * @param {RecipeFilterInput=} filters
 */
export function getRecipesUrl(apiBaseUrl = process.env.API_BASE_URL, filters) {
  const recipesUrl = `${getApiBaseUrl(apiBaseUrl)}/api/recipes`;
  const queryString = getRecipesQueryString(filters);

  return queryString ? `${recipesUrl}?${queryString}` : recipesUrl;
}

/**
 * @param {string} id
 * @param {string=} apiBaseUrl
 */
export function getRecipeUrl(id, apiBaseUrl = process.env.API_BASE_URL) {
  return `${getApiBaseUrl(apiBaseUrl)}/api/recipes/${encodeURIComponent(id)}`;
}

/**
 * @param {unknown} value
 */
function isObject(value) {
  return Boolean(value) && typeof value === "object";
}

/**
 * @param {unknown} value
 * @returns {value is Nutrition}
 */
function isNutrition(value) {
  if (!isObject(value)) {
    return false;
  }

  const nutrition = /** @type {Partial<Nutrition>} */ (value);

  return (
    typeof nutrition.calories === "number" &&
    typeof nutrition.protein === "number" &&
    typeof nutrition.carbs === "number" &&
    typeof nutrition.fat === "number"
  );
}

/**
 * @param {unknown} value
 * @returns {value is RecipeIngredientDetail}
 */
function isRecipeIngredientDetail(value) {
  if (!isObject(value)) {
    return false;
  }

  const ingredient = /** @type {Partial<RecipeIngredientDetail>} */ (value);

  return (
    typeof ingredient.ingredientId === "string" &&
    typeof ingredient.name === "string" &&
    typeof ingredient.amount === "string" &&
    typeof ingredient.unit === "string" &&
    typeof ingredient.category === "string" &&
    isNutrition(ingredient.nutrition)
  );
}

/**
 * @param {unknown} value
 * @returns {value is RecipeDetail["nutrition"]}
 */
function isRecipeNutritionSummary(value) {
  if (!isObject(value)) {
    return false;
  }

  const nutrition = /** @type {Partial<RecipeDetail["nutrition"]>} */ (value);

  return (
    isNutrition(nutrition.total) &&
    isNutrition(nutrition.perServing) &&
    Array.isArray(nutrition.missingIngredientIds) &&
    nutrition.missingIngredientIds.every(
      (ingredientId) => typeof ingredientId === "string",
    )
  );
}

/**
 * @param {unknown} value
 * @returns {value is RecipeDetail}
 */
function isRecipeDetail(value) {
  if (!isObject(value)) {
    return false;
  }

  const recipe = /** @type {Partial<RecipeDetail>} */ (value);

  return (
    typeof recipe.id === "string" &&
    typeof recipe.title === "string" &&
    typeof recipe.description === "string" &&
    typeof recipe.servings === "number" &&
    typeof recipe.prepTime === "string" &&
    typeof recipe.cookTime === "string" &&
    typeof recipe.difficulty === "string" &&
    Array.isArray(recipe.tags) &&
    recipe.tags.every((tag) => typeof tag === "string") &&
    Array.isArray(recipe.instructions) &&
    recipe.instructions.every(
      (instruction) => typeof instruction === "string",
    ) &&
    Array.isArray(recipe.ingredients) &&
    recipe.ingredients.every(isRecipeIngredientDetail) &&
    isRecipeNutritionSummary(recipe.nutrition)
  );
}

/**
 * @param {{ apiBaseUrl?: string, filters?: RecipeFilterInput, fetchImpl?: RecipesFetch }} [options]
 * @returns {Promise<{ recipes: RecipeListItem[], error: string | null }>}
 */
export async function getRecipes({
  apiBaseUrl,
  filters,
  fetchImpl = /** @type {RecipesFetch} */ (globalThis.fetch),
} = {}) {
  try {
    const response = await fetchImpl(getRecipesUrl(apiBaseUrl, filters), {
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
 * @param {string} id
 * @param {{ apiBaseUrl?: string, fetchImpl?: RecipesFetch }} [options]
 * @returns {Promise<{ recipe: RecipeDetail | null, error: string | null, notFound: boolean }>}
 */
export async function getRecipe(
  id,
  {
    apiBaseUrl,
    fetchImpl = /** @type {RecipesFetch} */ (globalThis.fetch),
  } = {},
) {
  try {
    const response = await fetchImpl(getRecipeUrl(id, apiBaseUrl), {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          recipe: null,
          error: null,
          notFound: true,
        };
      }

      return {
        recipe: null,
        error: `Unable to load recipe (${response.status})`,
        notFound: false,
      };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return {
        recipe: null,
        error: "Invalid data format received from the recipe service.",
        notFound: false,
      };
    }

    if (!isRecipeDetail(data)) {
      return {
        recipe: null,
        error: "Invalid data format received from the recipe service.",
        notFound: false,
      };
    }

    return {
      recipe: data,
      error: null,
      notFound: false,
    };
  } catch {
    return {
      recipe: null,
      error: "Unable to reach the recipe service.",
      notFound: false,
    };
  }
}

/**
 * @param {unknown} difficulty
 */
export function formatDifficulty(difficulty) {
  if (typeof difficulty !== "string") {
    return "Unrated";
  }

  const normalizedDifficulty = difficulty.trim();

  if (!normalizedDifficulty) {
    return "Unrated";
  }

  return (
    normalizedDifficulty.charAt(0).toUpperCase() + normalizedDifficulty.slice(1)
  );
}
