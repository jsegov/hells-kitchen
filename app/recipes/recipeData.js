import * as recipeLib from "../../lib/recipes";
import {
  ALLERGEN_OPTIONS,
  DEFAULT_RECIPE_SORT,
  DIETARY_OPTIONS,
  RECIPE_SORT_OPTIONS,
  RECIPE_SORT_ORDERS,
  getOptionLabel,
  splitSortToken,
} from "../../lib/recipeOptions";

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
 * @property {string} dateAdded
 * @property {string[]} dietary
 * @property {string[]} allergens
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
 * @property {string[]} dietary
 * @property {string[]} allergens
 * @property {{ total: Nutrition, perServing: Nutrition, missingIngredientIds: string[], unconvertedIngredientIds: string[] }} nutrition
 */

/**
 * @typedef {object} RecipeFilterInput
 * @property {unknown=} name
 * @property {unknown=} tag
 * @property {unknown=} ingredient
 * @property {unknown=} diet
 * @property {unknown=} exclude
 * @property {unknown=} sort
 * @property {unknown=} order
 */

/**
 * @typedef {object} RecipeFilters
 * @property {string[]} name
 * @property {string[]} tag
 * @property {string[]} ingredient
 * @property {string[]} diet
 * @property {string[]} exclude
 */

/**
 * @typedef {object} RecipeSort
 * @property {string} sort
 * @property {string} order
 */

/**
 * @typedef {object} RecipeFacetOption
 * @property {string} value
 * @property {string} label
 * @property {number} count
 */

/**
 * @typedef {object} RecipeFacets
 * @property {RecipeFacetOption[]} tags
 * @property {RecipeFacetOption[]} ingredients
 * @property {RecipeFacetOption[]} diets
 * @property {RecipeFacetOption[]} allergens
 */

/**
 * @typedef {object} RecipeDataLayer
 * @property {(filters?: RecipeFilterInput, sort?: RecipeSort) => Promise<unknown[]>} getRecipeList
 * @property {(filters?: RecipeFilterInput) => Promise<unknown>} getRecipeFacets
 * @property {(id: string) => Promise<unknown>} getRecipeDetail
 */

const DIETARY_VALUES = new Set(DIETARY_OPTIONS.map((option) => option.value));
const ALLERGEN_VALUES = new Set(ALLERGEN_OPTIONS.map((option) => option.value));
const SORT_VALUES = new Set(RECIPE_SORT_OPTIONS.map((option) => option.value));
const SORT_ORDER_VALUES = new Set(
  RECIPE_SORT_ORDERS.map((option) => option.value),
);

// Trims only — intentionally preserves the user's original casing for the
// filter input display. The backend (recipes.js toSearchText) lowercases for
// case-insensitive matching, so this normalization is duplicated by design but
// deliberately not identical.
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
 * @param {unknown} value
 * @param {ReadonlySet<string>} allowedValues
 */
function normalizeKnownFilterValues(value, allowedValues) {
  return Array.from(
    new Set(
      normalizeFilterValues(value)
        .map((filterValue) => filterValue.toLowerCase())
        .filter((filterValue) => allowedValues.has(filterValue)),
    ),
  );
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
      diet: [],
      exclude: [],
    };
  }

  return {
    name: normalizeFilterValues(filters.name),
    tag: normalizeFilterValues(filters.tag),
    ingredient: normalizeFilterValues(filters.ingredient),
    diet: normalizeKnownFilterValues(filters.diet, DIETARY_VALUES),
    exclude: normalizeKnownFilterValues(filters.exclude, ALLERGEN_VALUES),
  };
}

/**
 * @param {unknown} value
 */
function normalizeSortValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * @param {RecipeFilterInput=} input
 * @returns {RecipeSort}
 */
