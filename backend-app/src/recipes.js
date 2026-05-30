const fs = require("fs").promises;
const path = require("path");

const DATA_PATH = path.join(__dirname, "../db/data.json");

/**
 * @typedef {object} RecipeIngredient
 * @property {string} ingredientId
 * @property {string} amount
 * @property {string} unit
 */

/**
 * @typedef {object} Recipe
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} servings
 * @property {string} prepTime
 * @property {string} cookTime
 * @property {unknown} difficulty
 * @property {RecipeIngredient[]=} ingredients
 * @property {string[]=} instructions
 * @property {string[]=} tags
 * @property {string=} dateAdded
 */

/**
 * @typedef {object} RecipeListItem
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} servings
 * @property {string} prepTime
 * @property {string} cookTime
 * @property {string} difficulty
 * @property {string[]} tags
 * @property {number} ingredientCount
 */

const getData = async () => {
  const data = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(data);
};

/**
 * @param {Recipe | null | undefined} recipe
 * @returns {RecipeListItem | null}
 */
const toRecipeListItem = (recipe) => {
  if (!recipe || typeof recipe !== "object") {
    return null;
  }

  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    difficulty: typeof recipe.difficulty === "string" ? recipe.difficulty : "",
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    ingredientCount: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.length
      : 0,
  };
};

/**
 * @param {unknown} data
 * @returns {RecipeListItem[]}
 */
const toRecipeListItems = (data) => {
  if (!data || typeof data !== "object") {
    return [];
  }

  const recipes = /** @type {{ recipes?: unknown }} */ (data).recipes;

  if (!Array.isArray(recipes)) {
    return [];
  }

  return recipes.reduce((items, recipe) => {
    const item = toRecipeListItem(
      /** @type {Recipe | null | undefined} */ (recipe),
    );

    if (item) {
      items.push(item);
    }

    return items;
  }, /** @type {RecipeListItem[]} */ ([]));
};

/**
 * @returns {Promise<RecipeListItem[]>}
 */
const getRecipeList = async () => {
  const data = await getData();
  return toRecipeListItems(data);
};

module.exports = {
  getData,
  getRecipeList,
  toRecipeListItem,
  toRecipeListItems,
};
