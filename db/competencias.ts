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

export async function listarCompetenciasDisponiveis(empresaId: string) {
  validarId(empresaId);
  const resultado = await getPool().query<{ competencia: string }>(
    `select competencia
       from (
         select to_char(folha.competencia, 'YYYY-MM') competencia
           from folha
          where folha.empresa_id = $1
            and folha.status <> 'CANCELADA'
         union
         select to_char(legado_folha.competencia, 'YYYY-MM') competencia
           from legado_folha
          where legado_folha.empresa_id = $1
       ) periodos
      order by competencia desc
      limit 36`,
    [empresaId],
  );
  return resultado.rows.map((item) => item.competencia);
}

