import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

function criarPool() {
  const connectionString = process.env.DATABASE_URL;
  const host = process.env.DATABASE_HOST;
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  const database = process.env.DATABASE_NAME;
  const port = Number(process.env.DATABASE_PORT ?? "5432");

  if (!connectionString && (!host || !user || password === undefined || !database)) {
    throw new Error("Configure DATABASE_URL ou DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD e DATABASE_NAME.");
  }

  return new Pool({
    ...(connectionString
      ? { connectionString }
      : { host, user, password, database, port }),
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

export function getDb() {
  const pool = globalForDb.pgPool ?? criarPool();
  if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;
  return drizzle(pool, { schema });
}
