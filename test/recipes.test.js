import {
  createRecipeRepository,
  toRecipeDetail,
  toRecipeListItem,
  toRecipeListItems,
} from "../lib/recipes";
import recipeDatabase from "../db/data.json";

const { getRecipeDetail, getRecipeList } = createRecipeRepository(
  async () => recipeDatabase,
);

test("toRecipeListItem maps only list-safe recipe fields", () => {
  const item = toRecipeListItem({
    id: "recipe-1",
    title: "Test Recipe",
    description: "A recipe for testing",
    servings: 4,
    prepTime: "10 minutes",
    cookTime: "20 minutes",
    difficulty: "easy",
    ingredients: [
      { ingredientId: "flour", amount: "1", unit: "cup" },
      { ingredientId: "salt", amount: "1", unit: "tsp" },
    ],
    instructions: ["Do the thing"],
    tags: ["dinner", "quick"],
    dateAdded: "2024-01-01T00:00:00Z",
  });

  expect(item).not.toBeNull();
  if (!item) {
    throw new Error("Expected a mapped recipe list item.");
  }

  expect(Object.keys(item).sort()).toEqual([
    "cookTime",
    "description",
    "difficulty",
    "id",
    "ingredientCount",
    "prepTime",
    "servings",
    "tags",
    "title",
  ]);
  expect(item.ingredientCount).toBe(2);
  expect(item.tags).toEqual(["dinner", "quick"]);
  expect(item).not.toHaveProperty("instructions");
  expect(item).not.toHaveProperty("ingredients");
  expect(item).not.toHaveProperty("dateAdded");
});

test("toRecipeListItem handles missing array fields defensively", () => {
  const item = toRecipeListItem({
    id: "recipe-2",
    title: "Sparse Recipe",
    description: "A sparse recipe for testing",
    servings: 2,
    prepTime: "5 minutes",
    cookTime: "0 minutes",
    difficulty: "easy",
  });

  expect(item).not.toBeNull();
  if (!item) {
    throw new Error("Expected a mapped recipe list item.");
  }

  expect(item.tags).toEqual([]);
  expect(item.ingredientCount).toBe(0);
});

test("toRecipeListItem normalizes non-string difficulty values", () => {
  const item = toRecipeListItem({
    id: "recipe-3",
    title: "Malformed Recipe",
    description: "A malformed recipe for testing",
    servings: 2,
    prepTime: "5 minutes",
    cookTime: "0 minutes",
    difficulty: 7,
  });

  expect(item).not.toBeNull();
  if (!item) {
    throw new Error("Expected a mapped recipe list item.");
  }

  expect(item.difficulty).toBe("");
});

test("toRecipeListItem normalizes malformed list-safe scalar fields", () => {
  const item = toRecipeListItem(
    /** @type {*} */ ({
      id: "recipe-4",
      title: "Malformed List Recipe",
      description: null,
      servings: Number.POSITIVE_INFINITY,
      prepTime: false,
      cookTime: 42,
      difficulty: 7,
      tags: ["dinner", 42, ""],
      ingredients: [
        { ingredientId: "flour" },
        { ingredientId: "" },
        { ingredientId: "salt" },
        {},
        null,
      ],
    }),
  );

  expect(item).not.toBeNull();
  if (!item) {
    throw new Error("Expected a mapped recipe list item.");
  }

  expect(item).toMatchObject({
    description: "",
    servings: 0,
    prepTime: "",
    cookTime: "",
    difficulty: "",
    tags: ["dinner", ""],
    ingredientCount: 2,
  });
});

test("toRecipeListItem returns null for empty recipe records", () => {
  expect(toRecipeListItem(null)).toBeNull();
  expect(toRecipeListItem(undefined)).toBeNull();
});

test("toRecipeListItem returns null when required list identity fields are missing", () => {
  expect(
    toRecipeListItem({
      id: "",
      title: "Missing ID Recipe",
      description: "A recipe without an ID",
      servings: 1,
      prepTime: "5 minutes",
      cookTime: "0 minutes",
      difficulty: "easy",
    }),
  ).toBeNull();
  expect(
    toRecipeListItem({
      id: "missing-title",
      title: "   ",
      description: "A recipe without a title",
      servings: 1,
      prepTime: "5 minutes",
      cookTime: "0 minutes",
      difficulty: "easy",
    }),
  ).toBeNull();
});

