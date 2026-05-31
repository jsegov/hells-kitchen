import styles from "./page.module.css";

const SKELETON_ROW_KEYS = ["1", "2", "3", "4"];

function SkeletonMetricCell() {
  return (
    <div>
      <span className={`${styles.skeleton} ${styles.skeletonMetric}`} />
    </div>
  );
}

/**
 * @param {{ rowCount: number }} props
 */
function SkeletonPanel({ rowCount }) {
  return (
    <section className={styles.panel}>
      <span className={`${styles.skeleton} ${styles.skeletonPanelTitle}`} />
      <div className={styles.skeletonRows}>
        {SKELETON_ROW_KEYS.slice(0, rowCount).map((key) => (
          <span
            key={key}
            className={`${styles.skeleton} ${styles.skeletonLine}`}
          />
        ))}
      </div>
    </section>
  );
}

export default function RecipeDetailLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <p className={styles.visuallyHidden} role="status">
        Loading recipe…
      </p>

      <nav className={styles.nav} aria-hidden="true">
        <span className={`${styles.skeleton} ${styles.skeletonBackLink}`} />
      </nav>

      <article className={styles.detail} aria-hidden="true">
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.skeletonStack}>
              <span
                className={`${styles.skeleton} ${styles.skeletonEyebrow}`}
              />
              <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
              <span className={`${styles.skeleton} ${styles.skeletonLine}`} />
              <span
                className={`${styles.skeleton} ${styles.skeletonLineShort}`}
              />
            </div>
          </div>

          <dl className={styles.metrics}>
            <SkeletonMetricCell />
            <SkeletonMetricCell />
            <SkeletonMetricCell />
            <SkeletonMetricCell />
          </dl>
        </header>

        <div className={styles.contentGrid}>
          <SkeletonPanel rowCount={4} />
          <SkeletonPanel rowCount={3} />
          <SkeletonPanel rowCount={4} />
        </div>
      </article>
    </main>
  );
}
