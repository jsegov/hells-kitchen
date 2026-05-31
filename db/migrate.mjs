import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "schema.sql");

if (!process.env.DATABASE_URL_UNPOOLED) {
  throw new Error(
    "DATABASE_URL_UNPOOLED is required to migrate Neon Postgres.",
  );
}

const parseSchemaStatements = (schemaSql) =>
  schemaSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

const migrateWithNeon = async () => {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED);
  const schemaSql = await readFile(schemaPath, "utf8");

  for (const statement of parseSchemaStatements(schemaSql)) {
    await sql.query(statement);
  }
};

const migrateWithPsql = () =>
  new Promise((resolve, reject) => {
    const psql = spawn(
      "psql",
      [
        process.env.DATABASE_URL_UNPOOLED,
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        schemaPath,
      ],
      { stdio: "inherit" },
    );

    psql.on("error", reject);
    psql.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`psql exited with status ${code ?? 1}.`));
    });
  });

const main = async () => {
  if (process.env.VERCEL === "1") {
    await migrateWithNeon();
    return;
  }

  try {
    await migrateWithPsql();
  } catch (error) {
    if (error && error.code === "ENOENT") {
      console.warn("psql was not found; applying schema with the Neon driver.");
      await migrateWithNeon();
      return;
    }

    throw error;
  }
};

await main();
