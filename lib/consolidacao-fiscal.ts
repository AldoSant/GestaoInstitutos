import { calcularInssPrestador, calcularIrrf2026 } from "./calculos";
import {
  deCentavos,
  decimalParaInteiro,
  paraCentavos,
} from "./dinheiro";
import {
  processarVinculoFolha,
  type EntradaVinculoFolha,
  type LinhaMemoriaFolha,
} from "./processamento-folha";
import { hashJson } from "./json-canonico";
import type { RegraFiscalParametros } from "./regras-fiscais";

type PesoRateio = {
  chave: string;
  peso: number;
};

function inteiroNaoNegativo(valor: number, campo: string) {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new RangeError(`${campo} deve ser um inteiro não negativo.`);
  }
}

export function ratearCentavos(total: number, pesos: PesoRateio[]) {
  inteiroNaoNegativo(total, "Total do rateio");
  const chaves = new Set<string>();
  for (const item of pesos) {
    if (!item.chave.trim() || chaves.has(item.chave)) {
      throw new Error("As chaves do rateio devem ser preenchidas e únicas.");
    }
    chaves.add(item.chave);
    inteiroNaoNegativo(item.peso, `Peso de ${item.chave}`);
  }
  const somaPesosBigInt = pesos.reduce(
    (soma, item) => soma + BigInt(item.peso),
    0n,
  );
  if (somaPesosBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("A soma dos pesos excede o limite numérico seguro.");
  }
  const somaPesos = Number(somaPesosBigInt);
  if (total > 0 && somaPesos === 0) {
    throw new Error("Não é possível distribuir um valor positivo sem base.");
  }
  if (pesos.length === 0) {
    if (total > 0) throw new Error("O rateio exige ao menos uma fonte.");
    return new Map<string, number>();
  }

  const denominador = BigInt(somaPesos || 1);
  const parcelas = pesos.map((item) => {
    const produto = BigInt(total) * BigInt(item.peso);
    return {
      chave: item.chave,
      valor: Number(produto / denominador),
      resto: produto % denominador,
    };
  });
  let residuo =
    total - parcelas.reduce((soma, parcela) => soma + parcela.valor, 0);
  const prioridade = [...parcelas].sort(
    (a, b) =>
      (a.resto === b.resto ? 0 : a.resto > b.resto ? -1 : 1) ||
      a.chave.localeCompare(b.chave),
  );
  for (let indice = 0; residuo > 0; indice += 1, residuo -= 1) {
    prioridade[indice % prioridade.length].valor += 1;
  }
  return new Map(parcelas.map((parcela) => [parcela.chave, parcela.valor]));
}

function hashOutrasFontes(fonte: EntradaVinculoFolha) {
  return hashJson(
    [...fonte.outrasFontes].sort(
      (a, b) =>
        a.documentoFonte.localeCompare(b.documentoFonte) ||
        a.documentoReferencia.localeCompare(b.documentoReferencia) ||
        a.fontePagadora.localeCompare(b.fontePagadora),
    ),
  );
}

function totaisIrrfOutrasFontes(fonte: EntradaVinculoFolha) {
  return fonte.outrasFontes.reduce(
    (totais, outra) => ({
      rendimentos:
        totais.rendimentos + decimalParaInteiro(outra.remuneracao ?? "0", 2),
      inssDedutivel:
        totais.inssDedutivel +
        decimalParaInteiro(outra.inssDedutivelIrrf ?? "0", 2),
      irrfRetido:
        totais.irrfRetido + decimalParaInteiro(outra.irrfRetido ?? "0", 2),
    }),
    { rendimentos: 0, inssDedutivel: 0, irrfRetido: 0 },
  );
}

