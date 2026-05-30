const express = require("express");
const cors = require("cors");
const { createCorsOptions } = require("./cors");
const { getRecipeDetail, getRecipeList } = require("./recipes");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors(createCorsOptions()));
app.use(express.json());

app.get("/api/recipes", async (req, res) => {
  try {
    res.json(await getRecipeList(req.query));
  } catch (error) {
    console.error("Failed to fetch recipes", error);
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
});

app.get("/api/recipes/:id", async (req, res) => {
  try {
    const recipe = await getRecipeDetail(req.params.id);

    if (!recipe) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }

    res.json(recipe);
  } catch (error) {
    console.error("Failed to fetch recipe", error);
    res.status(500).json({ error: "Failed to fetch recipe" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
