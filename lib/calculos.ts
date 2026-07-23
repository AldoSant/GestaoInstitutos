import {
  aplicarFormulaLinear,
  aplicarProporcao,
  deCentavos,
  paraCentavos,
} from "./dinheiro";
import {
  REGRA_FISCAL_2026,
  type RegraFiscalParametros,
} from "./regras-fiscais";

export const PARAMETROS_2026 = {
  tetoBaseInss: deCentavos(REGRA_FISCAL_2026.inss.tetoBaseCentavos),
  tetoContribuicaoInss: deCentavos(
    REGRA_FISCAL_2026.inss.tetoContribuicaoCentavos,
  ),
  aliquotaInssPrestador:
    REGRA_FISCAL_2026.inss.aliquotaNumerador /
    REGRA_FISCAL_2026.inss.aliquotaDenominador,
  descontoSimplificadoIrrf: deCentavos(
    REGRA_FISCAL_2026.irrf.descontoSimplificadoCentavos,
  ),
  deducaoDependenteIrrf: deCentavos(
    REGRA_FISCAL_2026.irrf.deducaoDependenteCentavos,
  ),
} as const;

export type ResultadoInss = {
  base: number;
  aliquota: number;
  valor: number;
  tetoAtingido: boolean;
};

export type ResultadoIrrf = {
  rendimentos: number;
  metodoDeducao: "LEGAL" | "SIMPLIFICADA";
  deducaoUtilizada: number;
  base: number;
  impostoBruto: number;
  reducao: number;
  valor: number;
};

function exigirNumeroNaoNegativo(valor: number, campo: string) {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(`${campo} deve ser um número finito e não negativo.`);
  }
}

export function arredondarMoeda(valor: number) {
  return deCentavos(paraCentavos(valor));
}

export function calcularInssPrestador(
  baseTributavel: number,
  baseContribuidaEmOutrasFontes = 0,
  regra: RegraFiscalParametros = REGRA_FISCAL_2026,
): ResultadoInss {
  exigirNumeroNaoNegativo(baseTributavel, "baseTributavel");
  exigirNumeroNaoNegativo(
    baseContribuidaEmOutrasFontes,
    "baseContribuidaEmOutrasFontes",
  );
  const baseTributavelCentavos = paraCentavos(baseTributavel);
  const baseOutrasFontesCentavos = paraCentavos(
    baseContribuidaEmOutrasFontes,
  );
  const tetoBaseCentavos = regra.inss.tetoBaseCentavos;
  const tetoContribuicaoCentavos = regra.inss.tetoContribuicaoCentavos;
  const baseResidualCentavos = Math.max(
    0,
    tetoBaseCentavos - baseOutrasFontesCentavos,
  );
  const baseCentavos = Math.min(
    baseTributavelCentavos,
    baseResidualCentavos,
  );
  const valorCentavos = Math.min(
    aplicarProporcao(
      baseCentavos,
      regra.inss.aliquotaNumerador,
      regra.inss.aliquotaDenominador,
    ),
    tetoContribuicaoCentavos,
  );
  const base = deCentavos(baseCentavos);
  const valor = deCentavos(valorCentavos);

  return {
    base,
    aliquota:
      regra.inss.aliquotaNumerador / regra.inss.aliquotaDenominador,
    valor,
    tetoAtingido:
      baseResidualCentavos === 0 || baseCentavos === baseResidualCentavos,
  };
}

function calcularIrrfBrutoCentavos(
  base: number,
  regra: RegraFiscalParametros,
) {
  const faixa = regra.irrf.faixas.find(
    (item) =>
      item.limiteSuperiorCentavos === null ||
      base <= item.limiteSuperiorCentavos,
  );
  if (!faixa) throw new Error("A regra fiscal não possui faixa final de IRRF.");
  return aplicarFormulaLinear({
    valor: base,
    numerador: faixa.aliquotaNumerador,
    denominador: faixa.aliquotaDenominador,
    parcela: faixa.parcelaDeduzirCentavos,
  });
}

