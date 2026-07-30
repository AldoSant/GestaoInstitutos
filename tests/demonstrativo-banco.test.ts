import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

test(
  "PostgreSQL fecha demonstrativo PF/PJ e protege classificação e imutabilidade",
  { skip: !databaseUrl },
  async () => {
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const empresaId = randomUUID();
      const pessoaId = randomUUID();
      const prestadorId = randomUUID();
      const demonstrativoId = randomUUID();
      const pagamentoId = randomUUID();
      const obrigacaoId = randomUUID();
      const cnpjEmpresa = String(randomInt(10 ** 13, 10 ** 14));
      const cnpjPessoa = String(randomInt(10 ** 13, 10 ** 14));

      await client.query(
        `insert into empresa (id, cnpj, razao_social) values ($1, $2, 'Teste demonstrativo')`,
        [empresaId, cnpjEmpresa],
      );
      await client.query(
        `insert into pessoa (id, empresa_id, tipo, nome_razao_social, cnpj)
         values ($1, $2, 'JURIDICA', 'Prestador PJ de teste', $3)`,
        [pessoaId, empresaId, cnpjPessoa],
      );
      await client.query(
        `insert into prestador (id, empresa_id, pessoa_id, matricula)
         values ($1, $2, $3, 'PJ-TESTE')`,
        [prestadorId, empresaId, pessoaId],
      );
      await client.query(
        `insert into demonstrativo_mensal (
           id, empresa_id, competencia, numero,
           total_bruto, total_retencoes, total_liquido
         ) values ($1, $2, '2026-06-01', 1, 1000, 100, 900)`,
        [demonstrativoId, empresaId],
      );
      await client.query(
        `insert into pagamento_prestador (
           id, empresa_id, demonstrativo_id, prestador_id, tipo_pessoa, origem,
           documento_referencia, beneficiario_snapshot,
           valor_bruto, total_retencoes, valor_liquido
         ) values (
           $1, $2, $3, $4, 'JURIDICA', 'NOTA_FISCAL_PJ',
           'NF TESTE', '{"nome":"Prestador PJ de teste"}', 1000, 100, 900
         )`,
        [pagamentoId, empresaId, demonstrativoId, prestadorId],
      );
      await client.query(
        `insert into pagamento_retencao (
           empresa_id, pagamento_id, tributo, base_calculo, aliquota, valor,
           origem, evidencia_referencia, snapshot
         ) values ($1, $2, 'ISS', 1000, 10, 100, 'DOCUMENTO_FISCAL', 'NF TESTE', '{}')`,
        [empresaId, pagamentoId],
      );
      await client.query(
        `insert into obrigacao_fiscal (
           id, empresa_id, competencia, tipo, principal, total
         ) values ($1, $2, '2026-06-01', 'ISS', 100, 100)`,
        [obrigacaoId, empresaId],
      );
      await client.query(
        `insert into demonstrativo_obrigacao (empresa_id, demonstrativo_id, obrigacao_id)
         values ($1, $2, $3)`,
        [empresaId, demonstrativoId, obrigacaoId],
      );
      await client.query("set constraints all immediate");

      await client.query("savepoint classificacao_invalida");
      await assert.rejects(
        client.query(
          `insert into classificacao_operacional_legado (
             empresa_id, entidade, legacy_id, natureza, status, decidido_em
           ) values ($1, 'prestador', '457', 'GUIA_RECOLHIMENTO', 'CONFIRMADA', now())`,
          [empresaId],
        ),
        /ck_classificacao_legado_decisao/,
      );
      await client.query("rollback to savepoint classificacao_invalida");

      await client.query(
        `update demonstrativo_mensal
            set status = 'FECHADO', fechado_em = now(), fechado_por = 'Teste automatizado',
                hash_resultado = repeat('a', 64)
          where id = $1`,
        [demonstrativoId],
      );
      await client.query("savepoint imutabilidade");
      await assert.rejects(
        client.query(`delete from pagamento_prestador where id = $1`, [pagamentoId]),
        /Demonstrativo fechado é imutável/,
      );
      await client.query("rollback to savepoint imutabilidade");
      await client.query("rollback");
    } finally {
      client.release();
      await pool.end();
    }
  },
);
