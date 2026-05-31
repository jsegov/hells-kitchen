import { ALLERGEN_OPTIONS, DIETARY_OPTIONS } from "./recipeOptions.js";

const DIETARY_VALUES = new Set(DIETARY_OPTIONS.map((option) => option.value));
const ALLERGEN_VALUES = new Set(ALLERGEN_OPTIONS.map((option) => option.value));

/**
 * @typedef {object} DietaryProfile
 * @property {string[]} dietary
 * @property {string[]} allergens
 * @property {boolean} hasMissingIngredients
 */

/**
 * @param {unknown} value
 */
const normalizeToken = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/**
 * @param {unknown} value
 * @param {ReadonlySet<string>} allowedValues
 * @returns {string[]}
 */
export function normalizeExactValues(value, allowedValues) {
  if (typeof value === "string") {
    return value
      .split(",")
      .map(normalizeToken)
      .filter((token) => token && allowedValues.has(token));
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.flatMap((item) => normalizeExactValues(item, allowedValues))),
  );
}

/**
 * @param {unknown} value
 */
export const normalizeDietaryValues = (value) =>
  normalizeExactValues(value, DIETARY_VALUES);

/**
 * @param {unknown} value
 */
export const normalizeAllergenValues = (value) =>
  normalizeExactValues(value, ALLERGEN_VALUES);

/**
 * @param {unknown} value
 * @param {ReadonlySet<string>} allowedValues
 */
const toKnownValueSet = (value, allowedValues) =>
  new Set(normalizeExactValues(value, allowedValues));

/**
 * @param {unknown} ingredient
 * @returns {Set<string>}
 */
function getIngredientDietarySet(ingredient) {
  if (!ingredient || typeof ingredient !== "object") {
    return new Set();
  }

  const values = toKnownValueSet(
    /** @type {{ dietary?: unknown }} */ (ingredient).dietary,
    DIETARY_VALUES,
  );

  if (values.has("vegan")) {
    values.add("vegetarian");
  }

  return values;
}

/**
 * @param {unknown} ingredient
 * @returns {Set<string>}
 */
function getIngredientAllergenSet(ingredient) {
  if (!ingredient || typeof ingredient !== "object") {
    return new Set();
  }

  const typedIngredient =
    /** @type {{ commonAllergens?: unknown, allergens?: unknown }} */ (
      ingredient
    );

  return toKnownValueSet(
    typedIngredient.commonAllergens ?? typedIngredient.allergens,
    ALLERGEN_VALUES,
  );
}

/**
 * @param {Set<string>} target
 * @param {Set<string>} source
 */
function intersectWith(target, source) {
  for (const value of target) {
    if (!source.has(value)) {
      target.delete(value);
    }
  }
}

/**
 * @param {ReadonlySet<string>} values
 * @param {readonly { value: string }[]} options
 */
const orderKnownValues = (values, options) =>
  options.map((option) => option.value).filter((value) => values.has(value));

/**
 * @param {unknown} recipeIngredients
 * @param {Map<string, unknown>} ingredientMap
 * @returns {DietaryProfile}
 */
export function deriveRecipeDietaryProfile(recipeIngredients, ingredientMap) {
  const ingredients = Array.isArray(recipeIngredients) ? recipeIngredients : [];
  /** @type {Set<string> | null} */
  let dietaryIntersection = null;
  const allergens = new Set();
  let hasMissingIngredients = false;

  for (const recipeIngredient of ingredients) {
    const ingredientId =
      recipeIngredient && typeof recipeIngredient === "object"
        ? /** @type {{ ingredientId?: unknown }} */ (recipeIngredient)
            .ingredientId
        : "";

    if (typeof ingredientId !== "string" || !ingredientId.trim()) {
      hasMissingIngredients = true;
      dietaryIntersection = new Set();
      continue;
    }

    const ingredient = ingredientMap.get(ingredientId);

    if (!ingredient) {
      hasMissingIngredients = true;
      dietaryIntersection = new Set();
      continue;
    }

    const ingredientDietary = getIngredientDietarySet(ingredient);

    if (dietaryIntersection === null) {
      dietaryIntersection = new Set(ingredientDietary);
    } else {
      intersectWith(dietaryIntersection, ingredientDietary);
    }

    for (const allergen of getIngredientAllergenSet(ingredient)) {
      allergens.add(allergen);
    }
  }

  return {
    dietary: hasMissingIngredients
      ? []
      : orderKnownValues(dietaryIntersection ?? new Set(), DIETARY_OPTIONS),
    allergens: orderKnownValues(allergens, ALLERGEN_OPTIONS),
    hasMissingIngredients,
  };
}

/**
 * @param {DietaryProfile} profile
 * @param {{ diets?: string[], excludedAllergens?: string[] }} filters
 */
export function matchesDietaryProfileFilters(profile, filters) {
  const diets = Array.isArray(filters.diets) ? filters.diets : [];
  const excludedAllergens = Array.isArray(filters.excludedAllergens)
    ? filters.excludedAllergens
    : [];
  const dietary = new Set(profile.dietary);
  const allergens = new Set(profile.allergens);

  if (diets.some((diet) => !dietary.has(diet))) {
    return false;
  }

  if (excludedAllergens.length && profile.hasMissingIngredients) {
    return false;
  }

  return excludedAllergens.every((allergen) => !allergens.has(allergen));
}