test("toRecipeListItems returns an empty list for invalid database shapes", () => {
  expect(toRecipeListItems(null)).toEqual([]);
  expect(toRecipeListItems({})).toEqual([]);
  expect(toRecipeListItems({ recipes: null })).toEqual([]);
});

test("toRecipeListItems filters out invalid recipe records", () => {
  const recipes = toRecipeListItems({
    recipes: [
      null,
      {
        id: "recipe-1",
        title: "Test Recipe",
        description: "A recipe for testing",
        servings: 4,
        prepTime: "10 minutes",
        cookTime: "20 minutes",
        difficulty: "easy",
      },
    ],
  });

  expect(recipes).toHaveLength(1);
  expect(recipes[0].id).toBe("recipe-1");
});

test("getRecipeList returns list DTOs from the mock database", async () => {
  const recipes = await getRecipeList();

  expect(recipes).toHaveLength(15);
  expect(recipes[0].title).toBe("Classic Margherita Pizza");
  expect(recipes[0].ingredientCount).toBe(5);
  expect(Object.keys(recipes[0]).sort()).toEqual([
    "cookTime",
    "description",
    "difficulty",
    "id",
    "ingredientCount",
    "prepTime",
    "servings",
    "tags",
    "title",
  ]);
});

test("getRecipeList filters recipes by name", async () => {
  const recipes = await getRecipeList({ name: "PIZZA" });

  expect(recipes).toHaveLength(1);
  expect(recipes[0].title).toBe("Classic Margherita Pizza");
});

test("getRecipeList filters recipes by tag", async () => {
  const recipes = await getRecipeList({ tag: "vegetarian" });

  expect(recipes).toHaveLength(5);
  expect(recipes.every((recipe) => recipe.tags.includes("vegetarian"))).toBe(
    true,
  );
});

test("getRecipeList filters recipes by ingredient id, name, and fallback name", async () => {
  const tomatoRecipes = await getRecipeList({ ingredient: "diced tomatoes" });
  const soySauceRecipes = await getRecipeList({ ingredient: "soy sauce" });

  expect(tomatoRecipes.map((recipe) => recipe.title)).toEqual([
    "Classic Margherita Pizza",
    "Greek Salad",
  ]);
  expect(soySauceRecipes.map((recipe) => recipe.title)).toEqual([
    "Chicken Stir-Fry",
    "Stir-Fried Tofu",
  ]);
});

test("getRecipeList combines filters, repeated values, and comma-separated values with AND semantics", async () => {
  const recipes = await getRecipeList({
    name: "salad",
    tag: "vegetarian",
    ingredient: "tomato, feta",
  });

  expect(recipes).toHaveLength(1);
  expect(recipes[0].title).toBe("Greek Salad");
});

test("getRecipeList ignores empty and malformed filter values", async () => {
  const recipes = await getRecipeList({
    name: {
      toString() {
        throw new Error("Filter values must not be coerced.");
      },
    },
    tag: ["", "dinner", 42],
    ingredient: null,
  });

  expect(recipes.map((recipe) => recipe.title)).toEqual([
    "Classic Margherita Pizza",
    "Chicken Stir-Fry",
    "Beef Tacos",
    "Sushi Roll",
    "Pasta Carbonara",
    "Grilled Salmon with Asparagus",
    "Almond-Crusted Chicken",
  ]);
});

test("getRecipeDetail returns a full recipe detail DTO from the mock database", async () => {
  const recipe = await getRecipeDetail("1");

  expect(recipe).not.toBeNull();
  if (!recipe) {
    throw new Error("Expected a recipe detail DTO.");
  }

  expect(Object.keys(recipe).sort()).toEqual([
    "cookTime",
    "description",
    "difficulty",
    "id",
    "ingredients",
    "instructions",
    "nutrition",
    "prepTime",
    "servings",
    "tags",
    "title",
  ]);
  expect(recipe).not.toHaveProperty("dateAdded");
  expect(recipe.title).toBe("Classic Margherita Pizza");
  expect(recipe.instructions).toEqual([
    "Prepare pizza dough with flour",
    "Spread tomato sauce",
    "Add fresh mozzarella",
    "Bake at 450°F",
    "Top with fresh basil",
  ]);
  expect(recipe.ingredients[0]).toEqual({
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
  });
  expect(recipe.ingredients[2]).toEqual({
    ingredientId: "basil",
    name: "Fresh Basil",
    amount: "10",
    unit: "leaves",
    category: "herb",
    nutrition: {
      calories: 2,
      protein: 0.2,
      carbs: 0.2,
      fat: 0.1,
    },
  });
  expect(recipe.nutrition).toEqual({
    total: {
      calories: 3669.5,
      protein: 211.7,
      carbs: 263.7,
      fat: 199.5,
    },
    perServing: {
      calories: 917.4,
      protein: 52.9,
      carbs: 65.9,
      fat: 49.9,
    },
    missingIngredientIds: [],
  });
});

