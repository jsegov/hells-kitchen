/**
 * @jest-environment node
 *
 * These are pure, non-DOM helpers, and the AI SDK's stream utilities
 * (`ai/test`) require the Node Web Streams globals (`TransformStream`) that the
 * default jsdom environment does not provide.
 */
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import {
  OVERVIEW_JSON_SCHEMA,
  OVERVIEW_SYSTEM_PROMPT,
  buildOverviewMessages,
  createOverviewJsonSchema,
  createOverviewService,
  validateOverviewOutput,
} from "../lib/aiOverview";
import { toOverviewCatalogRow } from "../lib/recipes";

/**
 * Builds a recipe + ingredient map with a single fully-convertible (gram-based)
 * ingredient so per-serving nutrition is deterministic and assertable without a
 * database. 200 g of {25,1.5,5,0.2}/100g → total {50,3,10,0.4}; /2 servings →
 * perServing {25,1.5,5,0.2}.
 */
const buildConvertibleRecipe = () => {
  const recipe = {
    id: "r1",
    title: "Tomato Bowl",
    description: "A simple bowl",
    servings: 2,
    prepTime: "20 minutes",
    cookTime: "1 hour",
    difficulty: "easy",
    tags: ["italian", "vegetarian", "dinner"],
    dateAdded: "2024-01-15T10:30:00Z",
    instructions: ["Mix"],
    ingredients: [{ ingredientId: "tomato", amount: "200", unit: "g" }],
  };

  const ingredientMap = new Map([
    [
      "tomato",
      {
        id: "tomato",
        name: "Diced Tomatoes",
        category: "vegetable",
        nutrition: { calories: 25, protein: 1.5, carbs: 5, fat: 0.2 },
        nutritionBasis: "per_100g",
        unitWeights: {},
        dietary: ["vegan", "gluten-free"],
        commonAllergens: [],
      },
    ],
  ]);

  return { recipe, ingredientMap };
};

/** @type {import("../lib/recipes").OverviewCatalogRow[]} */
const sampleCatalog = [
  {
    id: "r1",
    title: "Tomato Bowl",
    tags: ["italian", "vegetarian", "dinner"],
    difficulty: "easy",
    prepMinutes: 20,
    cookMinutes: 60,
    servings: 2,
    dietary: ["vegetarian", "gluten-free"],
    allergens: [],
    nutritionComplete: true,
    perServing: { calories: 25, protein: 1.5, carbs: 5, fat: 0.2 },
  },
  {
    id: "r2",
    title: "Steak Plate",
    tags: ["american", "dinner", "high-protein"],
    difficulty: "medium",
    prepMinutes: 10,
    cookMinutes: 25,
    servings: 1,
    dietary: ["high-protein"],
    allergens: ["soy"],
    nutritionComplete: true,
    perServing: { calories: 600, protein: 45, carbs: 2, fat: 30 },
  },
];

test("toOverviewCatalogRow projects compact, nutrition-aware fields", () => {
  const { recipe, ingredientMap } = buildConvertibleRecipe();

  expect(toOverviewCatalogRow(recipe, ingredientMap)).toEqual({
    id: "r1",
    title: "Tomato Bowl",
    tags: ["italian", "vegetarian", "dinner"],
    difficulty: "easy",
    prepMinutes: 20,
    cookMinutes: 60,
    servings: 2,
    // Derived from the single vegan + gluten-free ingredient, ordered by the
    // canonical DIETARY_OPTIONS sequence (vegan implies vegetarian).
    dietary: ["vegetarian", "vegan", "gluten-free"],
    allergens: [],
    nutritionComplete: true,
    perServing: { calories: 25, protein: 1.5, carbs: 5, fat: 0.2 },
  });
});

test("toOverviewCatalogRow normalizes tags and flags incomplete nutrition", () => {
  const { recipe, ingredientMap } = buildConvertibleRecipe();
  recipe.tags = [" Dinner ", "", "DINNER", "Quick Meals"];
  recipe.ingredients = [
    { ingredientId: "mystery_item", amount: "1", unit: "cup" },
  ];

  const row = toOverviewCatalogRow(recipe, ingredientMap);

  expect(row?.tags).toEqual(["dinner", "quick meals"]);
  expect(row?.nutritionComplete).toBe(false);
});

test("toOverviewCatalogRow rejects records without a usable id/title", () => {
  expect(toOverviewCatalogRow(null)).toBeNull();
  expect(toOverviewCatalogRow(undefined)).toBeNull();
  // A complete recipe shape but with an unusable identity is exactly what the
  // boundary must reject (mirrors the toRecipeListItem identity guard).
  expect(
    toOverviewCatalogRow({
      id: "",
      title: "No id",
      description: "",
      servings: 1,
      prepTime: "5 minutes",
      cookTime: "0 minutes",
      difficulty: "easy",
    }),
  ).toBeNull();
  expect(
    toOverviewCatalogRow({
      id: "x",
      title: "   ",
      description: "",
      servings: 1,
      prepTime: "5 minutes",
      cookTime: "0 minutes",
      difficulty: "easy",
    }),
  ).toBeNull();
});

