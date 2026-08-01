import { avaliarProntidaoFgts, resolverCategoriaFgts } from "@/lib/fgts";
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

function competenciaNormalizada(valor: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) {
    throw new Error("Competência inválida.");
  }
  return `${valor}-01`;
}

export async function diagnosticarFgtsCompetencia(
  empresaId: string,
  competencia: string,
) {
  validarId(empresaId);
  const data = competenciaNormalizada(competencia);
  const [categorias, folhas] = await Promise.all([
    getPool().query<{
      categoria: string | null;
      trabalhadores: number;
      remuneracao: string;
    }>(
      `select nullif(
                btrim(item.snapshots #>> '{prestador,categoriaContribuinte}'),
                ''
              ) categoria,
              count(distinct coalesce(
                item.snapshots #>> '{pessoa,id}',
                item.id::text
              ))::int trabalhadores,
              coalesce(sum(item.total_proventos), 0)::text remuneracao
         from folha
         join folha_item item on item.folha_id = folha.id
        where folha.empresa_id = $1
          and folha.competencia = $2::date
          and folha.status = 'FECHADA'
        group by nullif(
          btrim(item.snapshots #>> '{prestador,categoriaContribuinte}'),
          ''
        )
        order by categoria nulls first`,
      [empresaId, data],
    ),
    getPool().query<{ total: number }>(
      `select count(*)::int total
         from folha
        where empresa_id = $1
          and competencia = $2::date
          and status = 'FECHADA'`,
      [empresaId, data],
    ),
  ]);
  const grupos = categorias.rows.map((grupo) => ({
    ...grupo,
    decisao: resolverCategoriaFgts(grupo.categoria),
  }));
  return {
    folhasFechadas: folhas.rows[0]?.total ?? 0,
    trabalhadores: grupos.reduce(
      (total, grupo) => total + grupo.trabalhadores,
      0,
    ),
    elegiveis: grupos
      .filter((grupo) => grupo.decisao.elegivel)
      .reduce((total, grupo) => total + grupo.trabalhadores, 0),
    naoElegiveis: grupos
      .filter((grupo) => !grupo.decisao.elegivel)
      .reduce((total, grupo) => total + grupo.trabalhadores, 0),
    grupos,
  };
}

/**
 * A base atual foi concebida para prestadores. Até existir rubrica com
 * incidência de FGTS persistida e motor trabalhista homologado, a etapa de
 * folha fica deliberadamente bloqueada; não se presume que proventos sejam
 * base de FGTS.
 */
export async function carregarProntidaoFgtsCompetencia(
  empresaId: string,
  competencia: string,
) {
  validarId(empresaId);
  const data = competenciaNormalizada(competencia);
  const [diagnostico, oficial] = await Promise.all([
    diagnosticarFgtsCompetencia(empresaId, competencia),
    getPool().query<{
      eventos_aceitos: number;
      s5003_conciliado: boolean;
      s5013_conciliado: boolean;
      gfd_registrada: boolean;
    }>(
      `select
         (select count(*)::int
            from integracao_esocial_evento
           where empresa_id = $1 and competencia = $2::date
             and tipo = 'S-1200' and estado = 'ACEITO') eventos_aceitos,
         exists(
           select 1 from fgts_apuracao
            where empresa_id = $1 and competencia = $2::date
              and status in ('CONCILIADA', 'GUIA_REGISTRADA', 'PAGA')
         ) s5013_conciliado,
         exists(
           select 1
             from fgts_apuracao ap
            where ap.empresa_id = $1 and ap.competencia = $2::date
              and ap.status in ('CONCILIADA', 'GUIA_REGISTRADA', 'PAGA')
              and exists (
                select 1 from fgts_apuracao_item item
                 where item.apuracao_id = ap.id
              )
              and not exists (
                select 1 from fgts_apuracao_item item
                 where item.apuracao_id = ap.id
                   and item.diferenca is distinct from 0
              )
         ) s5003_conciliado,
         exists(
           select 1 from fgts_guia guia
            join fgts_apuracao ap on ap.id = guia.apuracao_id
           where guia.empresa_id = $1 and ap.competencia = $2::date
             and guia.status <> 'CANCELADA'
         ) gfd_registrada`,
      [empresaId, data],
    ),
  ]);
  const dadosOficiais = oficial.rows[0];
  const categoriasNaoHomologadas = diagnostico.grupos
    .filter((grupo) => !grupo.decisao.elegivel)
    .reduce((total, grupo) => total + grupo.trabalhadores, 0);
  const prontidao = avaliarProntidaoFgts({
    folhasFechadas: diagnostico.folhasFechadas,
    trabalhadoresElegiveis: diagnostico.elegiveis,
    categoriasNaoHomologadas,
    // O modelo atual não guarda incidência de FGTS nas rubricas. Zero é
    // intencional: a aplicação não pode transformar remuneração em base.
    rubricasComIncidenciaFgts: 0,
    eventosEsocialAceitos: dadosOficiais?.eventos_aceitos ?? 0,
    s5003Conciliado: dadosOficiais?.s5003_conciliado ?? false,
    s5013Conciliado: dadosOficiais?.s5013_conciliado ?? false,
    gfdRegistrada: dadosOficiais?.gfd_registrada ?? false,
  });
  return { ...diagnostico, prontidao };
}
