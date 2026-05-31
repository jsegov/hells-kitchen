import ActiveFilterChips from "./ActiveFilterChips";
import RecipeEmptyState from "./RecipeEmptyState";
import RecipeFilters from "./RecipeFilters";
import RecipeCard from "./RecipeCard";
import RecipePageHeader from "./RecipePageHeader";
import {
  formatDietaryLabel,
  formatTagLabel,
  getRecipeFacets,
  getRecipes,
  hasRecipeFilters,
  normalizeRecipeFilters,
  normalizeRecipeSort,
} from "./recipeData";
import {
  DEFAULT_RECIPE_SORT,
  formatAllergenFreeLabel,
  toSortToken,
} from "../../lib/recipeOptions";
import styles from "./page.module.css";

export const metadata = {
  title: "Recipes",
  description: "Browse recipes and their basic information.",
};

const DEFAULT_SORT_TOKEN = toSortToken(DEFAULT_RECIPE_SORT);

/**
 * Builds a `/recipes` href from the canonical filter state, optionally dropping
 * one value — the basis for the "remove" chips (and "clear" reduces to omitting
 * everything). Default sort is left out to keep URLs clean.
 *
 * @param {import("./recipeData").RecipeFilters} filters
 * @param {string} sortToken
 * @param {{ key: string, value: string }} [omit]
 */
function buildRecipesHref(filters, sortToken, omit) {
  const params = new URLSearchParams();
  /** @type {[string, string[]][]} */
  const groups = [
    ["name", filters.name],
    ["tag", filters.tag],
    ["ingredient", filters.ingredient],
    ["diet", filters.diet],
    ["exclude", filters.exclude],
  ];

  for (const [key, values] of groups) {
    for (const value of values) {
      if (omit && omit.key === key && omit.value === value) {
        continue;
      }

      params.append(key, value);
    }
  }

  if (sortToken && sortToken !== DEFAULT_SORT_TOKEN) {
    params.set("sort", sortToken);
  }

  const queryString = params.toString();
  return queryString ? `/recipes?${queryString}` : "/recipes";
}

/**
 * @param {import("./recipeData").RecipeFilters} filters
 * @param {import("./recipeData").RecipeFacets} facets
 * @param {string} sortToken
 * @returns {import("./ActiveFilterChips").ActiveFilterChip[]}
 */
function buildActiveChips(filters, facets, sortToken) {
  /** @type {import("./ActiveFilterChips").ActiveFilterChip[]} */
  const chips = [];

  /**
   * @param {string} key
   * @param {string} category
   * @param {string} value
   * @param {string} label
   */
  const push = (key, category, value, label) => {
    chips.push({
      key: `${key}:${value}`,
      category,
      label,
      href: buildRecipesHref(filters, sortToken, { key, value }),
    });
  };

  for (const value of filters.name) {
    push("name", "Search", value, value);
  }

  for (const value of filters.tag) {
    push("tag", "Tag", value, formatTagLabel(value));
  }

  for (const value of filters.ingredient) {
    const label =
      facets.ingredients.find((option) => option.value === value)?.label ??
      value;
    push("ingredient", "Ingredient", value, label);
  }

  for (const value of filters.diet) {
    push("diet", "Diet", value, formatDietaryLabel(value));
  }

  for (const value of filters.exclude) {
    push("exclude", "Free from", value, formatAllergenFreeLabel(value));
  }

  return chips;
}

/**
 * @param {{ searchParams?: Promise<import("./recipeData").RecipeFilterInput> }} props
 */
export default async function RecipesPage({ searchParams }) {
  const query = await searchParams;
  const filters = normalizeRecipeFilters(query);
  const sort = normalizeRecipeSort(query);
  const sortToken = toSortToken(sort);
  const hasActiveFilters = hasRecipeFilters(filters);
  const [{ recipes, error }, { facets, error: facetError }] = await Promise.all(
    [getRecipes({ filters, sort }), getRecipeFacets({ filters })],
  );
  const activeChips = buildActiveChips(filters, facets, sortToken);

  return (
    <main className={styles.page}>
      <RecipePageHeader
        hasError={Boolean(error)}
        recipeCount={recipes.length}
      />

      <RecipeFilters
        facets={facets}
        filters={filters}
        resultCount={recipes.length}
        sort={sort}
      />

      {!error ? (
        <ActiveFilterChips chips={activeChips} clearHref="/recipes" />
      ) : null}

      {facetError ? (
        <section className={styles.state} role="alert">
          <h2>Recipe filters are unavailable</h2>
          <p>{facetError}</p>
        </section>
      ) : null}

      {error ? (
        <section className={styles.state} role="alert">
          <h2>Recipes are unavailable</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {!error && recipes.length === 0 ? (
        <RecipeEmptyState hasActiveFilters={hasActiveFilters} />
      ) : null}

      {!error && recipes.length > 0 ? (
        <section className={styles.grid} aria-label="Recipe list">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </section>
      ) : null}
    </main>
  );
}
