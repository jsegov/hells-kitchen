import { getSql, withNeonReadRetry } from "./db.js";
import {
  deriveRecipeDietaryProfile,
  matchesDietaryProfileFilters,
  normalizeAllergenValues,
  normalizeDietaryValues,
} from "./dietary.js";
import {
  DEFAULT_RECIPE_SORT,
  RECIPE_SORT_OPTIONS,
  RECIPE_SORT_ORDERS,
} from "./recipeOptions.js";

/**
 * @typedef {object} RecipeIngredient
 * @property {string} ingredientId
 * @property {unknown} amount
 * @property {unknown} unit
 */

/**
 * @typedef {object} Nutrition
 * @property {number} calories
 * @property {number} protein
 * @property {number} carbs
 * @property {number} fat
 */

/**
 * @typedef {object} Ingredient
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {Nutrition=} nutrition
 * @property {string[]=} dietary
 * @property {string[]=} commonAllergens
 */

/**
 * @typedef {object} Recipe
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} servings
 * @property {string} prepTime
 * @property {string} cookTime
 * @property {unknown} difficulty
 * @property {RecipeIngredient[]=} ingredients
 * @property {string[]=} instructions
 * @property {string[]=} tags
 * @property {string=} dateAdded
 */

/**
 * @typedef {object} RecipeListItem
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} servings
 * @property {string} prepTime
 * @property {string} cookTime
 * @property {string} difficulty
 * @property {string[]} tags
 * @property {string} dateAdded
 * @property {string[]} dietary
 * @property {string[]} allergens
 * @property {number} ingredientCount
 */

/**
 * @typedef {object} RecipeListFilters
 * @property {unknown=} name
 * @property {unknown=} tag
 * @property {unknown=} ingredient
 * @property {unknown=} diet
 * @property {unknown=} exclude
 */

/**
 * @typedef {object} NormalizedRecipeListFilters
 * @property {string[]} names
 * @property {string[]} tags
 * @property {string[]} ingredients
 * @property {string[]} diets
 * @property {string[]} excludedAllergens
 */

/**
 * @typedef {object} RecipeListSortInput
 * @property {unknown=} sort
 * @property {unknown=} order
 */

/**
 * @typedef {object} NormalizedRecipeListSort
 * @property {string} sort
 * @property {string} order
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
 * @typedef {object} RecipeNutritionSummary
 * @property {Nutrition} total
 * @property {Nutrition} perServing
 * @property {string[]} missingIngredientIds
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
 * @property {RecipeNutritionSummary} nutrition
 */

/**
 * @typedef {() => Promise<unknown>} ReadRecipeData
 */

/**
 * @typedef {object} RecipeRepository
 * @property {(filters?: RecipeListFilters, sort?: RecipeListSortInput) => Promise<RecipeListItem[]>} getRecipeList
 * @property {(id: string) => Promise<RecipeDetail | null>} getRecipeDetail
 */

/**
 * @typedef {object} RecipeListRow
 * @property {unknown} id
 * @property {unknown} title
 * @property {unknown} description
 * @property {unknown} servings
 * @property {unknown} prep_time
 * @property {unknown} cook_time
 * @property {unknown} difficulty
 * @property {unknown} tags
 * @property {unknown} ingredient_count
 * @property {unknown} date_added
 * @property {unknown} ingredient_metadata
 */

/** @type {Array<keyof Nutrition>} */
const NUTRITION_FIELDS = ["calories", "protein", "carbs", "fat"];

const RECIPES_CACHE_TAG = "recipes";
const RECIPES_CACHE_REVALIDATE_SECONDS = 3600;

const RECIPE_SORT_VALUES = new Set(
  RECIPE_SORT_OPTIONS.map((option) => option.value),
);
const RECIPE_SORT_ORDER_VALUES = new Set(
  RECIPE_SORT_ORDERS.map((option) => option.value),
);
const DIFFICULTY_RANKS = new Map([
  ["easy", 1],
  ["medium", 2],
  ["hard", 3],
]);
const RECIPE_SORT_SQL_EXPRESSIONS = Object.freeze({
  title: "LOWER(r.title)",
  "prep-time": "r.prep_time_minutes",
  "cook-time": "r.cook_time_minutes",
  difficulty: "r.difficulty_rank",
  servings: "r.servings",
  "date-added": "r.date_added",
});

/**
 * @param {unknown} value
 */
const toPostgresNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getData = async () => {
  const sql = await getSql();
  const [ingredients, recipes, recipeIngredients] = await withNeonReadRetry(
    () =>
      sql.transaction(
        [
          sql`SELECT id, name, category, calories, protein, carbs, fat, dietary, allergens FROM ingredients`,
          sql`SELECT id, title, description, servings, prep_time, cook_time, difficulty,
                 instructions, tags, date_added FROM recipes ORDER BY sort_order ASC`,
          sql`SELECT recipe_id, ingredient_id, amount, unit FROM recipe_ingredients ORDER BY recipe_id, position`,
        ],
        { readOnly: true },
      ),
    { label: "Recipe catalog read" },
  );

  /** @type {Map<string, RecipeIngredient[]>} */
  const ingredientsByRecipe = new Map();

  for (const recipeIngredient of recipeIngredients) {
    const recipeId = String(recipeIngredient.recipe_id ?? "");

    if (!ingredientsByRecipe.has(recipeId)) {
      ingredientsByRecipe.set(recipeId, []);
    }

    ingredientsByRecipe.get(recipeId)?.push({
      ingredientId: String(recipeIngredient.ingredient_id ?? ""),
      amount: String(recipeIngredient.amount ?? ""),
      unit: String(recipeIngredient.unit ?? ""),
    });
  }

  return {
    ingredients: ingredients.map((ingredient) => ({
      id: String(ingredient.id ?? ""),
      name: String(ingredient.name ?? ""),
      category: String(ingredient.category ?? ""),
      nutrition: {
        calories: toPostgresNumber(ingredient.calories),
        protein: toPostgresNumber(ingredient.protein),
        carbs: toPostgresNumber(ingredient.carbs),
        fat: toPostgresNumber(ingredient.fat),
      },
      dietary: Array.isArray(ingredient.dietary) ? ingredient.dietary : [],
      commonAllergens: Array.isArray(ingredient.allergens)
        ? ingredient.allergens
        : [],
    })),
    recipes: recipes.map((recipe) => ({
      id: String(recipe.id ?? ""),
      title: String(recipe.title ?? ""),
      description: String(recipe.description ?? ""),
      servings: toPostgresNumber(recipe.servings),
      prepTime: String(recipe.prep_time ?? ""),
      cookTime: String(recipe.cook_time ?? ""),
      difficulty: String(recipe.difficulty ?? ""),
      instructions: Array.isArray(recipe.instructions)
        ? recipe.instructions
        : [],
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
      dateAdded:
        typeof recipe.date_added === "string"
          ? recipe.date_added
          : (recipe.date_added?.toISOString?.() ?? ""),
      ingredients: ingredientsByRecipe.get(String(recipe.id ?? "")) ?? [],
    })),
  };
};

/**
 * @returns {Nutrition}
 */
const createEmptyNutrition = () => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});

/**
 * @param {unknown} value
 */
const toSafeString = (value) => (typeof value === "string" ? value : "");

/**
 * @param {unknown} value
 */
const toSafeNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

// Backend lowercases filter terms for case-insensitive matching. The frontend
// (recipeData.js normalizeFilterValues) trims only, preserving the user's
// original casing for the filter input display — the duplication is intentional
// and the two are deliberately not identical.
/**
 * @param {unknown} value
 */
const toSearchText = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/**
 * @param {string} term
 */
const toLikePattern = (term) => `%${term.replace(/[\\%_]/g, "\\$&")}%`;

/**
 * @param {unknown} value
 */
const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

/**
 * @param {unknown} value
 * @returns {string[]}
 */
