const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

/**
 * @param {string | undefined} corsOrigin
 * @returns {string[]}
 */
const getAllowedCorsOrigins = (corsOrigin = process.env.CORS_ORIGIN) => {
  if (typeof corsOrigin !== "string") {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return corsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

/**
 * @param {unknown} origin
 * @param {string[]=} allowedOrigins
 */
const isCorsOriginAllowed = (
  origin,
  allowedOrigins = getAllowedCorsOrigins(),
) =>
  typeof origin === "string" &&
  (allowedOrigins.includes("*") || allowedOrigins.includes(origin));

/**
 * @param {string | undefined} corsOrigin
 * @returns {import("cors").CorsOptions}
 */
const createCorsOptions = (corsOrigin = process.env.CORS_ORIGIN) => {
  const allowedOrigins = getAllowedCorsOrigins(corsOrigin);

  return {
    origin(origin, callback) {
      callback(null, isCorsOriginAllowed(origin, allowedOrigins));
    },
  };
};

module.exports = {
  DEFAULT_ALLOWED_ORIGINS,
  createCorsOptions,
  getAllowedCorsOrigins,
  isCorsOriginAllowed,
};
