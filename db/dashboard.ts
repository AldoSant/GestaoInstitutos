import { getPool } from "./index";

function validarId(valor: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      valor,
    )
  ) {
    throw new Error("Empresa inválida.");
  }
}

export type CompetenciaDashboard = {
  competencia: string;
  folhas: number;
  folhas_fechadas: number;
  status_folhas: string;
  prestadores: number;
  proventos: string;
  descontos: string;
  inss: string;
  irrf: string;
  liquido: string;
  pagamentos_total: number;
  pagamentos_conformes: number;
  obrigacao_id: string | null;
  obrigacao_status: string | null;
  obrigacao_total: string | null;
  obrigacao_diferenca: string | null;
  homologacao_status: string | null;
  homologacao_versao: number | null;
  homologacao_hash: string | null;
};

export async function carregarDashboardOperacional(
  empresaId: string,
  competenciaSelecionada?: string,
) {
  validarId(empresaId);
  const competenciaData = competenciaSelecionada
    ? `${competenciaSelecionada}-01`
    : null;
  const [competencias, cadastros] = await Promise.all([
    getPool().query<CompetenciaDashboard>(
      `with competencias_recentes as (
         select distinct folha.competencia
           from folha
          where folha.empresa_id = $1 and folha.status <> 'CANCELADA'
          order by folha.competencia desc
          limit 6
       ),
       competencias as (
         select competencia from competencias_recentes
         union
         select $2::date
          where $2::date is not null
            and exists (
              select 1
                from folha
               where folha.empresa_id = $1
                 and folha.competencia = $2::date
                 and folha.status <> 'CANCELADA'
            )
       ),
       resumo as (
         select competencia.competencia,
                count(distinct folha.id)::int folhas,
                count(distinct folha.id)
                  filter (where folha.status = 'FECHADA')::int folhas_fechadas,
                case
                  when bool_and(folha.status = 'FECHADA') then 'FECHADA'
                  when bool_or(folha.status = 'PROCESSANDO') then 'PROCESSANDO'
                  when bool_or(folha.status = 'RASCUNHO') then 'NA_FILA'
                  else 'EM_CONFERENCIA'
                end status_folhas,
                count(distinct coalesce(
                  item.snapshots #>> '{pessoa,id}',
                  item.id::text
                ))::int prestadores,
                coalesce(sum(item.total_proventos), 0)::text proventos,
                coalesce(sum(item.total_descontos), 0)::text descontos,
                coalesce(sum(item.valor_inss), 0)::text inss,
                coalesce(sum(item.valor_irrf), 0)::text irrf,
                coalesce(sum(item.total_liquido), 0)::text liquido,
                count(item.id)::int pagamentos_total,
                count(item.id) filter (
                  where folha.status = 'FECHADA'
                    and nullif(btrim(item.snapshots #>> '{contaBancaria,agencia}'), '') is not null
                    and nullif(btrim(item.snapshots #>> '{contaBancaria,numero}'), '') is not null
                    and item.snapshots #>> '{contaBancaria,tipo}' in ('CORRENTE', 'POUPANCA')
                )::int pagamentos_conformes
           from competencias competencia
           join folha
             on folha.empresa_id = $1
            and folha.competencia = competencia.competencia
            and folha.status <> 'CANCELADA'
           left join folha_item item on item.folha_id = folha.id
          group by competencia.competencia
       )
       select resumo.competencia::text, resumo.folhas,
              resumo.folhas_fechadas, resumo.status_folhas,
              resumo.prestadores, resumo.proventos, resumo.descontos,
              resumo.inss, resumo.irrf, resumo.liquido,
              resumo.pagamentos_total, resumo.pagamentos_conformes,
              obrigacao.id obrigacao_id,
              obrigacao.status obrigacao_status,
              obrigacao.total::text obrigacao_total,
              obrigacao.diferenca::text obrigacao_diferenca,
              homologacao.status homologacao_status,
              homologacao.versao homologacao_versao,
              homologacao.hash_fontes homologacao_hash
         from resumo
         left join lateral (
           select id, status::text, total, diferenca
             from obrigacao_fiscal
            where empresa_id = $1
              and competencia = resumo.competencia
              and tipo = 'PREVIDENCIARIA_DCTFWEB'
              and status <> 'CANCELADA'
            limit 1
         ) obrigacao on true
         left join lateral (
           select status, versao, hash_fontes
             from homologacao_competencia
            where empresa_id = $1
              and competencia = resumo.competencia
              and status <> 'INVALIDADA'
            order by versao desc
            limit 1
         ) homologacao on true
        order by resumo.competencia desc`,
      [empresaId, competenciaData],
    ),
    getPool().query<{
      pessoas: number;
      prestadores: number;
      vinculos: number;
    }>(
      `select
         (select count(*)::int from pessoa
           where empresa_id = $1 and ativo) pessoas,
         (select count(*)::int from prestador
           where empresa_id = $1 and ativo) prestadores,
         (select count(*)::int from prestador_vinculo
           where empresa_id = $1 and ativo) vinculos`,
      [empresaId],
    ),
  ]);
  return {
    competencias: competencias.rows,
    cadastros: cadastros.rows[0] ?? {
      pessoas: 0,
      prestadores: 0,
      vinculos: 0,
    },
  };
}
