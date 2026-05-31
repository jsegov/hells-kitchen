CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  calories NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  dietary TEXT[] NOT NULL DEFAULT '{}',
  allergens TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  servings INTEGER NOT NULL DEFAULT 0,
  prep_time TEXT NOT NULL DEFAULT '',
  cook_time TEXT NOT NULL DEFAULT '',
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  difficulty TEXT NOT NULL DEFAULT '',
  difficulty_rank SMALLINT,
  instructions TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  date_added TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  ingredient_id TEXT NOT NULL DEFAULT '',
  amount TEXT NOT NULL DEFAULT '',
  amount_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (recipe_id, position)
);

CREATE INDEX IF NOT EXISTS idx_recipes_sort_order ON recipes (sort_order);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_recipes_title_trgm ON recipes USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ingredients_name_trgm ON ingredients USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ingredients_category_trgm ON ingredients USING GIN (category gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ingredients_dietary ON ingredients USING GIN (dietary);
CREATE INDEX IF NOT EXISTS idx_ri_recipe ON recipe_ingredients (recipe_id);
CREATE INDEX IF NOT EXISTS idx_ri_ingredient ON recipe_ingredients (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ri_ingredient_id_trgm ON recipe_ingredients USING GIN (ingredient_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ri_ingredient_id_fallback_trgm ON recipe_ingredients USING GIN ((replace(ingredient_id, '_', ' ')) gin_trgm_ops);
