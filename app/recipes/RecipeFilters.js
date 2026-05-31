import Link from "next/link";
import { hasRecipeFilters } from "./recipeData";
import styles from "./page.module.css";

/**
 * @param {string[]} values
 */
function formatFilterValue(values) {
  return values.join(", ");
}

/**
 * @param {{ filters: import("./recipeData").RecipeFilters }} props
 */
export default function RecipeFilters({ filters }) {
  const hasActiveFilters = hasRecipeFilters(filters);

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

        <button className={styles.searchButton} type="submit">
          Search
        </button>
      </form>
    </section>
  );
}
