import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

function connectionOptions() {
  const ssl =
    process.env.DATABASE_SSL === "true"
      ? {
          rejectUnauthorized:
            process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
        }
      : undefined;

  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl };
  }

  const host = process.env.DATABASE_HOST;
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  const database = process.env.DATABASE_NAME;
  const port = Number(process.env.DATABASE_PORT ?? "5432");

  if (!host || !user || password === undefined || !database) {
    throw new Error(
      "Configure DATABASE_URL ou DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD e DATABASE_NAME.",
    );
  }

  return { host, user, password, database, port, ssl };
}

const pool = new pg.Pool({
  ...connectionOptions(),
  max: 1,
  application_name:
    process.env.DATABASE_APPLICATION_NAME ?? "gestao-institutos-migrator",
  connectionTimeoutMillis: Number(
    process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? "5000",
  ),
  statement_timeout: Number(
    process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? "60000",
  ),
});

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Migrations aplicadas com sucesso.");
} finally {
  await pool.end();
}
