import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;
const host = process.env.DATABASE_HOST;
const user = process.env.DATABASE_USER;
const password = process.env.DATABASE_PASSWORD;
const database = process.env.DATABASE_NAME;
const port = Number(process.env.DATABASE_PORT ?? "5432");

const dbCredentials = url
  ? { url }
  : host && user && password !== undefined && database
    ? { host, user, password, database, port }
    : undefined;

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials,
  strict: true,
  verbose: true,
});
