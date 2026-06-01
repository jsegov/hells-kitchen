import { render, screen } from "@testing-library/react";
import RecipesPage from "../app/recipes/page";
import { getRecipeFacets, getRecipes } from "../app/recipes/recipeData";

jest.mock("../app/recipes/RecipeOverview", () => ({
  __esModule: true,
  default: function MockRecipeOverview() {
    return <section aria-label="AI overview" />;
  },
}));

jest.mock("../app/recipes/RecipeFilters", () => ({
  __esModule: true,
  default: function MockRecipeFilters() {
    return <section aria-label="Recipe filters" />;
  },
}));

jest.mock("../app/recipes/recipeData", () => ({
  __esModule: true,
  formatDietaryLabel: (value = "") => value,
  formatDifficulty: (value = "") => value,
  formatTagLabel: (value = "") => value,
  getRecipeFacets: jest.fn(),
  getRecipes: jest.fn(),
  hasRecipeFilters: jest.fn(() => false),
  normalizeRecipeFilters: jest.fn(() => ({
    name: [],
    tag: [],
    ingredient: [],
    diet: [],
    exclude: [],
  })),
  normalizeRecipeSort: jest.fn(() => ({ sort: "curated", order: "asc" })),
}));

const recipeListItem = {
  id: "1",
  title: "Classic Margherita Pizza",
  description: "Traditional Italian pizza with fresh basil",
  servings: 4,
  prepTime: "20 minutes",
  cookTime: "15 minutes",
  difficulty: "easy",
  ingredientCount: 5,
  tags: ["italian"],
  dateAdded: "2024-01-15T10:30:00Z",
  dietary: ["vegetarian"],
  allergens: ["dairy"],
};

const emptyFacets = {
  tags: [],
  ingredients: [],
  diets: [],
  allergens: [],
};

test("surfaces facet loading errors while keeping loaded recipes visible", async () => {
  /** @type {jest.MockedFunction<typeof getRecipes>} */ (
    getRecipes
  ).mockResolvedValue({
    recipes: [recipeListItem],
    error: null,
  });
  /** @type {jest.MockedFunction<typeof getRecipeFacets>} */ (
    getRecipeFacets
  ).mockResolvedValue({
    facets: emptyFacets,
    error: "Unable to load recipe filters.",
  });

  render(await RecipesPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByText("1 recipe")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: recipeListItem.title }),
  ).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Recipe filters are unavailable",
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Unable to load recipe filters.",
  );
});

test("always mounts the AI overview entry point on the recipes page", async () => {
  /** @type {jest.MockedFunction<typeof getRecipes>} */ (
    getRecipes
  ).mockResolvedValue({
    recipes: [recipeListItem],
    error: null,
  });
  /** @type {jest.MockedFunction<typeof getRecipeFacets>} */ (
    getRecipeFacets
  ).mockResolvedValue({
    facets: emptyFacets,
    error: null,
  });

  render(await RecipesPage({ searchParams: Promise.resolve({}) }));

  expect(
    screen.queryByText("AI recommendations aren't configured."),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "AI overview" })).toBeVisible();
});