function exigirMesmoContexto(fontes: EntradaVinculoFolha[]) {
  const primeira = fontes[0];
  const ids = new Set<string>();
  const baseOutrasFontes = decimalParaInteiro(
    primeira.baseOutrasFontes,
    2,
  );
  const comprovantesOutrasFontes = hashOutrasFontes(primeira);
  for (const fonte of fontes) {
    if (!fonte.vinculoId.trim() || ids.has(fonte.vinculoId)) {
      throw new Error("Cada fonte consolidada deve possuir um Vínculo único.");
    }
    ids.add(fonte.vinculoId);
    if (fonte.tipoPessoa !== primeira.tipoPessoa) {
      throw new Error("As fontes da mesma pessoa possuem naturezas incompatíveis.");
    }
    if (fonte.categoriaContribuinte !== primeira.categoriaContribuinte) {
      throw new Error(
        "As fontes da mesma pessoa possuem categorias previdenciárias diferentes.",
      );
    }
    if (fonte.dependentesIrrf !== primeira.dependentesIrrf) {
      throw new Error(
        "A quantidade de dependentes deve ser única por pessoa e competência.",
      );
    }
    if (
      fonte.enquadramentoPrevidenciario.id !==
        primeira.enquadramentoPrevidenciario.id ||
      fonte.enquadramentoPrevidenciario.aliquotaSeguradoNumerador !==
        primeira.enquadramentoPrevidenciario.aliquotaSeguradoNumerador ||
      fonte.enquadramentoPrevidenciario.aliquotaSeguradoDenominador !==
        primeira.enquadramentoPrevidenciario.aliquotaSeguradoDenominador
    ) {
      throw new Error(
        "Todas as fontes devem usar o mesmo enquadramento previdenciário.",
      );
    }
    if (
      decimalParaInteiro(fonte.baseOutrasFontes, 2) !== baseOutrasFontes
    ) {
      throw new Error(
        "A base de outras fontes deve ser informada uma única vez e repetida sem divergência.",
      );
    }
    if (hashOutrasFontes(fonte) !== comprovantesOutrasFontes) {
      throw new Error(
        "Os comprovantes de outras fontes devem ser idênticos em todas as fontes consolidadas.",
      );
    }
  }
  return {
    primeira,
    baseOutrasFontes,
    irrfOutrasFontes: totaisIrrfOutrasFontes(primeira),
  };
}

function exigirSomaRateio(
  campo: string,
  esperado: number,
  valores: number[],
) {
  const apurado = valores.reduce((soma, valor) => soma + valor, 0);
  if (apurado !== esperado) {
    throw new Error(
      `Falha interna no rateio de ${campo}: esperado ${esperado}, apurado ${apurado}.`,
    );
  }
}

function linhaSistema(
  codigo: "INSS" | "IRRF",
  baseCentavos: number,
  valorCentavos: number,
  referencia: string,
): LinhaMemoriaFolha {
  return {
    eventoId: null,
    codigo,
    descricao:
      codigo === "INSS"
        ? "Retenção previdenciária consolidada da pessoa"
        : "IRRF consolidado da pessoa",
    natureza: "DESCONTO",
    origem: "SISTEMA",
    tipoCalculo: "PERCENTUAL",
    referencia,
    baseCalculoCentavos: baseCentavos,
    valorCentavos,
    incideInss: false,
    incideIrrf: false,
  };
}

