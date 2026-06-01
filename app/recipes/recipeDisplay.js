import {
  ALLERGEN_OPTIONS,
  DIETARY_OPTIONS,
  getOptionLabel,
} from "../../lib/recipeOptions";

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