const normalizeFilterValues = (value) => {
  if (typeof value === "string") {
    return value.split(",").map(toSearchText).filter(Boolean);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(normalizeFilterValues);
};

/**
 * @param {RecipeListFilters=} filters
 * @returns {NormalizedRecipeListFilters}
 */
const normalizeRecipeListFilters = (filters = {}) => {
  if (!filters || typeof filters !== "object") {
    return {
      names: [],
      tags: [],
      ingredients: [],
      diets: [],
      excludedAllergens: [],
    };
  }

  return {
    names: normalizeFilterValues(filters.name),
    tags: normalizeFilterValues(filters.tag),
    ingredients: normalizeFilterValues(filters.ingredient),
    diets: normalizeDietaryValues(filters.diet),
    excludedAllergens: normalizeAllergenValues(filters.exclude),
  };
};

/**
 * @param {NormalizedRecipeListFilters} filters
 */
const hasActiveRecipeListFilters = (filters) =>
  filters.names.length > 0 ||
  filters.tags.length > 0 ||
  filters.ingredients.length > 0 ||
  filters.diets.length > 0 ||
  filters.excludedAllergens.length > 0;

/**
 * @param {unknown} value
 */
const normalizeSortValue = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/**
 * @param {RecipeListSortInput=} sort
 * @returns {NormalizedRecipeListSort}
 */
const normalizeRecipeListSort = (sort = {}) => {
  if (!sort || typeof sort !== "object") {
    return DEFAULT_RECIPE_SORT;
  }

  const sortValue = normalizeSortValue(sort.sort);

  if (!RECIPE_SORT_VALUES.has(sortValue)) {
    return DEFAULT_RECIPE_SORT;
  }

  const orderValue = normalizeSortValue(sort.order);

  return {
    sort: sortValue,
    order: RECIPE_SORT_ORDER_VALUES.has(orderValue)
      ? orderValue
      : DEFAULT_RECIPE_SORT.order,
  };
};

/**
 * @param {unknown[]} params
 * @param {unknown} value
 */
const addQueryParam = (params, value) => {
  params.push(value);
  return `$${params.length}`;
};

/**
 * @param {string} expression
 * @param {string} placeholder
 */
const createIlikeCondition = (expression, placeholder) =>
  `${expression} ILIKE ${placeholder} ESCAPE '\\'`;

/**
 * @param {NormalizedRecipeListSort} sort
 */
const createRecipeListOrderClause = (sort) => {
  const direction = sort.order === "desc" ? "DESC" : "ASC";

  if (sort.sort === "curated") {
    return `ORDER BY r.sort_order ${direction}, r.id ASC`;
  }

  const expression = /** @type {Record<string, string>} */ (
    RECIPE_SORT_SQL_EXPRESSIONS
  )[sort.sort];

  return `ORDER BY ${expression} ${direction} NULLS LAST, r.sort_order ASC, r.id ASC`;
};

/**
 * @param {NormalizedRecipeListFilters} filters
 * @param {NormalizedRecipeListSort} sort
 */
const createRecipeListQuery = (filters, sort) => {
  /** @type {unknown[]} */
  const params = [];
  /** @type {string[]} */
  const conditions = [];

  for (const term of filters.names) {
    const placeholder = addQueryParam(params, toLikePattern(term));
    conditions.push(createIlikeCondition("r.title", placeholder));
  }

  for (const term of filters.tags) {
    const placeholder = addQueryParam(params, toLikePattern(term));
    // Tags remain a text[] to preserve the current schema; substring matching
    // over unnest() may scan until a normalized tag table is warranted.
    conditions.push(`EXISTS (
      SELECT 1
      FROM unnest(r.tags) AS tag(value)
      WHERE ${createIlikeCondition("tag.value", placeholder)}
    )`);
  }

  for (const term of filters.ingredients) {
    const placeholder = addQueryParam(params, toLikePattern(term));
    conditions.push(`EXISTS (
      SELECT 1
      FROM recipe_ingredients ri_filter
      LEFT JOIN ingredients i_filter ON i_filter.id = ri_filter.ingredient_id
      WHERE ri_filter.recipe_id = r.id
        AND (
          ${createIlikeCondition("ri_filter.ingredient_id", placeholder)}
          OR ${createIlikeCondition(
            "replace(ri_filter.ingredient_id, '_', ' ')",
            placeholder,
          )}
          OR ${createIlikeCondition("i_filter.name", placeholder)}
          OR ${createIlikeCondition("i_filter.category", placeholder)}
        )
    )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join("\n    AND ")}`
    : "";
  const orderClause = createRecipeListOrderClause(sort);

  return {
    queryText: `
      SELECT
        r.id,
        r.title,
        r.description,
        r.servings,
        r.prep_time,
        r.cook_time,
        r.difficulty,
        r.tags,
        r.date_added,
        (
          SELECT COUNT(*)
          FROM recipe_ingredients ri_count
          WHERE ri_count.recipe_id = r.id
            AND ri_count.ingredient_id <> ''
        ) AS ingredient_count,
        (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'ingredientId', ri_profile.ingredient_id,
                'isMissing', i_profile.id IS NULL,
                'dietary', COALESCE(i_profile.dietary, '{}'::text[]),
                'commonAllergens', COALESCE(i_profile.allergens, '{}'::text[])
              )
              ORDER BY ri_profile.position
            ) FILTER (WHERE ri_profile.recipe_id IS NOT NULL),
            '[]'::jsonb
          )
          FROM recipe_ingredients ri_profile
          LEFT JOIN ingredients i_profile ON i_profile.id = ri_profile.ingredient_id
          WHERE ri_profile.recipe_id = r.id
        ) AS ingredient_metadata
      FROM recipes r
      ${whereClause}
      ${orderClause}
    `,
    params,
  };
};

/**
 * @param {number} value
 */
const roundNutritionValue = (value) => Math.round(value * 10) / 10;

/**
 * @param {Nutrition} nutrition
 * @returns {Nutrition}
 */
const roundNutrition = (nutrition) => ({
  calories: roundNutritionValue(nutrition.calories),
  protein: roundNutritionValue(nutrition.protein),
  carbs: roundNutritionValue(nutrition.carbs),
  fat: roundNutritionValue(nutrition.fat),
});

/**
 * @param {unknown} nutrition
 * @param {string} field
 */
const getNutritionValue = (nutrition, field) => {
  if (!nutrition || typeof nutrition !== "object") {
    return 0;
  }

  const value = /** @type {Record<string, unknown>} */ (nutrition)[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

/**
 * @param {unknown} amount
 */
const parseRecipeAmount = (amount) => {
  if (typeof amount === "number") {
    return Number.isFinite(amount) ? amount : 0;
  }

  if (typeof amount !== "string") {
    return 0;
  }

  const normalizedAmount = amount.trim();

  if (!normalizedAmount) {
    return 0;
  }

  const numericAmount = Number(normalizedAmount);

  if (Number.isFinite(numericAmount)) {
    return numericAmount;
  }

  const fractionMatch = normalizedAmount.match(
    /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/,
  );

  if (!fractionMatch) {
    return 0;
  }

  const numerator = Number(fractionMatch[1]);
  const denominator = Number(fractionMatch[2]);

  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return 0;
  }

  return numerator / denominator;
};

/**
 * @param {unknown} duration
 * @returns {number | null}
 */
const parseDurationMinutes = (duration) => {
  if (typeof duration === "number") {
    return Number.isFinite(duration) ? Math.round(duration) : null;
  }

  if (typeof duration !== "string") {
    return null;
  }

  const normalizedDuration = duration.trim().toLowerCase();

  if (!normalizedDuration) {
    return null;
  }

  let minutes = 0;
  let matchedUnit = false;
  const hourMatches = normalizedDuration.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b/g,
  );
  const minuteMatches = normalizedDuration.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)\b/g,
  );

  for (const match of hourMatches) {
    minutes += Number(match[1]) * 60;
    matchedUnit = true;
  }

  for (const match of minuteMatches) {
    minutes += Number(match[1]);
    matchedUnit = true;
  }

  if (matchedUnit) {
    return Number.isFinite(minutes) ? Math.round(minutes) : null;
  }

  const fallbackMatch = normalizedDuration.match(/\d+(?:\.\d+)?/);

  if (!fallbackMatch) {
    return null;
  }

  const fallbackMinutes = Number(fallbackMatch[0]);
  return Number.isFinite(fallbackMinutes) ? Math.round(fallbackMinutes) : null;
};

/**
 * @param {unknown} difficulty
 */
const getDifficultyRank = (difficulty) =>
  DIFFICULTY_RANKS.get(toSearchText(difficulty)) ?? null;

/**
 * @param {unknown} dateAdded
 */
const parseDateAddedTime = (dateAdded) => {
  if (typeof dateAdded !== "string" || !dateAdded.trim()) {
    return null;
  }

  const time = Date.parse(dateAdded);
  return Number.isFinite(time) ? time : null;
};

/**
 * @param {string} ingredientId
 */
const formatIngredientName = (ingredientId) => {
  const fallbackName = ingredientId.split("_").filter(Boolean).join(" ").trim();

  if (!fallbackName) {
    return "Unknown ingredient";
  }

  return fallbackName.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

/**
 * @param {Nutrition} nutrition
 * @param {number} multiplier
 * @returns {Nutrition}
 */
const multiplyNutrition = (nutrition, multiplier) => {
  const scaledNutrition = createEmptyNutrition();

  for (const field of NUTRITION_FIELDS) {
    scaledNutrition[field] = getNutritionValue(nutrition, field) * multiplier;
  }

  return roundNutrition(scaledNutrition);
};

/**
 * @param {Nutrition} target
 * @param {Nutrition} source
 */
const addNutrition = (target, source) => {
  for (const field of NUTRITION_FIELDS) {
    target[field] += getNutritionValue(source, field);
  }
};

/**
 * @param {Nutrition} nutrition
 * @param {number} servings
 */
const divideNutrition = (nutrition, servings) => {
  if (
    typeof servings !== "number" ||
    !Number.isFinite(servings) ||
    servings <= 0
  ) {
    return createEmptyNutrition();
  }

  return roundNutrition({
    calories: nutrition.calories / servings,
    protein: nutrition.protein / servings,
    carbs: nutrition.carbs / servings,
    fat: nutrition.fat / servings,
  });
};

/**
 * @param {unknown} data
 * @returns {Map<string, Ingredient>}
 */
const toIngredientMap = (data) => {
  /** @type {Map<string, Ingredient>} */
  const ingredientMap = new Map();

  if (!data || typeof data !== "object") {
    return ingredientMap;
  }

  const ingredients = /** @type {{ ingredients?: unknown }} */ (data)
    .ingredients;

  if (!Array.isArray(ingredients)) {
    return ingredientMap;
  }

  for (const ingredient of ingredients) {
    if (!ingredient || typeof ingredient !== "object") {
      continue;
    }

    const typedIngredient = /** @type {Partial<Ingredient>} */ (ingredient);

    if (typeof typedIngredient.id === "string") {
      ingredientMap.set(
        typedIngredient.id,
        /** @type {Ingredient} */ (ingredient),
      );
    }
  }

  return ingredientMap;
};

/**
 * @param {string[]} values
 * @param {string[]} terms
 */
const matchesAllTerms = (values, terms) =>
  terms.every((term) => values.some((value) => value.includes(term)));

/**
 * @param {Recipe | null | undefined} recipe
 * @param {string[]} nameTerms
 */
const matchesRecipeName = (recipe, nameTerms) => {
  if (!nameTerms.length) {
    return true;
  }

  return matchesAllTerms([toSearchText(recipe?.title)], nameTerms);
};

/**
 * @param {Recipe | null | undefined} recipe
 * @param {string[]} tagTerms
 */
const matchesRecipeTags = (recipe, tagTerms) => {
  if (!tagTerms.length) {
    return true;
  }

  const tags = Array.isArray(recipe?.tags) ? recipe.tags.map(toSearchText) : [];
  return matchesAllTerms(tags, tagTerms);
};

/**
 * @param {RecipeIngredient} recipeIngredient
 * @param {Map<string, Ingredient>} ingredientMap
 */
const getRecipeIngredientSearchValues = (recipeIngredient, ingredientMap) => {
  const ingredientId = toSafeString(recipeIngredient.ingredientId);

  if (!ingredientId) {
    return [];
  }

  const ingredient = ingredientMap.get(ingredientId);

  return [
    ingredientId,
    ingredientId.replace(/_/g, " "),
    ingredient?.name || "",
    ingredient?.category || "",
  ]
    .map(toSearchText)
    .filter(Boolean);
};

/**
 * @param {Recipe | null | undefined} recipe
 * @param {string[]} ingredientTerms
 * @param {Map<string, Ingredient>} ingredientMap
 */
const matchesRecipeIngredients = (recipe, ingredientTerms, ingredientMap) => {
  if (!ingredientTerms.length) {
    return true;
  }

  const ingredients = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients
    : [];
  const ingredientValues = ingredients.flatMap((recipeIngredient) => {
    if (!recipeIngredient || typeof recipeIngredient !== "object") {
      return [];
    }

    return getRecipeIngredientSearchValues(recipeIngredient, ingredientMap);
  });

  return matchesAllTerms(ingredientValues, ingredientTerms);
};

/**
 * @param {Recipe | null | undefined} recipe
 * @param {NormalizedRecipeListFilters} filters
 * @param {Map<string, Ingredient>} ingredientMap
 */
const matchesRecipeDietaryFilters = (recipe, filters, ingredientMap) => {
  if (!filters.diets.length && !filters.excludedAllergens.length) {
    return true;
  }

  if (!recipe || typeof recipe !== "object") {
    return false;
  }

  const profile = deriveRecipeDietaryProfile(recipe.ingredients, ingredientMap);
  return matchesDietaryProfileFilters(profile, filters);
};

/**
 * @param {Recipe | null | undefined} recipe
 * @param {NormalizedRecipeListFilters} filters
 * @param {Map<string, Ingredient>} ingredientMap
 */
const matchesRecipeListFilters = (recipe, filters, ingredientMap) => {
  if (!hasActiveRecipeListFilters(filters)) {
    return true;
  }

  if (!recipe || typeof recipe !== "object") {
    return false;
  }

  return (
    matchesRecipeName(recipe, filters.names) &&
    matchesRecipeTags(recipe, filters.tags) &&
    matchesRecipeIngredients(recipe, filters.ingredients, ingredientMap) &&
    matchesRecipeDietaryFilters(recipe, filters, ingredientMap)
  );
};

/**
 * @param {Recipe | null | undefined} recipe
 * @param {string} sort
 */
const getRecipeSortValue = (recipe, sort) => {
  if (!recipe || typeof recipe !== "object") {
    return null;
  }

  if (sort === "title") {
    const title = toSearchText(recipe.title);
    return title || null;
  }

  if (sort === "prep-time") {
    return parseDurationMinutes(recipe.prepTime);
  }

  if (sort === "cook-time") {
    return parseDurationMinutes(recipe.cookTime);
  }

  if (sort === "difficulty") {
    return getDifficultyRank(recipe.difficulty);
  }

  if (sort === "servings") {
    return typeof recipe.servings === "number" &&
      Number.isFinite(recipe.servings)
      ? recipe.servings
      : null;
  }

  if (sort === "date-added") {
    return parseDateAddedTime(recipe.dateAdded);
  }

  return null;
};

/**
 * @param {string | number | null} firstValue
 * @param {string | number | null} secondValue
 * @param {string} order
 */
const compareNullableSortValues = (firstValue, secondValue, order) => {
  const firstMissing = firstValue === null;
  const secondMissing = secondValue === null;

  if (firstMissing && secondMissing) {
    return 0;
  }

  if (firstMissing) {
    return 1;
  }

  if (secondMissing) {
    return -1;
  }

  if (firstValue < secondValue) {
    return order === "desc" ? 1 : -1;
  }

  if (firstValue > secondValue) {
    return order === "desc" ? -1 : 1;
  }

  return 0;
};

/**
 * @param {unknown} recipe
 */
const getRecipeTieBreakerId = (recipe) => {
  if (!recipe || typeof recipe !== "object") {
    return "";
  }

  return toSafeString(/** @type {Partial<Recipe>} */ (recipe).id);
};

/**
 * @param {{ recipe: unknown, index: number }} first
 * @param {{ recipe: unknown, index: number }} second
 * @param {NormalizedRecipeListSort} sort
 */
const compareRecipeEntries = (first, second, sort) => {
  if (sort.sort !== "curated") {
    const primaryComparison = compareNullableSortValues(
      getRecipeSortValue(
        /** @type {Recipe | null | undefined} */ (first.recipe),
        sort.sort,
      ),
      getRecipeSortValue(
        /** @type {Recipe | null | undefined} */ (second.recipe),
        sort.sort,
      ),
      sort.order,
    );

    if (primaryComparison !== 0) {
      return primaryComparison;
    }

    if (first.index !== second.index) {
      return first.index - second.index;
    }
  } else if (first.index !== second.index) {
    return sort.order === "desc"
      ? second.index - first.index
      : first.index - second.index;
  }

  return getRecipeTieBreakerId(first.recipe).localeCompare(
    getRecipeTieBreakerId(second.recipe),
  );
};

/**
 * @param {Recipe | null | undefined} recipe
 * @param {Map<string, Ingredient>} [ingredientMap]
 * @param {import("./dietary.js").DietaryProfile | null} [dietaryProfile]
 * @returns {RecipeListItem | null}
 */
const toRecipeListItem = (
  recipe,
  ingredientMap = new Map(),
  dietaryProfile = null,
) => {
  if (!recipe || typeof recipe !== "object") {
    return null;
  }

  if (!isNonEmptyString(recipe.id) || !isNonEmptyString(recipe.title)) {
    return null;
  }

  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : [];
  const resolvedDietaryProfile =
    dietaryProfile ?? deriveRecipeDietaryProfile(ingredients, ingredientMap);

  return {
    id: recipe.id,
    title: recipe.title,
    description: toSafeString(recipe.description),
    servings: toSafeNumber(recipe.servings),
    prepTime: toSafeString(recipe.prepTime),
    cookTime: toSafeString(recipe.cookTime),
    difficulty: typeof recipe.difficulty === "string" ? recipe.difficulty : "",
    tags: Array.isArray(recipe.tags)
      ? recipe.tags.filter((tag) => typeof tag === "string")
      : [],
    dateAdded: toSafeString(recipe.dateAdded),
    dietary: resolvedDietaryProfile.dietary,
    allergens: resolvedDietaryProfile.allergens,
    ingredientCount: ingredients.filter(
      (ingredient) =>
        ingredient &&
        typeof ingredient === "object" &&
        isNonEmptyString(ingredient.ingredientId),
    ).length,
  };
};

/**
 * @param {unknown} value
 */
const toPostgresDateString = (value) => {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "toISOString" in value) {
    const dateValue = /** @type {{ toISOString?: unknown }} */ (value)
      .toISOString;

    if (typeof dateValue === "function") {
      return dateValue.call(value);
    }
  }

  return "";
};

/**
 * @param {unknown} metadata
 * @returns {{ recipeIngredients: RecipeIngredient[], ingredientMap: Map<string, Ingredient> }}
 */
const toPostgresDietaryMetadata = (metadata) => {
  /** @type {RecipeIngredient[]} */
  const recipeIngredients = [];
  /** @type {Map<string, Ingredient>} */
  const ingredientMap = new Map();
  const rows = Array.isArray(metadata) ? metadata : [];

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const typedRow =
      /** @type {{ ingredientId?: unknown, isMissing?: unknown, dietary?: unknown, commonAllergens?: unknown }} */ (
        row
      );
    const ingredientId = String(typedRow.ingredientId ?? "");

    recipeIngredients.push({
      ingredientId,
      amount: "",
      unit: "",
    });

    if (!ingredientId || typedRow.isMissing === true) {
      continue;
    }

    ingredientMap.set(ingredientId, {
      id: ingredientId,
      name: "",
      category: "",
      dietary: Array.isArray(typedRow.dietary)
        ? typedRow.dietary.filter((value) => typeof value === "string")
        : [],
      commonAllergens: Array.isArray(typedRow.commonAllergens)
        ? typedRow.commonAllergens.filter((value) => typeof value === "string")
        : [],
    });
  }

  return { recipeIngredients, ingredientMap };
};