export function normalizeRecipeSort(input = {}) {
  if (!input || typeof input !== "object") {
    return DEFAULT_RECIPE_SORT;
  }

  // The sort dropdown submits a combined `${sort}-${order}` token; fall back to
  // legacy separate `sort`/`order` params for back-compat (matches lib/recipes).
  const rawSort = /** @type {{ sort?: unknown }} */ (input).sort;
  const combined = splitSortToken(rawSort);
  const sortValue = combined ? combined.sort : normalizeSortValue(rawSort);

  if (!SORT_VALUES.has(sortValue)) {
    return DEFAULT_RECIPE_SORT;
  }

  const orderValue = combined
    ? combined.order
    : normalizeSortValue(/** @type {{ order?: unknown }} */ (input).order);

  return {
    sort: sortValue,
    order: SORT_ORDER_VALUES.has(orderValue)
      ? orderValue
      : DEFAULT_RECIPE_SORT.order,
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
    normalizedFilters.ingredient.length > 0 ||
    normalizedFilters.diet.length > 0 ||
    normalizedFilters.exclude.length > 0
  );
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
 * @returns {value is RecipeListItem}
 */
function isRecipeListItem(value) {
  if (!isObject(value)) {
    return false;
  }

  const recipe = /** @type {Partial<RecipeListItem>} */ (value);

  return (
    typeof recipe.id === "string" &&
    recipe.id.trim().length > 0 &&
    typeof recipe.title === "string" &&
    recipe.title.trim().length > 0 &&
    typeof recipe.description === "string" &&
    typeof recipe.servings === "number" &&
    Number.isFinite(recipe.servings) &&
    typeof recipe.prepTime === "string" &&
    typeof recipe.cookTime === "string" &&
    typeof recipe.difficulty === "string" &&
    typeof recipe.ingredientCount === "number" &&
    Number.isFinite(recipe.ingredientCount) &&
    Array.isArray(recipe.tags) &&
    recipe.tags.every((tag) => typeof tag === "string") &&
    typeof recipe.dateAdded === "string" &&
    Array.isArray(recipe.dietary) &&
    recipe.dietary.every((diet) => typeof diet === "string") &&
    Array.isArray(recipe.allergens) &&
    recipe.allergens.every((allergen) => typeof allergen === "string")
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
    ) &&
    Array.isArray(nutrition.unconvertedIngredientIds) &&
    nutrition.unconvertedIngredientIds.every(
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
    Array.isArray(recipe.dietary) &&
    recipe.dietary.every((diet) => typeof diet === "string") &&
    Array.isArray(recipe.allergens) &&
    recipe.allergens.every((allergen) => typeof allergen === "string") &&
    isRecipeNutritionSummary(recipe.nutrition)
  );
}

/**
 * @param {{ filters?: RecipeFilterInput, sort?: RecipeSort, dataLayer?: Pick<RecipeDataLayer, "getRecipeList"> }} [options]
 * @returns {Promise<{ recipes: RecipeListItem[], error: string | null }>}
 */
export async function getRecipes({
  filters,
  sort,
  dataLayer = /** @type {RecipeDataLayer} */ (recipeLib),
} = {}) {
  try {
    const data = await dataLayer.getRecipeList(filters, sort);

    if (!Array.isArray(data) || !data.every(isRecipeListItem)) {
      return {
        recipes: [],
        error: "Invalid data format received from the recipe service.",
      };
    }

    return {
      recipes: /** @type {RecipeListItem[]} */ (data),
      error: null,
    };
  } catch {
    return {
      recipes: [],
      error: "Unable to load recipes.",
    };
  }
}

/**
 * @param {unknown} value
 * @returns {value is RecipeFacetOption}
 */
function isRecipeFacetOption(value) {
  if (!isObject(value)) {
    return false;
  }

  const option = /** @type {Partial<RecipeFacetOption>} */ (value);

  return (
    typeof option.value === "string" &&
    typeof option.label === "string" &&
    typeof option.count === "number" &&
    Number.isFinite(option.count)
  );
}

/**
 * @param {unknown} value
 * @returns {value is RecipeFacetOption[]}
 */
function isFacetOptionArray(value) {
  return Array.isArray(value) && value.every(isRecipeFacetOption);
}

/**
 * @param {unknown} value
 * @returns {value is RecipeFacets}
 */
function isRecipeFacets(value) {
  if (!isObject(value)) {
    return false;
  }

  const facets = /** @type {Partial<RecipeFacets>} */ (value);

  return (
    isFacetOptionArray(facets.tags) &&
    isFacetOptionArray(facets.ingredients) &&
    isFacetOptionArray(facets.diets) &&
    isFacetOptionArray(facets.allergens)
  );
}

/** @type {RecipeFacets} */
const EMPTY_FACETS = { tags: [], ingredients: [], diets: [], allergens: [] };

/**
 * Tag labels arrive raw (lowercase) from the data layer; diet/allergen labels
 * are already display-ready option labels and ingredient labels are names. This
 * capitalizes tag labels so all four facets read uniformly in the UI.
 *
 * @param {RecipeFacets} facets
 * @returns {RecipeFacets}
 */
function toDisplayFacets(facets) {
  return {
    ...facets,
    tags: facets.tags.map((option) => ({
      ...option,
      label: formatTagLabel(option.value),
    })),
  };
}

/**
 * @param {{ filters?: RecipeFilterInput, dataLayer?: Pick<RecipeDataLayer, "getRecipeFacets"> }} [options]
 * @returns {Promise<{ facets: RecipeFacets, error: string | null }>}
 */
export async function getRecipeFacets({
  filters,
  dataLayer = /** @type {RecipeDataLayer} */ (recipeLib),
} = {}) {
  try {
    const data = await dataLayer.getRecipeFacets(filters);

    if (!isRecipeFacets(data)) {
      return {
        facets: EMPTY_FACETS,
        error: "Invalid data format received from the recipe service.",
      };
    }

    return { facets: toDisplayFacets(data), error: null };
  } catch {
    return { facets: EMPTY_FACETS, error: "Unable to load recipe filters." };
  }
}

/**
 * @param {string} id
 * @param {{ dataLayer?: Pick<RecipeDataLayer, "getRecipeDetail"> }} [options]
 * @returns {Promise<{ recipe: RecipeDetail | null, error: string | null, notFound: boolean }>}
 */
export async function getRecipe(
  id,
  { dataLayer = /** @type {RecipeDataLayer} */ (recipeLib) } = {},
) {
  try {
    const data = await dataLayer.getRecipeDetail(id);

    if (data === null || data === undefined) {
      return {
        recipe: null,
        error: null,
        notFound: true,
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
      recipe: /** @type {RecipeDetail} */ (data),
      error: null,
      notFound: false,
    };
  } catch {
    return {
      recipe: null,
      error: "Unable to load the recipe.",
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

/**
 * @param {string} value
 */
export function formatTagLabel(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * @param {string} value
 */
export function formatDietaryLabel(value) {
  return getOptionLabel(DIETARY_OPTIONS, value);
}

/**
 * @param {string} value
 */
export function formatAllergenLabel(value) {
  return getOptionLabel(ALLERGEN_OPTIONS, value);
}
