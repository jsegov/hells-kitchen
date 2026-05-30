const {
  DEFAULT_ALLOWED_ORIGINS,
  createCorsOptions,
  getAllowedCorsOrigins,
  isCorsOriginAllowed,
} = require("../src/cors");

/**
 * @param {string | undefined} origin
 * @param {string | undefined} corsOrigin
 * @returns {Promise<boolean | string | RegExp | Array<boolean | string | RegExp> | undefined>}
 */
const resolveCorsOrigin = (origin, corsOrigin) => {
  const { origin: originHandler } = createCorsOptions(corsOrigin);

  if (typeof originHandler !== "function") {
    throw new Error("Expected CORS origin handler.");
  }

  return new Promise((resolve, reject) => {
    originHandler(origin, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
};

test("getAllowedCorsOrigins uses the local frontend defaults", () => {
  expect(getAllowedCorsOrigins(undefined)).toEqual(DEFAULT_ALLOWED_ORIGINS);
});

test("getAllowedCorsOrigins parses the CORS_ORIGIN allowlist", () => {
  expect(
    getAllowedCorsOrigins("https://recipes.example, https://preview.example "),
  ).toEqual(["https://recipes.example", "https://preview.example"]);
  expect(getAllowedCorsOrigins("")).toEqual([]);
});

test("isCorsOriginAllowed only allows configured origins", () => {
  expect(
    isCorsOriginAllowed("https://recipes.example", ["https://recipes.example"]),
  ).toBe(true);
  expect(
    isCorsOriginAllowed("https://other.example", ["https://recipes.example"]),
  ).toBe(false);
});

test("createCorsOptions allows originless and disallowed requests without CORS headers", async () => {
  await expect(resolveCorsOrigin(undefined, undefined)).resolves.toBe(false);
  await expect(
    resolveCorsOrigin("https://other.example", "https://recipes.example"),
  ).resolves.toBe(false);
});

test("createCorsOptions enables CORS headers for allowed origins", async () => {
  await expect(
    resolveCorsOrigin("http://localhost:3000", undefined),
  ).resolves.toBe(true);
  await expect(
    resolveCorsOrigin("https://recipes.example", "https://recipes.example"),
  ).resolves.toBe(true);
});
