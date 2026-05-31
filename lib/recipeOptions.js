/**
 * @param {string} value
 * @param {string} label
 */
const createOption = (value, label) => Object.freeze({ value, label });

export const DEFAULT_RECIPE_SORT = Object.freeze({
  sort: "curated",
  order: "asc",
});

export const RECIPE_SORT_OPTIONS = Object.freeze([
  createOption("curated", "Curated"),
  createOption("title", "Title"),
  createOption("prep-time", "Prep time"),
  createOption("cook-time", "Cook time"),
  createOption("difficulty", "Difficulty"),
  createOption("servings", "Servings"),
  createOption("date-added", "Date added"),
]);

export const RECIPE_SORT_ORDERS = Object.freeze([
  createOption("asc", "Ascending"),
  createOption("desc", "Descending"),
]);

export const DIETARY_OPTIONS = Object.freeze([
  createOption("vegetarian", "Vegetarian"),
  createOption("vegan", "Vegan"),
  createOption("gluten-free", "Gluten-free"),
  createOption("keto", "Keto"),
  createOption("high-protein", "High-protein"),
]);

export const ALLERGEN_OPTIONS = Object.freeze([
  createOption("dairy", "Dairy"),
  createOption("eggs", "Eggs"),
  createOption("fish", "Fish"),
  createOption("gluten", "Gluten"),
  createOption("nuts", "Nuts"),
  createOption("peanuts", "Peanuts"),
  createOption("sesame", "Sesame"),
  createOption("shellfish", "Shellfish"),
  createOption("soy", "Soy"),
  createOption("tree nuts", "Tree nuts"),
  createOption("wheat", "Wheat"),
]);

/**
 * @param {readonly { value: string, label: string }[]} options
 * @param {string} value
 */
export function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? value;
}
