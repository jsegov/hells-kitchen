"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DEFAULT_RECIPE_SORT,
  RECIPE_SORT_CHOICES,
  toSortToken,
} from "../../lib/recipeOptions";
import styles from "./page.module.css";

const DEFAULT_SORT_TOKEN = toSortToken(DEFAULT_RECIPE_SORT);
const MOBILE_MEDIA_QUERY = "(max-width: 640px)";
// Facets longer than this gain a type-to-filter box; shorter ones render inline.
const SEARCHABLE_OPTION_THRESHOLD = 12;

/**
 * One facet group rendered as a row of toggle-chip checkboxes. Long groups
 * (tag, ingredient) get a client-side type-to-filter box; the checkboxes stay
 * the source of truth so the group still submits with the GET form when JS is
 * off, and `:has(:checked)` styling reflects toggles instantly.
 *
 * @param {{
 *   legend: string,
 *   name: string,
 *   options: import("./recipeData").RecipeFacetOption[],
 *   selected: string[],
 *   searchable?: boolean,
 * }} props
 */
function FacetGroup({ legend, name, options, selected, searchable = false }) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions =
    searchable && normalizedQuery
      ? options.filter(
          (option) =>
            selectedSet.has(option.value) ||
            option.label.toLowerCase().includes(normalizedQuery),
        )
      : options;

  return (
    <fieldset className={styles.facet}>
      <legend>{legend}</legend>

      {searchable ? (
        <input
          type="search"
          className={styles.facetSearch}
          placeholder={`Filter ${legend.toLowerCase()}…`}
          aria-label={`Filter ${legend} options`}
          value={query}
          onChange={(event) => {
            // Local UI only — keep it from bubbling to the form's instant nav.
            event.stopPropagation();
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
            }
          }}
        />
      ) : null}

      <div
        className={searchable ? styles.facetScroll : styles.facetChips}
        role="group"
        aria-label={legend}
      >
        {visibleOptions.length ? (
          visibleOptions.map((option) => (
            <label
              key={option.value}
              className={`${styles.toggleChip}${
                option.count === 0 ? ` ${styles.toggleChipEmpty}` : ""
              }`}
            >
              <input
                className={styles.visuallyHidden}
                type="checkbox"
                name={name}
                value={option.value}
                defaultChecked={selectedSet.has(option.value)}
                aria-label={`${option.label} (${option.count})`}
              />
              <span className={styles.toggleLabel} aria-hidden="true">
                {option.label}
              </span>
              <span className={styles.facetCount} aria-hidden="true">
                {option.count}
              </span>
            </label>
          ))
        ) : (
          <p className={styles.facetEmpty}>No matches.</p>
        )}
      </div>
    </fieldset>
  );
}

/**
 * @param {{
 *   filters: import("./recipeData").RecipeFilters,
 *   sort: import("./recipeData").RecipeSort,
 *   facets: import("./recipeData").RecipeFacets,
 *   resultCount: number,
 * }} props
 */
