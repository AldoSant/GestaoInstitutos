import assert from "node:assert/strict";
import test from "node:test";
import { getPool } from "../db";

test("reutiliza um único pool PostgreSQL com limites explícitos", async () => {
  process.env.DATABASE_URL =
    "postgresql://usuario:senha@127.0.0.1:5432/banco_inexistente";
  process.env.DATABASE_POOL_MAX = "7";
  process.env.DATABASE_STATEMENT_TIMEOUT_MS = "12345";
  process.env.DATABASE_QUERY_TIMEOUT_MS = "15000";
  process.env.DATABASE_APPLICATION_NAME = "teste-pool";

  const primeiro = getPool();
  const segundo = getPool();

  assert.equal(segundo, primeiro);
  assert.equal(primeiro.options.max, 7);
  assert.equal(primeiro.options.statement_timeout, 12_345);
  assert.equal(primeiro.options.query_timeout, 15_000);
  assert.equal(primeiro.options.application_name, "teste-pool");

  await primeiro.end();
});