/**
 * @param {RecipeListRow} row
 * @returns {{ recipe: Recipe, ingredientMap: Map<string, Ingredient> }}
 */
const toRecipeListRecipeFromPostgres = (row) => {
  const { recipeIngredients, ingredientMap } = toPostgresDietaryMetadata(
    row.ingredient_metadata,
  );

  return {
    recipe: {
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      description: String(row.description ?? ""),
      servings: toPostgresNumber(row.servings),
      prepTime: String(row.prep_time ?? ""),
      cookTime: String(row.cook_time ?? ""),
      difficulty: String(row.difficulty ?? ""),
      tags: Array.isArray(row.tags)
        ? row.tags.filter((tag) => typeof tag === "string")
        : [],
      dateAdded: toPostgresDateString(row.date_added),
      ingredients: recipeIngredients,
      instructions: [],
    },
    ingredientMap,
  };
};

/**
 * @param {NormalizedRecipeListFilters} filters
 * @param {NormalizedRecipeListSort} sort
 * @returns {Promise<RecipeListItem[]>}
 */
const getRecipeListFromPostgres = async (filters, sort) => {
  const sql = await getSql();
  const { queryText, params } = createRecipeListQuery(filters, sort);
  const rows = /** @type {RecipeListRow[]} */ (
    await withNeonReadRetry(() => sql.query(queryText, params), {
      label: "Recipe list read",
    })
  );

  return rows.reduce((items, row) => {
    const { recipe, ingredientMap } = toRecipeListRecipeFromPostgres(row);
    const dietaryProfile = deriveRecipeDietaryProfile(
      recipe.ingredients,
      ingredientMap,
    );

    if (!matchesDietaryProfileFilters(dietaryProfile, filters)) {
      return items;
    }

    const item = toRecipeListItem(recipe, ingredientMap, dietaryProfile);

    if (item) {
      items.push({
        ...item,
        description: String(row.description ?? ""),
        ingredientCount: toPostgresNumber(row.ingredient_count),
      });
    }

    return items;
  }, /** @type {RecipeListItem[]} */ ([]));
};

