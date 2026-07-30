import { getPool } from "./index";
import { decimalParaInteiro } from "@/lib/dinheiro";
import { numeroDecimalBrasileiro } from "@/lib/importacao-giw";
import type { PoolClient } from "pg";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/u;

function validarId(valor: string, campo: string) {
  if (!UUID.test(valor)) throw new Error(`${campo} inválido.`);
}

function competenciaData(valor: string) {
  if (!COMPETENCIA.test(valor)) throw new Error("Competência inválida.");
  return `${valor}-01`;
}

function centavosFormulario(valor: unknown, campo: string) {
  const decimal = numeroDecimalBrasileiro(valor);
  if (decimal === null) throw new Error(`${campo} inválido.`);
  const centavos = decimalParaInteiro(decimal, 2);
  if (centavos < 0) throw new Error(`${campo} não pode ser negativo.`);
  return centavos;
}

function decimalCentavos(valor: number) {
  const inteiro = Math.trunc(valor / 100);
  const fracao = String(valor % 100).padStart(2, "0");
  return `${inteiro}.${fracao}`;
}

async function atualizarTotais(
  client: PoolClient,
  demonstrativoId: string,
) {
  await client.query(
    `update demonstrativo_mensal d
        set total_bruto = totais.bruto,
            total_retencoes = totais.retencoes,
            total_liquido = totais.liquido,
            atualizado_em = now()
       from (
         select coalesce(sum(valor_bruto), 0) bruto,
                coalesce(sum(total_retencoes), 0) retencoes,
                coalesce(sum(valor_liquido), 0) liquido
           from pagamento_prestador
          where demonstrativo_id = $1
       ) totais
      where d.id = $1`,
    [demonstrativoId],
  );
}

