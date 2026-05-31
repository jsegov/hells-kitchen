import { render, screen } from "@testing-library/react";
import RecipeFilters from "../app/recipes/RecipeFilters";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

// jsdom does not implement matchMedia; the island reads it in an effect.
beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
});

const facets = {
  tags: [{ value: "italian", label: "Italian", count: 2 }],
  ingredients: [{ value: "tomato", label: "Diced Tomatoes", count: 2 }],
  diets: [{ value: "vegetarian", label: "Vegetarian", count: 5 }],
  allergens: [{ value: "dairy", label: "Dairy-free", count: 1 }],
};

test("renders the search box, single sort dropdown, and facet chips", () => {
  render(
    <RecipeFilters
      filters={{
        name: ["pizza"],
        tag: [],
        ingredient: ["tomato"],
        diet: ["vegetarian"],
        exclude: ["dairy"],
      }}
      sort={{ sort: "title", order: "asc" }}
      facets={facets}
      resultCount={3}
    />,
  );

  const form = screen.getByRole("search").closest("form");

  expect(
    screen.getByRole("heading", { name: "Find recipes" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Search")).toHaveValue("pizza");

  // Sort key + direction are now one dropdown carrying a combined token.
  expect(screen.getByLabelText("Sort")).toHaveValue("title-asc");

  expect(screen.getByRole("checkbox", { name: /Vegetarian/ })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /Dairy-free/ })).toBeChecked();
  expect(
    screen.getByRole("checkbox", { name: /Diced Tomatoes/ }),
  ).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /Italian/ })).not.toBeChecked();

  // Submit button (the no-JS apply) reflects the current result count.
  expect(
    screen.getByRole("button", { name: "Show 3 recipes" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute(
    "href",
    "/recipes",
  );

  // The GET form remains the no-JS baseline.
  expect(form).not.toBeNull();
  expect(form?.getAttribute("action")).toBe("/recipes");
});

test("hides the clear link when no filters are active", () => {
  render(
    <RecipeFilters
      filters={{ name: [], tag: [], ingredient: [], diet: [], exclude: [] }}
      sort={{ sort: "curated", order: "asc" }}
      facets={facets}
      resultCount={15}
    />,
  );

  expect(
    screen.queryByRole("link", { name: "Clear all" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Sort")).toHaveValue("curated-asc");
});
