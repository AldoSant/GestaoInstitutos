import type { PoolClient } from "pg";
import {
  normalizarMotivoCancelamento,
  validarStatusCancelamentoObrigacao,
} from "@/lib/cancelamento";
import type { TipoDocumentoObrigacao } from "@/lib/documentos-obrigacao";
import {
  validarEstadoFolhasParaApuracao,
  validarIntegridadeFontesObrigacao,
} from "@/lib/integridade-obrigacao";
import {
  hashSnapshotRetificacao,
  normalizarSolicitacaoRetificacao,
} from "@/lib/retificacao-obrigacao";
import { carregarPerfilRecolhimentoPorCompetencia } from "./perfis-recolhimento";
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
      [empresaId, data],
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
    if (!resumo) throw new Error("Não foi possível conferir as Folhas da competência.");
    validarEstadoFolhasParaApuracao({
      fechadas: resumo.fechadas,
      pendentes: resumo.pendentes,
      itens: resumo.itens,
      semEnquadramento: resumo.sem_enquadramento,
    });

    const perfilRecolhimento = await carregarPerfilRecolhimentoPorCompetencia(
      empresaId,
      data,
      client,
    );

    const motivos = [
      "Segurado e cota patronal do contribuinte individual foram calculados conforme o enquadramento congelado.",
      perfilRecolhimento.instrumento === "GPS_EXCECAO"
        ? `A emissão depende da conferência da GPS excepcional, código ${perfilRecolhimento.codigo_receita}, conforme a fundamentação publicada.`
        : "A emissão depende da conferência de outras categorias eventualmente existentes e dos totalizadores/recibos do eSocial/DCTFWeb.",
    ];
    const bloqueioMotivo = motivos.join(" ");

    const obrigacao = await client.query<{ id: string }>(
      `insert into obrigacao_fiscal
         (empresa_id, competencia, tipo, status, principal, juros, multa,
          total, bloqueio_motivo, perfil_recolhimento_id)
       values ($1, $2::date, 'PREVIDENCIARIA_DCTFWEB', 'BLOQUEADA',
               0, 0, 0, 0, $3, $4)
       on conflict (empresa_id, competencia, tipo) do update
         set status = 'BLOQUEADA', principal = 0, juros = 0, multa = 0,
             total = 0, valor_declarado = null, diferenca = null,
             conciliada_em = null,
             bloqueio_motivo = excluded.bloqueio_motivo,
             perfil_recolhimento_id = excluded.perfil_recolhimento_id
         where obrigacao_fiscal.status in ('RASCUNHO', 'APURADA', 'BLOQUEADA')
       returning id`,
      [empresaId, data, bloqueioMotivo, perfilRecolhimento.id],
    );
    if (!obrigacao.rows[0]) {
      throw new Error("Uma obrigação emitida ou cancelada não pode ser recalculada.");
    }
    const obrigacaoId = obrigacao.rows[0].id;
    await client.query(
      `update obrigacao_fiscal_retificacao
          set status = 'EM_ANDAMENTO',
              iniciada_em = coalesce(iniciada_em, now())
        where empresa_id = $1 and obrigacao_id = $2
          and status = 'SOLICITADA'`,
      [empresaId, obrigacaoId],
    );

    await client.query(
      `update obrigacao_fiscal_documento
          set verificado = false,
              conteudo = conteudo || jsonb_build_object(
                'invalidadoPorReapuracaoEm', now(),
                'motivo', 'A obrigação foi recalculada e exige nova conferência.'
              )
        where obrigacao_id = $1 and verificado`,
      [obrigacaoId],
    );
    await client.query("delete from obrigacao_fiscal_item where obrigacao_id = $1", [
      obrigacaoId,
    ]);
    await client.query("delete from obrigacao_fiscal_folha where obrigacao_id = $1", [
      obrigacaoId,
    ]);
    await client.query(
      `insert into obrigacao_fiscal_folha
         (obrigacao_id, folha_id, revisao, hash_folha)
       select $1, f.id, f.revisao, f.hash_resultado
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
              fi.base_inss,
              round(
                ((fi.memoria #>> '{inss,aliquotaNumerador}')::numeric * 100)
                / (fi.memoria #>> '{inss,aliquotaDenominador}')::numeric,
                6
              ),
              fi.valor_inss,
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

export async function solicitarRetificacaoObrigacao({
  empresaId,
  obrigacaoId,
  motivo,
  responsavel,
}: {
  empresaId: string;
  obrigacaoId: string;
  motivo: string;
  responsavel: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(obrigacaoId, "Obrigação");
  const solicitacao = normalizarSolicitacaoRetificacao({
    motivo,
    responsavel,
  });
  return transacao(async (client) => {
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [solicitacao.responsavel, solicitacao.motivo],
    );
    const atual = await client.query<{
      id: string;
      status: string;
      competencia: string;
    }>(
      `select id, status::text, competencia::text
         from obrigacao_fiscal
        where id = $1 and empresa_id = $2
        for update`,
      [obrigacaoId, empresaId],
    );
    const obrigacao = atual.rows[0];
    if (!obrigacao) throw new Error("Obrigação não encontrada.");
    if (obrigacao.status !== "EMITIDA") {
      throw new Error(
        "Somente uma obrigação emitida pode iniciar retificação formal.",
      );
    }
    const snapshotResultado = await client.query<{
      snapshot: Record<string, unknown>;
    }>(
      `select jsonb_build_object(
         'obrigacao', to_jsonb(obrigacao),
         'folhas', coalesce((
           select jsonb_agg(to_jsonb(fonte) order by fonte.folha_id)
             from obrigacao_fiscal_folha fonte
            where fonte.obrigacao_id = obrigacao.id
         ), '[]'::jsonb),
         'itens', coalesce((
           select jsonb_agg(to_jsonb(item) order by item.natureza, item.id)
             from obrigacao_fiscal_item item
            where item.obrigacao_id = obrigacao.id
         ), '[]'::jsonb),
         'documentos', coalesce((
           select jsonb_agg(to_jsonb(documento) order by documento.tipo, documento.id)
             from obrigacao_fiscal_documento documento
            where documento.obrigacao_id = obrigacao.id
         ), '[]'::jsonb)
       ) snapshot
       from obrigacao_fiscal obrigacao
      where obrigacao.id = $1 and obrigacao.empresa_id = $2`,
      [obrigacaoId, empresaId],
    );
    const snapshot = snapshotResultado.rows[0]?.snapshot;
    if (!snapshot) {
      throw new Error("Não foi possível congelar a obrigação emitida.");
    }
    const hashSnapshot = hashSnapshotRetificacao(snapshot);
    const inserida = await client.query<{
      id: string;
      versao: number;
      status: string;
    }>(
      `insert into obrigacao_fiscal_retificacao
         (empresa_id, obrigacao_id, versao, status, motivo, responsavel,
          snapshot_anterior, hash_snapshot_anterior)
       select $1, $2,
              coalesce(max(retificacao.versao), 0) + 1,
              'SOLICITADA', $3, $4, $5::jsonb, $6
         from obrigacao_fiscal_retificacao retificacao
        where retificacao.obrigacao_id = $2
       returning id, versao, status`,
      [
        empresaId,
        obrigacaoId,
        solicitacao.motivo,
        solicitacao.responsavel,
        JSON.stringify(snapshot),
        hashSnapshot,
      ],
    );
    const retificacao = inserida.rows[0];
    await client.query(
      `update obrigacao_fiscal_documento
          set verificado = false,
              conteudo = conteudo || jsonb_build_object(
                'invalidadoPorRetificacaoEm', now(),
                'retificacaoId', $2::uuid,
                'motivo', $3::text
              )
        where obrigacao_id = $1 and verificado`,
      [obrigacaoId, retificacao.id, solicitacao.motivo],
    );
    await client.query(
      `update obrigacao_fiscal
          set status = 'BLOQUEADA',
              valor_declarado = null,
              diferenca = null,
              conciliada_em = null,
              bloqueio_motivo =
                'Retificação formal em andamento. Reabra e reprocesse as Folhas necessárias, reapure e registre novos documentos oficiais.'
        where id = $1`,
      [obrigacaoId],
    );
    return {
      ...retificacao,
      obrigacaoId,
      competencia: obrigacao.competencia,
      hashSnapshot,
    };
  });
}

export async function diagnosticarCompetenciaObrigacao(
  empresaId: string,
  competencia: string,
) {
  validarId(empresaId, "Empresa");
  const data = competenciaNormalizada(competencia);
  const resultado = await getPool().query<{
    folhas_total: number;
    folhas_fechadas: number;
    folhas_pendentes: number;
    itens_fechados: number;
    inss_segurado: string;
    apta_apuracao: boolean;
  }>(
    `select
       count(distinct f.id)::int folhas_total,
       count(distinct f.id) filter (where f.status = 'FECHADA')::int
         folhas_fechadas,
       count(distinct f.id) filter (
         where f.status not in ('FECHADA', 'CANCELADA')
       )::int folhas_pendentes,
       count(fi.id) filter (where f.status = 'FECHADA')::int itens_fechados,
       coalesce(
         sum(fi.valor_inss) filter (where f.status = 'FECHADA'),
         0
       )::text inss_segurado,
       (
         count(distinct f.id) filter (where f.status = 'FECHADA') > 0
         and count(distinct f.id) filter (
           where f.status not in ('FECHADA', 'CANCELADA')
         ) = 0
         and count(fi.id) filter (where f.status = 'FECHADA') > 0
       ) apta_apuracao
     from folha f
     left join folha_item fi on fi.folha_id = f.id
    where f.empresa_id = $1 and f.competencia = $2::date
      and f.status <> 'CANCELADA'`,
    [empresaId, data],
  );
  return (
    resultado.rows[0] ?? {
      folhas_total: 0,
      folhas_fechadas: 0,
      folhas_pendentes: 0,
      itens_fechados: 0,
      inss_segurado: "0",
      apta_apuracao: false,
    }
  );
}

export async function listarObrigacoes(
  empresaId: string,
  competencia?: string,
) {
  validarId(empresaId, "Empresa");
  const data = competencia ? competenciaNormalizada(competencia) : null;
  const resultado = await getPool().query<{
    id: string;
    competencia: string;
    tipo: string;
    status: string;
    principal: string;
    juros: string;
    multa: string;
    total: string;
    perfil_instrumento: "DCTFWEB_DARF" | "GPS_EXCECAO" | null;
    perfil_codigo_receita: string | null;
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
    retificacoes: Array<{
      id: string;
      versao: number;
      status: string;
      motivo: string;
      responsavel: string;
      protocolo: string | null;
      hashSnapshotAnterior: string;
      solicitadaEm: string;
      iniciadaEm: string | null;
      concluidaEm: string | null;
    }>;
  }>(
    `select o.id, o.competencia::text, o.tipo, o.status,
            o.principal::text, o.juros::text, o.multa::text, o.total::text,
            o.bloqueio_motivo, o.valor_declarado::text, o.diferenca::text,
            o.conciliada_em, o.criado_em,
            perfil.instrumento perfil_instrumento,
            perfil.codigo_receita perfil_codigo_receita,
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
            ,
            coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', retificacao.id,
                    'versao', retificacao.versao,
                    'status', retificacao.status,
                    'motivo', retificacao.motivo,
                    'responsavel', retificacao.responsavel,
                    'protocolo', retificacao.protocolo,
                    'hashSnapshotAnterior',
                      retificacao.hash_snapshot_anterior,
                    'solicitadaEm', retificacao.solicitada_em,
                    'iniciadaEm', retificacao.iniciada_em,
                    'concluidaEm', retificacao.concluida_em
                  )
                  order by retificacao.versao desc
                )
                  from obrigacao_fiscal_retificacao retificacao
                 where retificacao.obrigacao_id = o.id
              ),
              '[]'::jsonb
            ) retificacoes
       from obrigacao_fiscal o
       left join perfil_recolhimento_previdenciario perfil
         on perfil.id = o.perfil_recolhimento_id
      where o.empresa_id = $1
        and ($2::date is null or o.competencia = $2::date)
      order by o.competencia desc, o.criado_em desc
      limit 60`,
    [empresaId, data],
  );
  return resultado.rows;
}

export async function carregarEspelhoObrigacao(
  empresaId: string,
  obrigacaoId: string,
) {
  validarId(empresaId, "Empresa");
  validarId(obrigacaoId, "Obrigação");
  const [cabecalho, itens, documentos, retificacoes] = await Promise.all([
    getPool().query<{
      id: string;
      competencia: string;
      tipo: string;
      status: string;
      principal: string;
      juros: string;
      multa: string;
      total: string;
      valor_declarado: string | null;
      diferenca: string | null;
      bloqueio_motivo: string | null;
      conciliada_em: Date | null;
      perfil_instrumento: "DCTFWEB_DARF" | "GPS_EXCECAO" | null;
      perfil_codigo_receita: string | null;
      perfil_evidencia: string | null;
      perfil_responsavel: string | null;
      criado_em: Date;
    }>(
      `select o.id, o.competencia::text, o.tipo, o.status, o.principal::text,
              o.juros::text, o.multa::text, o.total::text,
              o.valor_declarado::text, o.diferenca::text, o.bloqueio_motivo,
              o.conciliada_em, o.criado_em,
              perfil.instrumento perfil_instrumento,
              perfil.codigo_receita perfil_codigo_receita,
              perfil.evidencia perfil_evidencia,
              perfil.responsavel perfil_responsavel
         from obrigacao_fiscal o
         left join perfil_recolhimento_previdenciario perfil
           on perfil.id = o.perfil_recolhimento_id
        where o.id = $1 and o.empresa_id = $2`,
      [obrigacaoId, empresaId],
    ),
    getPool().query<{
      id: string;
      natureza: string;
      origem: string;
      descricao: string;
      base_calculo: string;
      aliquota: string | null;
      valor: string;
      snapshot: Record<string, unknown>;
      folha_numero: number | null;
      folha_revisao: number | null;
      folha_hash: string | null;
      termo_numero: string | null;
      meta_codigo: string | null;
    }>(
      `select item.id, item.natureza, item.origem, item.descricao,
              item.base_calculo::text, item.aliquota::text, item.valor::text,
              item.snapshot, folha.numero folha_numero,
              fonte.revisao folha_revisao, fonte.hash_folha folha_hash,
              termo.numero termo_numero, meta.codigo meta_codigo
         from obrigacao_fiscal_item item
         left join folha_item folha_item on folha_item.id = item.folha_item_id
         left join folha on folha.id = folha_item.folha_id
         left join obrigacao_fiscal_folha fonte
           on fonte.obrigacao_id = item.obrigacao_id
          and fonte.folha_id = folha.id
         left join termo on termo.id = folha.termo_id
         left join termo_meta meta on meta.id = folha.meta_id
        where item.obrigacao_id = $1 and item.empresa_id = $2
        order by item.natureza, folha.numero, item.id`,
      [obrigacaoId, empresaId],
    ),
    getPool().query<{
      tipo: string;
      referencia: string;
      valor_total: string;
      emitido_em: string;
      localizador: string;
      verificado: boolean;
      hash_sha256: string | null;
    }>(
      `select tipo, referencia, valor_total::text, emitido_em::text,
              localizador, verificado, hash_sha256
         from obrigacao_fiscal_documento
        where obrigacao_id = $1 and empresa_id = $2
        order by emitido_em, tipo, referencia`,
      [obrigacaoId, empresaId],
    ),
    getPool().query<{
      id: string;
      versao: number;
      status: string;
      motivo: string;
      responsavel: string;
      protocolo: string | null;
      hash_snapshot_anterior: string;
      solicitada_em: Date;
      iniciada_em: Date | null;
      concluida_em: Date | null;
    }>(
      `select id, versao, status, motivo, responsavel, protocolo,
              hash_snapshot_anterior, solicitada_em, iniciada_em,
              concluida_em
         from obrigacao_fiscal_retificacao
        where obrigacao_id = $1 and empresa_id = $2
        order by versao`,
      [obrigacaoId, empresaId],
    ),
  ]);
  if (!cabecalho.rows[0]) throw new Error("Obrigação não encontrada.");
  if (itens.rowCount === 0) {
    throw new Error("A obrigação não possui itens para exportação.");
  }
  return {
    obrigacao: cabecalho.rows[0],
    itens: itens.rows,
    documentos: documentos.rows,
    retificacoes: retificacoes.rows,
  };
}

async function validarFontesObrigacaoAtuais(
  client: PoolClient,
  empresaId: string,
  obrigacaoId: string,
) {
  const resultado = await client.query<{
    vinculadas: number;
    pendentes: number;
    fechadas_novas: number;
    alteradas: number;
  }>(
    `select
       (
         select count(*)::int
           from obrigacao_fiscal_folha fonte
          where fonte.obrigacao_id = o.id
       ) vinculadas,
       (
         select count(*)::int
           from folha f
          where f.empresa_id = o.empresa_id
            and f.competencia = o.competencia
            and f.status not in ('FECHADA', 'CANCELADA')
       ) pendentes,
       (
         select count(*)::int
           from folha f
          where f.empresa_id = o.empresa_id
            and f.competencia = o.competencia
            and f.status = 'FECHADA'
            and not exists (
              select 1
                from obrigacao_fiscal_folha fonte
               where fonte.obrigacao_id = o.id
                 and fonte.folha_id = f.id
            )
       ) fechadas_novas,
       (
         select count(*)::int
           from obrigacao_fiscal_folha fonte
           join folha f on f.id = fonte.folha_id
          where fonte.obrigacao_id = o.id
            and (
              f.status <> 'FECHADA'
              or f.revisao <> fonte.revisao
              or f.hash_resultado is distinct from fonte.hash_folha
            )
       ) alteradas
     from obrigacao_fiscal o
    where o.id = $1 and o.empresa_id = $2`,
    [obrigacaoId, empresaId],
  );
  const fontes = resultado.rows[0];
  if (!fontes) throw new Error("Obrigação não encontrada.");
  validarIntegridadeFontesObrigacao({
    vinculadas: fontes.vinculadas,
    pendentes: fontes.pendentes,
    fechadasNovas: fontes.fechadas_novas,
    alteradas: fontes.alteradas,
  });
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
      competencia: string;
      instrumento: "DCTFWEB_DARF" | "GPS_EXCECAO" | null;
      codigo_receita: string | null;
    }>(
      `select o.id, o.status, o.total::text, o.competencia::text,
              perfil.instrumento, perfil.codigo_receita
         from obrigacao_fiscal o
         left join perfil_recolhimento_previdenciario perfil
           on perfil.id = o.perfil_recolhimento_id
        where o.id = $1 and o.empresa_id = $2
        for update`,
      [obrigacaoId, empresaId],
    );
    const obrigacao = bloqueada.rows[0];
    if (!obrigacao) throw new Error("Obrigação não encontrada.");
    if (obrigacao.status === "CANCELADA") {
      throw new Error("Obrigação cancelada não aceita documentos.");
    }
    if (!obrigacao.instrumento) {
      throw new Error(
        "A obrigação não possui perfil de recolhimento congelado. Reapure a competência antes de registrar documentos.",
      );
    }
    const documentosPermitidos =
      obrigacao.instrumento === "GPS_EXCECAO"
        ? ["GPS"]
        : ["TOTALIZADOR_DCTFWEB", "RECIBO_DCTFWEB", "DARF"];
    if (!documentosPermitidos.includes(tipo)) {
      throw new Error(
        obrigacao.instrumento === "GPS_EXCECAO"
          ? "Este perfil exige somente GPS excepcional; totalizador, recibo e DARF não se aplicam."
          : "Este perfil exige documentos DCTFWeb (totalizador, recibo e DARF); GPS não se aplica.",
      );
    }
    if (obrigacao.status === "EMITIDA" && tipo !== "RECIBO_DCTFWEB") {
      throw new Error("Obrigação já emitida não aceita novo documento de pagamento.");
    }
    if (verificado) {
      await client.query(
        "select pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        [empresaId, obrigacao.competencia],
      );
      await validarFontesObrigacaoAtuais(client, empresaId, obrigacaoId);
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

    if (verificado && tipo === "RECIBO_DCTFWEB") {
      await client.query(
        `update obrigacao_fiscal_retificacao
            set protocolo = $2,
                status = 'EM_ANDAMENTO',
                iniciada_em = coalesce(iniciada_em, now())
          where obrigacao_id = $1
            and status in ('SOLICITADA', 'EM_ANDAMENTO')`,
        [obrigacaoId, referencia],
      );
    }

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
      await client.query(
        `update obrigacao_fiscal_retificacao retificacao
            set status = 'CONCLUIDA',
                protocolo = coalesce(retificacao.protocolo, $2),
                concluida_em = now(),
                resultado = jsonb_build_object(
                  'obrigacaoId', obrigacao.id,
                  'status', obrigacao.status,
                  'principal', obrigacao.principal::text,
                  'juros', obrigacao.juros::text,
                  'multa', obrigacao.multa::text,
                  'total', obrigacao.total::text,
                  'valorDeclarado', obrigacao.valor_declarado::text,
                  'diferenca', obrigacao.diferenca::text,
                  'darfReferencia', $2::text,
                  'darfDocumentoId', $3::uuid
                )
           from obrigacao_fiscal obrigacao
          where retificacao.obrigacao_id = $1
            and retificacao.status in ('SOLICITADA', 'EM_ANDAMENTO')
            and obrigacao.id = retificacao.obrigacao_id`,
        [obrigacaoId, referencia, inserido.rows[0].id],
      );
    }
    if (verificado && tipo === "GPS") {
      if (Number(valorTotal) !== Number(obrigacao.total)) {
        throw new Error("GPS só pode ser confirmada quando o valor for idêntico à apuração interna.");
      }
      await client.query(
        `update obrigacao_fiscal
            set valor_declarado = $2::numeric,
                diferenca = 0,
                conciliada_em = now(),
                status = 'EMITIDA',
                bloqueio_motivo = null
          where id = $1`,
        [obrigacaoId, valorTotal],
      );
      await client.query(
        `update obrigacao_fiscal_retificacao retificacao
            set status = 'CONCLUIDA',
                protocolo = coalesce(retificacao.protocolo, $2),
                concluida_em = now(),
                resultado = jsonb_build_object(
                  'obrigacaoId', obrigacao.id,
                  'documentoReferencia', $2::text,
                  'documentoId', $3::uuid,
                  'instrumento', 'GPS_EXCECAO'
                )
           from obrigacao_fiscal obrigacao
          where retificacao.obrigacao_id = $1
            and retificacao.status in ('SOLICITADA', 'EM_ANDAMENTO')
            and obrigacao.id = retificacao.obrigacao_id`,
        [obrigacaoId, referencia, inserido.rows[0].id],
      );
    }
    return { id: inserido.rows[0].id, obrigacaoId, tipo };
  });
}

export async function cancelarObrigacao({
  empresaId,
  obrigacaoId,
  motivo,
  ator = "OPERADOR_INTERNO",
}: {
  empresaId: string;
  obrigacaoId: string;
  motivo: string;
  ator?: string;
}) {
  validarId(empresaId, "Empresa");
  validarId(obrigacaoId, "Obrigação");
  const justificativa = normalizarMotivoCancelamento(motivo, "Obrigação");
  return transacao(async (client) => {
    await client.query(
      `select set_config('app.ator', $1, true),
              set_config('app.motivo', $2, true)`,
      [ator.trim().slice(0, 160) || "OPERADOR_INTERNO", justificativa],
    );
    const atual = await client.query<{ id: string; status: string }>(
      `select id, status
         from obrigacao_fiscal
        where id = $1 and empresa_id = $2
        for update`,
      [obrigacaoId, empresaId],
    );
    const obrigacao = atual.rows[0];
    if (!obrigacao) throw new Error("Obrigação não encontrada.");
    validarStatusCancelamentoObrigacao(obrigacao.status);
    await client.query(
      `update obrigacao_fiscal_documento
          set verificado = false,
              conteudo = conteudo || jsonb_build_object(
                'invalidadoPorCancelamentoEm', now(),
                'motivo', $2::text
              )
        where obrigacao_id = $1 and verificado`,
      [obrigacaoId, justificativa],
    );
    await client.query(
      `update obrigacao_fiscal
          set status = 'CANCELADA',
              conciliada_em = null,
              bloqueio_motivo = $2
        where id = $1`,
      [obrigacaoId, `Obrigação cancelada: ${justificativa}`],
    );
    return { obrigacaoId };
  });
}
