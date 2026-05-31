/** @type {import("@neondatabase/serverless").NeonQueryFunction<false, false> | null} */
let cachedSql = null;

const NEON_READ_RETRY_COUNT = 2;
const NEON_READ_RETRY_BASE_DELAY_MS = 75;
const NEON_READ_RETRY_JITTER_MS = 50;

const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const RETRYABLE_ERROR_NAMES = new Set([
  "AbortError",
  "FetchError",
  "NetworkError",
  "TimeoutError",
]);

const RETRYABLE_MESSAGE_PATTERNS = [
  /\bfetch failed\b/i,
  /\bnetwork\b/i,
  /\bconnection (?:closed|refused|reset|terminated|timed out)\b/i,
  /\bsocket\b/i,
  /\btimeout\b/i,
  /\btemporarily unavailable\b/i,
];

/**
 * @param {unknown} error
 * @param {number} [depth]
 * @returns {boolean}
 */
function isRetryableNeonReadError(error, depth = 0) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const typedError =
    /** @type {{ code?: unknown, name?: unknown, message?: unknown, cause?: unknown }} */ (
      error
    );

  if (
    typeof typedError.code === "string" &&
    RETRYABLE_ERROR_CODES.has(typedError.code)
  ) {
    return true;
  }

  if (
    typeof typedError.name === "string" &&
    RETRYABLE_ERROR_NAMES.has(typedError.name)
  ) {
    return true;
  }

  if (typeof typedError.message === "string") {
    const { message } = typedError;

    if (RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
      return true;
    }
  }

  if (typedError.cause && depth < 3) {
    return isRetryableNeonReadError(typedError.cause, depth + 1);
  }

  return false;
}

/**
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
const delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/**
 * @param {number} attempt
 * @param {number} baseDelayMs
 * @param {number} jitterMs
 * @returns {number}
 */
const getRetryDelayMs = (attempt, baseDelayMs, jitterMs) =>
  baseDelayMs * 2 ** (attempt - 1) +
  (jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0);

export async function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to query Neon Postgres.");
  }

  if (!cachedSql) {
    const { neon } = await import("@neondatabase/serverless");
    cachedSql = neon(process.env.DATABASE_URL);
  }

  return cachedSql;
}

/**
 * @template Result
 * @param {() => Promise<Result>} read
 * @param {{ label?: string, retries?: number, baseDelayMs?: number, jitterMs?: number }} [options]
 * @returns {Promise<Result>}
 */
export async function withNeonReadRetry(read, options = {}) {
  const label = options.label ?? "Neon read";
  const retries = options.retries ?? NEON_READ_RETRY_COUNT;
  const baseDelayMs = options.baseDelayMs ?? NEON_READ_RETRY_BASE_DELAY_MS;
  const jitterMs = options.jitterMs ?? NEON_READ_RETRY_JITTER_MS;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (attempt >= retries || !isRetryableNeonReadError(error)) {
        throw error;
      }

      const retryAttempt = attempt + 1;
      console.warn(
        `${label} failed transiently; retrying read ${retryAttempt}/${retries}.`,
      );
      await delay(getRetryDelayMs(retryAttempt, baseDelayMs, jitterMs));
    }
  }
}
