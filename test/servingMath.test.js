import {
  formatScaledAmount,
  getServingMultiplier,
  parseScalableAmount,
  scaleIngredientAmount,
  scaleNutritionForServings,
} from "../lib/servingMath";

test("calculates a serving multiplier only for positive serving counts", () => {
  expect(getServingMultiplier(4, 8)).toBe(2);
  expect(getServingMultiplier(4, 2)).toBe(0.5);
  expect(getServingMultiplier(0, 2)).toBeNull();
  expect(getServingMultiplier(4, 0)).toBeNull();
});

test("scales nutrition from recipe totals for a target serving count", () => {
  expect(
    scaleNutritionForServings(
      { calories: 100, protein: 12, carbs: 20, fat: 4 },
      4,
      6,
    ),
  ).toEqual({
    total: { calories: 150, protein: 18, carbs: 30, fat: 6 },
    perServing: { calories: 25, protein: 3, carbs: 5, fat: 1 },
  });
});

test("formats scaled cooking amounts with common fractions", () => {
  expect(formatScaledAmount(0.5)).toBe("1/2");
  expect(formatScaledAmount(1.25)).toBe("1 1/4");
  expect(formatScaledAmount(2.33)).toBe("2 1/3");
  expect(formatScaledAmount(0.11)).toBe("0.11");
  expect(formatScaledAmount(0.005)).toBe("0.005");
});

test("scales parseable ingredient amounts and leaves ambiguous amounts unchanged", () => {
  expect(scaleIngredientAmount("2.5", 2)).toBe("5");
  expect(scaleIngredientAmount("1/2", 3)).toBe("1 1/2");
  expect(scaleIngredientAmount("1 1/2", 2)).toBe("1 1/2");
  expect(scaleIngredientAmount("to taste", 2)).toBe("to taste");
  expect(parseScalableAmount("1-2")).toEqual({ parsed: false, value: null });
});
