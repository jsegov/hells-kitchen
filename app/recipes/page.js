import RecipeEmptyState from "./RecipeEmptyState";
import RecipeFilters from "./RecipeFilters";
import RecipeCard from "./RecipeCard";
import RecipePageHeader from "./RecipePageHeader";
import {
  getRecipes,
  hasRecipeFilters,
  normalizeRecipeFilters,
  normalizeRecipeSort,
} from "./recipeData";
import styles from "./page.module.css";

export const metadata = {
  title: "Recipes",
  description: "Browse recipes and their basic information.",
};

/**
 * @param {{ searchParams?: Promise<import("./recipeData").RecipeFilterInput> }} props
 */
export default async function RecipesPage({ searchParams }) {
  const query = await searchParams;
  const filters = normalizeRecipeFilters(query);
  const sort = normalizeRecipeSort(query);
  const hasActiveFilters = hasRecipeFilters(filters);
  const { recipes, error } = await getRecipes({ filters, sort });

  return (
    <main className={styles.page}>
      <RecipePageHeader
        hasError={Boolean(error)}
        recipeCount={recipes.length}
      />

      <RecipeFilters filters={filters} sort={sort} />

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
