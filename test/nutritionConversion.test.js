import { getRecipeIngredientAmountInGrams } from "../lib/recipes";

const per100gIngredient = {
  id: "test",
  name: "Test Ingredient",
  category: "test",
  nutrition: {
    calories: 100,
    protein: 10,
    carbs: 20,
    fat: 5,
  },
  nutritionBasis: "per_100g",
  unitWeights: {
    cup: 120,
    tbsp: 15,
    leaf: 0.5,
  },
};

test("converts exact mass units to grams", () => {
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "200", unit: "g" },
      per100gIngredient,
    ),
  ).toEqual({ converted: true, grams: 200 });
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "1", unit: "kg" },
      per100gIngredient,
    ).grams,
  ).toBeCloseTo(1000);
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "1", unit: "lb" },
      per100gIngredient,
    ).grams,
  ).toBeCloseTo(453.59237);
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "2", unit: "oz" },
      per100gIngredient,
    ).grams,
  ).toBeCloseTo(56.699);
});

test("uses ingredient-specific weights for volume and count units", () => {
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "1/2", unit: "cups" },
      per100gIngredient,
    ),
  ).toEqual({ converted: true, grams: 60 });
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "2", unit: "tbsp" },
      per100gIngredient,
    ),
  ).toEqual({ converted: true, grams: 30 });
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "10", unit: "leaves" },
      per100gIngredient,
    ),
  ).toEqual({ converted: true, grams: 5 });
});

test("refuses to guess unconvertible amounts", () => {
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "1-2", unit: "cup" },
      per100gIngredient,
    ),
  ).toEqual({ converted: false, grams: null });
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "to taste", unit: "cup" },
      per100gIngredient,
    ),
  ).toEqual({ converted: false, grams: null });
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "1", unit: "pinch" },
      per100gIngredient,
    ),
  ).toEqual({ converted: false, grams: null });
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "1", unit: "cup" },
      {
        ...per100gIngredient,
        unitWeights: {},
      },
    ),
  ).toEqual({ converted: false, grams: null });
  expect(
    getRecipeIngredientAmountInGrams(
      { ingredientId: "test", amount: "1", unit: "cup" },
      {
        ...per100gIngredient,
        nutritionBasis: "per_serving",
      },
    ),
  ).toEqual({ converted: false, grams: null });
});
