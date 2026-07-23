import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

function connectionOptions() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
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

  return { host, user, password, database, port };
}

const pool = new pg.Pool(connectionOptions());

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Migrations aplicadas com sucesso.");
} finally {
  await pool.end();
}