export function processarPessoaConsolidada(
  fontesRecebidas: EntradaVinculoFolha[],
  regra: RegraFiscalParametros,
) {
  if (fontesRecebidas.length === 0) {
    throw new Error("A consolidação fiscal exige ao menos uma fonte.");
  }
  const fontes = [...fontesRecebidas].sort((a, b) =>
    a.vinculoId.localeCompare(b.vinculoId),
  );
  const { primeira, baseOutrasFontes, irrfOutrasFontes } = exigirMesmoContexto(fontes);
  const preliminares = fontes.map((entrada) => {
    const individual = processarVinculoFolha(entrada, regra);
    const linhas = individual.linhas.filter(
      (linha) => linha.codigo !== "INSS" && linha.codigo !== "IRRF",
    );
    const descontosEventosCentavos = linhas
      .filter((linha) => linha.natureza === "DESCONTO")
      .reduce((soma, linha) => soma + linha.valorCentavos, 0);
    return {
      entrada,
      linhas,
      totalProventosCentavos: individual.totalProventosCentavos,
      descontosEventosCentavos,
      baseInssBrutaCentavos: individual.memoria.baseInssBrutaCentavos,
      baseIrrfBrutaCentavos: individual.memoria.irrf.baseBrutaCentavos,
      memoriaIndividual: individual.memoria,
    };
  });

  const fontesInss = preliminares.filter(
    ({ entrada }) => entrada.descontaInss && !entrada.isentoInss,
  );
  const baseInssBrutaCentavos = fontesInss.reduce(
    (soma, fonte) => soma + fonte.baseInssBrutaCentavos,
    0,
  );
  const inss =
    fontesInss.length > 0
      ? calcularInssPrestador(
          deCentavos(baseInssBrutaCentavos),
          deCentavos(baseOutrasFontes),
          regra,
          {
            numerador:
              primeira.enquadramentoPrevidenciario
                .aliquotaSeguradoNumerador,
            denominador:
              primeira.enquadramentoPrevidenciario
                .aliquotaSeguradoDenominador,
          },
        )
      : {
          base: 0,
          aliquota:
            primeira.enquadramentoPrevidenciario
              .aliquotaSeguradoNumerador /
            primeira.enquadramentoPrevidenciario
              .aliquotaSeguradoDenominador,
          valor: 0,
          tetoAtingido: false,
        };
  const baseInssCentavos = paraCentavos(inss.base);
  const valorInssCentavos = paraCentavos(inss.valor);
  const pesosInss = preliminares.map((fonte) => ({
    chave: fonte.entrada.vinculoId,
    peso:
      fonte.entrada.descontaInss && !fonte.entrada.isentoInss
        ? fonte.baseInssBrutaCentavos
        : 0,
  }));
  const basesInssRateadas = ratearCentavos(baseInssCentavos, pesosInss);
  const valoresInssRateados = ratearCentavos(valorInssCentavos, pesosInss);

  const fontesIrrf = preliminares.filter(
    ({ entrada }) => entrada.descontaIrrf,
  );
  const rendimentosIrrfInternosCentavos = fontesIrrf.reduce(
    (soma, fonte) => soma + fonte.baseIrrfBrutaCentavos,
    0,
  );
  const rendimentosIrrfCentavos =
    rendimentosIrrfInternosCentavos + irrfOutrasFontes.rendimentos;
  const irrf =
    fontesIrrf.length > 0
      ? calcularIrrf2026({
          rendimentos: deCentavos(rendimentosIrrfCentavos),
          inssDedutivel: deCentavos(
            valorInssCentavos + irrfOutrasFontes.inssDedutivel,
          ),
          dependentes: primeira.dependentesIrrf,
          regra,
        })
      : {
          rendimentos: 0,
          metodoDeducao: "LEGAL" as const,
          deducaoUtilizada: 0,
          base: 0,
          impostoBruto: 0,
          reducao: 0,
          valor: 0,
        };
  const pesosIrrf = preliminares.map((fonte) => ({
    chave: fonte.entrada.vinculoId,
    peso: fonte.entrada.descontaIrrf
      ? fonte.baseIrrfBrutaCentavos
      : 0,
  }));
  const basesIrrfRateadas = ratearCentavos(
    paraCentavos(irrf.base),
    pesosIrrf,
  );
  const brutosIrrfRateados = ratearCentavos(
    paraCentavos(irrf.impostoBruto),
    pesosIrrf,
  );
  const reducoesIrrfRateadas = ratearCentavos(
    paraCentavos(irrf.reducao),
    pesosIrrf,
  );
  const valorIrrfInstitutoCentavos = Math.max(
    0,
    paraCentavos(irrf.valor) - irrfOutrasFontes.irrfRetido,
  );
  const valoresIrrfRateados = ratearCentavos(
    valorIrrfInstitutoCentavos,
    pesosIrrf,
  );

  const fontesCalculadas = preliminares.map((fonte) => {
    const chave = fonte.entrada.vinculoId;
    const baseInss = basesInssRateadas.get(chave) ?? 0;
    const valorInss = valoresInssRateados.get(chave) ?? 0;
    const baseIrrf = basesIrrfRateadas.get(chave) ?? 0;
    const irrfBruto = brutosIrrfRateados.get(chave) ?? 0;
    const irrfReducao = reducoesIrrfRateadas.get(chave) ?? 0;
    const valorIrrf = valoresIrrfRateados.get(chave) ?? 0;
    const totalDescontos =
      fonte.descontosEventosCentavos + valorInss + valorIrrf;
    return {
      vinculoId: chave,
      totalProventosCentavos: fonte.totalProventosCentavos,
      descontosEventosCentavos: fonte.descontosEventosCentavos,
      totalDescontosCentavos: totalDescontos,
      totalLiquidoCentavos:
        fonte.totalProventosCentavos - totalDescontos,
      baseInssBrutaCentavos: fonte.baseInssBrutaCentavos,
      baseInssCentavos: baseInss,
      valorInssCentavos: valorInss,
      baseIrrfBrutaCentavos: fonte.baseIrrfBrutaCentavos,
      baseIrrfCentavos: baseIrrf,
      irrfBrutoCentavos: irrfBruto,
      irrfReducaoCentavos: irrfReducao,
      valorIrrfCentavos: valorIrrf,
      linhas: [
        ...fonte.linhas,
        linhaSistema(
          "INSS",
          baseInss,
          valorInss,
          String(inss.aliquota * 100),
        ),
        linhaSistema("IRRF", baseIrrf, valorIrrf, "TABELA_PROGRESSIVA"),
      ],
      memoriaIndividual: fonte.memoriaIndividual,
    };
  });

  const totalProventosCentavos = fontesCalculadas.reduce(
    (soma, fonte) => soma + fonte.totalProventosCentavos,
    0,
  );
  const totalDescontosCentavos = fontesCalculadas.reduce(
    (soma, fonte) => soma + fonte.totalDescontosCentavos,
    0,
  );
  exigirSomaRateio(
    "baseInssCentavos",
    baseInssCentavos,
    fontesCalculadas.map((fonte) => fonte.baseInssCentavos),
  );
  exigirSomaRateio(
    "valorInssCentavos",
    valorInssCentavos,
    fontesCalculadas.map((fonte) => fonte.valorInssCentavos),
  );
  exigirSomaRateio(
    "baseIrrfCentavos",
    paraCentavos(irrf.base),
    fontesCalculadas.map((fonte) => fonte.baseIrrfCentavos),
  );
  exigirSomaRateio(
    "irrfBrutoCentavos",
    paraCentavos(irrf.impostoBruto),
    fontesCalculadas.map((fonte) => fonte.irrfBrutoCentavos),
  );
  exigirSomaRateio(
    "irrfReducaoCentavos",
    paraCentavos(irrf.reducao),
    fontesCalculadas.map((fonte) => fonte.irrfReducaoCentavos),
  );
  exigirSomaRateio(
    "valorIrrfCentavos",
    valorIrrfInstitutoCentavos,
    fontesCalculadas.map((fonte) => fonte.valorIrrfCentavos),
  );
  return {
    fontes: fontesCalculadas,
    totalProventosCentavos,
    totalDescontosCentavos,
    totalLiquidoCentavos:
      totalProventosCentavos - totalDescontosCentavos,
    baseInssBrutaCentavos,
    baseInssCentavos,
    valorInssCentavos,
    rendimentosIrrfCentavos,
    baseIrrfCentavos: paraCentavos(irrf.base),
    irrfBrutoCentavos: paraCentavos(irrf.impostoBruto),
    irrfReducaoCentavos: paraCentavos(irrf.reducao),
    valorIrrfCentavos: valorIrrfInstitutoCentavos,
    memoria: {
      versao: 1,
      modo: "SIMULACAO_NAO_HOMOLOGADA" as const,
      hipoteseRateio: "PROPORCIONAL_MAIOR_RESTO" as const,
      alerta:
        "O rateio proporcional é hipótese técnica e não pode alimentar Folha antes da homologação.",
      quantidadeFontes: fontesCalculadas.length,
      dependentesIrrf: primeira.dependentesIrrf,
      outrasFontes: {
        baseContribuidaCentavos: baseOutrasFontes,
        rendimentosTributaveisCentavos: irrfOutrasFontes.rendimentos,
        inssDedutivelIrrfCentavos: irrfOutrasFontes.inssDedutivel,
        irrfRetidoCentavos: irrfOutrasFontes.irrfRetido,
        comprovantes: primeira.outrasFontes,
      },
      previdencia: primeira.enquadramentoPrevidenciario,
      inss: {
        baseBrutaCentavos: baseInssBrutaCentavos,
        baseLimitadaCentavos: baseInssCentavos,
        valorCentavos: valorInssCentavos,
        tetoAtingido: inss.tetoAtingido,
      },
      irrf: {
        rendimentosCentavos: rendimentosIrrfCentavos,
        rendimentosInstitutoCentavos: rendimentosIrrfInternosCentavos,
        metodoDeducao: irrf.metodoDeducao,
        deducaoUtilizadaCentavos: paraCentavos(irrf.deducaoUtilizada),
        baseCentavos: paraCentavos(irrf.base),
        impostoBrutoCentavos: paraCentavos(irrf.impostoBruto),
        reducaoCentavos: paraCentavos(irrf.reducao),
        valorCentavos: valorIrrfInstitutoCentavos,
        irrfRetidoEmOutraFonteCentavos: irrfOutrasFontes.irrfRetido,
      },
      rateios: fontesCalculadas.map((fonte) => ({
        vinculoId: fonte.vinculoId,
        baseInssCentavos: fonte.baseInssCentavos,
        valorInssCentavos: fonte.valorInssCentavos,
        baseIrrfCentavos: fonte.baseIrrfCentavos,
        valorIrrfCentavos: fonte.valorIrrfCentavos,
      })),
    },
  };
}