test("validateOverviewOutput drops hallucinated and non-existent ids", () => {
  const result = validateOverviewOutput(
    {
      overview: "Two solid dinners.",
      recommendedRecipeIds: ["r2", " does-not-exist ", " r1 ", 999],
      intent: "discovery",
    },
    sampleCatalog,
  );

  // Unknown ids are filtered after normalization; model order is preserved.
  expect(result.recommendedRecipeIds).toEqual(["r2", "r1"]);
});

test("validateOverviewOutput coerces safe numeric ids to catalog string ids", () => {
  const numericCatalog = [
    ...sampleCatalog,
    { ...sampleCatalog[0], id: "2", title: "Numeric Id Bowl" },
  ];

  const result = validateOverviewOutput(
    {
      overview: "Numeric ids can still refer to catalog recipes.",
      recommendedRecipeIds: [2, " r1 "],
      intent: "discovery",
    },
    numericCatalog,
  );

  expect(result.recommendedRecipeIds).toEqual(["2", "r1"]);
});

test("validateOverviewOutput dedupes ids while preserving first-seen order", () => {
  const result = validateOverviewOutput(
    {
      overview: "x",
      recommendedRecipeIds: ["r1", "r2", "r1", "r2"],
      intent: "discovery",
    },
    sampleCatalog,
  );

  expect(result.recommendedRecipeIds).toEqual(["r1", "r2"]);
});

test("validateOverviewOutput handles an empty recommendation set as a first-class state", () => {
  const result = validateOverviewOutput(
    {
      overview: "Nothing in the catalog fits that.",
      recommendedRecipeIds: [],
      intent: "discovery",
    },
    sampleCatalog,
  );

  expect(result.recommendedRecipeIds).toEqual([]);
  expect(result.overview).toBe("Nothing in the catalog fits that.");
});

test("validateOverviewOutput defaults an unknown intent to discovery and keeps known ones", () => {
  expect(
    validateOverviewOutput(
      { overview: "x", recommendedRecipeIds: [], intent: "nonsense" },
      sampleCatalog,
    ).intent,
  ).toBe("discovery");

  expect(
    validateOverviewOutput(
      { overview: "x", recommendedRecipeIds: [], intent: "off_topic" },
      sampleCatalog,
    ).intent,
  ).toBe("off_topic");

  // Missing/malformed object → safe defaults, never throws.
  expect(validateOverviewOutput(null, sampleCatalog)).toEqual({
    overview: "",
    recommendedRecipeIds: [],
    intent: "discovery",
    suggestedFilters: { diet: [], tag: [] },
  });
});

test("validateOverviewOutput trims and caps overview length", () => {
  const long = "a".repeat(1000);
  const result = validateOverviewOutput(
    { overview: `  ${long}  `, recommendedRecipeIds: [], intent: "discovery" },
    sampleCatalog,
  );

  expect(result.overview).toHaveLength(600);
});

test("validateOverviewOutput intersects suggestedFilters against the canonical vocab", () => {
  const result = validateOverviewOutput(
    {
      overview: "x",
      recommendedRecipeIds: [],
      intent: "discovery",
      suggestedFilters: {
        diet: ["vegetarian", "made-up-diet", "vegetarian"],
        tag: ["dinner", "not-a-real-tag", "dinner"],
      },
    },
    sampleCatalog,
  );

  // Only canonical diet values and catalog-present tags survive, deduped.
  expect(result.suggestedFilters).toEqual({
    diet: ["vegetarian"],
    tag: ["dinner"],
  });
});