/**
 * Reads a single recipe and only that recipe's ingredients from Postgres, then
 * maps via {@link toRecipeDetail} (the sole detail mapping authority). This
 * avoids loading the whole catalog to render one recipe. A LEFT JOIN keeps every
 * recipe_ingredients row so unresolved ingredient refs still surface in
 * nutrition.missingIngredientIds, matching the in-process mapping path.
 *
 * @param {string} id
 * @returns {Promise<RecipeDetail | null>}
 */
const getRecipeDetailFromPostgres = async (id) => {
  const sql = await getSql();
  const [recipeRows, ingredientRows] = await withNeonReadRetry(
    () =>
      sql.transaction(
        [
          sql`SELECT id, title, description, servings, prep_time, cook_time, difficulty,
                 instructions, tags, date_added FROM recipes WHERE id = ${id}`,
          sql`SELECT ri.ingredient_id AS ingredient_id, ri.amount AS amount, ri.unit AS unit,
                 i.id AS id, i.name AS name, i.category AS category,
                 i.calories AS calories, i.protein AS protein, i.carbs AS carbs, i.fat AS fat,
                 i.dietary AS dietary, i.allergens AS allergens
               FROM recipe_ingredients ri
               LEFT JOIN ingredients i ON i.id = ri.ingredient_id
               WHERE ri.recipe_id = ${id}
               ORDER BY ri.position`,
        ],
        { readOnly: true },
      ),
    { label: "Recipe detail read" },
  );

  const recipeRow = Array.isArray(recipeRows) ? recipeRows[0] : undefined;

  if (!recipeRow) {
    return null;
  }

  const joinedRows = Array.isArray(ingredientRows) ? ingredientRows : [];

  /** @type {Map<string, Ingredient>} */
  const ingredientMap = new Map();

  for (const row of joinedRows) {
    if (row.id == null) {
      continue;
    }

    const ingredientId = String(row.id);

    if (!ingredientMap.has(ingredientId)) {
      ingredientMap.set(ingredientId, {
        id: ingredientId,
        name: String(row.name ?? ""),
        category: String(row.category ?? ""),
        nutrition: {
          calories: toPostgresNumber(row.calories),
          protein: toPostgresNumber(row.protein),
          carbs: toPostgresNumber(row.carbs),
          fat: toPostgresNumber(row.fat),
        },
        dietary: Array.isArray(row.dietary)
          ? row.dietary.filter((value) => typeof value === "string")
          : [],
        commonAllergens: Array.isArray(row.allergens)
          ? row.allergens.filter((value) => typeof value === "string")
          : [],
      });
    }
  }

  /** @type {Recipe} */
  const recipe = {
    id: String(recipeRow.id ?? ""),
    title: String(recipeRow.title ?? ""),
    description: String(recipeRow.description ?? ""),
    servings: toPostgresNumber(recipeRow.servings),
    prepTime: String(recipeRow.prep_time ?? ""),
    cookTime: String(recipeRow.cook_time ?? ""),
    difficulty: String(recipeRow.difficulty ?? ""),
    instructions: Array.isArray(recipeRow.instructions)
      ? recipeRow.instructions
      : [],
    tags: Array.isArray(recipeRow.tags) ? recipeRow.tags : [],
    ingredients: joinedRows.map((row) => ({
      ingredientId: String(row.ingredient_id ?? ""),
      amount: String(row.amount ?? ""),
      unit: String(row.unit ?? ""),
    })),
  };

  return toRecipeDetail(recipe, ingredientMap);
};

