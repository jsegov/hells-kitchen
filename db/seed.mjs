import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { neon } from "@neondatabase/serverless";

import { parseDurationMinutes, parseRecipeAmount } from "../lib/recipes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, "data.json");

const DIFFICULTY_RANKS = new Map([
  ["easy", 1],
  ["medium", 2],
  ["hard", 3],
]);

const toSafeString = (value) => (typeof value === "string" ? value : "");

const toSafeNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toStringArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

const getDifficultyRank = (value) =>
  DIFFICULTY_RANKS.get(toSafeString(value).trim().toLowerCase()) ?? null;

const getDateAdded = (value) => {
  const dateValue = toSafeString(value);

  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const readSeedData = async () => {
  const seedData = JSON.parse(await readFile(dataPath, "utf8"));

  return {
    ingredients: Array.isArray(seedData.ingredients)
      ? seedData.ingredients
      : [],
    recipes: Array.isArray(seedData.recipes) ? seedData.recipes : [],
  };
};

const createSeedQueries = (sql, seedData) => {
  const queries = [
    sql`TRUNCATE recipe_ingredients, recipes, ingredients RESTART IDENTITY CASCADE`,
  ];

  for (const ingredient of seedData.ingredients) {
    const nutrition =
      ingredient && typeof ingredient === "object" ? ingredient.nutrition : {};

    queries.push(sql`
      INSERT INTO ingredients (
        id,
        name,
        category,
        calories,
        protein,
        carbs,
        fat,
        dietary,
        allergens
      )
      VALUES (
        ${toSafeString(ingredient?.id)},
        ${toSafeString(ingredient?.name)},
        ${toSafeString(ingredient?.category)},
        ${toSafeNumber(nutrition?.calories)},
        ${toSafeNumber(nutrition?.protein)},
        ${toSafeNumber(nutrition?.carbs)},
        ${toSafeNumber(nutrition?.fat)},
        ${toStringArray(ingredient?.dietary)},
        ${toStringArray(ingredient?.commonAllergens)}
      )
    `);
  }

  seedData.recipes.forEach((recipe, recipeIndex) => {
    queries.push(sql`
      INSERT INTO recipes (
        id,
        sort_order,
        title,
        description,
        servings,
        prep_time,
        cook_time,
        prep_time_minutes,
        cook_time_minutes,
        difficulty,
        difficulty_rank,
        instructions,
        tags,
        date_added
      )
      VALUES (
        ${toSafeString(recipe?.id)},
        ${recipeIndex},
        ${toSafeString(recipe?.title)},
        ${toSafeString(recipe?.description)},
        ${toSafeNumber(recipe?.servings)},
        ${toSafeString(recipe?.prepTime)},
        ${toSafeString(recipe?.cookTime)},
        ${parseDurationMinutes(recipe?.prepTime)},
        ${parseDurationMinutes(recipe?.cookTime)},
        ${toSafeString(recipe?.difficulty)},
        ${getDifficultyRank(recipe?.difficulty)},
        ${toStringArray(recipe?.instructions)},
        ${toStringArray(recipe?.tags)},
        ${getDateAdded(recipe?.dateAdded)}
      )
    `);

    const recipeIngredients = Array.isArray(recipe?.ingredients)
      ? recipe.ingredients
      : [];

    recipeIngredients.forEach((recipeIngredient, ingredientIndex) => {
      queries.push(sql`
        INSERT INTO recipe_ingredients (
          recipe_id,
          position,
          ingredient_id,
          amount,
          amount_value,
          unit
        )
        VALUES (
          ${toSafeString(recipe?.id)},
          ${ingredientIndex},
          ${toSafeString(recipeIngredient?.ingredientId)},
          ${
            typeof recipeIngredient?.amount === "number"
              ? String(recipeIngredient.amount)
              : toSafeString(recipeIngredient?.amount)
          },
          ${parseRecipeAmount(recipeIngredient?.amount)},
          ${toSafeString(recipeIngredient?.unit)}
        )
      `);
    });
  });

  return queries;
};

const main = async () => {
  if (!process.env.DATABASE_URL_UNPOOLED) {
    throw new Error("DATABASE_URL_UNPOOLED is required to seed Neon Postgres.");
  }

  const sql = neon(process.env.DATABASE_URL_UNPOOLED);
  const seedData = await readSeedData();

  await sql.transaction(createSeedQueries(sql, seedData));

  const recipeIngredientCount = seedData.recipes.reduce(
    (count, recipe) =>
      count +
      (Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0),
    0,
  );

  console.log(
    `Seeded ${seedData.ingredients.length} ingredients, ${seedData.recipes.length} recipes, and ${recipeIngredientCount} recipe ingredients.`,
  );
};

await main();