export function calcularIrrf2026({
  rendimentos,
  inssDedutivel,
  dependentes = 0,
  outrasDeducoes = 0,
  regra = REGRA_FISCAL_2026,
}: {
  rendimentos: number;
  inssDedutivel: number;
  dependentes?: number;
  outrasDeducoes?: number;
  regra?: RegraFiscalParametros;
}): ResultadoIrrf {
  exigirNumeroNaoNegativo(rendimentos, "rendimentos");
  exigirNumeroNaoNegativo(inssDedutivel, "inssDedutivel");
  exigirNumeroNaoNegativo(outrasDeducoes, "outrasDeducoes");
  if (!Number.isInteger(dependentes) || dependentes < 0) {
    throw new RangeError("dependentes deve ser um inteiro não negativo.");
  }

  const rendimentosCentavos = paraCentavos(rendimentos);
  const deducaoLegalCentavos =
    paraCentavos(inssDedutivel) +
    dependentes * regra.irrf.deducaoDependenteCentavos +
    paraCentavos(outrasDeducoes);
  const descontoSimplificadoCentavos =
    regra.irrf.descontoSimplificadoCentavos;
  const usarSimplificada =
    descontoSimplificadoCentavos > deducaoLegalCentavos;
  const deducaoUtilizadaCentavos = usarSimplificada
    ? descontoSimplificadoCentavos
    : deducaoLegalCentavos;
  const baseCentavos = Math.max(
    0,
    rendimentosCentavos - deducaoUtilizadaCentavos,
  );
  const impostoBrutoCentavos = calcularIrrfBrutoCentavos(
    baseCentavos,
    regra,
  );

  let reducaoCentavos = 0;
  const reducao = regra.irrf.reducao;
  if (rendimentosCentavos <= reducao.integralAteCentavos) {
    reducaoCentavos = Math.min(
      impostoBrutoCentavos,
      reducao.integralLimiteCentavos,
    );
  } else if (rendimentosCentavos <= reducao.decrescenteAteCentavos) {
    reducaoCentavos = Math.min(
      impostoBrutoCentavos,
      Math.max(
        0,
        aplicarFormulaLinear({
          valor: rendimentosCentavos,
          numerador: -reducao.coeficienteNumerador,
          denominador: reducao.coeficienteDenominador,
          parcela: -reducao.constanteCentavos,
        }),
      ),
    );
  }

  const rendimentosNormalizados = deCentavos(rendimentosCentavos);
  const deducaoUtilizada = deCentavos(deducaoUtilizadaCentavos);
  const base = deCentavos(baseCentavos);
  const impostoBruto = deCentavos(impostoBrutoCentavos);
  const reducaoCalculada = deCentavos(reducaoCentavos);

  return {
    rendimentos: rendimentosNormalizados,
    metodoDeducao: usarSimplificada ? "SIMPLIFICADA" : "LEGAL",
    deducaoUtilizada,
    base,
    impostoBruto,
    reducao: reducaoCalculada,
    valor: deCentavos(
      Math.max(0, impostoBrutoCentavos - reducaoCentavos),
    ),
  };
}

export function analisarConciliacaoPrevidenciaria(
  inssFolha: number,
  totalObrigacao: number,
) {
  exigirNumeroNaoNegativo(inssFolha, "inssFolha");
  exigirNumeroNaoNegativo(totalObrigacao, "totalObrigacao");
  const diferenca = arredondarMoeda(totalObrigacao - inssFolha);
  const razao = inssFolha === 0 ? null : totalObrigacao / inssFolha;
  const duplicacaoExata =
    razao !== null && Math.abs(razao - 2) < 0.000_001;

  return {
    diferenca,
    razao: razao === null ? null : arredondarMoeda(razao),
    duplicacaoExata,
    conciliado: Math.abs(diferenca) < 0.01,
  };
}
