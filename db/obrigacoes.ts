import type { PoolClient } from "pg";
import type { TipoDocumentoObrigacao } from "@/lib/documentos-obrigacao";
import { getPool } from "./index";

function validarId(valor: string, campo: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) {
    throw new Error(`${campo} inválido.`);
  }
  return valor;
}

function competenciaNormalizada(valor: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) {
    throw new Error("Competência deve usar o formato AAAA-MM.");
  }
  return `${valor}-01`;
}

async function transacao<T>(operacao: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const resultado = await operacao(client);
    await client.query("commit");
    return resultado;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function apurarRetencoesSegurados({
  empresaId,
  competencia,
  ator = "OPERADOR_INTERNO",
}: {
  empresaId: string;
  competencia: string;
  ator?: string;
}) {
  validarId(empresaId, "Empresa");
  const data = competenciaNormalizada(competencia);
  return transacao(async (client) => {
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [
        ator.trim().slice(0, 160) || "OPERADOR_INTERNO",
        `Apuração previdenciária da competência ${competencia}.`,
      ],
    );
    await client.query(
      "select pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      [empresaId, `OBRIGACAO_PREVIDENCIARIA:${data}`],
    );

    const estados = await client.query<{
      fechadas: number;
      pendentes: number;
      itens: number;
      sem_enquadramento: number;
    }>(
      `select
         (count(*) filter (where f.status = 'FECHADA'))::int fechadas,
         (count(*) filter (
           where f.status not in ('FECHADA', 'CANCELADA')
         ))::int pendentes,
         (
           select count(*)::int
             from folha_item fi
             join folha ff on ff.id = fi.folha_id
            where ff.empresa_id = $1 and ff.competencia = $2::date
              and ff.status = 'FECHADA'
         ) itens,
         (
           select count(*)::int
             from folha_item fi
             join folha ff on ff.id = fi.folha_id
            where ff.empresa_id = $1 and ff.competencia = $2::date
              and ff.status = 'FECHADA'
              and not (fi.memoria ? 'previdencia')
         ) sem_enquadramento
       from folha f
      where f.empresa_id = $1 and f.competencia = $2::date`,
      [empresaId, data],
    );
    const resumo = estados.rows[0];
    if (!resumo || resumo.fechadas === 0 || resumo.itens === 0) {
      throw new Error(
        "A apuração exige ao menos uma Folha fechada com itens na competência.",
      );
    }
    if (resumo.sem_enquadramento > 0) {
      throw new Error(
        `${resumo.sem_enquadramento} item(ns) de Folha não possuem enquadramento previdenciário congelado. Reabra e reprocesse essas Folhas antes da apuração.`,
      );
    }

    const motivos = [
      "Segurado e cota patronal do contribuinte individual foram calculados conforme o enquadramento congelado.",
      "A emissão depende da conferência de outras categorias eventualmente existentes e dos totalizadores/recibos do eSocial/DCTFWeb.",
    ];
    if (resumo.pendentes > 0) {
      motivos.unshift(
        `${resumo.pendentes} Folha(s) da competência ainda não estão fechadas.`,
      );
    }
    const bloqueioMotivo = motivos.join(" ");

    const obrigacao = await client.query<{ id: string }>(
      `insert into obrigacao_fiscal
         (empresa_id, competencia, tipo, status, principal, juros, multa,
          total, bloqueio_motivo)
       values ($1, $2::date, 'PREVIDENCIARIA_DCTFWEB', 'BLOQUEADA',
               0, 0, 0, 0, $3)
       on conflict (empresa_id, competencia, tipo) do update
         set status = 'BLOQUEADA', principal = 0, juros = 0, multa = 0,
             total = 0, valor_declarado = null, diferenca = null,
             conciliada_em = null,
             bloqueio_motivo = excluded.bloqueio_motivo
         where obrigacao_fiscal.status in ('RASCUNHO', 'APURADA', 'BLOQUEADA')
       returning id`,
      [empresaId, data, bloqueioMotivo],
    );
    if (!obrigacao.rows[0]) {
      throw new Error("Uma obrigação emitida ou cancelada não pode ser recalculada.");
    }
    const obrigacaoId = obrigacao.rows[0].id;

    await client.query("delete from obrigacao_fiscal_item where obrigacao_id = $1", [
      obrigacaoId,
    ]);
    await client.query("delete from obrigacao_fiscal_folha where obrigacao_id = $1", [
      obrigacaoId,
    ]);
    await client.query(
      `insert into obrigacao_fiscal_folha (obrigacao_id, folha_id)
       select $1, f.id
         from folha f
        where f.empresa_id = $2 and f.competencia = $3::date
          and f.status = 'FECHADA'
       order by f.id`,
      [obrigacaoId, empresaId, data],
    );
    await client.query(
      `insert into obrigacao_fiscal_item
         (empresa_id, obrigacao_id, folha_item_id, natureza, origem,
          descricao, base_calculo, aliquota, valor, snapshot)
       select f.empresa_id, $1, fi.id, 'SEGURADO', 'FOLHA',
              'Retenção previdenciária do contribuinte individual',
              fi.base_inss, 11.000000, fi.valor_inss,
              jsonb_build_object(
                'folhaId', f.id,
                'folhaNumero', f.numero,
                'folhaRevisao', f.revisao,
                'folhaHash', f.hash_resultado,
                'folhaItemId', fi.id,
                'pessoa', fi.snapshots -> 'pessoa',
                'prestador', fi.snapshots -> 'prestador',
                'memoriaInss', fi.memoria -> 'inss',
                'outrasFontes', fi.memoria -> 'outrasFontes'
              )
         from folha f
         join folha_item fi on fi.folha_id = f.id and fi.empresa_id = f.empresa_id
        where f.empresa_id = $2 and f.competencia = $3::date
          and f.status = 'FECHADA' and fi.valor_inss > 0
        order by f.id, fi.id`,
      [obrigacaoId, empresaId, data],
    );
    await client.query(
      `insert into obrigacao_fiscal_item
         (empresa_id, obrigacao_id, folha_item_id, natureza, origem,
          descricao, base_calculo, aliquota, valor, snapshot)
       select f.empresa_id, $1, fi.id, 'PATRONAL', 'FOLHA',
              'Contribuição patronal sobre contribuinte individual',
              round((fi.memoria ->> 'baseInssBrutaCentavos')::numeric / 100, 2),
              round(
                ((fi.memoria #>> '{previdencia,aliquotaPatronalNumerador}')::numeric * 100)
                / (fi.memoria #>> '{previdencia,aliquotaPatronalDenominador}')::numeric,
                6
              ),
              round(
                ((fi.memoria ->> 'baseInssBrutaCentavos')::numeric / 100)
                * (fi.memoria #>> '{previdencia,aliquotaPatronalNumerador}')::numeric
                / (fi.memoria #>> '{previdencia,aliquotaPatronalDenominador}')::numeric,
                2
              ),
              jsonb_build_object(
                'folhaId', f.id,
                'folhaNumero', f.numero,
                'folhaRevisao', f.revisao,
                'folhaHash', f.hash_resultado,
                'folhaItemId', fi.id,
                'pessoa', fi.snapshots -> 'pessoa',
                'prestador', fi.snapshots -> 'prestador',
                'enquadramentoPrevidenciario', fi.memoria -> 'previdencia',
                'baseInssBrutaCentavos', fi.memoria -> 'baseInssBrutaCentavos'
              )
         from folha f
         join folha_item fi on fi.folha_id = f.id and fi.empresa_id = f.empresa_id
        where f.empresa_id = $2 and f.competencia = $3::date
          and f.status = 'FECHADA'
          and (fi.memoria #>> '{previdencia,aliquotaPatronalNumerador}')::int > 0
        order by f.id, fi.id`,
      [obrigacaoId, empresaId, data],
    );
    const atualizada = await client.query<{
      id: string;
      principal: string;
      total: string;
      itens: number;
    }>(
      `update obrigacao_fiscal o
          set principal = x.principal,
              total = round(x.principal + o.juros + o.multa, 2)
         from (
           select coalesce(sum(valor), 0) principal, count(*)::int itens
             from obrigacao_fiscal_item
            where obrigacao_id = $1
         ) x
        where o.id = $1
       returning o.id, o.principal::text, o.total::text, x.itens`,
      [obrigacaoId],
    );
    return {
      ...atualizada.rows[0],
      folhas: resumo.fechadas,
      pendentes: resumo.pendentes,
      bloqueioMotivo,
    };
  });
}

