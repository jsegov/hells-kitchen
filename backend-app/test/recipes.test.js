const {
  getRecipeList,
  toRecipeListItem,
  toRecipeListItems,
} = require("../src/recipes");

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

test("toRecipeListItem returns null for empty recipe records", () => {
  expect(toRecipeListItem(null)).toBeNull();
  expect(toRecipeListItem(undefined)).toBeNull();
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
