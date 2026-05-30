import { render, screen } from "@testing-library/react";
import RecipesLoading from "../app/recipes/loading";
import RecipeDetailLoading from "../app/recipes/[id]/loading";

test("recipe list loading exposes an accessible loading status", () => {
  render(<RecipesLoading />);

  expect(screen.getByRole("status")).toHaveTextContent("Loading recipes");
});

test("recipe detail loading exposes an accessible loading status", () => {
  render(<RecipeDetailLoading />);

  expect(screen.getByRole("status")).toHaveTextContent("Loading recipe");
});