/**
 * @param {unknown} data
 * @param {RecipeListFilters=} filters
 * @param {RecipeListSortInput=} sort
 * @returns {RecipeListItem[]}
 */
const toRecipeListItems = (data, filters = {}, sort = {}) => {
  if (!data || typeof data !== "object") {
    return [];
  }

  const recipes = /** @type {{ recipes?: unknown }} */ (data).recipes;

  if (!Array.isArray(recipes)) {
    return [];
  }

  const ingredientMap = toIngredientMap(data);
  const normalizedFilters = normalizeRecipeListFilters(filters);
  const normalizedSort = normalizeRecipeListSort(sort);

  return recipes
    .map((recipe, index) => ({ recipe, index }))
    .filter(({ recipe }) =>
      matchesRecipeListFilters(
        /** @type {Recipe | null | undefined} */ (recipe),
        normalizedFilters,
        ingredientMap,
      ),
    )
    .sort((first, second) =>
      compareRecipeEntries(first, second, normalizedSort),
    )
    .reduce((items, { recipe }) => {
      const item = toRecipeListItem(
        /** @type {Recipe | null | undefined} */ (recipe),
        ingredientMap,
      );

      if (item) {
        items.push(item);
      }

      return items;
    }, /** @type {RecipeListItem[]} */ ([]));
};

