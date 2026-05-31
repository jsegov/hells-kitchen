/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";

import { GET as listGET } from "../app/api/recipes/route";
import { GET as detailGET } from "../app/api/recipes/[id]/route";

const describeWithDb =
  process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

describeWithDb("GET /api/recipes", () => {
  it("returns all recipes", async () => {
    const res = await listGET(new Request("http://localhost/api/recipes"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(15);
  });

  it("filters recipes by name", async () => {
    const res = await listGET(
      new Request("http://localhost/api/recipes?name=pizza"),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Classic Margherita Pizza");
  });

  it("filters recipes with combined name, tag, and ingredient terms", async () => {
    const res = await listGET(
      new Request(
        "http://localhost/api/recipes?name=salad&tag=vegetarian&ingredient=tomato&ingredient=feta",
      ),
    );
    const data = /** @type {{ title: string }[]} */ (await res.json());

    expect(res.status).toBe(200);
    expect(data.map((recipe) => recipe.title)).toEqual(["Greek Salad"]);
  });
});

describeWithDb("GET /api/recipes/[id]", () => {
  it("returns a recipe by id", async () => {
    const res = await detailGET(new Request("http://localhost/api/recipes/1"), {
      params: Promise.resolve({ id: "1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Classic Margherita Pizza");
  });

  it("returns 404 for an unknown recipe id", async () => {
    const res = await detailGET(
      new Request("http://localhost/api/recipes/not-real"),
      { params: Promise.resolve({ id: "not-real" }) },
    );

    expect(res.status).toBe(404);
  });
});