test("getRecipeDetail returns null for missing recipe IDs", async () => {
  await expect(getRecipeDetail("not-real")).resolves.toBeNull();
});

test("toRecipeDetail supports fractional ingredient amounts", () => {
  const recipe = toRecipeDetail(
    {
      id: "fractional",
      title: "Fractional Recipe",
      description: "A recipe with fractional amounts",
      servings: 2,
      prepTime: "5 minutes",
      cookTime: "10 minutes",
      difficulty: "easy",
      ingredients: [{ ingredientId: "test_oil", amount: "1/2", unit: "cup" }],
      instructions: ["Measure carefully"],
      tags: ["test"],
    },
    new Map([
      [
        "test_oil",
        {
          id: "test_oil",
          name: "Test Oil",
          category: "oil",
          nutrition: {
            calories: 100,
            protein: 2,
            carbs: 4,
            fat: 8,
          },
        },
      ],
    ]),
  );

  expect(recipe).not.toBeNull();
  if (!recipe) {
    throw new Error("Expected a recipe detail DTO.");
  }

  expect(recipe.ingredients[0].nutrition).toEqual({
    calories: 50,
    protein: 1,
    carbs: 2,
    fat: 4,
  });
  expect(recipe.nutrition.total).toEqual({
    calories: 50,
    protein: 1,
    carbs: 2,
    fat: 4,
  });
  expect(recipe.nutrition.perServing).toEqual({
    calories: 25,
    protein: 0.5,
    carbs: 1,
    fat: 2,
  });
});

test("toRecipeDetail defensively maps malformed scalar detail fields", () => {
  const recipe = toRecipeDetail(
    /** @type {*} */ ({
      id: 7,
      title: null,
      description: undefined,
      servings: Number.NaN,
      prepTime: false,
      cookTime: 42,
      difficulty: "medium",
      ingredients: [{ ingredientId: "test_oil", amount: 2, unit: undefined }],
      instructions: ["Serve"],
      tags: ["test"],
    }),
    new Map([
      [
        "test_oil",
        {
          id: "test_oil",
          name: "Test Oil",
          category: "oil",
          nutrition: {
            calories: 100,
            protein: 2,
            carbs: 4,
            fat: 8,
          },
        },
      ],
    ]),
  );

  expect(recipe).not.toBeNull();
  if (!recipe) {
    throw new Error("Expected a recipe detail DTO.");
  }

  expect(recipe).toMatchObject({
    id: "",
    title: "",
    description: "",
    servings: 0,
    prepTime: "",
    cookTime: "",
  });
  expect(recipe.ingredients[0]).toMatchObject({
    amount: "2",
    unit: "",
    nutrition: {
      calories: 200,
      protein: 4,
      carbs: 8,
      fat: 16,
    },
  });
  expect(recipe.nutrition.perServing).toEqual({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
});

test("toRecipeDetail handles missing ingredient metadata without crashing", () => {
  const recipe = toRecipeDetail(
    {
      id: "missing-ingredient",
      title: "Missing Ingredient Recipe",
      description: "A recipe with missing metadata",
      servings: 1,
      prepTime: "5 minutes",
      cookTime: "0 minutes",
      difficulty: "easy",
      ingredients: [
        { ingredientId: "mystery_item", amount: "2", unit: "cups" },
      ],
      instructions: ["Serve"],
      tags: [],
    },
    new Map(),
  );

  expect(recipe).not.toBeNull();
  if (!recipe) {
    throw new Error("Expected a recipe detail DTO.");
  }

  expect(recipe.ingredients[0]).toEqual({
    ingredientId: "mystery_item",
    name: "Mystery Item",
    amount: "2",
    unit: "cups",
    category: "",
    nutrition: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    },
  });
  expect(recipe.nutrition.missingIngredientIds).toEqual(["mystery_item"]);
});
