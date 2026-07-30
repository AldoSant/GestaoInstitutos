import { resolverCategoriaFgts } from "@/lib/fgts";
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

