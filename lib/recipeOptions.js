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

/**
 * Single-dropdown sort choices: each entry folds a sort key and a direction
 * into one human-readable option so users never have to reason about
 * "ascending"/"descending" for non-numeric keys. `value` is a combined token
 * (`${sort}-${order}`, except curated) parsed by {@link splitSortToken}.
 */
export const RECIPE_SORT_CHOICES = Object.freeze([
  createOption("curated-asc", "Curated"),
  createOption("title-asc", "Title: A–Z"),
  createOption("title-desc", "Title: Z–A"),
  createOption("prep-time-asc", "Prep time: shortest"),
  createOption("prep-time-desc", "Prep time: longest"),
  createOption("cook-time-asc", "Cook time: shortest"),
  createOption("cook-time-desc", "Cook time: longest"),
  createOption("difficulty-asc", "Difficulty: easiest"),
  createOption("difficulty-desc", "Difficulty: hardest"),
  createOption("servings-asc", "Servings: fewest"),
  createOption("servings-desc", "Servings: most"),
  createOption("date-added-desc", "Newest"),
  createOption("date-added-asc", "Oldest"),
]);

/**
 * Splits a combined sort token (e.g. `"prep-time-desc"`) into its sort key and
 * order. The order suffix is always `asc`/`desc`, so the key is whatever
 * precedes the final `-asc`/`-desc`. Returns `null` for tokens that do not
 * carry a recognized order suffix, letting callers fall back to legacy
 * separate `sort`/`order` params.
 *
 * @param {unknown} token
 * @returns {{ sort: string, order: string } | null}
 */
export function splitSortToken(token) {
  if (typeof token !== "string") {
    return null;
  }

  const match = token
    .trim()
    .toLowerCase()
    .match(/^(.+)-(asc|desc)$/);

  if (!match) {
    return null;
  }

  return { sort: match[1], order: match[2] };
}

/**
 * Builds the combined token for a `{ sort, order }` pair so the single sort
 * dropdown can echo the active selection.
 *
 * @param {{ sort: string, order: string }} sort
 */
export function toSortToken(sort) {
  return `${sort.sort}-${sort.order}`;
}

/**
 * Builds a `/recipes?…` href from ordered filter groups, optionally dropping one
 * value and appending a non-default sort token. This is the browser-safe source
 * of truth for filter-page links such as active-filter chips and "clear".
 * Values are expected to be already-validated canonical tokens.
 *
 * @param {ReadonlyArray<readonly [string, readonly string[]]>} groups
 * @param {{ omit?: { key: string, value: string }, sortToken?: string, defaultSortToken?: string }} [options]
 * @returns {string}
 */
export function buildRecipesHref(groups, options = {}) {
  const { omit, sortToken, defaultSortToken } = options;
  const params = new URLSearchParams();

  for (const [key, values] of groups) {
    for (const value of values) {
      if (omit && omit.key === key && omit.value === value) {
        continue;
      }

      params.append(key, value);
    }
  }

  if (sortToken && sortToken !== defaultSortToken) {
    params.set("sort", sortToken);
  }

  const queryString = params.toString();
  return queryString ? `/recipes?${queryString}` : "/recipes";
}

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

/**
 * Allergen filter labels read as a positive "free from X" attribute so the
 * exclusion intent is obvious at a glance and matches the drill-down count
 * ("Dairy-free 8" = 8 recipes are dairy-free). Plurals are singularized
 * ("eggs" → "Egg-free"). The plain {@link ALLERGEN_OPTIONS} labels stay for the
 * detail page's "contains" listing, where the noun form is correct.
 *
 * @type {Readonly<Record<string, string>>}
 */
const ALLERGEN_FREE_LABELS = Object.freeze({
  dairy: "Dairy-free",
  eggs: "Egg-free",
  fish: "Fish-free",
  gluten: "Gluten-free",
  nuts: "Nut-free",
  peanuts: "Peanut-free",
  sesame: "Sesame-free",
  shellfish: "Shellfish-free",
  soy: "Soy-free",
  "tree nuts": "Tree nut-free",
  wheat: "Wheat-free",
});

/**
 * @param {string} value
 */
export function formatAllergenFreeLabel(value) {
  return (
    ALLERGEN_FREE_LABELS[value] ??
    `${getOptionLabel(ALLERGEN_OPTIONS, value)}-free`
  );
}
