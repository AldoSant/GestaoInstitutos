import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

test(
  "migrações criam o schema e as restrições críticas",
  { skip: !databaseUrl },
  async () => {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined,
    });
    const client = await pool.connect();

    try {
      const tabelas = await client.query<{ total: string }>(
        `select count(*)::text as total
           from information_schema.tables
          where table_schema = 'public'
            and table_type = 'BASE TABLE'`,
      );
      assert.equal(Number(tabelas.rows[0].total), 24);

      const restricoes = await client.query<{ conname: string }>(
        `select conname
           from pg_constraint
          where conname in (
            'ck_empresa_cnpj_formato',
            'ck_pessoa_documento_exclusivo',
            'ck_folha_item_total_liquido',
            'ck_obrigacao_total',
            'ck_importacao_totais',
            'ck_meta_valor_previsto',
            'ck_vinculo_carga_horaria',
            'ck_evento_natureza',
            'ck_evento_informativo_sem_incidencia',
            'ck_evento_recorrente_vigencia',
            'ck_pessoa_conta_tipo',
            'ck_dependente_cpf'
          )`,
      );
      assert.equal(restricoes.rowCount, 12);

      await client.query("begin");
      const empresaId = randomUUID();
      await client.query(
        `insert into empresa (id, cnpj, razao_social)
         values ($1, '12345678000199', 'Empresa sintética de teste')`,
        [empresaId],
      );

      await client.query("savepoint evento_informativo_invalido");
      await assert.rejects(
        client.query(
          `insert into evento
             (empresa_id, codigo, descricao, natureza, incide_inss)
           values ($1, 'INFO-INVALIDO', 'Informativo com incidência', 'INFORMATIVO', true)`,
          [empresaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_evento_informativo_sem_incidencia",
      );
      await client.query("rollback to savepoint evento_informativo_invalido");

      await client.query("savepoint documento_invalido");
      await assert.rejects(
        client.query(
          `insert into pessoa
             (empresa_id, tipo, nome_razao_social, cpf, cnpj)
           values ($1, 'FISICA', 'Pessoa inválida', '12345678901', '12345678000199')`,
          [empresaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_pessoa_documento_exclusivo",
      );
      await client.query("rollback to savepoint documento_invalido");

      await client.query("savepoint valor_invalido");
      await assert.rejects(
        client.query(
          `insert into atividade (empresa_id, codigo, descricao, valor)
           values ($1, 'TESTE', 'Atividade inválida', -0.01)`,
          [empresaId],
        ),
        (error: unknown) =>
          error instanceof Error &&
          "constraint" in error &&
          error.constraint === "ck_atividade_valor",
      );
      await client.query("rollback to savepoint valor_invalido");
      await client.query("rollback");
    } finally {
      client.release();
      await pool.end();
    }
  },
);
