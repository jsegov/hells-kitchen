import { render, screen } from "@testing-library/react";
import RecipePageHeader from "../app/recipes/RecipePageHeader";

test("shows the recipe count when recipes load successfully", () => {
  render(<RecipePageHeader hasError={false} recipeCount={15} />);

  expect(screen.getByRole("heading", { name: "Recipes" })).toBeInTheDocument();
  expect(screen.getByText("15 recipes")).toBeInTheDocument();
});

test("hides the recipe count when recipes fail to load", () => {
  render(<RecipePageHeader hasError={true} recipeCount={0} />);

  expect(screen.getByRole("heading", { name: "Recipes" })).toBeInTheDocument();
  expect(screen.queryByText("0 recipes")).not.toBeInTheDocument();
});
