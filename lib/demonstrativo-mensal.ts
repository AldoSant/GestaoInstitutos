export const NATUREZAS_OPERACIONAIS = [
  "PAGAMENTO_PRESTADOR",
  "RETENCAO_TRIBUTARIA",
  "GUIA_RECOLHIMENTO",
] as const;

export type NaturezaOperacional = (typeof NATUREZAS_OPERACIONAIS)[number];
export type TipoPessoaDemonstrativo = "FISICA" | "JURIDICA";
export type OrigemPagamento =
  | "FOLHA_PF"
  | "NOTA_FISCAL_PJ"
  | "IMPORTACAO_GIW"
  | "MANUAL";
export type OrigemRetencao =
  | "CALCULO_FOLHA_PF"
  | "DOCUMENTO_FISCAL"
  | "IMPORTACAO_GIW"
  | "MATRIZ_FISCAL";

export interface RetencaoDemonstrativo {
  tributo: "INSS" | "IRRF" | "ISS" | "PIS" | "COFINS" | "CSLL" | "OUTRO";
  valorCentavos: number;
  origem: OrigemRetencao;
  regraCalculoId?: string | null;
  evidencia?: string | null;
}

export interface PagamentoDemonstrativo {
  tipoPessoa: TipoPessoaDemonstrativo;
  origem: OrigemPagamento;
  valorBrutoCentavos: number;
  valorLiquidoCentavos: number;
  retencoes: readonly RetencaoDemonstrativo[];
}

function exigirCentavos(valor: number, campo: string) {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new Error(`${campo} deve ser um inteiro não negativo em centavos.`);
  }
}

export function totalizarRetencoes(
  retencoes: readonly RetencaoDemonstrativo[],
) {
  return retencoes.reduce((total, retencao, indice) => {
    exigirCentavos(retencao.valorCentavos, `Retenção ${indice + 1}`);
    return total + retencao.valorCentavos;
  }, 0);
}

export function validarPagamentoDemonstrativo(
  pagamento: PagamentoDemonstrativo,
) {
  exigirCentavos(pagamento.valorBrutoCentavos, "Valor bruto");
  exigirCentavos(pagamento.valorLiquidoCentavos, "Valor líquido");

  if (
    pagamento.tipoPessoa === "FISICA" &&
    pagamento.origem === "NOTA_FISCAL_PJ"
  ) {
    throw new Error("Pagamento de pessoa física não pode ter origem em nota fiscal PJ.");
  }
  if (
    pagamento.tipoPessoa === "JURIDICA" &&
    pagamento.origem === "FOLHA_PF"
  ) {
    throw new Error("Pagamento de pessoa jurídica não pode ter origem na folha PF.");
  }

  for (const retencao of pagamento.retencoes) {
    if (
      pagamento.tipoPessoa === "JURIDICA" &&
      retencao.origem === "MATRIZ_FISCAL" &&
      (!retencao.regraCalculoId || !retencao.evidencia?.trim())
    ) {
      throw new Error(
        "Retenção automática de PJ exige regra fiscal versionada e evidência.",
      );
    }
  }

  const totalRetencoesCentavos = totalizarRetencoes(pagamento.retencoes);
  if (
    pagamento.valorLiquidoCentavos !==
    pagamento.valorBrutoCentavos - totalRetencoesCentavos
  ) {
    throw new Error("Valor líquido diverge do bruto menos as retenções.");
  }

  return {
    valorBrutoCentavos: pagamento.valorBrutoCentavos,
    totalRetencoesCentavos,
    valorLiquidoCentavos: pagamento.valorLiquidoCentavos,
  };
}

export function validarClassificacaoLegado(entrada: {
  natureza: NaturezaOperacional;
  status: "PENDENTE" | "CONFIRMADA" | "REJEITADA";
  responsavel?: string | null;
  evidencia?: string | null;
}) {
  if (
    entrada.status !== "PENDENTE" &&
    (!entrada.responsavel?.trim() || !entrada.evidencia?.trim())
  ) {
    throw new Error(
      "Classificação decidida exige responsável e evidência rastreável.",
    );
  }
  return entrada;
}
