"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import RecipeCard from "./RecipeCard";
import { OVERVIEW_SCHEMA } from "../../lib/aiOverviewSchema";
import styles from "./RecipeOverview.module.css";

/**
 * Mirrors the route's server-side guard so the input cannot submit a query the
 * API would only reject with a 400 (plan §7/§12). The textarea also caps input.
 */
const MAX_QUERY_LEN = 300;

/**
 * @typedef {import("./recipeData").RecipeListItem} RecipeListItem
 */

/**
 * The streamed object, every field optional/partial. `useObject` types its
 * `object` as `DeepPartial` of the schema's inferred type, which (for a plain
 * JSON-Schema-backed `Schema`) widens to `{}`; this is the shape we actually
 * read defensively while tokens arrive.
 *
 * @typedef {object} PartialOverview
 * @property {string=} overview
 * @property {string[]=} recommendedRecipeIds
 * @property {("discovery" | "off_topic" | "how_to" | "analytics")=} intent
 * @property {{ diet?: string[], tag?: string[] }=} suggestedFilters
 */

/**
 * @typedef {object} FinalizedOverview
 * @property {string} overview
 * @property {("discovery" | "off_topic" | "how_to" | "analytics")} intent
 * @property {{ diet: string[], tag: string[] }} suggestedFilters
 * @property {string[]} recommendedRecipeIds
 * @property {RecipeListItem[]} recipes
 */

/**
 * Finalizes the completed streamed object through the server authority. The
 * streamed object is provisional; the finalizer validates ids/filters against
 * the real catalog and returns card DTOs the existing RecipeCard can render.
 *
 * @param {unknown} rawOverview
 * @param {string} query
 * @param {AbortSignal} signal
 * @returns {Promise<FinalizedOverview>}
 */
async function finalizeOverview(rawOverview, query, signal) {
  const response = await fetch("/api/recipes/overview/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({ query, rawOverview: rawOverview ?? {} }),
  });

  if (!response.ok) {
    throw new Error("Failed to finalize recommended recipes.");
  }

  const data = await response.json();
  return /** @type {FinalizedOverview} */ (data);
}

/**
 * @param {unknown} raw
 */
function hasUsablePartialOverview(raw) {
  if (!raw || typeof raw !== "object") {
    return false;
  }

  const partial = /** @type {PartialOverview} */ (raw);
  const filters = partial.suggestedFilters ?? {};

  return (
    (typeof partial.overview === "string" &&
      partial.overview.trim().length > 0) ||
    (Array.isArray(partial.recommendedRecipeIds) &&
      partial.recommendedRecipeIds.length > 0) ||
    (Array.isArray(filters.diet) && filters.diet.length > 0) ||
    (Array.isArray(filters.tag) && filters.tag.length > 0)
  );
}

/**
 * AI Overview client island, mounted above the filters on `/recipes`.
 *
 * A freeform query box that streams a short recommendation paragraph and then
 * asks the server to finalize the completed object into grounded recipe cards.
 * The model only names catalog ids; the finalizer re-resolves them through the
 * real data layer and strips invalid links before anything final is rendered.
 *
 */
