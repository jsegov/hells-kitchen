import Link from "next/link";
import { formatDifficulty } from "./recipeData";
import styles from "./page.module.css";

/**
 * @param {{ recipe: import("./recipeData").RecipeListItem }} props
 */
export default function RecipeCard({ recipe }) {
  return (
    <Link className={styles.card} href={`/recipes/${recipe.id}`}>
      <article>
        <div className={styles.cardHeader}>
          <h2>{recipe.title}</h2>
          <span className={styles.difficulty}>
            {formatDifficulty(recipe.difficulty)}
          </span>
        </div>
        <p className={styles.description}>{recipe.description}</p>

        <dl className={styles.metrics}>
          <div>
            <dt>Prep</dt>
            <dd>{recipe.prepTime}</dd>
          </div>
          <div>
            <dt>Cook</dt>
            <dd>{recipe.cookTime}</dd>
          </div>
          <div>
            <dt>Serves</dt>
            <dd>{recipe.servings}</dd>
          </div>
          <div>
            <dt>Ingredients</dt>
            <dd>{recipe.ingredientCount}</dd>
          </div>
        </dl>

        {recipe.tags?.length ? (
          <ul className={styles.tags} aria-label={`${recipe.title} tags`}>
            {recipe.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : null}
      </article>
    </Link>
  );
}