export default function RecipeFilters({ filters, sort, facets, resultCount }) {
  const router = useRouter();
  const sectionRef = useRef(/** @type {HTMLElement | null} */ (null));
  const formRef = useRef(/** @type {HTMLFormElement | null} */ (null));
  const isMobileRef = useRef(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeCount =
    filters.name.length +
    filters.tag.length +
    filters.ingredient.length +
    filters.diet.length +
    filters.exclude.length;
  const hasActiveFilters = activeCount > 0;
  // Remounts the uncontrolled form so defaults re-sync after a navigation
  // (e.g. removing a chip above the results).
  const formKey = JSON.stringify({ filters, sort });

  useEffect(() => {
    // Flag the panel as JS-enhanced so CSS can collapse it into a mobile
    // drawer. Done imperatively (not via state) to avoid a hydration-time
    // re-render; the attribute is absent on the server, matching first paint.
    sectionRef.current?.setAttribute("data-enhanced", "");

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateIsMobile = () => {
      isMobileRef.current = mediaQuery.matches;
    };

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);
    return () => mediaQuery.removeEventListener("change", updateIsMobile);
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    const onKeyDown = (/** @type {KeyboardEvent} */ event) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    /** @type {HTMLElement | null | undefined} */
    const firstControl = formRef.current?.querySelector(
      "input, select, button",
    );
    firstControl?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const buildHref = useCallback(() => {
    const form = formRef.current;

    if (!form) {
      return "/recipes";
    }

    const params = new URLSearchParams();

    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim() !== "") {
        params.append(key, value);
      }
    }

    if (params.get("sort") === DEFAULT_SORT_TOKEN) {
      params.delete("sort");
    }

    const queryString = params.toString();
    return queryString ? `/recipes?${queryString}` : "/recipes";
  }, []);

  const handleChange = useCallback(
    (/** @type {import("react").ChangeEvent<HTMLFormElement>} */ event) => {
      // Mobile batches every change behind the "apply" button. The free-text
      // search applies on submit/blur (not per keystroke) to avoid a request
      // per character; facets and sort apply instantly on desktop.
      if (isMobileRef.current) {
        return;
      }

      const target = event.target;

      if (target instanceof HTMLInputElement && target.name === "name") {
        return;
      }

      router.replace(buildHref(), { scroll: false });
    },
    [buildHref, router],
  );

  const handleSubmit = useCallback(
    (/** @type {import("react").FormEvent<HTMLFormElement>} */ event) => {
      event.preventDefault();
      router.push(buildHref());
      setDrawerOpen(false);
    },
    [buildHref, router],
  );

  const handleNameBlur = useCallback(() => {
    if (isMobileRef.current) {
      return;
    }

    router.replace(buildHref(), { scroll: false });
  }, [buildHref, router]);

  return (
    <section
      ref={sectionRef}
      className={styles.filters}
      aria-labelledby="recipe-filters-title"
      data-drawer-open={drawerOpen ? "" : undefined}
    >
      <div className={styles.filtersHeader}>
        <h2 id="recipe-filters-title">Find recipes</h2>
        {hasActiveFilters ? (
          <Link className={styles.clearFilters} href="/recipes">
            Clear all
          </Link>
        ) : null}
      </div>

      <button
        type="button"
        className={styles.filtersTrigger}
        aria-controls="recipe-filter-form"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
      >
        Filters{hasActiveFilters ? ` (${activeCount})` : ""}
      </button>

      <div
        className={styles.drawerOverlay}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />

      <form
        id="recipe-filter-form"
        key={formKey}
        ref={formRef}
        className={styles.filterForm}
        action="/recipes"
        role="search"
        aria-label="Recipe filters"
        onChange={handleChange}
        onSubmit={handleSubmit}
      >
        <div className={styles.drawerHeader}>
          <h2>Filters</h2>
          <button
            type="button"
            className={styles.drawerClose}
            aria-label="Close filters"
            onClick={() => setDrawerOpen(false)}
          >
            ×
          </button>
        </div>

        <div className={styles.searchRow}>
          <div className={styles.filterField}>
            <label htmlFor="recipe-name">Search</label>
            <input
              id="recipe-name"
              name="name"
              type="search"
              placeholder="Search by name…"
              defaultValue={filters.name.join(", ")}
              onBlur={handleNameBlur}
            />
          </div>

          <div className={styles.filterField}>
            <label htmlFor="recipe-sort">Sort</label>
            <select
              id="recipe-sort"
              name="sort"
              defaultValue={toSortToken(sort)}
            >
              {RECIPE_SORT_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.facetGrid}>
          <FacetGroup
            legend="Diet"
            name="diet"
            options={facets.diets}
            selected={filters.diet}
          />
          <FacetGroup
            legend="Exclude allergens"
            name="exclude"
            options={facets.allergens}
            selected={filters.exclude}
          />
          <FacetGroup
            legend="Tag"
            name="tag"
            options={facets.tags}
            selected={filters.tag}
            searchable={facets.tags.length > SEARCHABLE_OPTION_THRESHOLD}
          />
          <FacetGroup
            legend="Ingredient"
            name="ingredient"
            options={facets.ingredients}
            selected={filters.ingredient}
            searchable={facets.ingredients.length > SEARCHABLE_OPTION_THRESHOLD}
          />
        </div>

        <div className={styles.formActions}>
          <button className={styles.searchButton} type="submit">
            Show {resultCount} {resultCount === 1 ? "recipe" : "recipes"}
          </button>
        </div>
      </form>
    </section>
  );
}
