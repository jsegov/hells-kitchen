/** @type {import("@neondatabase/serverless").NeonQueryFunction<false, false> | null} */
let cachedSql = null;

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
