/**
 * @jest-environment node
 *
 * Directly exercises the AI Overview finalizer — the server-side honesty
 * authority. The streamed object is provisional; this endpoint validates it
 * against the catalog, suppresses non-discovery cards, and resolves real DTOs.
 */
import { createOverviewResolveHandler } from "../app/api/recipes/overview/resolve/route";

/**
 * @param {string} id
 * @param {string} title
 * @returns {import("../lib/recipes").RecipeListItem}
 */
const recipe = (id, title, overrides = {}) => ({
  id,
  title,
  description: `${title} description`,
  servings: 2,
  prepTime: "10 min",
  cookTime: "20 min",
  difficulty: "easy",
  tags: ["dinner"],
  dateAdded: "2026-01-01",
  dietary: [],
  allergens: [],
  ingredientCount: 3,
  ...overrides,
});

/**
 * @param {string} id
 * @param {string} title
 * @returns {import("../lib/recipes").OverviewCatalogRow}
 */
const catalogRow = (id, title, overrides = {}) => ({
  id,
  title,
  tags: ["dinner"],
  difficulty: "easy",
  prepMinutes: 10,
  cookMinutes: 20,
  servings: 2,
  dietary: [],
  allergens: [],
  nutritionComplete: true,
  perServing: { calories: 100, protein: 10, carbs: 15, fat: 2 },
  ...overrides,
});

/** @type {import("../lib/recipes").RecipeListItem[]} */
const recipes = [
  recipe("r1", "Tomato Bowl"),
  recipe("r2", "Steak Plate"),
  recipe("r3", "Lemon Pasta"),
];

/** @type {import("../lib/recipes").OverviewCatalogRow[]} */
const overviewCatalog = [
  catalogRow("r1", "Tomato Bowl"),
  catalogRow("r2", "Steak Plate"),
  catalogRow("r3", "Lemon Pasta"),
];

const handlerWith = ({ list = recipes, catalog = overviewCatalog } = {}) =>
  createOverviewResolveHandler({
    loadRecipes: () => Promise.resolve(list),
    loadCatalog: () => Promise.resolve(catalog),
  });

/**
 * @param {unknown} body
 */
