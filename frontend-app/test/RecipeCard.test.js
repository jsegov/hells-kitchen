import { render, screen, within } from "@testing-library/react";
import RecipeCard from "../app/recipes/RecipeCard";

const recipe = {
  id: "1",
  title: "Classic Margherita Pizza",
  description: "Traditional Italian pizza with fresh basil",
  servings: 4,
  prepTime: "20 minutes",
  cookTime: "15 minutes",
  difficulty: "easy",
  ingredientCount: 5,
  tags: ["italian", "vegetarian", "dinner"],
};

test("renders the recipe list card basic information", () => {
  render(<RecipeCard recipe={recipe} />);

  const link = screen.getByRole("link", {
    name: /Classic Margherita Pizza/i,
  });

  expect(link).toHaveAttribute("href", "/recipes/1");
  expect(within(link).getByRole("heading", { level: 2 })).toHaveTextContent(
    "Classic Margherita Pizza",
  );
  expect(within(link).getByText(recipe.description)).toBeInTheDocument();
  expect(within(link).getByText("Easy")).toBeInTheDocument();
  expect(within(link).getByText("Prep")).toBeInTheDocument();
  expect(within(link).getByText("20 minutes")).toBeInTheDocument();
  expect(within(link).getByText("Cook")).toBeInTheDocument();
  expect(within(link).getByText("15 minutes")).toBeInTheDocument();
  expect(within(link).getByText("Serves")).toBeInTheDocument();
  expect(within(link).getByText("4")).toBeInTheDocument();
  expect(within(link).getByText("Ingredients")).toBeInTheDocument();
  expect(within(link).getByText("5")).toBeInTheDocument();
});

test("renders tags with an accessible label", () => {
  render(<RecipeCard recipe={recipe} />);

  const tags = screen.getByRole("list", {
    name: "Classic Margherita Pizza tags",
  });

  expect(within(tags).getByText("italian")).toBeInTheDocument();
  expect(within(tags).getByText("vegetarian")).toBeInTheDocument();
  expect(within(tags).getByText("dinner")).toBeInTheDocument();
});
