import {
  formatDifficulty,
  getRecipe,
  getRecipeFacets,
  getRecipes,
  hasRecipeFilters,
  normalizeRecipeFilters,
  normalizeRecipeSort,
} from "../app/recipes/recipeData";

const recipeListItem = {
  id: "1",
  title: "Classic Margherita Pizza",
  description: "Traditional Italian pizza with fresh basil",
  servings: 4,
  prepTime: "20 minutes",
  cookTime: "15 minutes",
  difficulty: "easy",
  ingredientCount: 5,
  tags: ["italian", "vegetarian", "dinner"],
  dateAdded: "2024-01-15T10:30:00Z",
  dietary: ["vegetarian"],
  allergens: ["dairy", "gluten", "wheat"],
};

const recipeDetail = {
  id: "1",
  title: "Classic Margherita Pizza",
  description: "Traditional Italian pizza with fresh basil",
  servings: 4,
  prepTime: "20 minutes",
  cookTime: "15 minutes",
  difficulty: "easy",
  tags: ["italian", "vegetarian", "dinner"],
  dietary: ["vegetarian"],
  allergens: ["dairy", "gluten", "wheat"],
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
    unconvertedIngredientIds: [],
  },
};

test("normalizeRecipeFilters trims and splits strings while ignoring malformed values", () => {
  expect(
    normalizeRecipeFilters({
      name: "  salad  ",
      tag: ["vegetarian, dinner", "", 7],
      ingredient: null,
      diet: ["VEGAN", "not-real"],
      exclude: "tree nuts, peanuts",
    }),
  ).toEqual({
    name: ["salad"],
    tag: ["vegetarian", "dinner"],
    ingredient: [],
    diet: ["vegan"],
    exclude: ["tree nuts", "peanuts"],
  });
  expect(hasRecipeFilters({ name: "   " })).toBe(false);
  expect(hasRecipeFilters({ ingredient: "tomato" })).toBe(true);
  expect(hasRecipeFilters({ diet: "vegetarian" })).toBe(true);
});

test("normalizeRecipeSort accepts known single values and falls back defensively", () => {
  expect(
    normalizeRecipeSort({
      sort: "DATE-ADDED",
      order: "DESC",
    }),
  ).toEqual({ sort: "date-added", order: "desc" });
  expect(normalizeRecipeSort({ sort: ["title"], order: "asc" })).toEqual({
    sort: "curated",
    order: "asc",
  });
  expect(normalizeRecipeSort({ sort: "title", order: "sideways" })).toEqual({
    sort: "title",
    order: "asc",
  });
});

test("normalizeRecipeSort parses the combined dropdown token", () => {
  expect(normalizeRecipeSort({ sort: "prep-time-asc" })).toEqual({
    sort: "prep-time",
    order: "asc",
  });
  expect(
    normalizeRecipeSort({ sort: "difficulty-desc", order: "asc" }),
  ).toEqual({ sort: "difficulty", order: "desc" });
});

test("getRecipeFacets validates shape and capitalizes tag labels", async () => {
  const dataLayer = {
    getRecipeFacets: jest.fn(async () => ({
      tags: [{ value: "vegan", label: "vegan", count: 3 }],
      ingredients: [{ value: "tomato", label: "Diced Tomatoes", count: 2 }],
      diets: [{ value: "vegan", label: "Vegan", count: 3 }],
      allergens: [{ value: "dairy", label: "Dairy", count: 4 }],
    })),
  };

  const result = await getRecipeFacets({
    filters: { diet: "vegan" },
    dataLayer,
  });

  expect(dataLayer.getRecipeFacets).toHaveBeenCalledWith({ diet: "vegan" });
  expect(result.error).toBeNull();
  expect(result.facets.tags[0].label).toBe("Vegan");
  expect(result.facets.ingredients[0].label).toBe("Diced Tomatoes");
});

test("getRecipeFacets returns empty facets and an error on malformed data", async () => {
  const dataLayer = {
    getRecipeFacets: jest.fn(async () => ({ tags: [{ value: "x" }] })),
  };

  const result = await getRecipeFacets({ dataLayer });

  expect(result.error).toBe(
    "Invalid data format received from the recipe service.",
  );
  expect(result.facets).toEqual({
    tags: [],
    ingredients: [],
    diets: [],
    allergens: [],
  });
});