const postRequest = (body) =>
  new Request("http://localhost/api/recipes/overview/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("finalizes ids to the catalog subset and resolved cards", async () => {
  const handler = handlerWith();

  const response = await handler(
    postRequest({
      overview: "Two solid dinners.",
      recommendedRecipeIds: ["r2", "does-not-exist", "r1", "🙈"],
      intent: "discovery",
      suggestedFilters: {
        diet: ["vegetarian", "made-up"],
        tag: ["dinner", "fake-tag"],
      },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");

  const finalized =
    /** @type {{ recommendedRecipeIds: string[], recipes: import("../lib/recipes").RecipeListItem[], suggestedFilters: { diet: string[], tag: string[] } }} */ (
      await response.json()
    );
  expect(finalized.recommendedRecipeIds).toEqual(["r2", "r1"]);
  expect(finalized.recipes.map((r) => r.id)).toEqual(["r2", "r1"]);
  expect(finalized.recipes[0].title).toBe("Steak Plate");
  expect(finalized.suggestedFilters).toEqual({
    diet: ["vegetarian"],
    tag: ["dinner"],
  });
});

test("suppresses cards for non-discovery intents", async () => {
  const handler = handlerWith();

  const response = await handler(
    postRequest({
      overview: "I can help with recipe discovery instead.",
      recommendedRecipeIds: ["r1"],
      intent: "off_topic",
    }),
  );

  const finalized =
    /** @type {{ intent: string, recommendedRecipeIds: string[], recipes: import("../lib/recipes").RecipeListItem[] }} */ (
      await response.json()
    );
  expect(finalized.intent).toBe("off_topic");
  expect(finalized.recommendedRecipeIds).toEqual([]);
  expect(finalized.recipes).toEqual([]);
});

test("resolves valid ids for non-off-topic intents without fallback", async () => {
  const handler = handlerWith();

  const response = await handler(
    postRequest({
      overview: "This is more of a cooking question, but Tomato Bowl applies.",
      recommendedRecipeIds: ["r1"],
      intent: "how_to",
    }),
  );

  const finalized =
    /** @type {{ intent: string, recommendedRecipeIds: string[], recipes: import("../lib/recipes").RecipeListItem[] }} */ (
      await response.json()
    );
  expect(finalized.intent).toBe("how_to");
  expect(finalized.recommendedRecipeIds).toEqual(["r1"]);
  expect(finalized.recipes.map((recipe) => recipe.id)).toEqual(["r1"]);
});

test("falls back to validated filters when discovery ids do not resolve", async () => {
  const handler = handlerWith({
    list: [
      recipe("v1", "Vegetable Curry", {
        tags: ["dinner", "vegetarian"],
        dietary: ["vegetarian"],
      }),
      recipe("v2", "Pasta Night", {
        tags: ["dinner", "vegetarian"],
        dietary: ["vegetarian"],
      }),
      recipe("m1", "Steak Plate", { tags: ["dinner"], dietary: [] }),
    ],
    catalog: [
      catalogRow("v1", "Vegetable Curry", {
        tags: ["dinner", "vegetarian"],
        dietary: ["vegetarian"],
      }),
      catalogRow("v2", "Pasta Night", {
        tags: ["dinner", "vegetarian"],
        dietary: ["vegetarian"],
      }),
      catalogRow("m1", "Steak Plate", {
        tags: ["dinner"],
        dietary: [],
      }),
    ],
  });

  const response = await handler(
    postRequest({
      rawOverview: {
        overview: "Here are vegetarian dinner ideas.",
        recommendedRecipeIds: ["not-real"],
        intent: "discovery",
        suggestedFilters: {
          diet: ["vegetarian"],
          tag: ["dinner"],
        },
      },
      query: "quick vegetarian dinner",
    }),
  );

  const finalized =
    /** @type {{ recommendedRecipeIds: string[], recipes: import("../lib/recipes").RecipeListItem[] }} */ (
      await response.json()
    );
  expect(finalized.recommendedRecipeIds).toEqual(["v1", "v2"]);
  expect(finalized.recipes.map((recipe) => recipe.id)).toEqual(["v1", "v2"]);
});

test("falls back to exact title mentions before filter matches", async () => {
  const handler = handlerWith({
    list: [
      recipe("r1", "Tomato Bowl"),
      recipe("r2", "Steak Plate"),
      recipe("r3", "Lemon Pasta"),
    ],
    catalog: [
      catalogRow("r1", "Tomato Bowl"),
      catalogRow("r2", "Steak Plate"),
      catalogRow("r3", "Lemon Pasta"),
    ],
  });

  const response = await handler(
    postRequest({
      overview: "Lemon Pasta and Tomato Bowl would both work.",
      recommendedRecipeIds: [],
      intent: "discovery",
      suggestedFilters: { diet: [], tag: ["dinner"] },
    }),
  );

  const finalized =
    /** @type {{ recommendedRecipeIds: string[], recipes: import("../lib/recipes").RecipeListItem[] }} */ (
      await response.json()
    );
  expect(finalized.recommendedRecipeIds).toEqual(["r3", "r1", "r2"]);
  expect(finalized.recipes.map((recipe) => recipe.id)).toEqual([
    "r3",
    "r1",
    "r2",
  ]);
});

test("valid ids win over fallback candidates", async () => {
  const handler = handlerWith();

  const response = await handler(
    postRequest({
      overview: "Tomato Bowl mentions a fallback title.",
      recommendedRecipeIds: ["r2"],
      intent: "discovery",
      suggestedFilters: { diet: [], tag: ["dinner"] },
    }),
  );

  const finalized =
    /** @type {{ recommendedRecipeIds: string[], recipes: import("../lib/recipes").RecipeListItem[] }} */ (
      await response.json()
    );
  expect(finalized.recommendedRecipeIds).toEqual(["r2"]);
  expect(finalized.recipes.map((recipe) => recipe.id)).toEqual(["r2"]);
});

test("returns no cards when discovery has no ids, filters, or exact titles", async () => {
  const handler = handlerWith();

  const response = await handler(
    postRequest({
      overview: "These ideas are cozy and simple.",
      recommendedRecipeIds: [],
      intent: "discovery",
      suggestedFilters: { diet: [], tag: [] },
    }),
  );

  const finalized =
    /** @type {{ recommendedRecipeIds: string[], recipes: import("../lib/recipes").RecipeListItem[] }} */ (
      await response.json()
    );
  expect(finalized.recommendedRecipeIds).toEqual([]);
  expect(finalized.recipes).toEqual([]);
});

test("caps fallback recommendations at four cards", async () => {
  const fallbackRecipes = Array.from({ length: 6 }, (_, index) =>
    recipe(`v${index}`, `Vegetarian Dinner ${index}`, {
      tags: ["dinner", "vegetarian"],
      dietary: ["vegetarian"],
    }),
  );
  const fallbackCatalog = fallbackRecipes.map((item) =>
    catalogRow(item.id, item.title, {
      tags: ["dinner", "vegetarian"],
      dietary: ["vegetarian"],
    }),
  );
  const handler = handlerWith({
    list: fallbackRecipes,
    catalog: fallbackCatalog,
  });

  const response = await handler(
    postRequest({
      overview: "Vegetarian dinner ideas.",
      recommendedRecipeIds: [],
      intent: "discovery",
      suggestedFilters: { diet: ["vegetarian"], tag: ["dinner"] },
    }),
  );

  const finalized =
    /** @type {{ recommendedRecipeIds: string[], recipes: import("../lib/recipes").RecipeListItem[] }} */ (
      await response.json()
    );
  expect(finalized.recommendedRecipeIds).toEqual(["v0", "v1", "v2", "v3"]);
  expect(finalized.recipes).toHaveLength(4);
});

test("catalog/list drift returns only actually resolved cards", async () => {
  const handler = handlerWith({
    list: [recipe("r1", "Tomato Bowl")],
    catalog: [catalogRow("r1", "Tomato Bowl"), catalogRow("r2", "Steak Plate")],
  });

  const response = await handler(
    postRequest({
      overview: "Two picks.",
      recommendedRecipeIds: ["r2", "r1"],
      intent: "discovery",
    }),
  );

  const finalized =
    /** @type {{ recommendedRecipeIds: string[], recipes: import("../lib/recipes").RecipeListItem[] }} */ (
      await response.json()
    );
  expect(finalized.recommendedRecipeIds).toEqual(["r1"]);
  expect(finalized.recipes.map((recipe) => recipe.id)).toEqual(["r1"]);
});

test("caps finalized recommendations at the defensive maximum (25)", async () => {
  const manyRecipes = Array.from({ length: 40 }, (_, i) =>
    recipe(`x${i}`, `Recipe ${i}`),
  );
  const manyCatalog = Array.from({ length: 40 }, (_, i) =>
    catalogRow(`x${i}`, `Recipe ${i}`),
  );
  const handler = handlerWith({ list: manyRecipes, catalog: manyCatalog });

  const ids = manyCatalog.map((row) => row.id);
  const response = await handler(
    postRequest({
      overview: "Many picks.",
      recommendedRecipeIds: ids,
      intent: "discovery",
    }),
  );

  const finalized =
    /** @type {{ recommendedRecipeIds: string[], recipes: import("../lib/recipes").RecipeListItem[] }} */ (
      await response.json()
    );
  expect(finalized.recommendedRecipeIds).toEqual(ids.slice(0, 25));
  expect(finalized.recipes.map((r) => r.id)).toEqual(ids.slice(0, 25));
});

test("returns 400 on malformed JSON and 413 on oversized payloads", async () => {
  const handler = handlerWith();

  const malformed = await handler(
    new Request("http://localhost/api/recipes/overview/resolve", {
      method: "POST",
      body: "not json",
    }),
  );
  expect(malformed.status).toBe(400);

  const oversized = await handler(
    new Request("http://localhost/api/recipes/overview/resolve", {
      method: "POST",
      headers: { "content-length": "4097" },
      body: "{}",
    }),
  );
  expect(oversized.status).toBe(413);
});

test("returns a generic 500 and logs only the error class", async () => {
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  const handler = createOverviewResolveHandler({
    loadCatalog: () =>
      Promise.reject(new Error("postgres exploded at db.internal")),
    loadRecipes: () => Promise.resolve(recipes),
  });

  const response = await handler(
    postRequest({
      overview: "x",
      recommendedRecipeIds: ["r1"],
      intent: "discovery",
    }),
  );

  expect(response.status).toBe(500);
  expect(response.headers.get("Cache-Control")).toBe("no-store");

  const body = await response.json();
  expect(body).toEqual({ error: "Failed to finalize recommended recipes" });
  expect(JSON.stringify(body)).not.toContain("db.internal");
  expect(errorSpy).toHaveBeenCalledWith(
    "Failed to finalize overview recipes (Error)",
  );

  errorSpy.mockRestore();
});