export default function RecipeOverview() {
  const formId = useId();
  const inputRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const finalizeAbortRef = useRef(/** @type {AbortController | null} */ (null));
  const latestStreamedRef = useRef(
    /** @type {PartialOverview | null} */ (null),
  );
  const ignoredStreamedRef = useRef(
    /** @type {PartialOverview | null} */ (null),
  );
  const ignoreFinishUntilFreshStreamRef = useRef(false);
  const wasStoppedRef = useRef(false);
  const requestIdRef = useRef(0);
  const submittedQueryRef = useRef("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [finalized, setFinalized] = useState(
    /** @type {FinalizedOverview | null} */ (null),
  );
  const [isResolving, setIsResolving] = useState(false);
  const [finalizeError, setFinalizeError] = useState(false);
  const [streamFinishError, setStreamFinishError] = useState(false);
  const [wasStopped, setWasStopped] = useState(false);
  // True once a finished stream has settled (so cards/empty state can render
  // without flashing while tokens are still arriving).
  const [settled, setSettled] = useState(false);

  const { object, submit, stop, clear, error, isLoading } = useObject({
    api: "/api/recipes/overview",
    schema: OVERVIEW_SCHEMA,
    onFinish: ({ object: rawFinal, error: finishError }) => {
      if (wasStoppedRef.current || ignoreFinishUntilFreshStreamRef.current) {
        setIsResolving(false);
        setSettled(true);
        return;
      }

      const requestId = requestIdRef.current;
      const rawOverview =
        rawFinal ??
        (hasUsablePartialOverview(latestStreamedRef.current)
          ? latestStreamedRef.current
          : undefined);

      if (finishError && !rawOverview) {
        setStreamFinishError(true);
        setIsResolving(false);
        setSettled(true);
        return;
      }

      const controller = new AbortController();
      finalizeAbortRef.current?.abort();
      finalizeAbortRef.current = controller;
      setIsResolving(true);

      finalizeOverview(
        rawOverview,
        submittedQueryRef.current,
        controller.signal,
      )
        .then((resolved) => {
          if (
            !controller.signal.aborted &&
            requestIdRef.current === requestId
          ) {
            setFinalized(resolved);
            setSettled(true);
          }
        })
        .catch((cause) => {
          if (
            cause &&
            typeof cause === "object" &&
            "name" in cause &&
            cause.name === "AbortError"
          ) {
            return;
          }
          if (
            !controller.signal.aborted &&
            requestIdRef.current === requestId
          ) {
            setFinalizeError(true);
            setSettled(true);
          }
        })
        .finally(() => {
          if (
            !controller.signal.aborted &&
            requestIdRef.current === requestId
          ) {
            setIsResolving(false);
          }
        });
    },
  });

  const streamed = /** @type {PartialOverview | undefined} */ (object);

  useEffect(() => {
    if (streamed && streamed === ignoredStreamedRef.current) {
      return;
    }

    if (hasUsablePartialOverview(streamed)) {
      latestStreamedRef.current = streamed ?? null;
      ignoredStreamedRef.current = null;
      ignoreFinishUntilFreshStreamRef.current = false;
    }
  }, [streamed]);

  useEffect(() => {
    return () => {
      finalizeAbortRef.current?.abort();
    };
  }, []);

  const handleSubmit = useCallback(
    (/** @type {import("react").FormEvent<HTMLFormElement>} */ event) => {
      event.preventDefault();
      const value = inputRef.current?.value.trim() ?? "";

      if (!value) {
        return;
      }

      // Reset per-request state; keep focus on the input (a11y, plan §8).
      const needsFreshStreamBeforeFinish = wasStoppedRef.current;
      requestIdRef.current += 1;
      finalizeAbortRef.current?.abort();
      finalizeAbortRef.current = null;
      ignoredStreamedRef.current = streamed ?? null;
      latestStreamedRef.current = null;
      ignoreFinishUntilFreshStreamRef.current = needsFreshStreamBeforeFinish;
      wasStoppedRef.current = false;
      submittedQueryRef.current = value;
      setSubmittedQuery(value);
      setFinalized(null);
      setIsResolving(false);
      setFinalizeError(false);
      setStreamFinishError(false);
      setWasStopped(false);
      setSettled(false);
      clear();
      submit({ query: value.slice(0, MAX_QUERY_LEN) });
      inputRef.current?.focus();
    },
    [clear, streamed, submit],
  );

  const handleStop = useCallback(() => {
    requestIdRef.current += 1;
    wasStoppedRef.current = true;
    ignoreFinishUntilFreshStreamRef.current = true;
    stop();
    finalizeAbortRef.current?.abort();
    finalizeAbortRef.current = null;
    ignoredStreamedRef.current = streamed ?? null;
    latestStreamedRef.current = null;
    setFinalized(null);
    setIsResolving(false);
    setWasStopped(true);
    clear();
    inputRef.current?.focus();
  }, [clear, stop, streamed]);

  const streamedOverview =
    typeof streamed?.overview === "string" ? streamed.overview : "";
  const overview = finalized?.overview ?? streamedOverview;
  const cards = finalized?.recipes ?? [];
  const hasSubmitted = submittedQuery.length > 0;
  const showError = Boolean(error) || finalizeError || streamFinishError;
  // Honest empty state: a finished stream that yielded no grounded cards (the
  // model abstained, or every claimed id failed to resolve). Not an error.
  const showEmpty =
    Boolean(finalized) &&
    !wasStopped &&
    settled &&
    !showError &&
    !isLoading &&
    !isResolving &&
    cards.length === 0 &&
    !overview;
  const showNoMatch =
    Boolean(finalized) &&
    finalized?.intent === "discovery" &&
    !wasStopped &&
    settled &&
    !showError &&
    !isLoading &&
    !isResolving &&
    cards.length === 0 &&
    overview.length > 0;
  const finalStatus = showError
    ? "Recommendation failed."
    : finalized
      ? "Recommendation ready."
      : wasStopped
        ? "Recommendation stopped."
        : isResolving
          ? "Checking recommendations."
          : "";

  return (
    <section className={styles.overview} aria-labelledby={`${formId}-title`}>
      <h2 id={`${formId}-title`} className={styles.title}>
        Ask for a recommendation
      </h2>

      <form
        action="/recipes"
        className={styles.form}
        method="get"
        onSubmit={handleSubmit}
      >
        <label className={styles.visuallyHidden} htmlFor={`${formId}-input`}>
          Describe what you want to cook
        </label>
        <textarea
          id={`${formId}-input`}
          ref={inputRef}
          className={styles.input}
          name="name"
          rows={2}
          maxLength={MAX_QUERY_LEN}
          placeholder="Ask for a recommendation — e.g. “a quick vegetarian dinner” or “something to impress for date night”."
          disabled={isLoading}
        />
        <div className={styles.actions}>
          {isLoading ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleStop}
            >
              Stop
            </button>
          ) : (
            <button type="submit" className={styles.primaryButton}>
              {hasSubmitted ? "Ask again" : "Ask"}
            </button>
          )}
        </div>
      </form>

      <p className={styles.visuallyHidden} aria-live="polite">
        {finalStatus}
      </p>

      <div className={styles.result}>
        {hasSubmitted && !showError ? (
          overview ? (
            <p className={styles.prose}>{overview}</p>
          ) : null
        ) : null}

        {isLoading && !overview ? (
          <p className={styles.pending}>Thinking…</p>
        ) : null}

        {isResolving ? (
          <p className={styles.pending}>Checking the catalog…</p>
        ) : null}

        {showNoMatch ? (
          <p className={styles.note}>
            Nothing in the catalog matched that exactly. Try{" "}
            <Link className={styles.inlineLink} href="/recipes">
              browsing all recipes
            </Link>{" "}
            or relaxing a constraint.
          </p>
        ) : null}

        {cards.length > 0 ? (
          <div
            className={styles.cards}
            role="region"
            aria-label="Recommended recipes"
          >
            {cards.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        ) : null}
      </div>

      {showEmpty ? (
        <p className={styles.note}>
          No recommendation yet. Try{" "}
          <Link className={styles.inlineLink} href="/recipes">
            browsing all recipes
          </Link>
          .
        </p>
      ) : null}

      {showError ? (
        <div className={styles.error} role="alert">
          <p>Something went wrong generating a recommendation.</p>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              if (submittedQuery) {
                requestIdRef.current += 1;
                finalizeAbortRef.current?.abort();
                latestStreamedRef.current = null;
                submittedQueryRef.current = submittedQuery;
                setFinalized(null);
                setIsResolving(false);
                setFinalizeError(false);
                setStreamFinishError(false);
                setWasStopped(false);
                setSettled(false);
                submit({ query: submittedQuery.slice(0, MAX_QUERY_LEN) });
                inputRef.current?.focus();
              }
            }}
          >
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}
