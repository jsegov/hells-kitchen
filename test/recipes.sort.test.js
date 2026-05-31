import {
  createRecipeRepository,
  normalizeRecipeListSort,
  parseDurationMinutes,
  toRecipeListItems,
} from "../lib/recipes";

const sortData = {
  ingredients: [
    {
      id: "rice",
      name: "Rice",
      category: "grain",
      dietary: ["vegan"],
      commonAllergens: [],
    },
  ],
  recipes: [
    {
      id: "b",
      title: "Beta",
      description: "Second",
      servings: 2,
      prepTime: "0 minutes",
      cookTime: "1 hour 15 minutes",
      difficulty: "hard",
      tags: [],
      dateAdded: "2024-01-02T00:00:00Z",
      ingredients: [{ ingredientId: "rice", amount: "1", unit: "cup" }],
    },
    {
      id: "a",
      title: "Alpha",
      description: "First",
      servings: 4,
      prepTime: "10 minutes",
      cookTime: "20 minutes",
      difficulty: "easy",
      tags: [],
      dateAdded: "2024-01-03T00:00:00Z",
      ingredients: [{ ingredientId: "rice", amount: "1", unit: "cup" }],
    },
    {
      id: "c",
      title: "Charlie",
      description: "Third",
      servings: 1,
      prepTime: "",
      cookTime: "5 minutes",
      difficulty: "medium",
      tags: [],
      dateAdded: "",
      ingredients: [{ ingredientId: "rice", amount: "1", unit: "cup" }],
    },
  ],
};

test("normalizes recipe sort options defensively", () => {
  expect(normalizeRecipeListSort({ sort: "title", order: "DESC" })).toEqual({
    sort: "title",
    order: "desc",
  });
  expect(normalizeRecipeListSort({ sort: ["title"], order: "asc" })).toEqual({
    sort: "curated",
    order: "asc",
  });
  expect(normalizeRecipeListSort({ sort: "servings", order: "bad" })).toEqual({
    sort: "servings",
    order: "asc",
  });
});

test("parses duration strings for in-memory sort parity", () => {
  expect(parseDurationMinutes("0 minutes")).toBe(0);
  expect(parseDurationMinutes("1 hour 15 minutes")).toBe(75);
  expect(parseDurationMinutes("90")).toBe(90);
  expect(parseDurationMinutes("")).toBeNull();
});

test("sorts recipes by whitelisted fields with nulls last", () => {
  expect(
    toRecipeListItems(sortData, {}, { sort: "title", order: "asc" }).map(
      (recipe) => recipe.title,
    ),
  ).toEqual(["Alpha", "Beta", "Charlie"]);
  expect(
    toRecipeListItems(sortData, {}, { sort: "prep-time", order: "asc" }).map(
      (recipe) => recipe.title,
    ),
  ).toEqual(["Beta", "Alpha", "Charlie"]);
  expect(
    toRecipeListItems(sortData, {}, { sort: "date-added", order: "desc" }).map(
      (recipe) => recipe.title,
    ),
  ).toEqual(["Alpha", "Beta", "Charlie"]);
});

test("sorts missing servings last for in-memory sort parity", () => {
  const data = {
    ...sortData,
    recipes: [
      {
        ...sortData.recipes[0],
        id: "missing",
        title: "Missing",
        servings: undefined,
      },
      {
        ...sortData.recipes[1],
        id: "invalid",
        title: "Invalid",
        servings: Number.NaN,
      },
      { ...sortData.recipes[2], id: "one", title: "One", servings: 1 },
      { ...sortData.recipes[0], id: "two", title: "Two", servings: 2 },
    ],
  };

  expect(
    toRecipeListItems(data, {}, { sort: "servings", order: "asc" }).map(
      (recipe) => recipe.title,
    ),
  ).toEqual(["One", "Two", "Missing", "Invalid"]);
});

test("repository accepts the shared filters plus sort contract", async () => {
  const { getRecipeList } = createRecipeRepository(async () => sortData);

  await expect(
    getRecipeList({ diet: "vegetarian" }, { sort: "servings", order: "desc" }),
  ).resolves.toEqual([
    expect.objectContaining({ title: "Alpha", servings: 4 }),
    expect.objectContaining({ title: "Beta", servings: 2 }),
    expect.objectContaining({ title: "Charlie", servings: 1 }),
  ]);
});
