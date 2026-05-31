import { getSql, withNeonReadRetry } from "./db.js";
import {
  deriveRecipeDietaryProfile,
  matchesDietaryProfileFilters,
  normalizeAllergenValues,
  normalizeDietaryValues,
} from "./dietary.js";
import {
  ALLERGEN_OPTIONS,
  DEFAULT_RECIPE_SORT,
  DIETARY_OPTIONS,
  RECIPE_SORT_OPTIONS,
  RECIPE_SORT_ORDERS,
  formatAllergenFreeLabel,
  splitSortToken,
} from "./recipeOptions.js";

/** @typedef {import("./dietary.js").DietaryProfile} DietaryProfile */

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
 * @property {string=} nutritionBasis
 * @property {Record<string, number>=} unitWeights
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
 * @property {string[]} unconvertedIngredientIds
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
 * @property {(filters?: RecipeListFilters) => Promise<RecipeFacets>} getRecipeFacets
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
const NUTRITION_BASIS_PER_100G = "per_100g";
const MASS_UNIT_GRAMS = new Map([
  ["g", 1],
  ["kg", 1000],
  ["oz", 28.349523125],
  ["lb", 453.59237],
]);
const UNIT_ALIASES = new Map([
  ["g", "g"],
  ["gram", "g"],
  ["grams", "g"],
  ["kg", "kg"],
  ["kilogram", "kg"],
  ["kilograms", "kg"],
  ["oz", "oz"],
  ["ounce", "oz"],
  ["ounces", "oz"],
  ["lb", "lb"],
  ["lbs", "lb"],
  ["pound", "lb"],
  ["pounds", "lb"],
  ["ml", "ml"],
  ["milliliter", "ml"],
  ["milliliters", "ml"],
  ["cup", "cup"],
  ["cups", "cup"],
  ["tbsp", "tbsp"],
  ["tbsps", "tbsp"],
  ["tablespoon", "tbsp"],
  ["tablespoons", "tbsp"],
  ["tsp", "tsp"],
  ["tsps", "tsp"],
  ["teaspoon", "tsp"],
  ["teaspoons", "tsp"],
  ["piece", "piece"],
  ["pieces", "piece"],
  ["sheet", "sheet"],
  ["sheets", "sheet"],
  ["clove", "clove"],
  ["cloves", "clove"],
  ["leaf", "leaf"],
  ["leaves", "leaf"],
  ["medium", "medium"],
  ["large", "large"],
  ["small", "small"],
  ["whole", "whole"],
  ["can", "can"],
  ["head", "head"],
  ["bunch", "bunch"],
]);

/**
 * @param {unknown} value
 */
const toPostgresNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

/**
 * @param {unknown} value
 * @returns {Record<string, number>}
 */
const toUnitWeights = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  /** @type {Record<string, number>} */
  const unitWeights = {};

  for (const [unit, weight] of Object.entries(
    /** @type {Record<string, unknown>} */ (value),
  )) {
    const normalizedUnit = normalizeNutritionUnit(unit);
    const numericWeight = Number(weight);

    if (normalizedUnit && Number.isFinite(numericWeight) && numericWeight > 0) {
      unitWeights[normalizedUnit] = numericWeight;
    }
  }

  return unitWeights;
};

