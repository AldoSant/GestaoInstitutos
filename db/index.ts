import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
const globalForDb = globalThis as unknown as {
  pgPool?: InstanceType<typeof Pool>;
};

function inteiroPositivo(nome: string, padrao: number) {
  const configurado = process.env[nome];
  if (configurado === undefined || configurado.trim() === "") return padrao;

  const valor = Number(configurado);
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw new Error(`${nome} deve ser um inteiro positivo.`);
  }
  return valor;
}

function criarPool() {
  const connectionString = process.env.DATABASE_URL;
  const host = process.env.DATABASE_HOST;
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  const database = process.env.DATABASE_NAME;
  const port = inteiroPositivo("DATABASE_PORT", 5432);

  if (!connectionString && (!host || !user || password === undefined || !database)) {
    throw new Error("Configure DATABASE_URL ou DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD e DATABASE_NAME.");
  }

  return new Pool({
    ...(connectionString
      ? { connectionString }
      : { host, user, password, database, port }),
    max: inteiroPositivo("DATABASE_POOL_MAX", 10),
    connectionTimeoutMillis: inteiroPositivo(
      "DATABASE_CONNECTION_TIMEOUT_MS",
      5_000,
    ),
    idleTimeoutMillis: inteiroPositivo("DATABASE_IDLE_TIMEOUT_MS", 30_000),
    statement_timeout: inteiroPositivo(
      "DATABASE_STATEMENT_TIMEOUT_MS",
      30_000,
    ),
    query_timeout: inteiroPositivo("DATABASE_QUERY_TIMEOUT_MS", 35_000),
    idle_in_transaction_session_timeout: inteiroPositivo(
      "DATABASE_IDLE_TRANSACTION_TIMEOUT_MS",
      30_000,
    ),
    application_name:
      process.env.DATABASE_APPLICATION_NAME ?? "gestao-institutos-web",
    keepAlive: true,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : undefined,
  });
}

export function getPool() {
  const pool = globalForDb.pgPool ?? criarPool();
  if (!globalForDb.pgPool) {
    pool.on("error", (error) => {
      console.error("Conexão ociosa com o PostgreSQL falhou.", {
        name: error.name,
        message: error.message,
      });
    });
    globalForDb.pgPool = pool;
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
