import Link from "next/link";
import { notFound } from "next/navigation";
import RecipeDetail from "./RecipeDetail";
import { getRecipe } from "../recipeData";
import styles from "./page.module.css";

export const metadata = {
  title: "Recipe Detail",
  description: "View recipe ingredients, instructions, tags, and nutrition.",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function RecipeDetailPage({ params }) {
  const { id } = await params;
  const { recipe, error, notFound: recipeNotFound } = await getRecipe(id);

  if (recipeNotFound) {
    notFound();
  }

  return (
    <main className={styles.page}>
      {recipe ? <RecipeDetail recipe={recipe} /> : null}

      {!recipe && error ? (
        <section className={styles.state} role="alert">
          <h1>Recipe is unavailable</h1>
          <p>{error}</p>
          <Link className={styles.backLink} href="/recipes">
            Back to recipes
          </Link>
        </section>
      ) : null}
    </main>
  );
}
