"use client";

import { useMemo, useState } from "react";
import {
  getServingMultiplier,
  scaleIngredientAmount,
  scaleNutritionForServings,
  toValidServings,
} from "../../../lib/servingMath";
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
 * @param {number} servings
 */
function createServingPresets(servings) {
  const validServings = toValidServings(servings) ?? 1;
  return Array.from(
    new Set(
      [
        Math.max(1, Math.round(validServings / 2)),
        validServings,
        validServings * 2,
        8,
      ]
        .map((value) => Math.round(value))
        .filter((value) => value > 0 && value <= 99),
    ),
  );
}

/**
 * @param {{ recipe: Pick<import("../recipeData").RecipeDetail, "servings" | "ingredients" | "nutrition">, missingIngredientNames: string[], unconvertedIngredientNames: string[] }} props
 */
export default function ServingSizeControls({
  recipe,
  missingIngredientNames,
  unconvertedIngredientNames,
}) {
  const originalServings = toValidServings(recipe.servings);
  const [targetServings, setTargetServings] = useState(
    String(originalServings ?? 1),
  );
  const numericTargetServings = toValidServings(targetServings);
  const canScale = originalServings !== null;
  const effectiveServings =
    canScale && numericTargetServings !== null
      ? numericTargetServings
      : (originalServings ?? 1);
  const multiplier =
    getServingMultiplier(originalServings, effectiveServings) ?? 1;
  const scaledNutrition = useMemo(
    () =>
      scaleNutritionForServings(
        recipe.nutrition.total,
        originalServings,
        effectiveServings,
      ),
    [effectiveServings, originalServings, recipe.nutrition.total],
  );
  const scaledIngredients = useMemo(
    () =>
      recipe.ingredients.map((ingredient) => ({
        ...ingredient,
        scaledAmount: scaleIngredientAmount(ingredient.amount, multiplier),
      })),
    [multiplier, recipe.ingredients],
  );
  const servingPresets = useMemo(
    () => createServingPresets(recipe.servings),
    [recipe.servings],
  );
  const nutritionExclusionNote = [
    missingIngredientNames.length ? missingIngredientNames.join(", ") : "",
    unconvertedIngredientNames.length
      ? `unconverted amounts for ${unconvertedIngredientNames.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <>
      <section className={styles.panel} aria-labelledby="ingredients-heading">
        <div className={styles.sectionHeader}>
          <h2 id="ingredients-heading">Ingredients</h2>

          <div className={styles.servingControl}>
            <label htmlFor="target-servings">Target servings</label>
            <div className={styles.servingInputRow}>
              <input
                id="target-servings"
                min="1"
                max="99"
                name="targetServings"
                type="number"
                step="1"
                value={targetServings}
                disabled={!canScale}
                onChange={(event) => setTargetServings(event.target.value)}
              />
              <div
                className={styles.servingPresets}
                aria-label="Serving presets"
              >
                {servingPresets.map((servings) => (
                  <button
                    aria-pressed={Number(targetServings) === servings}
                    disabled={!canScale}
                    key={servings}
                    onClick={() => setTargetServings(String(servings))}
                    type="button"
                  >
                    {servings}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.visuallyHidden} aria-live="polite">
              Scaled to {effectiveServings} servings with a{" "}
              {formatNutritionNumber(multiplier)} times ingredient multiplier.
            </p>
          </div>
        </div>

        {recipe.ingredients.length ? (
          <ul className={styles.ingredients}>
            {scaledIngredients.map((ingredient, index) => (
              <li key={`${ingredient.ingredientId}-${index}`}>
                <span className={styles.ingredientAmount}>
                  {ingredient.scaledAmount} {ingredient.unit}
                </span>
                <span className={styles.ingredientName}>{ingredient.name}</span>
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

        <p className={styles.scaleNote}>
          Scaling is linear; adjust seasoning, leavening, and cook times by
          taste.
        </p>
      </section>

      <aside className={styles.panel} aria-labelledby="nutrition-heading">
        <h2 id="nutrition-heading">Nutrition</h2>
        <div className={styles.nutritionStack}>
          <NutritionGroup
            title="Per serving"
            nutrition={scaledNutrition.perServing}
          />
          <NutritionGroup title="Total" nutrition={scaledNutrition.total} />
        </div>

        {nutritionExclusionNote ? (
          <p className={styles.nutritionNote}>
            Nutrition excludes {nutritionExclusionNote}.
          </p>
        ) : null}
      </aside>
    </>
  );
}
