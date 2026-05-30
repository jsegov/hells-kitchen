import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Recipe Not Found",
};

export default function RecipeNotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.state}>
        <p className={styles.eyebrow}>Recipe Manager</p>
        <h1>Recipe not found</h1>
        <p>The recipe may have been removed or the link may be incorrect.</p>
        <Link className={styles.backLink} href="/recipes">
          Back to recipes
        </Link>
      </section>
    </main>
  );
}
