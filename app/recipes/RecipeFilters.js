import Link from "next/link";
import { hasRecipeFilters } from "./recipeData";
import {
  ALLERGEN_OPTIONS,
  DIETARY_OPTIONS,
  RECIPE_SORT_OPTIONS,
  RECIPE_SORT_ORDERS,
} from "../../lib/recipeOptions";
import styles from "./page.module.css";

/**
 * @param {string[]} values
 */
function formatFilterValue(values) {
  return values.join(", ");
}

/**
 * @param {{ filters: import("./recipeData").RecipeFilters, sort: import("./recipeData").RecipeSort }} props
 */
export default function RecipeFilters({ filters, sort }) {
  const hasActiveFilters = hasRecipeFilters(filters);
  const selectedDiets = new Set(filters.diet);
  const excludedAllergens = new Set(filters.exclude);
  const formKey = JSON.stringify({ filters, sort });

  return (
    <section className={styles.filters} aria-labelledby="recipe-filters-title">
      <div className={styles.filtersHeader}>
        <h2 id="recipe-filters-title">Find recipes</h2>
        {hasActiveFilters ? (
          <Link className={styles.clearFilters} href="/recipes">
            Clear
          </Link>
        ) : null}
      </div>

      <form
        key={formKey}
        className={styles.filterForm}
        action="/recipes"
        role="search"
        aria-label="Recipe filters"
      >
        <div className={styles.filterField}>
          <label htmlFor="recipe-name">Recipe name</label>
          <input
            id="recipe-name"
            name="name"
            type="search"
            defaultValue={formatFilterValue(filters.name)}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor="recipe-tag">Tag</label>
          <input
            id="recipe-tag"
            name="tag"
            type="search"
            defaultValue={formatFilterValue(filters.tag)}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor="recipe-ingredient">Ingredient</label>
          <input
            id="recipe-ingredient"
            name="ingredient"
            type="search"
            defaultValue={formatFilterValue(filters.ingredient)}
          />
        </div>

        <div className={styles.filterField}>
          <label htmlFor="recipe-sort">Sort by</label>
          <select id="recipe-sort" name="sort" defaultValue={sort.sort}>
            {RECIPE_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label htmlFor="recipe-order">Order</label>
          <select id="recipe-order" name="order" defaultValue={sort.order}>
            {RECIPE_SORT_ORDERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset className={styles.filterGroup}>
          <legend>Dietary</legend>
          <div className={styles.checkboxGrid}>
            {DIETARY_OPTIONS.map((option) => (
              <label className={styles.checkboxField} key={option.value}>
                <input
                  type="checkbox"
                  name="diet"
                  value={option.value}
                  defaultChecked={selectedDiets.has(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.filterGroup}>
          <legend>Exclude allergens</legend>
          <div className={styles.checkboxGrid}>
            {ALLERGEN_OPTIONS.map((option) => (
              <label className={styles.checkboxField} key={option.value}>
                <input
                  type="checkbox"
                  name="exclude"
                  value={option.value}
                  defaultChecked={excludedAllergens.has(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button className={styles.searchButton} type="submit">
          Search
        </button>
      </form>
    </section>
  );
}
