import {
  DEFAULT_API_BASE_URL,
  formatDifficulty,
  getRecipes,
  getRecipesUrl,
} from "../app/recipes/recipeData";

test("getRecipesUrl builds the list API URL from the default base URL", () => {
  expect(getRecipesUrl()).toBe(`${DEFAULT_API_BASE_URL}/api/recipes`);
});

test("getRecipesUrl handles a configured base URL with a trailing slash", () => {
  expect(getRecipesUrl("http://example.test/")).toBe(
    "http://example.test/api/recipes",
  );
});

test("getRecipes fetches recipes with no-store caching", async () => {
  const recipeList = [
    {
      id: "1",
      title: "Classic Margherita Pizza",
      description: "Traditional Italian pizza with fresh basil",
      servings: 4,
      prepTime: "20 minutes",
      cookTime: "15 minutes",
      difficulty: "easy",
      ingredientCount: 5,
      tags: ["italian", "vegetarian", "dinner"],
    },
  ];
  const fetchImpl = jest.fn(async () => ({
    ok: true,
    json: async () => recipeList,
  }));

  const result = await getRecipes({
    apiBaseUrl: "http://api.test",
    fetchImpl,
  });

  expect(fetchImpl).toHaveBeenCalledWith("http://api.test/api/recipes", {
    cache: "no-store",
  });
  expect(result).toEqual({
    recipes: recipeList,
    error: null,
  });
});

test("getRecipes returns a visible error for non-2xx responses", async () => {
  const result = await getRecipes({
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      json: async () => [],
    }),
  });

  expect(result).toEqual({
    recipes: [],
    error: "Unable to load recipes (503)",
  });
});

test("getRecipes returns a visible error for non-array payloads", async () => {
  const result = await getRecipes({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ recipes: [] }),
    }),
  });

  expect(result).toEqual({
    recipes: [],
    error: "Invalid data format received from the recipe service.",
  });
});

test("getRecipes returns a data format error when JSON parsing fails", async () => {
  const result = await getRecipes({
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    }),
  });

  expect(result).toEqual({
    recipes: [],
    error: "Invalid data format received from the recipe service.",
  });
});

test("getRecipes returns a service error when fetch throws", async () => {
  const result = await getRecipes({
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
  });

  expect(result).toEqual({
    recipes: [],
    error: "Unable to reach the recipe service.",
  });
});

test("formatDifficulty title-cases difficulty and falls back when missing", () => {
  expect(formatDifficulty("easy")).toBe("Easy");
  expect(formatDifficulty("medium")).toBe("Medium");
  expect(formatDifficulty("")).toBe("Unrated");
  expect(formatDifficulty(null)).toBe("Unrated");
});