/**
 * @param {RecipeIngredient} recipeIngredient
 * @param {Map<string, Ingredient>} ingredientMap
 * @returns {{ detail: RecipeIngredientDetail, isMissingIngredient: boolean }}
 */
const toRecipeIngredientDetail = (recipeIngredient, ingredientMap) => {
  const ingredient = ingredientMap.get(recipeIngredient.ingredientId);
  const amountMultiplier = parseRecipeAmount(recipeIngredient.amount);
  const amount =
    typeof recipeIngredient.amount === "number"
      ? String(recipeIngredient.amount)
      : toSafeString(recipeIngredient.amount);
  const nutrition = ingredient?.nutrition
    ? multiplyNutrition(ingredient.nutrition, amountMultiplier)
    : createEmptyNutrition();

  return {
    detail: {
      ingredientId: recipeIngredient.ingredientId,
      name:
        ingredient?.name || formatIngredientName(recipeIngredient.ingredientId),
      amount,
      unit: toSafeString(recipeIngredient.unit),
      category: ingredient?.category || "",
      nutrition,
    },
    isMissingIngredient: !ingredient,
  };
};

/**
 * @param {Recipe | null | undefined} recipe
 * @param {Map<string, Ingredient>} ingredientMap
 * @returns {RecipeDetail | null}
 */
const toRecipeDetail = (recipe, ingredientMap) => {
  if (!recipe || typeof recipe !== "object") {
    return null;
  }

  const totalNutrition = createEmptyNutrition();
  /** @type {Set<string>} */
  const missingIngredientIds = new Set();
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.reduce((items, recipeIngredient) => {
        if (
          !recipeIngredient ||
          typeof recipeIngredient !== "object" ||
          typeof recipeIngredient.ingredientId !== "string"
        ) {
          return items;
        }

        const { detail, isMissingIngredient } = toRecipeIngredientDetail(
          recipeIngredient,
          ingredientMap,
        );

        addNutrition(totalNutrition, detail.nutrition);

        if (isMissingIngredient) {
          missingIngredientIds.add(detail.ingredientId);
        }

        items.push(detail);
        return items;
      }, /** @type {RecipeIngredientDetail[]} */ ([]))
    : [];
  const servings = toSafeNumber(recipe.servings);
  const roundedTotalNutrition = roundNutrition(totalNutrition);
  const dietaryProfile = deriveRecipeDietaryProfile(ingredients, ingredientMap);

  return {
    id: toSafeString(recipe.id),
    title: toSafeString(recipe.title),
    description: toSafeString(recipe.description),
    servings,
    prepTime: toSafeString(recipe.prepTime),
    cookTime: toSafeString(recipe.cookTime),
    difficulty: typeof recipe.difficulty === "string" ? recipe.difficulty : "",
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [],
    ingredients,
    dietary: dietaryProfile.dietary,
    allergens: dietaryProfile.allergens,
    nutrition: {
      total: roundedTotalNutrition,
      perServing: divideNutrition(roundedTotalNutrition, servings),
      missingIngredientIds: Array.from(missingIngredientIds),
    },
  };
};

