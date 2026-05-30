import {
  DEFAULT_API_BASE_URL,
  formatDifficulty,
  getRecipe,
  getRecipeUrl,
  getRecipes,
  getRecipesUrl,
} from "../app/recipes/recipeData";

const recipeDetail = {
  id: "1",
  title: "Classic Margherita Pizza",
  description: "Traditional Italian pizza with fresh basil",
  servings: 4,
  prepTime: "20 minutes",
  cookTime: "15 minutes",
  difficulty: "easy",
  tags: ["italian", "vegetarian", "dinner"],
  instructions: ["Prepare pizza dough with flour"],
  ingredients: [
    {
      ingredientId: "tomato",
      name: "Diced Tomatoes",
      amount: "2",
      unit: "cups",
      category: "vegetable",
      nutrition: {
        calories: 50,
        protein: 3,
        carbs: 10,
        fat: 0.4,
      },
    },
  ],
  nutrition: {
    total: {
      calories: 50,
      protein: 3,
      carbs: 10,
      fat: 0.4,
    },
    perServing: {
      calories: 12.5,
      protein: 0.8,
      carbs: 2.5,
      fat: 0.1,
    },
    missingIngredientIds: [],
  },
};

test("getRecipesUrl builds the list API URL from the default base URL", () => {
  expect(getRecipesUrl()).toBe(`${DEFAULT_API_BASE_URL}/api/recipes`);
});

test("getRecipesUrl handles a configured base URL with a trailing slash", () => {
  expect(getRecipesUrl("http://example.test/")).toBe(
    "http://example.test/api/recipes",
  );
});

test("getRecipeUrl builds an encoded detail API URL", () => {
  expect(getRecipeUrl("recipe with/slash", "http://example.test/")).toBe(
    "http://example.test/api/recipes/recipe%20with%2Fslash",
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

test("getRecipe fetches a recipe detail with no-store caching", async () => {
  const fetchImpl = jest.fn(async () => ({
    ok: true,
    json: async () => recipeDetail,
  }));

  const result = await getRecipe("1", {
    apiBaseUrl: "http://api.test",
    fetchImpl,
  });

  expect(fetchImpl).toHaveBeenCalledWith("http://api.test/api/recipes/1", {
    cache: "no-store",
  });
  expect(result).toEqual({
    recipe: recipeDetail,
    error: null,
    notFound: false,
  });
});

test("getRecipe returns a not found result for 404 responses", async () => {
  const result = await getRecipe("not-real", {
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: "Recipe not found" }),
    }),
  });

  expect(result).toEqual({
    recipe: null,
    error: null,
    notFound: true,
  });
});

test("getRecipe returns a visible error for non-404 failed responses", async () => {
  const result = await getRecipe("1", {
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      json: async () => [],
    }),
  });

  expect(result).toEqual({
    recipe: null,
    error: "Unable to load recipe (503)",
    notFound: false,
  });
});

test("getRecipe returns a visible error for invalid detail payloads", async () => {
  const result = await getRecipe("1", {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ id: "1", title: "Missing fields" }),
    }),
  });

  expect(result).toEqual({
    recipe: null,
    error: "Invalid data format received from the recipe service.",
    notFound: false,
  });
});

test("getRecipe returns a data format error when JSON parsing fails", async () => {
  const result = await getRecipe("1", {
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    }),
  });

  expect(result).toEqual({
    recipe: null,
    error: "Invalid data format received from the recipe service.",
    notFound: false,
  });
});

test("getRecipe returns a service error when fetch throws", async () => {
  const result = await getRecipe("1", {
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
  });

  expect(result).toEqual({
    recipe: null,
    error: "Unable to reach the recipe service.",
    notFound: false,
  });
});

test("formatDifficulty title-cases difficulty and falls back when missing", () => {
  expect(formatDifficulty("easy")).toBe("Easy");
  expect(formatDifficulty("medium")).toBe("Medium");
  expect(formatDifficulty("")).toBe("Unrated");
  expect(formatDifficulty("   ")).toBe("Unrated");
  expect(formatDifficulty(null)).toBe("Unrated");
  expect(formatDifficulty(3)).toBe("Unrated");
  expect(formatDifficulty(true)).toBe("Unrated");
});
