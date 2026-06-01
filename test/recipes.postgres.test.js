/** @jest-environment node */
import { describe, expect, test } from "@jest/globals";

import { getData, getRecipeDetail, getRecipeList } from "../lib/recipes";
import recipeDatabase from "../db/data.json";

const describeWithDb =
  process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

/** @param {string} tag */
const getSeedTitlesWithTag = (tag) =>
  recipeDatabase.recipes
    .filter((recipe) => recipe.tags?.includes(tag))
    .map((recipe) => recipe.title);

/** @param {...string} tags */
const getSeedTitlesWithAllTags = (...tags) =>
  recipeDatabase.recipes
    .filter((recipe) => tags.every((tag) => recipe.tags?.includes(tag)))
    .map((recipe) => recipe.title);

/** @param {string} ingredientId */
const getSeedTitlesWithIngredient = (ingredientId) =>
  recipeDatabase.recipes
    .filter((recipe) =>
      recipe.ingredients?.some(
        (ingredient) => ingredient.ingredientId === ingredientId,
      ),
    )
    .map((recipe) => recipe.title);

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
    expect(data.recipes).toHaveLength(recipeDatabase.recipes.length);
    expect(data.ingredients).toHaveLength(recipeDatabase.ingredients.length);
  });

  test("returns list DTOs in the same order as the JSON seed", async () => {
    const recipes = await getRecipeList();

    expect(recipes).toHaveLength(recipeDatabase.recipes.length);
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

  test("filters recipes by multiple name terms with AND semantics", async () => {
    const recipes = await getRecipeList({ name: "classic, pizza" });
    const emptyRecipes = await getRecipeList({ name: "classic, salad" });

    expect(recipes.map((recipe) => recipe.title)).toEqual([
      "Classic Margherita Pizza",
    ]);
    expect(emptyRecipes).toEqual([]);
  });

  test("filters recipes by tag", async () => {
    const recipes = await getRecipeList({ tag: "vegetarian" });

    expect(recipes).toHaveLength(getSeedTitlesWithTag("vegetarian").length);
    expect(recipes.every((recipe) => recipe.tags.includes("vegetarian"))).toBe(
      true,
    );
  });

  test("filters recipes by multiple tag terms with AND semantics", async () => {
    const recipes = await getRecipeList({ tag: "dinner, vegetarian" });
    const emptyRecipes = await getRecipeList({ tag: "dinner, breakfast" });

    expect(recipes.map((recipe) => recipe.title)).toEqual(
      getSeedTitlesWithAllTags("dinner", "vegetarian"),
    );
    expect(emptyRecipes).toEqual([]);
  });

  test("filters recipes by exact ingredient id", async () => {
    const tomatoRecipes = await getRecipeList({ ingredient: "tomato" });
    const soySauceIdRecipes = await getRecipeList({ ingredient: "soy_sauce" });
    const soySauceRecipes = await getRecipeList({ ingredient: "soy sauce" });
    const proteinRecipes = await getRecipeList({ ingredient: "protein" });

    expect(tomatoRecipes.map((recipe) => recipe.title)).toEqual(
      getSeedTitlesWithIngredient("tomato"),
    );
    expect(soySauceIdRecipes.map((recipe) => recipe.title)).toEqual(
      getSeedTitlesWithIngredient("soy_sauce"),
    );
    expect(soySauceRecipes).toEqual([]);
    expect(proteinRecipes).toEqual([]);
  });

  test("combines filters and ignores malformed filter values", async () => {
    const combinedRecipes = await getRecipeList({
      name: "salad",
      tag: "vegetarian",
      ingredient: "tomato, feta_cheese",
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
    expect(malformedRecipes.map((recipe) => recipe.title)).toEqual(
      getSeedTitlesWithTag("dinner"),
    );
  });

  test("returns an empty list for unsatisfied AND combinations", async () => {
    const recipes = await getRecipeList({
      name: "pizza",
      tag: "vegan",
      ingredient: "soy sauce",
    });

    expect(recipes).toEqual([]);
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
        calories: 120,
        protein: 7.2,
        carbs: 24,
        fat: 1,
      },
    });
    expect(recipe.nutrition).toEqual({
      total: {
        calories: 2132.4,
        protein: 89.5,
        carbs: 267,
        fat: 78.7,
      },
      perServing: {
        calories: 533.1,
        protein: 22.4,
        carbs: 66.8,
        fat: 19.7,
      },
      missingIngredientIds: [],
      unconvertedIngredientIds: [],
    });
  });

  test("returns null for unknown recipe IDs", async () => {
    await expect(getRecipeDetail("not-real")).resolves.toBeNull();
  });

  test("returns detail ingredients in seed order with no dropped refs", async () => {
    const recipe = await getRecipeDetail("1");

    expect(recipe).not.toBeNull();
    if (!recipe) {
      throw new Error("Expected a recipe detail DTO.");
    }

    expect(
      recipe.ingredients.map((ingredient) => ingredient.ingredientId),
    ).toEqual(["tomato", "mozzarella", "basil", "flour", "olive_oil"]);
    expect(recipe.nutrition.missingIngredientIds).toEqual([]);
    expect(recipe.nutrition.unconvertedIngredientIds).toEqual([]);
  });
});
