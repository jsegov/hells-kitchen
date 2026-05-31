import { NextResponse } from "next/server";
import { getRecipeList } from "../../../lib/recipes";
import { CACHE_HEADERS, NO_STORE_HEADERS } from "../../../lib/apiCache";

/**
 * @param {Request} request
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      name: searchParams.getAll("name"),
      tag: searchParams.getAll("tag"),
      ingredient: searchParams.getAll("ingredient"),
      diet: searchParams.getAll("diet"),
      exclude: searchParams.getAll("exclude"),
    };
    /**
     * @param {string} key
     */
    const getSingleParam = (key) => {
      const values = searchParams.getAll(key);
      return values.length === 1 ? values[0] : undefined;
    };
    const sort = {
      sort: getSingleParam("sort"),
      order: getSingleParam("order"),
    };

    return NextResponse.json(await getRecipeList(filters, sort), {
      headers: CACHE_HEADERS,
    });
  } catch (error) {
    console.error("Failed to fetch recipes", error);
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
