import {
  deriveRecipeDietaryProfile,
  matchesDietaryProfileFilters,
} from "../lib/dietary";
import { ALLERGEN_OPTIONS, DIETARY_OPTIONS } from "../lib/recipeOptions";
import {
  createRecipeRepository,
  toIngredientMap,
  toRecipeDetail,
} from "../lib/recipes";
import recipeDatabase from "../db/data.json";

test("derives recipe diets by ingredient intersection with vegan implying vegetarian", () => {
  const ingredientMap = new Map([
    [
      "tofu",
      {
        dietary: ["vegan", "gluten-free"],
        commonAllergens: ["soy"],
      },
    ],
    [
      "rice",
      {
        dietary: ["vegan", "gluten-free"],
        commonAllergens: [],
      },
    ],
  ]);

  expect(
    deriveRecipeDietaryProfile(
      [
        { ingredientId: "tofu", amount: "1", unit: "block" },
        { ingredientId: "rice", amount: "1", unit: "cup" },
      ],
      ingredientMap,
    ),
  ).toEqual({
    dietary: ["vegetarian", "vegan", "gluten-free"],
    allergens: ["soy"],
    hasMissingIngredients: false,
  });
});

test("missing ingredients qualify for no diets and fail safe for allergen exclusion", () => {
  const profile = deriveRecipeDietaryProfile(
    [{ ingredientId: "unknown", amount: "1", unit: "cup" }],
    new Map(),
  );

  expect(profile).toEqual({
    dietary: [],
    allergens: [],
    hasMissingIngredients: true,
  });
  expect(
    matchesDietaryProfileFilters(profile, {
      diets: [],
      excludedAllergens: ["peanuts"],
    }),
  ).toBe(false);
});

test("recipe list filters diets and allergens by exact derived tokens", async () => {
  const { getRecipeList } = createRecipeRepository(async () => recipeDatabase);
  const vegetarianRecipes = await getRecipeList({ diet: "vegetarian" });
  const noDairyVegetarianRecipes = await getRecipeList({
    diet: "vegetarian",
    exclude: "dairy",
  });

  expect(vegetarianRecipes.map((recipe) => recipe.title)).toContain(
    "Classic Margherita Pizza",
  );
  expect(noDairyVegetarianRecipes.map((recipe) => recipe.title)).not.toContain(
    "Classic Margherita Pizza",
  );
});

test("detail DTOs expose derived dietary badges and allergens", () => {
  const recipe = toRecipeDetail(
    recipeDatabase.recipes[0],
    toIngredientMap(recipeDatabase),
  );

  expect(recipe?.dietary).toEqual(["vegetarian"]);
  expect(recipe?.allergens).toEqual(["dairy", "gluten", "wheat"]);
});

test("hardcoded dietary and allergen options cover the seed data", () => {
  const configuredDiets = new Set(
    DIETARY_OPTIONS.map((option) => option.value),
  );
  const configuredAllergens = new Set(
    ALLERGEN_OPTIONS.map((option) => option.value),
  );
  const dietsInData = new Set();
  const allergensInData = new Set();

  for (const ingredient of recipeDatabase.ingredients) {
    for (const diet of ingredient.dietary ?? []) {
      dietsInData.add(diet);
    }

    for (const allergen of ingredient.commonAllergens ?? []) {
      allergensInData.add(allergen);
    }
  }

  expect([...dietsInData].filter((diet) => !configuredDiets.has(diet))).toEqual(
    [],
  );
  expect(
    [...allergensInData].filter(
      (allergen) => !configuredAllergens.has(allergen),
    ),
  ).toEqual([]);
});
