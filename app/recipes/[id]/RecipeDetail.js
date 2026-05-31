import Link from "next/link";
import {
  formatAllergenLabel,
  formatDietaryLabel,
  formatDifficulty,
} from "../recipeData";
import Metric from "./Metric";
import ServingSizeControls from "./ServingSizeControls";
import styles from "./page.module.css";

/**
 * @param {string} ingredientId
 */
function formatIngredientId(ingredientId) {
  return ingredientId
    .split("_")
    .filter(Boolean)
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * @param {{ recipe: import("../recipeData").RecipeDetail }} props
 */
export default function RecipeDetail({ recipe }) {
  const missingIngredientNames =
    recipe.nutrition.missingIngredientIds.map(formatIngredientId);
  const unconvertedIngredientNames =
    recipe.nutrition.unconvertedIngredientIds.map(formatIngredientId);
  const allergenLabels = recipe.allergens.map(formatAllergenLabel);

  return (
    <>
      <nav className={styles.nav} aria-label="Recipe navigation">
        <Link className={styles.backLink} href="/recipes">
          Back to recipes
        </Link>
      </nav>

      <article className={styles.detail}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Recipe Manager</p>
            <h1>{recipe.title}</h1>
            <p className={styles.description}>{recipe.description}</p>

            {recipe.tags.length ? (
              <ul className={styles.tags} aria-label={`${recipe.title} tags`}>
                {recipe.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            ) : null}

            {recipe.dietary.length ? (
              <ul
                className={styles.dietaryBadges}
                aria-label={`${recipe.title} dietary suitability`}
              >
                {recipe.dietary.map((diet) => (
                  <li key={diet}>{formatDietaryLabel(diet)}</li>
                ))}
              </ul>
            ) : null}

            <p className={styles.allergenLine}>
              <span>Contains:</span>{" "}
              {allergenLabels.length
                ? allergenLabels.join(", ")
                : "No listed common allergens"}
              . Always verify ingredients yourself.
            </p>
          </div>

          <dl className={styles.metrics}>
            <Metric
              label="Difficulty"
              value={formatDifficulty(recipe.difficulty)}
            />
            <Metric label="Prep" value={recipe.prepTime} />
            <Metric label="Cook" value={recipe.cookTime} />
          </dl>
        </header>

        <div className={styles.contentGrid}>
          <ServingSizeControls
            missingIngredientNames={missingIngredientNames}
            recipe={recipe}
            unconvertedIngredientNames={unconvertedIngredientNames}
          />

          <section
            className={styles.panel}
            aria-labelledby="instructions-heading"
          >
            <h2 id="instructions-heading">Instructions</h2>
            {recipe.instructions.length ? (
              <ol className={styles.instructions}>
                {recipe.instructions.map((instruction, index) => (
                  <li key={`${instruction}-${index}`}>{instruction}</li>
                ))}
              </ol>
            ) : (
              <p className={styles.emptyState}>No instructions listed.</p>
            )}
          </section>
        </div>
      </article>
    </>
  );
}
