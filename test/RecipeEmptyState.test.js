import { render, screen } from "@testing-library/react";
import RecipeEmptyState from "../app/recipes/RecipeEmptyState";

test("renders the default empty recipe state", () => {
  render(<RecipeEmptyState hasActiveFilters={false} />);

  expect(
    screen.getByRole("heading", { name: "No recipes found" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Add recipes to the mock database to see them here."),
  ).toBeInTheDocument();
});

test("renders the filtered empty recipe state", () => {
  render(<RecipeEmptyState hasActiveFilters={true} />);

  expect(
    screen.getByRole("heading", { name: "No matching recipes" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "Try a different name, tag, ingredient, diet, or allergen filter.",
    ),
  ).toBeInTheDocument();
});
