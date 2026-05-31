import { fireEvent, render, screen } from "@testing-library/react";
import RecipesError from "../app/recipes/error";

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("renders the error message and a link back to recipes", () => {
  render(<RecipesError error={new Error("boom")} reset={() => {}} />);

  expect(
    screen.getByRole("heading", { name: "Something went wrong" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to recipes" })).toHaveAttribute(
    "href",
    "/recipes",
  );
});

test("invokes the reset prop when Try again is clicked", () => {
  const reset = jest.fn();
  render(<RecipesError error={new Error("boom")} reset={reset} />);

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(reset).toHaveBeenCalledTimes(1);
});