/**
 * @param {ReadRecipeData} readData
 * @returns {RecipeRepository}
 */
const createRecipeRepository = (readData) => ({
  async getRecipeList(filters = {}, sort = {}) {
    const data = await readData();
    return toRecipeListItems(data, filters, sort);
  },

  async getRecipeDetail(id) {
    const data = await readData();

    if (!data || typeof data !== "object") {
      return null;
    }

    const recipes = /** @type {{ recipes?: unknown }} */ (data).recipes;

    if (!Array.isArray(recipes)) {
      return null;
    }

    const recipe = recipes.find((recipeItem) => {
      if (!recipeItem || typeof recipeItem !== "object") {
        return false;
      }

      return /** @type {Partial<Recipe>} */ (recipeItem).id === id;
    });

    return toRecipeDetail(
      /** @type {Recipe | null | undefined} */ (recipe),
      toIngredientMap(data),
    );
  },
});

/** @type {((filters: NormalizedRecipeListFilters, sort: NormalizedRecipeListSort) => Promise<RecipeListItem[]>) | null} */
let cachedRecipeListFromPostgres = null;

/** @type {((id: string) => Promise<RecipeDetail | null>) | null} */
let cachedRecipeDetailFromPostgres = null;

const importNextCache = async () => {
  try {
    return await import("next/cache");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ERR_MODULE_NOT_FOUND") {
        return import("next/cache.js");
      }
    }

    throw error;
  }
};

const getCachedRecipeListFromPostgres = async () => {
  if (!cachedRecipeListFromPostgres) {
    const { unstable_cache: unstableCache } = await importNextCache();
    cachedRecipeListFromPostgres = unstableCache(
      getRecipeListFromPostgres,
      ["recipe-list"],
      {
        revalidate: RECIPES_CACHE_REVALIDATE_SECONDS,
        tags: [RECIPES_CACHE_TAG],
      },
    );
  }

  return cachedRecipeListFromPostgres;
};

const getCachedRecipeDetailFromPostgres = async () => {
  if (!cachedRecipeDetailFromPostgres) {
    const { unstable_cache: unstableCache } = await importNextCache();
    cachedRecipeDetailFromPostgres = unstableCache(
      getRecipeDetailFromPostgres,
      ["recipe-detail"],
      {
        revalidate: RECIPES_CACHE_REVALIDATE_SECONDS,
        tags: [RECIPES_CACHE_TAG],
      },
    );
  }

  return cachedRecipeDetailFromPostgres;
};

/**
 * @param {unknown} error
 */
const isIncrementalCacheUnavailableError = (error) =>
  error instanceof Error && error.message.includes("incrementalCache missing");

/**
 * Jest, seed scripts, and one-off Node commands do not run inside Next's
 * incremental cache context. Keep those paths executable while using the cache
 * in route handlers and Server Components.
 *
 * @template {unknown[]} Args
 * @template Result
 * @param {(...args: Args) => Promise<Result>} cachedRead
 * @param {(...args: Args) => Promise<Result>} uncachedRead
 * @param {Args} args
 * @returns {Promise<Result>}
 */
const readWithCacheFallback = async (cachedRead, uncachedRead, ...args) => {
  try {
    return await cachedRead(...args);
  } catch (error) {
    if (isIncrementalCacheUnavailableError(error)) {
      return uncachedRead(...args);
    }

    throw error;
  }
};

/**
 * @param {RecipeListFilters=} filters
 * @param {RecipeListSortInput=} sort
 * @returns {Promise<RecipeListItem[]>}
 */
const getRecipeList = async (filters = {}, sort = {}) => {
  const normalizedFilters = normalizeRecipeListFilters(filters);
  const normalizedSort = normalizeRecipeListSort(sort);
  const cachedRead = await getCachedRecipeListFromPostgres();

  return readWithCacheFallback(
    cachedRead,
    getRecipeListFromPostgres,
    normalizedFilters,
    normalizedSort,
  );
};

/**
 * @param {string} id
 * @returns {Promise<RecipeDetail | null>}
 */
const getRecipeDetail = async (id) => {
  const recipeId = typeof id === "string" ? id : "";
  const cachedRead = await getCachedRecipeDetailFromPostgres();

  return readWithCacheFallback(
    cachedRead,
    getRecipeDetailFromPostgres,
    recipeId,
  );
};

const revalidateRecipeCache = async () => {
  const { revalidateTag } = await importNextCache();
  revalidateTag(RECIPES_CACHE_TAG, "max");
};

export {
  RECIPES_CACHE_REVALIDATE_SECONDS,
  RECIPES_CACHE_TAG,
  createRecipeRepository,
  getData,
  getRecipeDetail,
  getRecipeList,
  normalizeRecipeListSort,
  parseDurationMinutes,
  parseRecipeAmount,
  revalidateRecipeCache,
  toIngredientMap,
  toRecipeDetail,
  toRecipeListItem,
  toRecipeListItems,
};
