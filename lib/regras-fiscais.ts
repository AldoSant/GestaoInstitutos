export const CODIGO_REGRA_FOLHA_PRESTADOR = "FOLHA_PRESTADOR";

export type FaixaIrrf = {
  limiteSuperiorCentavos: number | null;
  aliquotaNumerador: number;
  aliquotaDenominador: number;
  parcelaDeduzirCentavos: number;
};

export type RegraFiscalParametros = {
  moeda: "BRL";
  inss: {
    tetoBaseCentavos: number;
    tetoContribuicaoCentavos: number;
    aliquotaNumerador: number;
    aliquotaDenominador: number;
  };
  irrf: {
    descontoSimplificadoCentavos: number;
    deducaoDependenteCentavos: number;
    faixas: FaixaIrrf[];
    reducao: {
      integralAteCentavos: number;
      integralLimiteCentavos: number;
      decrescenteAteCentavos: number;
      constanteCentavos: number;
      coeficienteNumerador: number;
      coeficienteDenominador: number;
    };
  };
};

export const REGRA_FISCAL_2026: RegraFiscalParametros = {
  moeda: "BRL",
  inss: {
    tetoBaseCentavos: 847_555,
    tetoContribuicaoCentavos: 93_231,
    aliquotaNumerador: 11,
    aliquotaDenominador: 100,
  },
  irrf: {
    descontoSimplificadoCentavos: 60_720,
    deducaoDependenteCentavos: 18_959,
    faixas: [
      { limiteSuperiorCentavos: 242_880, aliquotaNumerador: 0, aliquotaDenominador: 1, parcelaDeduzirCentavos: 0 },
      { limiteSuperiorCentavos: 282_665, aliquotaNumerador: 75, aliquotaDenominador: 1_000, parcelaDeduzirCentavos: 18_216 },
      { limiteSuperiorCentavos: 375_105, aliquotaNumerador: 15, aliquotaDenominador: 100, parcelaDeduzirCentavos: 39_416 },
      { limiteSuperiorCentavos: 466_468, aliquotaNumerador: 225, aliquotaDenominador: 1_000, parcelaDeduzirCentavos: 67_549 },
      { limiteSuperiorCentavos: null, aliquotaNumerador: 275, aliquotaDenominador: 1_000, parcelaDeduzirCentavos: 90_873 },
    ],
    reducao: {
      integralAteCentavos: 500_000,
      integralLimiteCentavos: 31_289,
      decrescenteAteCentavos: 735_000,
      constanteCentavos: 97_862,
      coeficienteNumerador: 133_145,
      coeficienteDenominador: 1_000_000,
    },
  },
};

function inteiroNaoNegativo(valor: unknown): valor is number {
  return Number.isSafeInteger(valor) && Number(valor) >= 0;
}

function inteiroPositivo(valor: unknown): valor is number {
  return Number.isSafeInteger(valor) && Number(valor) > 0;
}

export function validarRegraFiscal(value: unknown): RegraFiscalParametros {
  if (!value || typeof value !== "object") {
    throw new Error("Parâmetros fiscais devem ser um objeto.");
  }
  const regra = value as Partial<RegraFiscalParametros>;
  if (regra.moeda !== "BRL" || !regra.inss || !regra.irrf) {
    throw new Error("Parâmetros fiscais incompletos ou em moeda não suportada.");
  }
  if (
    !inteiroNaoNegativo(regra.inss.tetoBaseCentavos) ||
    !inteiroNaoNegativo(regra.inss.tetoContribuicaoCentavos) ||
    !inteiroNaoNegativo(regra.inss.aliquotaNumerador) ||
    !inteiroPositivo(regra.inss.aliquotaDenominador) ||
    regra.inss.aliquotaNumerador > regra.inss.aliquotaDenominador
  ) {
    throw new Error("Parâmetros de INSS inválidos.");
  }

  const { irrf } = regra;
  if (
    !inteiroNaoNegativo(irrf.descontoSimplificadoCentavos) ||
    !inteiroNaoNegativo(irrf.deducaoDependenteCentavos) ||
    !Array.isArray(irrf.faixas) ||
    irrf.faixas.length === 0 ||
    !irrf.reducao
  ) {
    throw new Error("Parâmetros de IRRF incompletos.");
  }

  let limiteAnterior = -1;
  irrf.faixas.forEach((faixa, indice) => {
    const ultima = indice === irrf.faixas.length - 1;
    if (
      !faixa ||
      !inteiroNaoNegativo(faixa.aliquotaNumerador) ||
      !inteiroPositivo(faixa.aliquotaDenominador) ||
      faixa.aliquotaNumerador > faixa.aliquotaDenominador ||
      !inteiroNaoNegativo(faixa.parcelaDeduzirCentavos) ||
      (ultima
        ? faixa.limiteSuperiorCentavos !== null
        : !inteiroNaoNegativo(faixa.limiteSuperiorCentavos))
    ) {
      throw new Error(`Faixa de IRRF ${indice + 1} inválida.`);
    }
    if (
      faixa.limiteSuperiorCentavos !== null &&
      faixa.limiteSuperiorCentavos <= limiteAnterior
    ) {
      throw new Error("As faixas de IRRF devem ter limites crescentes.");
    }
    if (faixa.limiteSuperiorCentavos !== null) {
      limiteAnterior = faixa.limiteSuperiorCentavos;
    }
  });

  const reducao = irrf.reducao;
  if (
    !inteiroNaoNegativo(reducao.integralAteCentavos) ||
    !inteiroNaoNegativo(reducao.integralLimiteCentavos) ||
    !inteiroNaoNegativo(reducao.decrescenteAteCentavos) ||
    reducao.decrescenteAteCentavos < reducao.integralAteCentavos ||
    !inteiroNaoNegativo(reducao.constanteCentavos) ||
    !inteiroNaoNegativo(reducao.coeficienteNumerador) ||
    !inteiroPositivo(reducao.coeficienteDenominador) ||
    reducao.coeficienteNumerador > reducao.coeficienteDenominador
  ) {
    throw new Error("Parâmetros de redução do IRRF inválidos.");
  }
  return regra as RegraFiscalParametros;
}
