/**
 * Island-state tests for the AI Overview client island. The streaming hook
 * (`@ai-sdk/react`'s `experimental_useObject`) and finalizer `fetch` are
 * mocked so the states render deterministically with no network, no key, and no
 * real stream.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import RecipeOverview from "../app/recipes/RecipeOverview";

// Controllable stand-in for `experimental_useObject`. A test sets the current
// `object`/`isLoading`/`error`, and re-renders to push new values; the captured
// `onFinish`/`submit` let a test drive the finished-stream transition.
const hookState = {
  /** @type {unknown} */
  object: undefined,
  isLoading: false,
  /** @type {Error | undefined} */
  error: undefined,
  submit: jest.fn(),
  stop: jest.fn(),
  clear: jest.fn(),
  /** @type {((event: { object: unknown, error: Error | undefined }) => void) | null} */
  onFinish: null,
};

jest.mock("@ai-sdk/react", () => ({
  __esModule: true,
  experimental_useObject: (
    /** @type {{ onFinish?: (event: { object: unknown, error: Error | undefined }) => void }} */ options,
  ) => {
    hookState.onFinish = options.onFinish ?? null;
    return {
      object: hookState.object,
      submit: hookState.submit,
      stop: hookState.stop,
      error: hookState.error,
      isLoading: hookState.isLoading,
      clear: hookState.clear,
    };
  },
}));

const tomatoBowl = {
  id: "r1",
  title: "Tomato Bowl",
  description: "A bright vegetarian bowl.",
  servings: 2,
  prepTime: "20 minutes",
  cookTime: "60 minutes",
  difficulty: "easy",
  ingredientCount: 5,
  tags: ["italian", "dinner"],
  dateAdded: "2024-01-15T10:30:00Z",
  dietary: ["vegetarian"],
  allergens: [],
};

const finalizedPayload = (overrides = {}) => ({
  overview: "Tomato Bowl is the quickest.",
  intent: "discovery",
  suggestedFilters: { diet: ["vegetarian"], tag: ["dinner"] },
  recommendedRecipeIds: ["r1"],
  recipes: [tomatoBowl],
  ...overrides,
});

/**
 * @param {unknown} payload
 */
const mockFinalizeFetch = (payload) =>
  jest.fn(
    async (/** @type {string} */ _url, /** @type {RequestInit} */ _init) => ({
      ok: true,
      json: async () => payload,
    }),
  );

beforeEach(() => {
  hookState.object = undefined;
  hookState.isLoading = false;
  hookState.error = undefined;
  hookState.onFinish = null;
  hookState.submit.mockReset();
  hookState.stop.mockReset();
  hookState.clear.mockReset();
  delete (/** @type {{ fetch?: unknown }} */ (global).fetch);
});

