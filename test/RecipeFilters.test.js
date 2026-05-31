import { render, screen } from "@testing-library/react";
import RecipeFilters from "../app/recipes/RecipeFilters";

test("renders recipe filter fields and search action", () => {
  render(
    <RecipeFilters
      filters={{
        name: ["pizza"],
        tag: [],
        ingredient: ["tomato"],
        diet: ["vegetarian"],
        exclude: ["peanuts"],
      }}
      sort={{ sort: "title", order: "asc" }}
    />,
  );

  const form = screen.getByRole("search").closest("form");

  expect(
    screen.getByRole("heading", { name: "Find recipes" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Recipe name")).toHaveValue("pizza");
  expect(screen.getByLabelText("Tag")).toHaveValue("");
  expect(screen.getByLabelText("Ingredient")).toHaveValue("tomato");
  expect(screen.getByLabelText("Sort by")).toHaveValue("title");
  expect(screen.getByLabelText("Order")).toHaveValue("asc");
  expect(screen.getByLabelText("Vegetarian")).toBeChecked();
  expect(screen.getByLabelText("Peanuts")).toBeChecked();
  expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute(
    "href",
    "/recipes",
  );
  expect(form).not.toBeNull();
  expect(form?.getAttribute("action")).toBe("/recipes");
});

test("hides clear link when no filters are active", () => {
  render(
    <RecipeFilters
      filters={{ name: [], tag: [], ingredient: [], diet: [], exclude: [] }}
      sort={{ sort: "title", order: "desc" }}
    />,
  );

  expect(screen.queryByRole("link", { name: "Clear" })).not.toBeInTheDocument();
});
