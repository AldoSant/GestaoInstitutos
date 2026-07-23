import { hashJson } from "@/lib/json-canonico";
import {
  CODIGO_REGRA_FOLHA_PRESTADOR,
  validarRegraFiscal,
} from "@/lib/regras-fiscais";
import { getPool } from "./index";

type LinhaRegra = {
  id: string;
  empresa_id: string | null;
  codigo: string;
  versao: number;
  inicio_vigencia: string;
  fim_vigencia: string | null;
  parametros: unknown;
  fonte_normativa: string;
  hash_conteudo: string;
  publicada: boolean;
  criada_em: Date;
};

function competenciaNormalizada(competencia: string) {
  if (!/^\d{4}-\d{2}(-01)?$/.test(competencia)) {
    throw new Error("Competência deve usar o formato AAAA-MM.");
  }
  const normalizada = competencia.length === 7 ? `${competencia}-01` : competencia;
  const mes = Number(normalizada.slice(5, 7));
  if (mes < 1 || mes > 12) throw new Error("Competência inválida.");
  return normalizada;
}

function mapearRegra(linha: LinhaRegra) {
  const parametros = validarRegraFiscal(linha.parametros);
  const hashCalculado = hashJson(parametros);
  if (hashCalculado !== linha.hash_conteudo) {
    throw new Error(
      `A regra fiscal ${linha.codigo} v${linha.versao} falhou na verificação de integridade.`,
    );
  }
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    codigo: linha.codigo,
    versao: linha.versao,
    inicioVigencia: linha.inicio_vigencia,
    fimVigencia: linha.fim_vigencia,
    parametros,
    fonteNormativa: linha.fonte_normativa,
    hashConteudo: linha.hash_conteudo,
    publicada: linha.publicada,
    criadaEm: linha.criada_em,
  };
}

export async function carregarRegraFiscalPorCompetencia(
  competencia: string,
  empresaId: string,
) {
  const data = competenciaNormalizada(competencia);
  const resultado = await getPool().query<LinhaRegra>(
    `select id, empresa_id, codigo, versao, inicio_vigencia::text,
            fim_vigencia::text, parametros, fonte_normativa, hash_conteudo,
            publicada, criada_em
       from regra_calculo_versao
      where codigo = $1
        and publicada
        and inicio_vigencia <= $2::date
        and (fim_vigencia is null or fim_vigencia >= $2::date)
        and (empresa_id = $3 or empresa_id is null)
      order by (empresa_id is not null) desc, versao desc
      limit 1`,
    [CODIGO_REGRA_FOLHA_PRESTADOR, data, empresaId],
  );
  if (!resultado.rows[0]) {
    throw new Error(`Nenhuma regra fiscal publicada atende à competência ${data.slice(0, 7)}.`);
  }
  return mapearRegra(resultado.rows[0]);
}

export async function listarRegrasFiscais(empresaId: string) {
  const resultado = await getPool().query<LinhaRegra>(
    `select id, empresa_id, codigo, versao, inicio_vigencia::text,
            fim_vigencia::text, parametros, fonte_normativa, hash_conteudo,
            publicada, criada_em
       from regra_calculo_versao
      where codigo = $1
        and (empresa_id = $2 or empresa_id is null)
      order by inicio_vigencia desc, (empresa_id is not null) desc, versao desc`,
    [CODIGO_REGRA_FOLHA_PRESTADOR, empresaId],
  );
  return resultado.rows.map(mapearRegra);
}
