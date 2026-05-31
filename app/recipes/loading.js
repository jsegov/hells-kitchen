import styles from "./page.module.css";

const SKELETON_CARD_KEYS = ["1", "2", "3", "4", "5", "6"];

function SkeletonMetricCell() {
  return (
    <div>
      <span className={`${styles.skeleton} ${styles.skeletonMetric}`} />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className={styles.card}>
      <article>
        <div className={styles.cardHeader}>
          <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          <span className={`${styles.skeleton} ${styles.skeletonPill}`} />
        </div>
        <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
        <span className={`${styles.skeleton} ${styles.skeletonLineShort}`} />
        <dl className={styles.metrics}>
          <SkeletonMetricCell />
          <SkeletonMetricCell />
          <SkeletonMetricCell />
          <SkeletonMetricCell />
        </dl>
      </article>
    </div>
  );
}

export default function RecipesLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <p className={styles.visuallyHidden} role="status">
        Loading recipes…
      </p>

      <section className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Recipe Manager</p>
          <h1>Recipes</h1>
        </div>
      </section>

      <section className={styles.filters} aria-hidden="true">
        <div className={styles.filtersHeader}>
          <span className={`${styles.skeleton} ${styles.skeletonSubtitle}`} />
        </div>
        <div className={styles.filterForm}>
          <span className={`${styles.skeleton} ${styles.skeletonInput}`} />
          <span className={`${styles.skeleton} ${styles.skeletonInput}`} />
          <span className={`${styles.skeleton} ${styles.skeletonInput}`} />
          <span className={`${styles.skeleton} ${styles.skeletonButton}`} />
        </div>
      </section>

      <section className={styles.grid} aria-hidden="true">
        {SKELETON_CARD_KEYS.map((key) => (
          <SkeletonCard key={key} />
        ))}
      </section>
    </main>
  );
}
