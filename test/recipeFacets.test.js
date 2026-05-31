import { createRecipeRepository } from "../lib/recipes";
import recipeDatabase from "../db/data.json";

const { getRecipeFacets, getRecipeList } = createRecipeRepository(
  async () => recipeDatabase,
);

/**
 * Maps each facet group to the filter key {@link getRecipeList} accepts.
 *
 * @type {ReadonlyArray<readonly [("tags" | "ingredients" | "diets" | "allergens"), ("tag" | "ingredient" | "diet" | "exclude")]>}
 */
const GROUP_TO_FILTER_KEY = [
  ["tags", "tag"],
  ["ingredients", "ingredient"],
  ["diets", "diet"],
  ["allergens", "exclude"],
];

test("derives facet vocabularies from the catalog and static lists", async () => {
  const facets = await getRecipeFacets({});

  expect(facets.tags).toHaveLength(22);
  expect(facets.ingredients).toHaveLength(53);
  expect(facets.diets).toHaveLength(5);
  expect(facets.allergens).toHaveLength(11);

  // Ingredient options are keyed by id but labeled by name.
  expect(facets.ingredients.find((o) => o.value === "tomato")?.label).toBe(
    "Diced Tomatoes",
  );
});

test("counts are drill-down (results if you also pick the option)", async () => {
  const facets = await getRecipeFacets({});

  expect(facets.tags.find((o) => o.value === "vegetarian")?.count).toBe(5);
});

test("ingredient counts match by id, never colliding on name substrings", async () => {
  const facets = await getRecipeFacets({});
  const potato = facets.ingredients.find((o) => o.value === "potato");
  const sweetPotato = facets.ingredients.find(
    (o) => o.value === "sweet_potato",
  );

  // Both exist independently; a substring matcher would have conflated them.
  expect(potato?.count ?? 0).toBeGreaterThan(0);
  expect(sweetPotato?.count ?? 0).toBeGreaterThan(0);

  const potatoList = await getRecipeList({ ingredient: "potato" });
  const sweetPotatoList = await getRecipeList({ ingredient: "sweet_potato" });
  expect(
    potatoList.every(
      (recipe) => !sweetPotatoList.some((other) => other.id === recipe.id),
    ),
  ).toBe(true);
});

test("facet counts never drift from the list they preview", async () => {
  const facets = await getRecipeFacets({});

  for (const [group, filterKey] of GROUP_TO_FILTER_KEY) {
    for (const option of facets[group]) {
      const list = await getRecipeList({ [filterKey]: option.value });
      expect(option.count).toBe(list.length);
    }
  }
});

test("counts reflect already-applied filters from other groups", async () => {
  const all = await getRecipeFacets({});
  const veganOnly = await getRecipeFacets({ diet: "vegan" });

  const dairyAll = all.allergens.find((o) => o.value === "dairy")?.count ?? 0;
  const dairyVegan =
    veganOnly.allergens.find((o) => o.value === "dairy")?.count ?? 0;

  // Excluding dairy among vegan recipes can only narrow the all-recipes count.
  expect(dairyVegan).toBeLessThanOrEqual(dairyAll);
});