test("getRecipes returns mapped recipes from the data layer", async () => {
  const recipeList = [recipeListItem];
  const dataLayer = {
    getRecipeList: jest.fn(async () => recipeList),
    getRecipeDetail: jest.fn(async () => null),
  };

  const result = await getRecipes({ dataLayer });

  expect(result).toEqual({
    recipes: recipeList,
    error: null,
  });
});

test("getRecipes forwards filters to the data layer", async () => {
  const filters = {
    name: "Greek Salad",
    ingredient: "feta",
  };
  const dataLayer = {
    getRecipeList: jest.fn(async () => []),
    getRecipeDetail: jest.fn(async () => null),
  };

  await getRecipes({ filters, dataLayer });

  expect(dataLayer.getRecipeList).toHaveBeenCalledWith(filters, undefined);
});

test("getRecipes forwards sort to the data layer", async () => {
  const sort = {
    sort: "title",
    order: "desc",
  };
  const dataLayer = {
    getRecipeList: jest.fn(async () => []),
    getRecipeDetail: jest.fn(async () => null),
  };

  await getRecipes({ sort, dataLayer });

  expect(dataLayer.getRecipeList).toHaveBeenCalledWith(undefined, sort);
});

test("getRecipes returns a visible error for invalid list items", async () => {
  const dataLayer = {
    getRecipeList: jest.fn(async () => [
      {
        ...recipeListItem,
        tags: ["italian", 42],
      },
    ]),
    getRecipeDetail: jest.fn(async () => null),
  };

  const result = await getRecipes({ dataLayer });

  expect(result).toEqual({
    recipes: [],
    error: "Invalid data format received from the recipe service.",
  });
});

test("getRecipes returns a visible error for non-array payloads", async () => {
  const dataLayer = {
    getRecipeList: jest.fn(async () => /** @type {any} */ ({ recipes: [] })),
    getRecipeDetail: jest.fn(async () => null),
  };

  const result = await getRecipes({ dataLayer });

  expect(result).toEqual({
    recipes: [],
    error: "Invalid data format received from the recipe service.",
  });
});

test("getRecipes returns a service error when the data layer throws", async () => {
  const dataLayer = {
    getRecipeList: jest.fn(async () => {
      throw new Error("boom");
    }),
    getRecipeDetail: jest.fn(async () => null),
  };

  const result = await getRecipes({ dataLayer });

  expect(result).toEqual({
    recipes: [],
    error: "Unable to load recipes.",
  });
});

test("getRecipe returns a recipe detail from the data layer", async () => {
  const dataLayer = {
    getRecipeList: jest.fn(async () => []),
    getRecipeDetail: jest.fn(async () => recipeDetail),
  };

  const result = await getRecipe("1", { dataLayer });

  expect(dataLayer.getRecipeDetail).toHaveBeenCalledWith("1");
  expect(result).toEqual({
    recipe: recipeDetail,
    error: null,
    notFound: false,
  });
});

test("getRecipe returns a not found result when the data layer returns null", async () => {
  const dataLayer = {
    getRecipeList: jest.fn(async () => []),
    getRecipeDetail: jest.fn(async () => null),
  };

  const result = await getRecipe("not-real", { dataLayer });

  expect(result).toEqual({
    recipe: null,
    error: null,
    notFound: true,
  });
});

test("getRecipe returns a visible error for invalid detail payloads", async () => {
  const dataLayer = {
    getRecipeList: jest.fn(async () => []),
    getRecipeDetail: jest.fn(async () => ({
      id: "1",
      title: "Missing fields",
    })),
  };

  const result = await getRecipe("1", { dataLayer });

  expect(result).toEqual({
    recipe: null,
    error: "Invalid data format received from the recipe service.",
    notFound: false,
  });
});

test("getRecipe returns a service error when the data layer throws", async () => {
  const dataLayer = {
    getRecipeList: jest.fn(async () => []),
    getRecipeDetail: jest.fn(async () => {
      throw new Error("boom");
    }),
  };

  const result = await getRecipe("1", { dataLayer });

  expect(result).toEqual({
    recipe: null,
    error: "Unable to load the recipe.",
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
