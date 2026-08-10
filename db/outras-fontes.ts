import { getPool } from "./index";

function validarId(valor: string, campo: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) {
    throw new Error(`${campo} inválido.`);
  }
  return valor;
}

export async function carregarOutrasFontes(
  empresaId: string,
  prestadorId: string,
) {
  validarId(empresaId, "Empresa");
  validarId(prestadorId, "Prestador");
  const [prestador, fontes] = await Promise.all([
    getPool().query<{
      id: string;
      matricula: string;
      nome: string;
      categoria_contribuinte: string | null;
    }>(
      `select pr.id, pr.matricula, p.nome_razao_social nome,
              pr.categoria_contribuinte
         from prestador pr
         join pessoa p
           on p.id = pr.pessoa_id and p.empresa_id = pr.empresa_id
        where pr.id = $1 and pr.empresa_id = $2`,
      [prestadorId, empresaId],
    ),
    getPool().query<{
      id: string;
      competencia: string;
      fonte_pagadora: string;
      documento_fonte: string;
      remuneracao: string;
      inss_dedutivel_irrf: string;
      irrf_retido: string;
      base_contribuicao: string;
      valor_contribuicao: string;
      documento_referencia: string;
      comprovante_verificado: boolean;
      observacao: string | null;
    }>(
      `select id, competencia::text, fonte_pagadora, documento_fonte,
              remuneracao::text, inss_dedutivel_irrf::text, irrf_retido::text,
              base_contribuicao::text,
              valor_contribuicao::text, documento_referencia,
              comprovante_verificado, observacao
         from contribuicao_outra_fonte
        where prestador_id = $1 and empresa_id = $2
        order by competencia desc, fonte_pagadora`,
      [prestadorId, empresaId],
    ),
  ]);
  if (!prestador.rows[0]) throw new Error("Prestador não encontrado.");
  return { prestador: prestador.rows[0], fontes: fontes.rows };
}