export async function listarObrigacoes(empresaId: string) {
  validarId(empresaId, "Empresa");
  const resultado = await getPool().query<{
    id: string;
    competencia: string;
    tipo: string;
    status: string;
    principal: string;
    juros: string;
    multa: string;
    total: string;
    bloqueio_motivo: string | null;
    valor_declarado: string | null;
    diferenca: string | null;
    conciliada_em: Date | null;
    criado_em: Date;
    folhas: number;
    itens: number;
    segurado: string;
    patronal: string;
    itens_detalhe: Array<{
      id: string;
      natureza: string;
      descricao: string;
      baseCalculo: string;
      aliquota: string | null;
      valor: string;
      snapshot: Record<string, unknown>;
    }>;
    documentos: Array<{
      id: string;
      tipo: string;
      referencia: string;
      valorTotal: string;
      emitidoEm: string;
      localizador: string;
      hashSha256: string | null;
      verificado: boolean;
    }>;
  }>(
    `select o.id, o.competencia::text, o.tipo, o.status,
            o.principal::text, o.juros::text, o.multa::text, o.total::text,
            o.bloqueio_motivo, o.valor_declarado::text, o.diferenca::text,
            o.conciliada_em, o.criado_em,
            (
              select count(*)::int
                from obrigacao_fiscal_folha ofo
               where ofo.obrigacao_id = o.id
            ) folhas,
            (
              select count(*)::int
                from obrigacao_fiscal_item oi
               where oi.obrigacao_id = o.id
            ) itens,
            coalesce(
              (
                select sum(oi.valor) from obrigacao_fiscal_item oi
                 where oi.obrigacao_id = o.id and oi.natureza = 'SEGURADO'
              ),
              0
            )::text segurado,
            coalesce(
              (
                select sum(oi.valor) from obrigacao_fiscal_item oi
                 where oi.obrigacao_id = o.id and oi.natureza = 'PATRONAL'
              ),
              0
            )::text patronal,
            coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', oi.id,
                    'natureza', oi.natureza,
                    'descricao', oi.descricao,
                    'baseCalculo', oi.base_calculo::text,
                    'aliquota', oi.aliquota::text,
                    'valor', oi.valor::text,
                    'snapshot', oi.snapshot
                  )
                  order by oi.natureza, oi.id
                )
                  from obrigacao_fiscal_item oi
                 where oi.obrigacao_id = o.id
              ),
              '[]'::jsonb
            ) itens_detalhe,
            coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', od.id,
                    'tipo', od.tipo,
                    'referencia', od.referencia,
                    'valorTotal', od.valor_total::text,
                    'emitidoEm', od.emitido_em::text,
                    'localizador', od.localizador,
                    'hashSha256', od.hash_sha256,
                    'verificado', od.verificado
                  )
                  order by od.emitido_em desc, od.criado_em desc
                )
                  from obrigacao_fiscal_documento od
                 where od.obrigacao_id = o.id
              ),
              '[]'::jsonb
            ) documentos
       from obrigacao_fiscal o
      where o.empresa_id = $1
      order by o.competencia desc, o.criado_em desc
      limit 60`,
    [empresaId],
  );
  return resultado.rows;
}

