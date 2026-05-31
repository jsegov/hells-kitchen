import { getSql } from "./db.js";

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
 * @property {number} ingredientCount
 */

/**
 * @typedef {object} RecipeListFilters
 * @property {unknown=} name
 * @property {unknown=} tag
 * @property {unknown=} ingredient
 */

/**
 * @typedef {object} NormalizedRecipeListFilters
 * @property {string[]} names
 * @property {string[]} tags
 * @property {string[]} ingredients
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
 * @property {RecipeNutritionSummary} nutrition
 */

/**
 * @typedef {() => Promise<unknown>} ReadRecipeData
 */

/**
 * @typedef {object} RecipeRepository
 * @property {(filters?: RecipeListFilters) => Promise<RecipeListItem[]>} getRecipeList
 * @property {(id: string) => Promise<RecipeDetail | null>} getRecipeDetail
 */

/** @type {Array<keyof Nutrition>} */
const NUTRITION_FIELDS = ["calories", "protein", "carbs", "fat"];

/**
 * @param {unknown} value
 */
const toPostgresNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getData = async () => {
  const sql = await getSql();
  const [ingredients, recipes, recipeIngredients] = await sql.transaction(
    [
      sql`SELECT id, name, category, calories, protein, carbs, fat, dietary, allergens FROM ingredients`,
      sql`SELECT id, title, description, servings, prep_time, cook_time, difficulty,
               instructions, tags, date_added FROM recipes ORDER BY sort_order ASC`,
      sql`SELECT recipe_id, ingredient_id, amount, unit FROM recipe_ingredients ORDER BY recipe_id, position`,
    ],
    { readOnly: true },
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
    };
  }

  return {
    names: normalizeFilterValues(filters.name),
    tags: normalizeFilterValues(filters.tag),
    ingredients: normalizeFilterValues(filters.ingredient),
  };
};

/**
 * @param {NormalizedRecipeListFilters} filters
 */
const hasActiveRecipeListFilters = (filters) =>
  filters.names.length > 0 ||
  filters.tags.length > 0 ||
  filters.ingredients.length > 0;

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
    matchesRecipeIngredients(recipe, filters.ingredients, ingredientMap)
  );
};

/**
 * @param {Recipe | null | undefined} recipe
 * @returns {RecipeListItem | null}
 */
const toRecipeListItem = (recipe) => {
  if (!recipe || typeof recipe !== "object") {
    return null;
  }

  if (!isNonEmptyString(recipe.id) || !isNonEmptyString(recipe.title)) {
    return null;
  }

  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : [];

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
    ingredientCount: ingredients.filter(
      (ingredient) =>
        ingredient &&
        typeof ingredient === "object" &&
        isNonEmptyString(ingredient.ingredientId),
    ).length,
  };
};

/**
 * @param {unknown} data
 * @param {RecipeListFilters=} filters
 * @returns {RecipeListItem[]}
 */
const toRecipeListItems = (data, filters = {}) => {
  if (!data || typeof data !== "object") {
    return [];
  }

  const recipes = /** @type {{ recipes?: unknown }} */ (data).recipes;

  if (!Array.isArray(recipes)) {
    return [];
  }

  const ingredientMap = toIngredientMap(data);
  const normalizedFilters = normalizeRecipeListFilters(filters);

  return recipes.reduce((items, recipe) => {
    if (
      !matchesRecipeListFilters(
        /** @type {Recipe | null | undefined} */ (recipe),
        normalizedFilters,
        ingredientMap,
      )
    ) {
      return items;
    }

    const item = toRecipeListItem(
      /** @type {Recipe | null | undefined} */ (recipe),
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
  async getRecipeList(filters = {}) {
    const data = await readData();
    return toRecipeListItems(data, filters);
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

const recipeRepository = createRecipeRepository(getData);

/**
 * @param {RecipeListFilters=} filters
 * @returns {Promise<RecipeListItem[]>}
 */
const getRecipeList = async (filters = {}) =>
  recipeRepository.getRecipeList(filters);

/**
 * @param {string} id
 * @returns {Promise<RecipeDetail | null>}
 */
const getRecipeDetail = async (id) => recipeRepository.getRecipeDetail(id);

export {
  createRecipeRepository,
  getData,
  getRecipeDetail,
  getRecipeList,
  parseRecipeAmount,
  toIngredientMap,
  toRecipeDetail,
  toRecipeListItem,
  toRecipeListItems,
};
