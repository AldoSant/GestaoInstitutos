import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import {
  abrirNovaRevisaoDemonstrativo,
  carregarRelatorioDemonstrativo,
  fecharDemonstrativo,
  materializarDemonstrativoFolhas,
  registrarConferenciaDemonstrativo,
} from "../db/demonstrativos";

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

test(
  "materializa Folha PF fechada sem converter desconto comum em retenção",
  { skip: !databaseUrl },
  async () => {
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const empresaId = randomUUID();
      const pessoaId = randomUUID();
      const prestadorId = randomUUID();
      const termoId = randomUUID();
      const metaId = randomUUID();
      const vinculoId = randomUUID();
      const folhaId = randomUUID();
      const itemId = randomUUID();
      await client.query(
        `insert into empresa (id, cnpj, razao_social) values ($1, $2, 'Empresa materialização')`,
        [empresaId, String(randomInt(10 ** 13, 10 ** 14))],
      );
      await client.query(
        `insert into pessoa (
           id, empresa_id, tipo, nome_razao_social, cpf
         ) values ($1, $2, 'FISICA', 'Prestador PF de teste', $3)`,
        [pessoaId, empresaId, String(randomInt(10 ** 10, 10 ** 11))],
      );
      await client.query(
        `insert into prestador (
           id, empresa_id, pessoa_id, matricula
         ) values ($1, $2, $3, 'PF-TESTE')`,
        [prestadorId, empresaId, pessoaId],
      );
      await client.query(
        `insert into termo (
           id, empresa_id, numero, descricao, modalidade, inicio, valor_global
         ) values ($1, $2, 'T-TESTE', 'Termo de teste', 'TESTE', '2026-01-01', 1000)`,
        [termoId, empresaId],
      );
      await client.query(
        `insert into termo_meta (id, termo_id, codigo, descricao)
         values ($1, $2, 'M-TESTE', 'Meta de teste')`,
        [metaId, termoId],
      );
      await client.query(
        `insert into prestador_vinculo (
           id, empresa_id, prestador_id, termo_id, meta_id,
           atividade, inicio, valor_retribuicao
         ) values ($1, $2, $3, $4, $5, 'Serviço de teste', '2026-01-01', 1000)`,
        [vinculoId, empresaId, prestadorId, termoId, metaId],
      );
      await client.query(
        `insert into folha (
           id, empresa_id, termo_id, meta_id, competencia, numero, status
         ) values ($1, $2, $3, $4, '2026-06-01', 1, 'ABERTA')`,
        [folhaId, empresaId, termoId, metaId],
      );
      await client.query(
        `insert into folha_item (
           id, empresa_id, folha_id, vinculo_id,
           total_proventos, total_descontos, base_inss, valor_inss,
           base_irrf, irrf_bruto, irrf_reducao, valor_irrf, total_liquido,
           snapshots, memoria
         ) values (
           $1, $2, $3, $4, 1000, 150, 1000, 100,
           900, 20, 0, 20, 850,
           '{"pessoa":{"nome":"Prestador PF de teste"},"prestador":{"matricula":"PF-TESTE"}}',
           '{}'
         )`,
        [itemId, empresaId, folhaId, vinculoId],
      );
      await client.query(
        `update folha
            set status = 'FECHADA', fechada_em = now(),
                hash_resultado = repeat('b', 64)
          where id = $1`,
        [folhaId],
      );

      const resultado = await materializarDemonstrativoFolhas({
        empresaId,
        competencia: "2026-06",
        client,
      });
      assert.equal(resultado.pagamentos, 1);
      const pagamento = await client.query<{
        bruto: string;
        retencoes: string;
        liquido: string;
        descontos_comuns: string;
        itens_retencao: number;
      }>(
        `select p.valor_bruto::text bruto, p.total_retencoes::text retencoes,
                p.valor_liquido::text liquido,
                p.beneficiario_snapshot#>>'{folha,descontosNaoTributarios}' descontos_comuns,
                count(r.id)::int itens_retencao
           from pagamento_prestador p
           left join pagamento_retencao r on r.pagamento_id = p.id
          where p.demonstrativo_id = $1
          group by p.id`,
        [resultado.demonstrativoId],
      );
      assert.deepEqual(pagamento.rows[0], {
        bruto: "970.00",
        retencoes: "120.00",
        liquido: "850.00",
        descontos_comuns: "30.00",
        itens_retencao: 2,
      });
      const conferencia = await registrarConferenciaDemonstrativo({
        empresaId,
        demonstrativoId: resultado.demonstrativoId,
        resultado: "APROVADA",
        conferente: "Gerente do RH",
        confirmouPagamentos: true,
        confirmouRetencoes: true,
        confirmouGuias: true,
        observacao: "Competência sintética conferida.",
        client,
      });
      assert.match(conferencia.hash, /^[0-9a-f]{64}$/u);
      await client.query(
        `update pagamento_prestador
            set documento_referencia = documento_referencia || ' alterado'
          where demonstrativo_id = $1`,
        [resultado.demonstrativoId],
      );
      await assert.rejects(
        fecharDemonstrativo({
          empresaId,
          demonstrativoId: resultado.demonstrativoId,
          responsavel: "Gerente do RH",
          client,
        }),
        /mudaram após a conferência/,
      );
      await client.query(
        `update pagamento_prestador
            set documento_referencia = replace(documento_referencia, ' alterado', '')
          where demonstrativo_id = $1`,
        [resultado.demonstrativoId],
      );
      const fechamento = await fecharDemonstrativo({
        empresaId,
        demonstrativoId: resultado.demonstrativoId,
        responsavel: "Gerente do RH",
        client,
      });
      assert.equal(fechamento.hash, conferencia.hash);
      const fechado = await client.query<{
        status: string;
        fechado_por: string;
        hash_resultado: string;
      }>(
        `select status, fechado_por, hash_resultado
           from demonstrativo_mensal where id = $1`,
        [resultado.demonstrativoId],
      );
      assert.deepEqual(fechado.rows[0], {
        status: "FECHADO",
        fechado_por: "Gerente do RH",
        hash_resultado: conferencia.hash,
      });
      await client.query("savepoint demonstrativo_fechado");
      await assert.rejects(
        client.query(
          `update pagamento_prestador set observacao = 'alteração' where demonstrativo_id = $1`,
          [resultado.demonstrativoId],
        ),
        /Demonstrativo fechado é imutável/,
      );
      await client.query("rollback to savepoint demonstrativo_fechado");
      const novaRevisao = await abrirNovaRevisaoDemonstrativo({
        empresaId,
        demonstrativoId: resultado.demonstrativoId,
        motivo:
          "Correção formal solicitada após o fechamento sintético da competência.",
        responsavel: "Gerente do RH",
        client,
      });
      assert.equal(novaRevisao.revisao_origem, 1);
      assert.equal(novaRevisao.revisao_destino, 2);
      assert.equal(novaRevisao.hash_resultado, conferencia.hash);
      const reaberto = await client.query<{
        revisao: number;
        status: string;
        hash_resultado: string | null;
        fechado_em: Date | null;
      }>(
        `select revisao, status, hash_resultado, fechado_em
           from demonstrativo_mensal where id = $1`,
        [resultado.demonstrativoId],
      );
      assert.deepEqual(reaberto.rows[0], {
        revisao: 2,
        status: "RASCUNHO",
        hash_resultado: null,
        fechado_em: null,
      });
      const historico = await client.query<{
        hash_resultado: string;
        snapshot_anterior: {
          conteudo: { demonstrativo: { revisao: number } };
          conferencia: { resultado: string };
        };
      }>(
        `select hash_resultado, snapshot_anterior
           from demonstrativo_revisao_historico
          where demonstrativo_id = $1`,
        [resultado.demonstrativoId],
      );
      assert.equal(historico.rows[0].hash_resultado, conferencia.hash);
      assert.equal(
        historico.rows[0].snapshot_anterior.conteudo.demonstrativo.revisao,
        1,
      );
      assert.equal(
        historico.rows[0].snapshot_anterior.conferencia.resultado,
        "APROVADA",
      );
      const relatorioHistorico = await carregarRelatorioDemonstrativo({
        empresaId,
        demonstrativoId: resultado.demonstrativoId,
        revisao: 1,
        client,
      });
      assert.equal(relatorioHistorico.demonstrativo.status, "FECHADO");
      assert.equal(relatorioHistorico.integridadeValida, true);
      assert.equal(relatorioHistorico.hashCalculado, conferencia.hash);
      await client.query("savepoint historico_revisao");
      await assert.rejects(
        client.query(
          `update demonstrativo_revisao_historico
              set motivo = motivo || ' alterado'
            where demonstrativo_id = $1`,
          [resultado.demonstrativoId],
        ),
        /Histórico de revisão do demonstrativo é imutável/,
      );
      await client.query("rollback to savepoint historico_revisao");
      await materializarDemonstrativoFolhas({
        empresaId,
        competencia: "2026-06",
        client,
      });
      const revisaoAposAtualizacao = await client.query<{ revisao: number }>(
        `select revisao from demonstrativo_mensal where id = $1`,
        [resultado.demonstrativoId],
      );
      assert.equal(
        revisaoAposAtualizacao.rows[0].revisao,
        2,
        "Atualizar as fontes não pode criar uma revisão formal silenciosa.",
      );
      const relatorioAtual = await carregarRelatorioDemonstrativo({
        empresaId,
        demonstrativoId: resultado.demonstrativoId,
        client,
      });
      assert.equal(relatorioAtual.demonstrativo.revisao, 2);
      assert.equal(relatorioAtual.integridadeValida, true);
      await client.query("rollback");
    } finally {
      client.release();
      await pool.end();
    }
  },
);

test(
  "prepara demonstrativo vazio para competência composta somente por pagamentos PJ",
  { skip: !databaseUrl },
  async () => {
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const empresaId = randomUUID();
      await client.query(
        `insert into empresa (id, cnpj, razao_social)
         values ($1, $2, 'Empresa somente PJ')`,
        [empresaId, String(randomInt(10 ** 13, 10 ** 14))],
      );

      const resultado = await materializarDemonstrativoFolhas({
        empresaId,
        competencia: "2026-06",
        client,
      });

      assert.equal(resultado.pagamentos, 0);
      const demonstrativo = await client.query<{
        status: string;
        total_bruto: string;
        total_retencoes: string;
        total_liquido: string;
      }>(
        `select status, total_bruto::text, total_retencoes::text, total_liquido::text
           from demonstrativo_mensal where id = $1`,
        [resultado.demonstrativoId],
      );
      assert.deepEqual(demonstrativo.rows[0], {
        status: "RASCUNHO",
        total_bruto: "0.00",
        total_retencoes: "0.00",
        total_liquido: "0.00",
      });
      await client.query("rollback");
    } finally {
      client.release();
      await pool.end();
    }
  },
);
