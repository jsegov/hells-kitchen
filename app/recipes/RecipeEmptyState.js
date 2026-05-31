import styles from "./page.module.css";

/**
 * @param {{ hasActiveFilters: boolean }} props
 */
export default function RecipeEmptyState({ hasActiveFilters }) {
  return (
    <section className={styles.state}>
      <h2>{hasActiveFilters ? "No matching recipes" : "No recipes found"}</h2>
      <p>
        {hasActiveFilters
          ? "Try a different name, tag, ingredient, diet, or allergen filter."
          : "Add recipes to the mock database to see them here."}
      </p>
    </section>
  );
}
