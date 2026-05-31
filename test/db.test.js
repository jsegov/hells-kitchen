import { afterEach, expect, jest, test } from "@jest/globals";

import { withNeonReadRetry } from "../lib/db";

afterEach(() => {
  jest.restoreAllMocks();
});

test("withNeonReadRetry retries transient read failures before returning", async () => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  const transientError = Object.assign(new Error("fetch failed"), {
    code: "UND_ERR_SOCKET",
  });
  let readCount = 0;
  const read = async () => {
    readCount += 1;

    if (readCount <= 2) {
      throw transientError;
    }

    return "recipes";
  };

  await expect(
    withNeonReadRetry(read, {
      label: "Test read",
      baseDelayMs: 0,
      jitterMs: 0,
    }),
  ).resolves.toBe("recipes");

  expect(readCount).toBe(3);
  expect(warnSpy).toHaveBeenNthCalledWith(
    1,
    "Test read failed transiently; retrying read 1/2.",
  );
  expect(warnSpy).toHaveBeenNthCalledWith(
    2,
    "Test read failed transiently; retrying read 2/2.",
  );
});

test("withNeonReadRetry does not retry non-transient read failures", async () => {
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  const syntaxError = Object.assign(
    new Error('syntax error at or near "FROM"'),
    {
      code: "42601",
    },
  );
  let readCount = 0;
  const read = async () => {
    readCount += 1;
    throw syntaxError;
  };

  await expect(
    withNeonReadRetry(read, {
      label: "Test read",
      baseDelayMs: 0,
      jitterMs: 0,
    }),
  ).rejects.toBe(syntaxError);

  expect(readCount).toBe(1);
  expect(warnSpy).not.toHaveBeenCalled();
});
