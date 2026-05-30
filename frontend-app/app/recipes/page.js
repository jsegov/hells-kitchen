import RecipeCard from "./RecipeCard";
import RecipePageHeader from "./RecipePageHeader";
import { getRecipes } from "./recipeData";
import styles from "./page.module.css";

export const metadata = {
  title: "Recipes",
  description: "Browse recipes and their basic information.",
};

export default async function RecipesPage() {
  const { recipes, error } = await getRecipes();

  return (
    <main className={styles.page}>
      <RecipePageHeader
        hasError={Boolean(error)}
        recipeCount={recipes.length}
      />

      {error ? (
        <section className={styles.state} role="alert">
          <h2>Recipes are unavailable</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {!error && recipes.length === 0 ? (
        <section className={styles.state}>
          <h2>No recipes found</h2>
          <p>Add recipes to the mock database to see them here.</p>
        </section>
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