const getData = async () => {
  const sql = await getSql();
  const [ingredients, recipes, recipeIngredients] = await withNeonReadRetry(
    () =>
      sql.transaction(
        [
          sql`SELECT id, name, category, calories, protein, carbs, fat,
                 nutrition_basis, unit_weights, dietary, allergens FROM ingredients`,
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
      nutritionBasis: String(
        ingredient.nutrition_basis ?? NUTRITION_BASIS_PER_100G,
      ),
      unitWeights: toUnitWeights(ingredient.unit_weights),
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

  // The single sort dropdown submits a combined `${sort}-${order}` token;
  // legacy callers (and the API) may still pass separate `sort`/`order` params.
  const combined = splitSortToken(sort.sort);
  const sortValue = combined ? combined.sort : normalizeSortValue(sort.sort);

  if (!RECIPE_SORT_VALUES.has(sortValue)) {
    return DEFAULT_RECIPE_SORT;
  }

  const orderValue = combined ? combined.order : normalizeSortValue(sort.order);

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

  if (!isNonEmptyString(expression)) {
    return createRecipeListOrderClause(DEFAULT_RECIPE_SORT);
  }

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

  for (const ingredientId of filters.ingredients) {
    // Ingredient is a pick-list facet keyed on exact ingredient ids, so match
    // by equality (one EXISTS per id => AND across selected ingredients).
    const placeholder = addQueryParam(params, ingredientId);
    conditions.push(`EXISTS (
      SELECT 1
      FROM recipe_ingredients ri_filter
      WHERE ri_filter.recipe_id = r.id
        AND ri_filter.ingredient_id = ${placeholder}
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
                'name', COALESCE(i_profile.name, ''),
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
 * @returns {{ parsed: true, value: number } | { parsed: false, value: null }}
 */
const parseRecipeAmountValue = (amount) => {
  if (typeof amount === "number") {
    return Number.isFinite(amount)
      ? { parsed: true, value: amount }
      : { parsed: false, value: null };
  }

  if (typeof amount !== "string") {
    return { parsed: false, value: null };
  }

  const normalizedAmount = amount.trim();

  if (!normalizedAmount) {
    return { parsed: false, value: null };
  }

  const numericAmount = Number(normalizedAmount);

  if (Number.isFinite(numericAmount)) {
    return { parsed: true, value: numericAmount };
  }

  const fractionMatch = normalizedAmount.match(
    /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/,
  );

  if (!fractionMatch) {
    return { parsed: false, value: null };
  }

  const numerator = Number(fractionMatch[1]);
  const denominator = Number(fractionMatch[2]);

  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return { parsed: false, value: null };
  }

  return { parsed: true, value: numerator / denominator };
};

/**
 * @param {unknown} amount
 */
const parseRecipeAmount = (amount) => {
  const parsedAmount = parseRecipeAmountValue(amount);
  return parsedAmount.parsed ? parsedAmount.value : 0;
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
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)(?![a-z])/g,
  );
  const minuteMatches = normalizedDuration.matchAll(
    /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)(?![a-z])/g,
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
 * @param {unknown} unit
 */
const normalizeNutritionUnit = (unit) => {
  if (typeof unit !== "string") {
    return "";
  }

  return UNIT_ALIASES.get(unit.trim().toLowerCase().replace(/\.$/, "")) ?? "";
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
 * @param {RecipeIngredient} recipeIngredient
 * @param {Ingredient} ingredient
 * @returns {{ converted: true, grams: number } | { converted: false, grams: null }}
 */
const getRecipeIngredientAmountInGrams = (recipeIngredient, ingredient) => {
  if (ingredient.nutritionBasis !== NUTRITION_BASIS_PER_100G) {
    return { converted: false, grams: null };
  }

  const parsedAmount = parseRecipeAmountValue(recipeIngredient.amount);

  if (!parsedAmount.parsed) {
    return { converted: false, grams: null };
  }

  const normalizedUnit = normalizeNutritionUnit(recipeIngredient.unit);

  if (!normalizedUnit) {
    return { converted: false, grams: null };
  }

  const massUnitGrams = MASS_UNIT_GRAMS.get(normalizedUnit);

  if (massUnitGrams) {
    return { converted: true, grams: parsedAmount.value * massUnitGrams };
  }

  const unitWeight = toUnitWeights(ingredient.unitWeights)[normalizedUnit];

  if (!Number.isFinite(unitWeight) || unitWeight <= 0) {
    return { converted: false, grams: null };
  }

  return { converted: true, grams: parsedAmount.value * unitWeight };
};

/**
 * @param {RecipeIngredient} recipeIngredient
 * @param {Ingredient} ingredient
 */
const getRecipeIngredientNutrition = (recipeIngredient, ingredient) => {
  if (!ingredient.nutrition) {
    return {
      nutrition: createEmptyNutrition(),
      isUnconvertedIngredient: true,
    };
  }

  const convertedAmount = getRecipeIngredientAmountInGrams(
    recipeIngredient,
    ingredient,
  );

  if (!convertedAmount.converted) {
    return {
      nutrition: createEmptyNutrition(),
      isUnconvertedIngredient: true,
    };
  }

  return {
    nutrition: multiplyNutrition(
      ingredient.nutrition,
      convertedAmount.grams / 100,
    ),
    isUnconvertedIngredient: false,
  };
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
 * Collects the exact ingredient ids a recipe references. The ingredient filter
 * is a pick-list facet keyed on these ids, so matching is exact rather than
 * substring — otherwise picking "Potato" (`potato`) would also match
 * "Sweet Potato" (`sweet_potato`), and "Butter" would match "Peanut Butter".
 *
 * @param {Recipe | null | undefined} recipe
 * @returns {Set<string>}
 */
const getRecipeIngredientIds = (recipe) => {
  const ingredients = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients
    : [];
  /** @type {Set<string>} */
  const ids = new Set();

  for (const recipeIngredient of ingredients) {
    if (!recipeIngredient || typeof recipeIngredient !== "object") {
      continue;
    }

    const ingredientId = toSearchText(recipeIngredient.ingredientId);

    if (ingredientId) {
      ids.add(ingredientId);
    }
  }

  return ids;
};

/**
 * @param {Recipe | null | undefined} recipe
 * @param {string[]} ingredientIds
 * @param {Map<string, Ingredient>} _ingredientMap
 */
const matchesRecipeIngredients = (recipe, ingredientIds, _ingredientMap) => {
  if (!ingredientIds.length) {
    return true;
  }

  const recipeIngredientIds = getRecipeIngredientIds(recipe);
  return ingredientIds.every((ingredientId) =>
    recipeIngredientIds.has(ingredientId),
  );
};

/**
 * @param {Recipe | null | undefined} recipe
 * @param {NormalizedRecipeListFilters} filters
 * @param {Map<string, Ingredient>} ingredientMap
 * @param {DietaryProfile=} dietaryProfile
 */
const matchesRecipeDietaryFilters = (
  recipe,
  filters,
  ingredientMap,
  dietaryProfile,
) => {
  if (!filters.diets.length && !filters.excludedAllergens.length) {
    return true;
  }

  if (!recipe || typeof recipe !== "object") {
    return false;
  }

  return matchesDietaryProfileFilters(
    dietaryProfile ??
      deriveRecipeDietaryProfile(recipe.ingredients, ingredientMap),
    filters,
  );
};

/**
 * @param {Recipe | null | undefined} recipe
 * @param {NormalizedRecipeListFilters} filters
 * @param {Map<string, Ingredient>} ingredientMap
 * @param {DietaryProfile=} dietaryProfile
 */
const matchesRecipeListFilters = (
  recipe,
  filters,
  ingredientMap,
  dietaryProfile,
) => {
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
    matchesRecipeDietaryFilters(recipe, filters, ingredientMap, dietaryProfile)
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
      /** @type {{ ingredientId?: unknown, isMissing?: unknown, name?: unknown, dietary?: unknown, commonAllergens?: unknown }} */ (
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
      name: typeof typedRow.name === "string" ? typedRow.name : "",
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
 * A recipe only reaches the list once {@link toRecipeListItem} accepts it, so
 * facet counts (and the derived vocabularies) consider the same set — keeping
 * counts from drifting above the rendered result count.
 *
 * @param {unknown} recipe
 * @returns {recipe is Recipe}
 */
const isListableRecipe = (recipe) =>
  Boolean(recipe) &&
  typeof recipe === "object" &&
  isNonEmptyString(/** @type {Partial<Recipe>} */ (recipe).id) &&
  isNonEmptyString(/** @type {Partial<Recipe>} */ (recipe).title);

/**
 * @param {string} ingredientId
 */
const humanizeIngredientId = (ingredientId) =>
  ingredientId
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

/**
 * Returns a copy of `filters` with `value` added to one category — the basis
 * for drill-down facet counts ("how many results if you also pick this").
 *
 * @param {NormalizedRecipeListFilters} filters
 * @param {keyof NormalizedRecipeListFilters} category
 * @param {string} value
 * @returns {NormalizedRecipeListFilters}
 */
const withFilterValue = (filters, category, value) => ({
  ...filters,
  [category]: [...new Set([...filters[category], value])],
});

/**
 * Counts recipes matching `filters` once `value` is added to `category`. Reuses
 * {@link matchesRecipeListFilters} verbatim so a facet count can never disagree
 * with the list it previews.
 *
 * @param {Recipe[]} listableRecipes
 * @param {Map<string, Ingredient>} ingredientMap
 * @param {Map<Recipe, DietaryProfile>} dietaryProfiles
 * @param {NormalizedRecipeListFilters} filters
 * @param {keyof NormalizedRecipeListFilters} category
 * @param {string} value
 */
const countRecipesWithOption = (
  listableRecipes,
  ingredientMap,
  dietaryProfiles,
  filters,
  category,
  value,
) => {
  const candidateFilters = withFilterValue(filters, category, value);
  let count = 0;

  for (const recipe of listableRecipes) {
    if (
      matchesRecipeListFilters(
        recipe,
        candidateFilters,
        ingredientMap,
        dietaryProfiles.get(recipe),
      )
    ) {
      count += 1;
    }
  }

  return count;
};

/**
 * @param {Recipe[]} listableRecipes
 * @returns {string[]}
 */
const collectRecipeTagValues = (listableRecipes) => {
  /** @type {Set<string>} */
  const tagValues = new Set();

  for (const recipe of listableRecipes) {
    const tags = Array.isArray(recipe.tags) ? recipe.tags : [];

    for (const tag of tags) {
      const value = toSearchText(tag);

      if (value) {
        tagValues.add(value);
      }
    }
  }

  return [...tagValues].sort();
};

/**
 * @param {Recipe[]} listableRecipes
 * @param {Map<string, Ingredient>} ingredientMap
 * @returns {{ value: string, label: string }[]}
 */
const collectRecipeIngredientOptions = (listableRecipes, ingredientMap) => {
  /** @type {Map<string, string>} */
  const labelsById = new Map();

  for (const recipe of listableRecipes) {
    for (const ingredientId of getRecipeIngredientIds(recipe)) {
      if (labelsById.has(ingredientId)) {
        continue;
      }

      const name = ingredientMap.get(ingredientId)?.name;
      labelsById.set(
        ingredientId,
        name && name.trim() ? name : humanizeIngredientId(ingredientId),
      );
    }
  }

  return [...labelsById.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((first, second) => first.label.localeCompare(second.label));
};

/**
 * Allergens already expressed by a diet option, so offering them in the
 * "free from" facet too would duplicate a control (the "Gluten-free" diet
 * already covers gluten avoidance). The allergen still surfaces on the detail
 * page's "contains" listing — only the filter facet omits it.
 *
 * @type {ReadonlySet<string>}
 */
const ALLERGENS_COVERED_BY_DIET = new Set(["gluten"]);

/**
 * @param {Recipe[]} listableRecipes
 * @param {Map<string, Ingredient>} ingredientMap
 */
const collectRecipeDietaryProfiles = (listableRecipes, ingredientMap) => {
  /** @type {Map<Recipe, DietaryProfile>} */
  const profiles = new Map();

  for (const recipe of listableRecipes) {
    profiles.set(
      recipe,
      deriveRecipeDietaryProfile(recipe.ingredients, ingredientMap),
    );
  }

  return profiles;
};

/**
 * Collects the diet/allergen tokens at least one listable recipe actually
 * carries. A filter for a token no recipe carries is dead weight — keto and
 * high-protein match nothing here, and every recipe is already peanut-free — so
 * the facet omits them rather than offering a no-op option.
 *
 * @param {Recipe[]} listableRecipes
 * @param {Map<Recipe, DietaryProfile>} dietaryProfiles
 * @returns {{ diets: Set<string>, allergens: Set<string> }}
 */
const collectPresentDietaryTokens = (listableRecipes, dietaryProfiles) => {
  /** @type {Set<string>} */
  const diets = new Set();
  /** @type {Set<string>} */
  const allergens = new Set();

  for (const recipe of listableRecipes) {
    const profile = dietaryProfiles.get(recipe);

    if (!profile) {
      continue;
    }

    for (const diet of profile.dietary) {
      diets.add(diet);
    }

    for (const allergen of profile.allergens) {
      allergens.add(allergen);
    }
  }

  return { diets, allergens };
};

/**
 * Builds the facet vocabularies (tag/ingredient derived from the catalog;
 * diet/allergen from the static option lists, narrowed to tokens the catalog
 * actually carries) each annotated with a drill-down result count. Allergen
 * options are labeled as a "free from X" attribute so the exclusion intent is
 * unambiguous.
 *
 * @param {unknown[]} recipes
 * @param {Map<string, Ingredient>} ingredientMap
 * @param {NormalizedRecipeListFilters} filters
 * @returns {RecipeFacets}
 */
const computeRecipeFacets = (recipes, ingredientMap, filters) => {
  const listableRecipes = recipes.filter(isListableRecipe);
  const dietaryProfiles = collectRecipeDietaryProfiles(
    listableRecipes,
    ingredientMap,
  );
  const present = collectPresentDietaryTokens(listableRecipes, dietaryProfiles);

  /**
   * @param {keyof NormalizedRecipeListFilters} category
   * @param {string} value
   */
  const count = (category, value) =>
    countRecipesWithOption(
      listableRecipes,
      ingredientMap,
      dietaryProfiles,
      filters,
      category,
      value,
    );

  return {
    tags: collectRecipeTagValues(listableRecipes).map((value) => ({
      value,
      label: value,
      count: count("tags", value),
    })),
    ingredients: collectRecipeIngredientOptions(
      listableRecipes,
      ingredientMap,
    ).map(({ value, label }) => ({
      value,
      label,
      count: count("ingredients", value),
    })),
    diets: DIETARY_OPTIONS.filter((option) =>
      present.diets.has(option.value),
    ).map((option) => ({
      value: option.value,
      label: option.label,
      count: count("diets", option.value),
    })),
    allergens: ALLERGEN_OPTIONS.filter(
      (option) =>
        present.allergens.has(option.value) &&
        !ALLERGENS_COVERED_BY_DIET.has(option.value),
    ).map((option) => ({
      value: option.value,
      label: formatAllergenFreeLabel(option.value),
      count: count("excludedAllergens", option.value),
    })),
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
 * Fetches the whole catalog's facet metadata in one query (no WHERE) and counts
 * facet options in JS via the shared {@link computeRecipeFacets}, so counts and
 * labels stay identical to the in-memory path.
 *
 * @param {NormalizedRecipeListFilters} filters
 * @returns {Promise<RecipeFacets>}
 */
const getRecipeFacetsFromPostgres = async (filters) => {
  const sql = await getSql();
  const { queryText, params } = createRecipeListQuery(
    normalizeRecipeListFilters({}),
    DEFAULT_RECIPE_SORT,
  );
  const rows = /** @type {RecipeListRow[]} */ (
    await withNeonReadRetry(() => sql.query(queryText, params), {
      label: "Recipe facets read",
    })
  );

  /** @type {Recipe[]} */
  const recipes = [];
  /** @type {Map<string, Ingredient>} */
  const ingredientMap = new Map();

  for (const row of rows) {
    const { recipe, ingredientMap: rowIngredientMap } =
      toRecipeListRecipeFromPostgres(row);
    recipes.push(recipe);

    for (const [id, ingredient] of rowIngredientMap) {
      if (!ingredientMap.has(id)) {
        ingredientMap.set(id, ingredient);
      }
    }
  }

  return computeRecipeFacets(recipes, ingredientMap, filters);
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
                 i.nutrition_basis AS nutrition_basis, i.unit_weights AS unit_weights,
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
        nutritionBasis: String(row.nutrition_basis ?? NUTRITION_BASIS_PER_100G),
        unitWeights: toUnitWeights(row.unit_weights),
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
 * @param {unknown} data
 * @param {RecipeListFilters=} filters
 * @returns {RecipeFacets}
 */
const toRecipeFacets = (data, filters = {}) => {
  const recipes =
    data && typeof data === "object"
      ? /** @type {{ recipes?: unknown }} */ (data).recipes
      : undefined;

  return computeRecipeFacets(
    Array.isArray(recipes) ? recipes : [],
    toIngredientMap(data),
    normalizeRecipeListFilters(filters),
  );
};

/**
 * @param {RecipeIngredient} recipeIngredient
 * @param {Map<string, Ingredient>} ingredientMap
 * @returns {{ detail: RecipeIngredientDetail, isMissingIngredient: boolean, isUnconvertedIngredient: boolean }}
 */
const toRecipeIngredientDetail = (recipeIngredient, ingredientMap) => {
  const ingredient = ingredientMap.get(recipeIngredient.ingredientId);
  const amount =
    typeof recipeIngredient.amount === "number"
      ? String(recipeIngredient.amount)
      : toSafeString(recipeIngredient.amount);
  const { nutrition, isUnconvertedIngredient } = ingredient
    ? getRecipeIngredientNutrition(recipeIngredient, ingredient)
    : {
        nutrition: createEmptyNutrition(),
        isUnconvertedIngredient: false,
      };

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
    isUnconvertedIngredient,
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
  /** @type {Set<string>} */
  const unconvertedIngredientIds = new Set();
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.reduce((items, recipeIngredient) => {
        if (
          !recipeIngredient ||
          typeof recipeIngredient !== "object" ||
          typeof recipeIngredient.ingredientId !== "string"
        ) {
          return items;
        }

        const { detail, isMissingIngredient, isUnconvertedIngredient } =
          toRecipeIngredientDetail(recipeIngredient, ingredientMap);

        addNutrition(totalNutrition, detail.nutrition);

        if (isMissingIngredient) {
          missingIngredientIds.add(detail.ingredientId);
        }

        if (isUnconvertedIngredient) {
          unconvertedIngredientIds.add(detail.ingredientId);
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
      unconvertedIngredientIds: Array.from(unconvertedIngredientIds),
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

  async getRecipeFacets(filters = {}) {
    const data = await readData();
    return toRecipeFacets(data, filters);
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

/** @type {((filters: NormalizedRecipeListFilters) => Promise<RecipeFacets>) | null} */
let cachedRecipeFacetsFromPostgres = null;

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

const getCachedRecipeFacetsFromPostgres = async () => {
  if (!cachedRecipeFacetsFromPostgres) {
    const { unstable_cache: unstableCache } = await importNextCache();
    cachedRecipeFacetsFromPostgres = unstableCache(
      getRecipeFacetsFromPostgres,
      ["recipe-facets"],
      {
        revalidate: RECIPES_CACHE_REVALIDATE_SECONDS,
        tags: [RECIPES_CACHE_TAG],
      },
    );
  }

  return cachedRecipeFacetsFromPostgres;
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
 * @param {RecipeListFilters=} filters
 * @returns {Promise<RecipeFacets>}
 */
const getRecipeFacets = async (filters = {}) => {
  const normalizedFilters = normalizeRecipeListFilters(filters);
  const cachedRead = await getCachedRecipeFacetsFromPostgres();

  return readWithCacheFallback(
    cachedRead,
    getRecipeFacetsFromPostgres,
    normalizedFilters,
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
  createRecipeListOrderClause,
  createRecipeRepository,
  getData,
  getRecipeIngredientAmountInGrams,
  getRecipeDetail,
  getRecipeFacets,
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
