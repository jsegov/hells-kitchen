import Link from "next/link";
import { formatDifficulty } from "../recipeData";
import styles from "./page.module.css";

/**
 * @param {number} value
 */
function formatNutritionNumber(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

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
 * @param {{ label: string, value: string | number }} props
 */
function Metric({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * @param {{ title: string, nutrition: import("../recipeData").Nutrition }} props
 */
function NutritionGroup({ title, nutrition }) {
  return (
    <section className={styles.nutritionGroup} aria-label={title}>
      <h3>{title}</h3>
      <dl className={styles.nutritionGrid}>
        <Metric
          label="Calories"
          value={formatNutritionNumber(nutrition.calories)}
        />
        <Metric
          label="Protein"
          value={`${formatNutritionNumber(nutrition.protein)}g`}
        />
        <Metric
          label="Carbs"
          value={`${formatNutritionNumber(nutrition.carbs)}g`}
        />
        <Metric
          label="Fat"
          value={`${formatNutritionNumber(nutrition.fat)}g`}
        />
      </dl>
    </section>
  );
}

/**
 * @param {{ recipe: import("../recipeData").RecipeDetail }} props
 */
export default function RecipeDetail({ recipe }) {
  const missingIngredientNames =
    recipe.nutrition.missingIngredientIds.map(formatIngredientId);

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
          </div>

          <dl className={styles.metrics}>
            <Metric
              label="Difficulty"
              value={formatDifficulty(recipe.difficulty)}
            />
            <Metric label="Prep" value={recipe.prepTime} />
            <Metric label="Cook" value={recipe.cookTime} />
            <Metric label="Serves" value={recipe.servings} />
          </dl>
        </header>

        <div className={styles.contentGrid}>
          <section
            className={styles.panel}
            aria-labelledby="ingredients-heading"
          >
            <h2 id="ingredients-heading">Ingredients</h2>
            {recipe.ingredients.length ? (
              <ul className={styles.ingredients}>
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={`${ingredient.ingredientId}-${index}`}>
                    <span className={styles.ingredientAmount}>
                      {ingredient.amount} {ingredient.unit}
                    </span>
                    <span className={styles.ingredientName}>
                      {ingredient.name}
                    </span>
                    {ingredient.category ? (
                      <span className={styles.ingredientCategory}>
                        {ingredient.category}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>No ingredients listed.</p>
            )}
          </section>

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

          <aside className={styles.panel} aria-labelledby="nutrition-heading">
            <h2 id="nutrition-heading">Nutrition</h2>
            <div className={styles.nutritionStack}>
              <NutritionGroup
                title="Per serving"
                nutrition={recipe.nutrition.perServing}
              />
              <NutritionGroup
                title="Total"
                nutrition={recipe.nutrition.total}
              />
            </div>

            {missingIngredientNames.length ? (
              <p className={styles.nutritionNote}>
                Nutrition excludes {missingIngredientNames.join(", ")}.
              </p>
            ) : null}
          </aside>
        </div>
      </article>
    </>
  );
}
