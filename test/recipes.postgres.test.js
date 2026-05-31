/** @jest-environment node */
import { describe, expect, test } from "@jest/globals";

import { getData, getRecipeDetail, getRecipeList } from "../lib/recipes";

const describeWithDb =
  process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

describeWithDb("Neon-backed recipe repository", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for Neon integration tests.");
    }
  });

  test("reassembles the seeded recipe database shape", async () => {
    const data = await getData();

    expect(data).toMatchObject({
      recipes: expect.any(Array),
      ingredients: expect.any(Array),
    });
    expect(data.recipes).toHaveLength(15);
    expect(data.ingredients).toHaveLength(54);
  });

  test("returns list DTOs in the same order as the JSON seed", async () => {
    const recipes = await getRecipeList();

    expect(recipes).toHaveLength(15);
    expect(recipes[0]).toMatchObject({
      title: "Classic Margherita Pizza",
      ingredientCount: 5,
    });
  });

  test("filters recipes by name", async () => {
    const recipes = await getRecipeList({ name: "PIZZA" });

    expect(recipes).toHaveLength(1);
    expect(recipes[0].title).toBe("Classic Margherita Pizza");
  });

  test("filters recipes by tag", async () => {
    const recipes = await getRecipeList({ tag: "vegetarian" });

    expect(recipes).toHaveLength(5);
    expect(recipes.every((recipe) => recipe.tags.includes("vegetarian"))).toBe(
      true,
    );
  });

  test("filters recipes by ingredient id, name, and fallback name", async () => {
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

  test("combines filters and ignores malformed filter values", async () => {
    const combinedRecipes = await getRecipeList({
      name: "salad",
      tag: "vegetarian",
      ingredient: "tomato, feta",
    });
    const malformedRecipes = await getRecipeList({
      name: {
        toString() {
          throw new Error("Filter values must not be coerced.");
        },
      },
      tag: ["", "dinner", 42],
      ingredient: null,
    });

    expect(combinedRecipes).toHaveLength(1);
    expect(combinedRecipes[0].title).toBe("Greek Salad");
    expect(malformedRecipes.map((recipe) => recipe.title)).toEqual([
      "Classic Margherita Pizza",
      "Chicken Stir-Fry",
      "Beef Tacos",
      "Sushi Roll",
      "Pasta Carbonara",
      "Grilled Salmon with Asparagus",
      "Almond-Crusted Chicken",
    ]);
  });

  test("returns a full recipe detail DTO with matching nutrition", async () => {
    const recipe = await getRecipeDetail("1");

    expect(recipe).not.toBeNull();
    if (!recipe) {
      throw new Error("Expected a recipe detail DTO.");
    }

    expect(recipe.title).toBe("Classic Margherita Pizza");
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

  test("returns null for unknown recipe IDs", async () => {
    await expect(getRecipeDetail("not-real")).resolves.toBeNull();
  });
});
