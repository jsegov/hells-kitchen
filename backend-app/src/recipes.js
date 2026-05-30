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
 * @property {string} difficulty
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
 * @param {Recipe} recipe
 * @returns {RecipeListItem}
 */
const toRecipeListItem = (recipe) => ({
  id: recipe.id,
  title: recipe.title,
  description: recipe.description,
  servings: recipe.servings,
  prepTime: recipe.prepTime,
  cookTime: recipe.cookTime,
  difficulty: recipe.difficulty,
  tags: Array.isArray(recipe.tags) ? recipe.tags : [],
  ingredientCount: Array.isArray(recipe.ingredients)
    ? recipe.ingredients.length
    : 0,
});

/**
 * @returns {Promise<RecipeListItem[]>}
 */
const getRecipeList = async () => {
  const data = await getData();
  return data.recipes.map(toRecipeListItem);
};

module.exports = {
  getData,
  getRecipeList,
  toRecipeListItem,
};