export async function materializarDemonstrativoFolhas({
  empresaId,
  competencia,
}: {
  empresaId: string;
  competencia: string;
}) {
  validarId(empresaId, "Empresa");
  const mes = competenciaData(competencia);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `select pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`demonstrativo:${empresaId}:${mes}`],
    );

    const fontes = await client.query<{ total: number }>(
      `select count(*)::int total
         from folha_item i
         join folha f on f.id = i.folha_id and f.empresa_id = i.empresa_id
         join prestador_vinculo v on v.id = i.vinculo_id and v.empresa_id = i.empresa_id
         join prestador pr on pr.id = v.prestador_id and pr.empresa_id = v.empresa_id
         join pessoa p on p.id = pr.pessoa_id and p.empresa_id = pr.empresa_id
        where f.empresa_id = $1 and f.competencia = $2::date
          and f.status = 'FECHADA' and p.tipo = 'FISICA'`,
      [empresaId, mes],
    );
    if ((fontes.rows[0]?.total ?? 0) === 0) {
      throw new Error(
        "Nenhum pagamento PF de Folha fechada foi encontrado nesta competência.",
      );
    }

    const atual = await client.query<{
      id: string;
      status: string;
      revisao: number;
    }>(
      `select id, status, revisao
         from demonstrativo_mensal
        where empresa_id = $1 and competencia = $2::date
          and status <> 'CANCELADO'
        order by numero desc
        limit 1
        for update`,
      [empresaId, mes],
    );
    if (atual.rows[0]?.status === "FECHADO") {
      throw new Error(
        "O demonstrativo está fechado. Abra uma nova revisão antes de alterar as fontes.",
      );
    }

    let demonstrativoId = atual.rows[0]?.id;
    if (!demonstrativoId) {
      const criado = await client.query<{ id: string }>(
        `insert into demonstrativo_mensal (
           empresa_id, competencia, numero, total_bruto, total_retencoes, total_liquido
         )
         select $1, $2::date, coalesce(max(numero), 0) + 1, 0, 0, 0
           from demonstrativo_mensal
          where empresa_id = $1 and competencia = $2::date
         returning id`,
        [empresaId, mes],
      );
      demonstrativoId = criado.rows[0].id;
    } else {
      await client.query(
        `update demonstrativo_mensal
            set revisao = revisao + 1, status = 'RASCUNHO',
                hash_resultado = null, fechado_em = null, fechado_por = null,
                atualizado_em = now()
          where id = $1`,
        [demonstrativoId],
      );
      await client.query(
        `delete from pagamento_prestador
          where demonstrativo_id = $1 and origem = 'FOLHA_PF'`,
        [demonstrativoId],
      );
    }

    const pagamentos = await client.query<{ id: string; folha_item_id: string }>(
      `insert into pagamento_prestador (
         empresa_id, demonstrativo_id, prestador_id, vinculo_id, folha_item_id,
         tipo_pessoa, origem, documento_referencia, documento_hash,
         beneficiario_snapshot, valor_bruto, total_retencoes, valor_liquido
       )
       select i.empresa_id, $3, pr.id, v.id, i.id, 'FISICA', 'FOLHA_PF',
              'Folha ' || f.numero || ' · revisão ' || f.revisao,
              f.hash_resultado,
              jsonb_build_object(
                'pessoa', i.snapshots->'pessoa',
                'prestador', i.snapshots->'prestador',
                'conta', i.snapshots->'contaBancaria',
                'folha', jsonb_build_object(
                  'id', f.id, 'numero', f.numero, 'revisao', f.revisao,
                  'hash', f.hash_resultado, 'proventos', i.total_proventos,
                  'descontos', i.total_descontos,
                  'descontosNaoTributarios',
                    i.total_descontos - i.valor_inss - i.valor_irrf
                )
              ),
              i.total_liquido + i.valor_inss + i.valor_irrf,
              i.valor_inss + i.valor_irrf,
              i.total_liquido
         from folha_item i
         join folha f on f.id = i.folha_id and f.empresa_id = i.empresa_id
         join prestador_vinculo v on v.id = i.vinculo_id and v.empresa_id = i.empresa_id
         join prestador pr on pr.id = v.prestador_id and pr.empresa_id = v.empresa_id
         join pessoa p on p.id = pr.pessoa_id and p.empresa_id = pr.empresa_id
        where f.empresa_id = $1 and f.competencia = $2::date
          and f.status = 'FECHADA' and p.tipo = 'FISICA'
        returning id, folha_item_id`,
      [empresaId, mes, demonstrativoId],
    );

    await client.query(
      `insert into pagamento_retencao (
         empresa_id, pagamento_id, tributo, base_calculo, valor, origem,
         regra_calculo_id, evidencia_referencia, evidencia_hash, snapshot
       )
       select pp.empresa_id, pp.id, r.tributo, r.base_calculo, r.valor,
              'CALCULO_FOLHA_PF', f.regra_calculo_id,
              pp.documento_referencia, f.hash_resultado,
              jsonb_build_object('folhaItemId', i.id, 'memoria', i.memoria)
         from pagamento_prestador pp
         join folha_item i on i.id = pp.folha_item_id
         join folha f on f.id = i.folha_id
         cross join lateral (
           values ('INSS'::varchar, i.base_inss, i.valor_inss),
                  ('IRRF'::varchar, i.base_irrf, i.valor_irrf)
         ) r(tributo, base_calculo, valor)
        where pp.demonstrativo_id = $1 and pp.origem = 'FOLHA_PF'
          and r.valor > 0`,
      [demonstrativoId],
    );

    await client.query(
      `delete from demonstrativo_obrigacao where demonstrativo_id = $1`,
      [demonstrativoId],
    );
    const guias = await client.query(
      `insert into demonstrativo_obrigacao (
         empresa_id, demonstrativo_id, obrigacao_id
       )
       select empresa_id, $3, id
         from obrigacao_fiscal
        where empresa_id = $1 and competencia = $2::date
          and status <> 'CANCELADA'
       on conflict do nothing`,
      [empresaId, mes, demonstrativoId],
    );
    await atualizarTotais(client, demonstrativoId);
    await client.query("set constraints all immediate");
    await client.query("commit");
    return {
      demonstrativoId,
      pagamentos: pagamentos.rowCount ?? 0,
      guias: guias.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function adicionarPagamentoPj({
  empresaId,
  competencia,
  prestadorId,
  documentoReferencia,
  valorBruto,
  retencoes,
}: {
  empresaId: string;
  competencia: string;
  prestadorId: string;
  documentoReferencia: string;
  valorBruto: unknown;
  retencoes: Record<string, unknown>;
}) {
  validarId(empresaId, "Empresa");
  validarId(prestadorId, "Prestador");
  const mes = competenciaData(competencia);
  const referencia = documentoReferencia.trim();
  if (referencia.length < 3 || referencia.length > 160) {
    throw new Error("Informe a nota fiscal ou documento de referência.");
  }
  const brutoCentavos = centavosFormulario(valorBruto, "Valor bruto");
  if (brutoCentavos === 0) throw new Error("Valor bruto deve ser maior que zero.");
  const tributos = ["INSS", "IRRF", "ISS", "PIS", "COFINS", "CSLL"] as const;
  const linhas = tributos
    .map((tributo) => ({
      tributo,
      centavos: centavosFormulario(retencoes[tributo] ?? "0", tributo),
    }))
    .filter((item) => item.centavos > 0);
  const totalRetencoes = linhas.reduce((total, item) => total + item.centavos, 0);
  if (totalRetencoes > brutoCentavos) {
    throw new Error("As retenções não podem superar o valor bruto.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const demonstrativo = await client.query<{ id: string; status: string }>(
      `select id, status from demonstrativo_mensal
        where empresa_id = $1 and competencia = $2::date
          and status <> 'CANCELADO'
        order by numero desc limit 1 for update`,
      [empresaId, mes],
    );
    if (!demonstrativo.rows[0]) {
      throw new Error("Gere primeiro o rascunho do demonstrativo da competência.");
    }
    if (demonstrativo.rows[0].status === "FECHADO") {
      throw new Error("Demonstrativo fechado não aceita novos pagamentos.");
    }
    const prestador = await client.query(
      `select pr.id, p.nome_razao_social nome, p.cnpj
         from prestador pr
         join pessoa p on p.id = pr.pessoa_id and p.empresa_id = pr.empresa_id
        where pr.id = $1 and pr.empresa_id = $2 and pr.ativo
          and p.ativo and p.tipo = 'JURIDICA'`,
      [prestadorId, empresaId],
    );
    if (!prestador.rows[0]) {
      throw new Error("Selecione um prestador PJ ativo.");
    }
    const pagamento = await client.query<{ id: string }>(
      `insert into pagamento_prestador (
         empresa_id, demonstrativo_id, prestador_id, tipo_pessoa, origem,
         documento_referencia, beneficiario_snapshot,
         valor_bruto, total_retencoes, valor_liquido
       ) values (
         $1, $2, $3, 'JURIDICA', 'NOTA_FISCAL_PJ', $4,
         jsonb_build_object('nome', $5::text, 'cnpj', $6::text),
         $7, $8, $9
       ) returning id`,
      [
        empresaId,
        demonstrativo.rows[0].id,
        prestadorId,
        referencia,
        prestador.rows[0].nome,
        prestador.rows[0].cnpj,
        decimalCentavos(brutoCentavos),
        decimalCentavos(totalRetencoes),
        decimalCentavos(brutoCentavos - totalRetencoes),
      ],
    );
    for (const linha of linhas) {
      await client.query(
        `insert into pagamento_retencao (
           empresa_id, pagamento_id, tributo, valor, origem,
           evidencia_referencia, snapshot
         ) values ($1, $2, $3, $4, 'DOCUMENTO_FISCAL', $5, '{}')`,
        [
          empresaId,
          pagamento.rows[0].id,
          linha.tributo,
          decimalCentavos(linha.centavos),
          referencia,
        ],
      );
    }
    await atualizarTotais(client, demonstrativo.rows[0].id);
    await client.query("set constraints all immediate");
    await client.query("commit");
    return pagamento.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function excluirPagamentoPj({
  empresaId,
  pagamentoId,
}: {
  empresaId: string;
  pagamentoId: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(pagamentoId, "Pagamento");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const pagamento = await client.query<{
      demonstrativo_id: string;
      origem: string;
      status: string;
    }>(
      `select p.demonstrativo_id, p.origem, d.status
         from pagamento_prestador p
         join demonstrativo_mensal d on d.id = p.demonstrativo_id
        where p.id = $1 and p.empresa_id = $2
        for update`,
      [pagamentoId, empresaId],
    );
    if (!pagamento.rows[0]) throw new Error("Pagamento não encontrado.");
    if (pagamento.rows[0].origem === "FOLHA_PF") {
      throw new Error("Pagamento PF deve ser atualizado pela Folha de origem.");
    }
    if (pagamento.rows[0].status === "FECHADO") {
      throw new Error("Demonstrativo fechado não pode ser alterado.");
    }
    await client.query(`delete from pagamento_prestador where id = $1`, [
      pagamentoId,
    ]);
    await atualizarTotais(client, pagamento.rows[0].demonstrativo_id);
    await client.query("set constraints all immediate");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function carregarDemonstrativo(
  empresaId: string,
  competencia: string,
) {
  validarId(empresaId, "Empresa");
  const mes = competenciaData(competencia);
  const [demonstrativo, pagamentos, guias, prestadoresPj, pendencias] =
    await Promise.all([
      getPool().query(
        `select id, competencia::text, numero, revisao, status,
                total_bruto::text, total_retencoes::text, total_liquido::text,
                hash_resultado, fechado_em, fechado_por
           from demonstrativo_mensal
          where empresa_id = $1 and competencia = $2::date
            and status <> 'CANCELADO'
          order by numero desc limit 1`,
        [empresaId, mes],
      ),
      getPool().query(
        `select p.id, p.tipo_pessoa, p.origem, p.documento_referencia,
                p.valor_bruto::text, p.total_retencoes::text,
                p.valor_liquido::text, p.beneficiario_snapshot,
                pr.matricula,
                coalesce(pe.nome_razao_social,
                         p.beneficiario_snapshot->>'nome',
                         p.beneficiario_snapshot#>>'{pessoa,nome}') beneficiario,
                coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'tributo', r.tributo, 'valor', r.valor::text,
                      'origem', r.origem, 'evidencia', r.evidencia_referencia
                    ) order by r.tributo
                  ) filter (where r.id is not null),
                  '[]'::jsonb
                ) retencoes
           from pagamento_prestador p
           join demonstrativo_mensal d on d.id = p.demonstrativo_id
           left join prestador pr on pr.id = p.prestador_id
           left join pessoa pe on pe.id = pr.pessoa_id
           left join pagamento_retencao r on r.pagamento_id = p.id
          where d.empresa_id = $1 and d.competencia = $2::date
            and d.status <> 'CANCELADO'
          group by p.id, pr.matricula, pe.nome_razao_social
          order by beneficiario, p.id`,
        [empresaId, mes],
      ),
      getPool().query(
        `select o.id, o.tipo, o.status, o.total::text,
                count(doc.id)::int documentos,
                count(doc.id) filter (where doc.verificado)::int verificados
           from demonstrativo_obrigacao rel
           join demonstrativo_mensal d on d.id = rel.demonstrativo_id
           join obrigacao_fiscal o on o.id = rel.obrigacao_id
           left join obrigacao_fiscal_documento doc on doc.obrigacao_id = o.id
          where d.empresa_id = $1 and d.competencia = $2::date
            and d.status <> 'CANCELADO'
          group by o.id
          order by o.tipo`,
        [empresaId, mes],
      ),
      getPool().query(
        `select pr.id, pr.matricula, p.nome_razao_social nome, p.cnpj
           from prestador pr
           join pessoa p on p.id = pr.pessoa_id and p.empresa_id = pr.empresa_id
          where pr.empresa_id = $1 and pr.ativo and p.ativo
            and p.tipo = 'JURIDICA'
          order by p.nome_razao_social`,
        [empresaId],
      ),
      getPool().query(
        `select count(*)::int total
           from classificacao_operacional_legado
          where empresa_id = $1 and status = 'PENDENTE'`,
        [empresaId],
      ),
    ]);
  return {
    demonstrativo: demonstrativo.rows[0] ?? null,
    pagamentos: pagamentos.rows,
    guias: guias.rows,
    prestadoresPj: prestadoresPj.rows,
    pendencias: pendencias.rows[0]?.total ?? 0,
  };
}
