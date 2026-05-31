import { NextResponse } from "next/server";
import { getRecipeList } from "../../../lib/recipes";

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
    };

    return NextResponse.json(await getRecipeList(filters));
  } catch (error) {
    console.error("Failed to fetch recipes", error);
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 },
    );
  }
}
