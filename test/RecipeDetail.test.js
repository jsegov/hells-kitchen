import { fireEvent, render, screen, within } from "@testing-library/react";
import RecipeDetail from "../app/recipes/[id]/RecipeDetail";

const recipe = {
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
  instructions: [
    "Prepare pizza dough with flour",
    "Spread tomato sauce",
    "Add fresh mozzarella",
  ],
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
    {
      ingredientId: "basil",
      name: "Basil",
      amount: "10",
      unit: "leaves",
      category: "",
      nutrition: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
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
    missingIngredientIds: ["basil"],
    unconvertedIngredientIds: [],
  },
};

test("renders recipe detail hero and navigation", () => {
  render(<RecipeDetail recipe={recipe} />);

  expect(screen.getByRole("link", { name: "Back to recipes" })).toHaveAttribute(
    "href",
    "/recipes",
  );
  expect(
    screen.getByRole("heading", { name: "Classic Margherita Pizza" }),
  ).toBeInTheDocument();
  expect(screen.getByText(recipe.description)).toBeInTheDocument();
  expect(screen.getByText("Easy")).toBeInTheDocument();
  expect(screen.getByText("20 minutes")).toBeInTheDocument();
  expect(screen.getByText("15 minutes")).toBeInTheDocument();
  // Yield is no longer duplicated in the header; the serving control is the
  // single source of truth and defaults to the recipe's base servings.
  expect(screen.getByLabelText("Target servings")).toHaveValue(4);
});

test("renders ingredients, instructions, tags, and nutrition", () => {
  render(<RecipeDetail recipe={recipe} />);

  const tags = screen.getByRole("list", {
    name: "Classic Margherita Pizza tags",
  });
  expect(within(tags).getByText("italian")).toBeInTheDocument();
  expect(within(tags).getByText("vegetarian")).toBeInTheDocument();
  expect(within(tags).getByText("dinner")).toBeInTheDocument();
  expect(
    within(
      screen.getByRole("list", {
        name: "Classic Margherita Pizza dietary suitability",
      }),
    ).getByText("Vegetarian"),
  ).toBeInTheDocument();
  expect(screen.getByText(/Dairy, Gluten, Wheat/)).toBeInTheDocument();
  expect(
    screen.getByText(/Always verify ingredients yourself/),
  ).toBeInTheDocument();

  const ingredients = screen
    .getByRole("heading", {
      name: "Ingredients",
    })
    .closest("section");
  expect(ingredients).not.toBeNull();
  if (!ingredients) {
    throw new Error("Expected ingredients section.");
  }
  expect(within(ingredients).getByText("2 cups")).toBeInTheDocument();
  expect(within(ingredients).getByText("Diced Tomatoes")).toBeInTheDocument();
  expect(within(ingredients).getByText("10 leaves")).toBeInTheDocument();
  expect(within(ingredients).getByText("Basil")).toBeInTheDocument();

  const instructions = screen.getByRole("heading", {
    name: "Instructions",
  }).parentElement;
  expect(instructions).not.toBeNull();
  if (!instructions) {
    throw new Error("Expected instructions section.");
  }
  expect(
    within(instructions).getByText("Prepare pizza dough with flour"),
  ).toBeInTheDocument();
  expect(
    within(instructions).getByText("Spread tomato sauce"),
  ).toBeInTheDocument();

  expect(
    screen.getByRole("heading", { name: "Nutrition" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Per serving" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Total" })).toBeInTheDocument();
  expect(screen.getByText("Nutrition excludes Basil.")).toBeInTheDocument();
});

test("surfaces unconverted nutrition ingredients", () => {
  render(
    <RecipeDetail
      recipe={{
        ...recipe,
        nutrition: {
          ...recipe.nutrition,
          missingIngredientIds: [],
          unconvertedIngredientIds: ["tomato"],
        },
      }}
    />,
  );

  expect(
    screen.getByText("Nutrition excludes unconverted amounts for Tomato."),
  ).toBeInTheDocument();
});

test("rescales ingredients and nutrition from one serving control", () => {
  render(<RecipeDetail recipe={recipe} />);

  fireEvent.change(screen.getByLabelText("Target servings"), {
    target: { value: "8" },
  });

  expect(screen.getByText("4 cups")).toBeInTheDocument();
  expect(screen.getByText("20 leaves")).toBeInTheDocument();

  const totalNutrition = screen.getByRole("region", { name: "Total" });
  expect(within(totalNutrition).getByText("100")).toBeInTheDocument();
  expect(within(totalNutrition).getByText("6g")).toBeInTheDocument();
});