export async function registrarDocumentoObrigacao({
  empresaId,
  obrigacaoId,
  tipo,
  referencia,
  valorTotal,
  emitidoEm,
  localizador,
  hashSha256,
  verificado,
  ator = "OPERADOR_INTERNO",
}: {
  empresaId: string;
  obrigacaoId: string;
  tipo: TipoDocumentoObrigacao;
  referencia: string;
  valorTotal: string;
  emitidoEm: string;
  localizador: string;
  hashSha256: string | null;
  verificado: boolean;
  ator?: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(obrigacaoId, "Obrigação");
  return transacao(async (client) => {
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [
        ator.trim().slice(0, 160) || "OPERADOR_INTERNO",
        `Registro do documento ${tipo} ${referencia}.`,
      ],
    );
    const bloqueada = await client.query<{
      id: string;
      status: string;
      total: string;
    }>(
      `select id, status, total::text
         from obrigacao_fiscal
        where id = $1 and empresa_id = $2
        for update`,
      [obrigacaoId, empresaId],
    );
    const obrigacao = bloqueada.rows[0];
    if (!obrigacao) throw new Error("Obrigação não encontrada.");
    if (obrigacao.status === "CANCELADA") {
      throw new Error("Obrigação cancelada não aceita documentos.");
    }
    if (obrigacao.status === "EMITIDA" && tipo !== "RECIBO_DCTFWEB") {
      throw new Error("Obrigação já emitida não aceita novo totalizador ou DARF.");
    }

    const inserido = await client.query<{ id: string }>(
      `insert into obrigacao_fiscal_documento
         (empresa_id, obrigacao_id, tipo, referencia, valor_total,
          emitido_em, localizador, hash_sha256, verificado, conteudo)
       values ($1, $2, $3, $4, $5::numeric, $6::date, $7, $8, $9,
               jsonb_build_object('registradoPeloSistema', true))
       returning id`,
      [
        empresaId,
        obrigacaoId,
        tipo,
        referencia,
        valorTotal,
        emitidoEm,
        localizador,
        hashSha256,
        verificado,
      ],
    );

    if (verificado && tipo === "TOTALIZADOR_DCTFWEB") {
      await client.query(
        `update obrigacao_fiscal
            set valor_declarado = $2::numeric,
                diferenca = round($2::numeric - total, 2),
                conciliada_em = case
                  when round($2::numeric - total, 2) = 0 then now()
                  else null
                end,
                status = case
                  when round($2::numeric - total, 2) = 0 then 'APURADA'::status_obrigacao
                  else 'BLOQUEADA'::status_obrigacao
                end,
                bloqueio_motivo = case
                  when round($2::numeric - total, 2) = 0
                    then 'Totalizador DCTFWeb conciliado. Aguardando recibo e DARF verificados.'
                  else 'O totalizador DCTFWeb diverge da apuração interna.'
                end
          where id = $1`,
        [obrigacaoId, valorTotal],
      );
    }

    if (verificado && tipo === "DARF") {
      const conciliacao = await client.query<{ apta: boolean }>(
        `select (
           o.status = 'APURADA'
           and $2::numeric = o.total
           and exists (
             select 1 from obrigacao_fiscal_documento d
              where d.obrigacao_id = o.id
                and d.tipo = 'TOTALIZADOR_DCTFWEB'
                and d.verificado and d.valor_total = o.total
           )
           and exists (
             select 1 from obrigacao_fiscal_documento d
              where d.obrigacao_id = o.id
                and d.tipo = 'RECIBO_DCTFWEB'
                and d.verificado
           )
         ) apta
         from obrigacao_fiscal o where o.id = $1`,
        [obrigacaoId, valorTotal],
      );
      if (!conciliacao.rows[0]?.apta) {
        throw new Error(
          "DARF só pode ser confirmado após totalizador conciliado e recibo DCTFWeb verificado.",
        );
      }
      await client.query(
        `update obrigacao_fiscal
            set status = 'EMITIDA', bloqueio_motivo = null
          where id = $1`,
        [obrigacaoId],
      );
    }
    return { id: inserido.rows[0].id, obrigacaoId, tipo };
  });
}