test("submits the query, keeps focus on the input, and shows provisional streaming prose", () => {
  const { rerender } = render(<RecipeOverview />);

  const input = screen.getByPlaceholderText(/Ask for a recommendation/i);
  fireEvent.change(input, {
    target: { value: "a quick vegetarian dinner" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  expect(hookState.submit).toHaveBeenCalledWith({
    query: "a quick vegetarian dinner",
  });
  expect(hookState.clear).toHaveBeenCalledTimes(1);
  // Focus stays on the input after submit (a11y).
  expect(input).toHaveFocus();
  expect(input).toHaveValue("a quick vegetarian dinner");
  expect(screen.queryByText(/You asked/i)).not.toBeInTheDocument();

  // Simulate the stream filling in: partial prose + a visible Stop control.
  hookState.isLoading = true;
  hookState.object = { overview: "Here are two fast vegetarian dinners." };
  rerender(<RecipeOverview />);

  expect(
    screen.getByText("Here are two fast vegetarian dinners."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
});

test("uses a GET browse fallback when JavaScript is unavailable", () => {
  render(<RecipeOverview />);

  const input = screen.getByPlaceholderText(/Ask for a recommendation/i);
  const form = input.closest("form");

  expect(input).toHaveAttribute("name", "name");
  expect(form).toHaveAttribute("method", "get");
  expect(form).toHaveAttribute("action", "/recipes");
});

test("finalizes grounded cards after the stream finishes", async () => {
  const resolveFetch = mockFinalizeFetch(finalizedPayload());
  /** @type {{ fetch: unknown }} */ (global).fetch = resolveFetch;

  const { rerender } = render(<RecipeOverview />);

  fireEvent.change(screen.getByPlaceholderText(/Ask for a recommendation/i), {
    target: { value: "a quick vegetarian dinner" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  // The streamed object is provisional; cards wait for finalization.
  hookState.object = {
    overview: "Tomato Bowl is the quickest.",
    recommendedRecipeIds: ["r1"],
    suggestedFilters: { diet: ["vegetarian"], tag: ["dinner"] },
    intent: "discovery",
  };
  rerender(<RecipeOverview />);

  expect(
    screen.queryByRole("region", { name: "Recommended recipes" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /See all/ })).toBeNull();

  await act(async () => {
    hookState.onFinish?.({
      object: hookState.object,
      error: undefined,
    });
  });

  expect(resolveFetch).toHaveBeenCalledTimes(1);
  const [url, init] = resolveFetch.mock.calls[0];
  expect(url).toBe("/api/recipes/overview/resolve");
  expect(init).toMatchObject({
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  expect(JSON.parse(String(init.body))).toEqual({
    query: "a quick vegetarian dinner",
    rawOverview: hookState.object,
  });

  await waitFor(() => {
    const cards = screen.getByRole("region", {
      name: "Recommended recipes",
    });
    expect(within(cards).getByText("Tomato Bowl")).toBeInTheDocument();
  });

  expect(screen.queryByRole("link", { name: /See all/ })).toBeNull();
});

test("a hallucinated id never renders a card from the provisional stream", async () => {
  const resolveFetch = mockFinalizeFetch(finalizedPayload());
  /** @type {{ fetch: unknown }} */ (global).fetch = resolveFetch;

  const { rerender } = render(<RecipeOverview />);

  fireEvent.change(screen.getByPlaceholderText(/Ask for a recommendation/i), {
    target: { value: "anything" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  hookState.object = {
    overview: "Here is a pick.",
    recommendedRecipeIds: ["r1", "does-not-exist"],
    suggestedFilters: { diet: [], tag: [] },
    intent: "discovery",
  };
  rerender(<RecipeOverview />);

  await act(async () => {
    hookState.onFinish?.({
      object: hookState.object,
      error: undefined,
    });
  });

  expect(JSON.parse(String(resolveFetch.mock.calls[0][1].body))).toMatchObject({
    query: "anything",
    rawOverview: {
      recommendedRecipeIds: ["r1", "does-not-exist"],
    },
  });

  await waitFor(() => {
    expect(screen.getByText("Tomato Bowl")).toBeInTheDocument();
  });

  const cards = screen.getByRole("region", { name: "Recommended recipes" });
  expect(within(cards).getAllByRole("link")).toHaveLength(1);
  expect(screen.queryByText("does-not-exist")).not.toBeInTheDocument();
});

test("shows no-match only from a finalized discovery response", async () => {
  const resolveFetch = mockFinalizeFetch(
    finalizedPayload({
      overview: "Nothing in the catalog fits that.",
      intent: "discovery",
      suggestedFilters: { diet: [], tag: [] },
      recommendedRecipeIds: [],
      recipes: [],
    }),
  );
  /** @type {{ fetch: unknown }} */ (global).fetch = resolveFetch;

  const { rerender } = render(<RecipeOverview />);

  fireEvent.change(screen.getByPlaceholderText(/Ask for a recommendation/i), {
    target: { value: "ostrich tartare" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  hookState.object = {
    overview: "Nothing in the catalog fits that.",
    recommendedRecipeIds: [],
    suggestedFilters: { diet: [], tag: [] },
    intent: "discovery",
  };
  rerender(<RecipeOverview />);

  expect(screen.queryByText(/Nothing in the catalog matched/i)).toBeNull();

  await act(async () => {
    hookState.onFinish?.({
      object: hookState.object,
      error: undefined,
    });
  });

  await waitFor(() => {
    expect(screen.getByText(/Nothing in the catalog matched/i)).toBeVisible();
  });
  expect(
    screen.queryByRole("region", { name: "Recommended recipes" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "browsing all recipes" }),
  ).toHaveAttribute("href", "/recipes");
});

test("does not show no-match after Stop", () => {
  const resolveFetch = mockFinalizeFetch(finalizedPayload());
  /** @type {{ fetch: unknown }} */ (global).fetch = resolveFetch;
  const { rerender } = render(<RecipeOverview />);

  fireEvent.change(screen.getByPlaceholderText(/Ask for a recommendation/i), {
    target: { value: "a difficult match" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  hookState.isLoading = true;
  hookState.object = { overview: "Nothing in the catalog fits that." };
  rerender(<RecipeOverview />);

  fireEvent.click(screen.getByRole("button", { name: "Stop" }));

  expect(hookState.stop).toHaveBeenCalledTimes(1);
  expect(hookState.clear).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/Nothing in the catalog matched/i)).toBeNull();

  act(() => {
    hookState.onFinish?.({
      object: {
        overview: "Tomato Bowl is the quickest.",
        recommendedRecipeIds: ["r1"],
        suggestedFilters: { diet: [], tag: [] },
        intent: "discovery",
      },
      error: undefined,
    });
  });

  expect(resolveFetch).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("region", { name: "Recommended recipes" }),
  ).not.toBeInTheDocument();
});

test("finalizes usable streamed partials after useObject schema errors", async () => {
  const resolveFetch = mockFinalizeFetch(finalizedPayload());
  /** @type {{ fetch: unknown }} */ (global).fetch = resolveFetch;

  const { rerender } = render(<RecipeOverview />);

  fireEvent.change(screen.getByPlaceholderText(/Ask for a recommendation/i), {
    target: { value: "a quick dinner" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  hookState.object = {
    overview: "Tomato Bowl is the quickest.",
    recommendedRecipeIds: ["r1"],
    suggestedFilters: { diet: [], tag: [] },
    intent: "discovery",
  };
  rerender(<RecipeOverview />);

  await act(async () => {
    hookState.onFinish?.({
      object: undefined,
      error: new Error("schema failed"),
    });
  });

  expect(resolveFetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(resolveFetch.mock.calls[0][1].body))).toEqual({
    query: "a quick dinner",
    rawOverview: hookState.object,
  });

  await waitFor(() => {
    expect(screen.getByText("Tomato Bowl")).toBeInTheDocument();
  });
});

test("treats schema validation errors without usable partials as real errors", async () => {
  const resolveFetch = mockFinalizeFetch(finalizedPayload());
  /** @type {{ fetch: unknown }} */ (global).fetch = resolveFetch;

  render(<RecipeOverview />);

  fireEvent.change(screen.getByPlaceholderText(/Ask for a recommendation/i), {
    target: { value: "a quick dinner" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  await act(async () => {
    hookState.onFinish?.({
      object: undefined,
      error: new Error("schema failed"),
    });
  });

  expect(resolveFetch).not.toHaveBeenCalled();
  const alert = screen.getByRole("alert");
  expect(within(alert).getByText(/Something went wrong/i)).toBeInTheDocument();
});

test("stale finalizer failures cannot poison a newer query", async () => {
  let rejectFirst =
    /** @type {((error: Error) => void) | null} */
    (null);
  const resolveFetch = jest.fn(
    () =>
      new Promise((resolve, reject) => {
        if (rejectFirst === null) {
          rejectFirst = reject;
          return;
        }

        resolve({
          ok: true,
          json: async () => finalizedPayload({ overview: "Second answer." }),
        });
      }),
  );
  /** @type {{ fetch: unknown }} */ (global).fetch = resolveFetch;

  const { rerender } = render(<RecipeOverview />);
  const input = screen.getByPlaceholderText(/Ask for a recommendation/i);

  fireEvent.change(input, { target: { value: "first query" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  hookState.object = {
    overview: "First answer.",
    recommendedRecipeIds: [],
    suggestedFilters: { diet: [], tag: [] },
    intent: "discovery",
  };
  rerender(<RecipeOverview />);

  await act(async () => {
    hookState.onFinish?.({ object: hookState.object, error: undefined });
  });

  fireEvent.change(input, { target: { value: "second query" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
  hookState.object = {
    overview: "Second answer.",
    recommendedRecipeIds: ["r1"],
    suggestedFilters: { diet: [], tag: [] },
    intent: "discovery",
  };
  rerender(<RecipeOverview />);

  await act(async () => {
    hookState.onFinish?.({ object: hookState.object, error: undefined });
  });

  await act(async () => {
    rejectFirst?.(new Error("stale failure"));
  });

  await waitFor(() => {
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Second answer.")).toBeInTheDocument();
  });
});

test("ignores cross-realm abort-shaped finalizer failures", async () => {
  const resolveFetch = jest.fn(() =>
    Promise.reject({
      name: "AbortError",
    }),
  );
  /** @type {{ fetch: unknown }} */ (global).fetch = resolveFetch;

  render(<RecipeOverview />);

  fireEvent.change(screen.getByPlaceholderText(/Ask for a recommendation/i), {
    target: { value: "a quick dinner" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  await act(async () => {
    hookState.onFinish?.({
      object: {
        overview: "Tomato Bowl is the quickest.",
        recommendedRecipeIds: ["r1"],
        suggestedFilters: { diet: [], tag: [] },
        intent: "discovery",
      },
      error: undefined,
    });
  });

  await waitFor(() => {
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

test("aborts pending finalization when unmounted", async () => {
  let finalizeSignal = /** @type {AbortSignal | null} */ (null);
  const resolveFetch = jest.fn(
    async (/** @type {string} */ _url, /** @type {RequestInit} */ init) => {
      finalizeSignal = init.signal instanceof AbortSignal ? init.signal : null;
      return new Promise(() => {});
    },
  );
  /** @type {{ fetch: unknown }} */ (global).fetch = resolveFetch;

  const { unmount } = render(<RecipeOverview />);

  fireEvent.change(screen.getByPlaceholderText(/Ask for a recommendation/i), {
    target: { value: "a quick dinner" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  await act(async () => {
    hookState.onFinish?.({
      object: {
        overview: "Tomato Bowl is the quickest.",
        recommendedRecipeIds: ["r1"],
        suggestedFilters: { diet: [], tag: [] },
        intent: "discovery",
      },
      error: undefined,
    });
  });

  expect(finalizeSignal?.aborted).toBe(false);

  unmount();

  expect(finalizeSignal?.aborted).toBe(true);
});

test("surfaces an inline stream error and retries the same query", () => {
  const { rerender } = render(<RecipeOverview />);

  fireEvent.change(screen.getByPlaceholderText(/Ask for a recommendation/i), {
    target: { value: "a quick dinner" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  hookState.submit.mockClear();

  hookState.error = new Error("stream failed");
  rerender(<RecipeOverview />);

  const alert = screen.getByRole("alert");
  expect(within(alert).getByText(/Something went wrong/i)).toBeInTheDocument();

  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  expect(hookState.submit).toHaveBeenCalledWith({ query: "a quick dinner" });
});