test("buildOverviewMessages embeds the catalog and the raw query as separate content parts", () => {
  const messages = buildOverviewMessages(sampleCatalog, "a quick dinner");

  // A single user message; the static guardrails travel via the system option.
  expect(messages).toHaveLength(1);

  const [user] = messages;
  expect(user.role).toBe("user");
  expect(Array.isArray(user.content)).toBe(true);

  const contentParts = /** @type {{ type: string, text: string }[]} */ (
    user.content
  );
  expect(contentParts).toHaveLength(2);

  const catalogPart =
    /** @type {{ type: string, text: string, providerOptions?: unknown }} */ (
      contentParts[0]
    );
  expect(catalogPart.type).toBe("text");
  expect(catalogPart.text).toContain('id="r1"');
  expect(catalogPart.text).toContain("title=Tomato Bowl");
  expect(catalogPart.text).toContain('id="r2"');
  expect(catalogPart.text).toContain("nutrition=complete");
  expect(catalogPart.text).toContain("perServing=600kcal P45 C2 F30");
  expect(catalogPart.providerOptions).toBeUndefined();

  // The raw query follows as a separate part so the catalog block stays stable.
  const queryPart = /** @type {{ text: string, providerOptions?: unknown }} */ (
    contentParts[1]
  );
  expect(queryPart.text).toContain("a quick dinner");
  expect(queryPart.providerOptions).toBeUndefined();

  // Guardrails are firm and code-computes-model-narrates.
  expect(OVERVIEW_SYSTEM_PROMPT).toContain("ONLY from the provided catalog");
  expect(OVERVIEW_SYSTEM_PROMPT).toContain("1-4 recommendedRecipeIds");
  expect(OVERVIEW_SYSTEM_PROMPT).toContain("Never calculate");
  expect(OVERVIEW_SYSTEM_PROMPT).toContain("nutrition=incomplete");
});

test("OVERVIEW_JSON_SCHEMA omits bounds the provider could reject and enforces the intent enum", () => {
  expect(OVERVIEW_JSON_SCHEMA.required).toEqual([
    "overview",
    "recommendedRecipeIds",
    "intent",
    "suggestedFilters",
  ]);
  expect(OVERVIEW_JSON_SCHEMA.additionalProperties).toBe(false);

  const properties = /** @type {Record<string, Record<string, unknown>>} */ (
    OVERVIEW_JSON_SCHEMA.properties
  );
  expect(properties.intent.enum).toEqual([
    "discovery",
    "off_topic",
    "how_to",
    "analytics",
  ]);
  expect(properties.suggestedFilters.required).toEqual(["diet", "tag"]);

  const catalogSchema = createOverviewJsonSchema(["r2", "r1", "r2"]);
  const catalogProperties =
    /** @type {Record<string, { items?: { enum?: string[] } }>} */ (
      catalogSchema.properties
    );
  expect(catalogProperties.recommendedRecipeIds.items?.enum).toEqual([
    "r2",
    "r1",
  ]);

  // No numeric/length/minItems constraints that a forwarding provider may 400 on.
  const serialized = JSON.stringify(OVERVIEW_JSON_SCHEMA);
  expect(serialized).not.toContain("minItems");
  expect(serialized).not.toContain("maxLength");
  expect(serialized).not.toContain("minLength");
});

test("createOverviewService loads the injected catalog and prompts with it", async () => {
  const loadCatalog = jest.fn(async () => sampleCatalog);
  /** @type {import("@ai-sdk/provider").LanguageModelV3StreamPart[]} */
  const chunks = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "0" },
    {
      type: "text-delta",
      id: "0",
      delta:
        '{"overview":"A quick dinner.","recommendedRecipeIds":["r1"],"intent":"discovery","suggestedFilters":{"diet":[],"tag":[]}}',
    },
    { type: "text-end", id: "0" },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: 0,
          cacheWrite: 0,
        },
        outputTokens: { total: 20, text: 20, reasoning: 0 },
      },
    },
  ];
  const model = new MockLanguageModelV3({
    doStream: async () => ({ stream: simulateReadableStream({ chunks }) }),
  });

  const onStreamError = jest.fn();
  const abortController = new AbortController();
  const service = createOverviewService({ model, loadCatalog, onStreamError });
  const result = await service.streamOverview("a quick dinner", {
    abortSignal: abortController.signal,
  });

  // Drain the stream so the mock records the call.
  let text = "";
  for await (const delta of result.textStream) {
    text += delta;
  }

  expect(loadCatalog).toHaveBeenCalledTimes(1);
  expect(text).toContain("A quick dinner.");
  expect(model.doStreamCalls).toHaveLength(1);
  expect(model.doStreamCalls[0].maxOutputTokens).toBeUndefined();
  expect("timeout" in model.doStreamCalls[0]).toBe(false);
  expect(model.doStreamCalls[0].temperature).toBe(0);
  expect(
    JSON.parse(JSON.stringify(model.doStreamCalls[0].providerOptions)),
  ).toEqual({
    gateway: { tags: ["feature:recipe-overview"] },
    google: { thinkingConfig: { thinkingLevel: "minimal" } },
  });
  expect(model.doStreamCalls[0].abortSignal).toBeDefined();
  expect(model.doStreamCalls[0].abortSignal?.aborted).toBe(false);
  abortController.abort();
  expect(model.doStreamCalls[0].abortSignal?.aborted).toBe(true);

  // The catalog rows reach the model as a system content part.
  const { prompt } = model.doStreamCalls[0];
  const serializedPrompt = JSON.stringify(prompt);
  expect(serializedPrompt).toContain("Tomato Bowl");
  expect(serializedPrompt).toContain("a quick dinner");
});
