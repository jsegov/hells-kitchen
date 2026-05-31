import Link from "next/link";
import { notFound } from "next/navigation";
import RecipeDetail from "./RecipeDetail";
import { getRecipe, getRecipes } from "../recipeData";
import styles from "./page.module.css";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { recipes } = await getRecipes();
  return recipes.map((recipe) => ({ id: recipe.id }));
}

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export async function generateMetadata({ params }) {
  const { id } = await params;
  const { recipe, notFound: recipeNotFound } = await getRecipe(id);

  if (recipe) {
    return {
      title: recipe.title,
      description:
        recipe.description ||
        "View recipe ingredients, instructions, tags, and nutrition.",
    };
  }

  if (recipeNotFound) {
    return {
      title: "Recipe Not Found",
      description: "The requested recipe could not be found.",
    };
  }

  return {
    title: "Recipe Unavailable",
    description: "Recipe details are currently unavailable.",
  };
}

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
