import pg from "pg";
import { somenteDigitos } from "../../lib/importacao-giw";

const { Pool } = pg;

function valor(argv: string[], nome: string) {
  const index = argv.indexOf(nome);
  return index >= 0 ? argv[index + 1] ?? "" : "";
}

async function executar() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL é obrigatória.");

  const argv = process.argv.slice(2);
  const cnpj = somenteDigitos(valor(argv, "--cnpj") || process.env.EMPRESA_CNPJ);
  const razaoSocial = (
    valor(argv, "--razao-social") ||
    process.env.EMPRESA_RAZAO_SOCIAL ||
    ""
  ).trim();
  const nomeFantasia = (
    valor(argv, "--nome-fantasia") ||
    process.env.EMPRESA_NOME_FANTASIA ||
    ""
  ).trim();

  if (!cnpj || cnpj.length !== 14) throw new Error("Informe um CNPJ com 14 dígitos.");
  if (!razaoSocial) throw new Error("Informe --razao-social.");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    const result = await pool.query<{ id: string }>(
      `insert into empresa (cnpj, razao_social, nome_fantasia, ativo)
       values ($1, $2, $3, true)
       on conflict (cnpj)
       do update set razao_social = excluded.razao_social,
                     nome_fantasia = excluded.nome_fantasia,
                     ativo = true,
                     atualizado_em = now()
       returning id`,
      [cnpj, razaoSocial, nomeFantasia || null],
    );
    console.log(`Empresa pronta. ID: ${result.rows[0].id}`);
  } finally {
    await pool.end();
  }
}

executar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
