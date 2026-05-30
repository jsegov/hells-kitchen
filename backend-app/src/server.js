const express = require("express");
const cors = require("cors");
const { getRecipeList } = require("./recipes");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get("/api/recipes", async (req, res) => {
  try {
    res.json(await getRecipeList());
  } catch {
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
