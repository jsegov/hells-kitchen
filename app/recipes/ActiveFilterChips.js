import Link from "next/link";
import styles from "./page.module.css";

/**
 * @typedef {object} ActiveFilterChip
 * @property {string} key
 * @property {string} category
 * @property {string} label
 * @property {string} href
 */

/**
 * Removable overview of every applied filter. Each chip is a plain anchor to the
 * current query minus that one value, so removal works with and without JS.
 *
 * @param {{ chips: ActiveFilterChip[], clearHref: string }} props
 */
export default function ActiveFilterChips({ chips, clearHref }) {
  if (!chips.length) {
    return null;
  }

  return (
    <section className={styles.activeFilters} aria-label="Active filters">
      <span className={styles.activeFiltersLabel}>Active</span>
      <ul className={styles.chipRow}>
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              className={styles.chip}
              href={chip.href}
              aria-label={`Remove ${chip.category} filter: ${chip.label}`}
            >
              <span className={styles.chipCategory}>{chip.category}</span>
              <span className={styles.chipLabel}>{chip.label}</span>
              <span className={styles.chipRemove} aria-hidden="true">
                ×
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link className={styles.clearAll} href={clearHref}>
            Clear all
          </Link>
        </li>
      </ul>
    </section>
  );
}
