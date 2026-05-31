import { NextResponse } from "next/server";
import { getRecipeDetail } from "../../../../lib/recipes";
import { CACHE_HEADERS, NO_STORE_HEADERS } from "../../../../lib/apiCache";

/**
 * @param {Request} _request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const recipe = await getRecipeDetail(id);

    if (!recipe) {
      return NextResponse.json(
        { error: "Recipe not found" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(recipe, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Failed to fetch recipe", error);
    return NextResponse.json(
      { error: "Failed to fetch recipe" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
