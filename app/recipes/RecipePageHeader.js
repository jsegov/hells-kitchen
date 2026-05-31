import styles from "./page.module.css";

/**
 * @param {{ hasError: boolean, recipeCount: number }} props
 */
export default function RecipePageHeader({ hasError, recipeCount }) {
  return (
    <section className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Recipe Manager</p>
        <h1>Recipes</h1>
      </div>
      {!hasError ? (
        <p className={styles.count}>
          {recipeCount} {recipeCount === 1 ? "recipe" : "recipes"}
        </p>
      ) : null}
    </section>
  );
}
