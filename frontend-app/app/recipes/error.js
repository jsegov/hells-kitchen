"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

/**
 * @param {{ error: Error & { digest?: string }, reset: () => void }} props
 */
export default function RecipesError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <section className={styles.state} role="alert">
        <h2>Something went wrong</h2>
        <p>We could not load this page right now. Please try again.</p>
        <div className={styles.errorActions}>
          <button
            type="button"
            className={styles.searchButton}
            onClick={() => reset()}
          >
            Try again
          </button>
          <Link className={styles.clearFilters} href="/recipes">
            Back to recipes
          </Link>
        </div>
      </section>
    </main>
  );
}
