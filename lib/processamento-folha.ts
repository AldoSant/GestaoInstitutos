import {
  calcularInssPrestador,
  calcularIrrf2026,
} from "./calculos";
import {
  aplicarProporcao,
  deCentavos,
  decimalParaInteiro,
  paraCentavos,
} from "./dinheiro";
import type { RegraFiscalParametros } from "./regras-fiscais";
import { resolverEnquadramentoPrestador } from "./inteligencia-contabil";
import type { RegimePrevidenciario } from "./enquadramento-previdenciario";

export type EventoCompetencia = {
  id: string;
  codigo: string;
  descricao: string;
  natureza: "PROVENTO" | "DESCONTO" | "INFORMATIVO";
  tipoCalculo: "VALOR" | "PERCENTUAL";
  valor: string;
  incideInss: boolean;
  incideIrrf: boolean;
};

export type EntradaVinculoFolha = {
  vinculoId: string;
  tipoPessoa: "FISICA" | "JURIDICA";
  categoriaContribuinte: string | null;
  valorRetribuicao: string;
  medicao?: {
    id: string;
    tipo: "PERCENTUAL" | "QUANTIDADE" | "VALOR";
    valorContratual: string;
    percentual: string | null;
    quantidade: string | null;
    valorUnitario: string | null;
    valorApurado: string;
    evidenciaReferencia: string;
    evidenciaHash: string | null;
    conferente: string;
    conferidaEm: string;
  } | null;
  descontaInss: boolean;
  descontaIrrf: boolean;
  isentoInss: boolean;
  baseOutrasFontes: string;
  outrasFontes: Array<{
    fontePagadora: string;
    documentoFonte: string;
    baseContribuicao: string;
    valorContribuicao: string;
    documentoReferencia: string;
  }>;
  enquadramentoPrevidenciario: {
    id: string;
    regime: RegimePrevidenciario;
    aliquotaSeguradoNumerador: number;
    aliquotaSeguradoDenominador: number;
    aliquotaPatronalNumerador: number;
    aliquotaPatronalDenominador: number;
    fonteNormativa: string;
  };
  dependentesIrrf: number;
  eventos: EventoCompetencia[];
};

export type LinhaMemoriaFolha = {
  eventoId: string | null;
  codigo: string;
  descricao: string;
  natureza: "PROVENTO" | "DESCONTO" | "INFORMATIVO";
  origem: "CONTRATUAL" | "RECORRENTE" | "SISTEMA";
  tipoCalculo: "VALOR" | "PERCENTUAL";
  referencia: string;
  baseCalculoCentavos: number;
  valorCentavos: number;
  incideInss: boolean;
  incideIrrf: boolean;
};

function calcularValorEvento(
  evento: EventoCompetencia,
  retribuicaoCentavos: number,
) {
  if (evento.tipoCalculo === "VALOR") {
    const valor = decimalParaInteiro(evento.valor, 2);
    if (valor < 0) throw new Error(`O Evento ${evento.codigo} possui valor negativo.`);
    return { baseCalculoCentavos: 0, valorCentavos: valor };
  }

  const percentualEscalaQuatro = decimalParaInteiro(evento.valor, 4);
  if (percentualEscalaQuatro < 0 || percentualEscalaQuatro > 1_000_000) {
    throw new Error(`O percentual do Evento ${evento.codigo} deve estar entre 0% e 100%.`);
  }
  return {
    baseCalculoCentavos: retribuicaoCentavos,
    valorCentavos: aplicarProporcao(
      retribuicaoCentavos,
      percentualEscalaQuatro,
      1_000_000,
    ),
  };
}

function efeitoIncidencia(linha: LinhaMemoriaFolha) {
  if (linha.natureza === "PROVENTO") return linha.valorCentavos;
  if (linha.natureza === "DESCONTO") return -linha.valorCentavos;
  return 0;
}

export function processarVinculoFolha(
  entrada: EntradaVinculoFolha,
  regra: RegraFiscalParametros,
) {
  const enquadramento = resolverEnquadramentoPrestador({
    tipoPessoa: entrada.tipoPessoa,
    categoriaContribuinte: entrada.categoriaContribuinte,
  });
  if (!enquadramento.suportado) {
    throw new Error(
      `${enquadramento.motivo} Dados necessários: ${enquadramento.dadosNecessarios.join(", ")}.`,
    );
  }
  if (!Number.isSafeInteger(entrada.dependentesIrrf) || entrada.dependentesIrrf < 0) {
    throw new Error("A quantidade de dependentes para IRRF é inválida.");
  }
  const retribuicaoCentavos = decimalParaInteiro(entrada.valorRetribuicao, 2);
  if (retribuicaoCentavos < 0) {
    throw new Error("A retribuição contratual não pode ser negativa.");
  }

  const linhas: LinhaMemoriaFolha[] = [
    {
      eventoId: null,
      codigo: "RETRIBUICAO",
      descricao: entrada.medicao
        ? "Retribuição apurada pela medição mensal"
        : "Retribuição contratual da competência",
      natureza: "PROVENTO",
      origem: "CONTRATUAL",
      tipoCalculo: "VALOR",
      referencia: entrada.valorRetribuicao,
      baseCalculoCentavos: 0,
      valorCentavos: retribuicaoCentavos,
      incideInss: entrada.descontaInss,
      incideIrrf: entrada.descontaIrrf,
    },
  ];

  for (const evento of [...entrada.eventos].sort((a, b) =>
    a.codigo.localeCompare(b.codigo, "pt-BR"),
  )) {
    const calculado = calcularValorEvento(evento, retribuicaoCentavos);
    linhas.push({
      eventoId: evento.id,
      codigo: evento.codigo,
      descricao: evento.descricao,
      natureza: evento.natureza,
      origem: "RECORRENTE",
      tipoCalculo: evento.tipoCalculo,
      referencia: evento.valor,
      ...calculado,
      incideInss: evento.incideInss,
      incideIrrf: evento.incideIrrf,
    });
  }

  const totalProventosCentavos = linhas
    .filter((linha) => linha.natureza === "PROVENTO")
    .reduce((total, linha) => total + linha.valorCentavos, 0);
  const descontosEventosCentavos = linhas
    .filter((linha) => linha.natureza === "DESCONTO")
    .reduce((total, linha) => total + linha.valorCentavos, 0);
  const baseInssBrutaCentavos = Math.max(
    0,
    linhas
      .filter((linha) => linha.incideInss)
      .reduce((total, linha) => total + efeitoIncidencia(linha), 0),
  );
  const baseIrrfBrutaCentavos = Math.max(
    0,
    linhas
      .filter((linha) => linha.incideIrrf)
      .reduce((total, linha) => total + efeitoIncidencia(linha), 0),
  );
  const baseOutrasFontesCentavos = decimalParaInteiro(
    entrada.baseOutrasFontes,
    2,
  );
  if (baseOutrasFontesCentavos < 0) {
    throw new Error("A base contribuída em outras fontes não pode ser negativa.");
  }

  const inss =
    entrada.descontaInss && !entrada.isentoInss
      ? calcularInssPrestador(
          deCentavos(baseInssBrutaCentavos),
          deCentavos(baseOutrasFontesCentavos),
          regra,
          {
            numerador:
              entrada.enquadramentoPrevidenciario.aliquotaSeguradoNumerador,
            denominador:
              entrada.enquadramentoPrevidenciario.aliquotaSeguradoDenominador,
          },
        )
      : {
          base: 0,
          aliquota:
            entrada.enquadramentoPrevidenciario.aliquotaSeguradoNumerador /
            entrada.enquadramentoPrevidenciario.aliquotaSeguradoDenominador,
          valor: 0,
          tetoAtingido: false,
        };
  const valorInssCentavos = paraCentavos(inss.valor);
  const baseInssCentavos = paraCentavos(inss.base);
  const irrf =
    entrada.descontaIrrf
      ? calcularIrrf2026({
          rendimentos: deCentavos(baseIrrfBrutaCentavos),
          inssDedutivel: deCentavos(valorInssCentavos),
          dependentes: entrada.dependentesIrrf,
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
  const valorIrrfCentavos = paraCentavos(irrf.valor);

  linhas.push(
    {
      eventoId: null,
      codigo: "INSS",
      descricao: "Retenção previdenciária do segurado",
      natureza: "DESCONTO",
      origem: "SISTEMA",
      tipoCalculo: "PERCENTUAL",
      referencia: String(inss.aliquota * 100),
      baseCalculoCentavos: baseInssCentavos,
      valorCentavos: valorInssCentavos,
      incideInss: false,
      incideIrrf: false,
    },
    {
      eventoId: null,
      codigo: "IRRF",
      descricao: "Imposto de renda retido na fonte",
      natureza: "DESCONTO",
      origem: "SISTEMA",
      tipoCalculo: "PERCENTUAL",
      referencia: "TABELA_PROGRESSIVA",
      baseCalculoCentavos: paraCentavos(irrf.base),
      valorCentavos: valorIrrfCentavos,
      incideInss: false,
      incideIrrf: false,
    },
  );

  const totalDescontosCentavos =
    descontosEventosCentavos + valorInssCentavos + valorIrrfCentavos;
  return {
    vinculoId: entrada.vinculoId,
    totalProventosCentavos,
    totalDescontosCentavos,
    totalLiquidoCentavos: totalProventosCentavos - totalDescontosCentavos,
    baseInssCentavos,
    valorInssCentavos,
    baseIrrfCentavos: paraCentavos(irrf.base),
    irrfBrutoCentavos: paraCentavos(irrf.impostoBruto),
    irrfReducaoCentavos: paraCentavos(irrf.reducao),
    valorIrrfCentavos,
    linhas,
    memoria: {
      versao: 1,
      moeda: regra.moeda,
      retribuicaoCentavos,
      retribuicao: entrada.medicao
        ? { origem: "MEDICAO_MENSAL", ...entrada.medicao }
        : {
            origem: "CONTRATUAL",
            valorContratual: entrada.valorRetribuicao,
          },
      baseInssBrutaCentavos,
      baseInssLimitadaCentavos: baseInssCentavos,
      outrasFontes: {
        baseContribuidaCentavos: baseOutrasFontesCentavos,
        comprovantes: entrada.outrasFontes,
      },
      previdencia: entrada.enquadramentoPrevidenciario,
      inss: {
        aliquotaNumerador:
          entrada.enquadramentoPrevidenciario.aliquotaSeguradoNumerador,
        aliquotaDenominador:
          entrada.enquadramentoPrevidenciario.aliquotaSeguradoDenominador,
        valorCentavos: valorInssCentavos,
        tetoAtingido: inss.tetoAtingido,
        isento: entrada.isentoInss || !entrada.descontaInss,
      },
      irrf: {
        baseBrutaCentavos: baseIrrfBrutaCentavos,
        dependentes: entrada.dependentesIrrf,
        metodoDeducao: irrf.metodoDeducao,
        deducaoUtilizadaCentavos: paraCentavos(irrf.deducaoUtilizada),
        baseCentavos: paraCentavos(irrf.base),
        impostoBrutoCentavos: paraCentavos(irrf.impostoBruto),
        reducaoCentavos: paraCentavos(irrf.reducao),
        valorCentavos: valorIrrfCentavos,
        isento: !entrada.descontaIrrf,
      },
      enquadramento: {
        cenario: enquadramento.cenario,
        fundamentos: enquadramento.fundamentos,
      },
    },
  };
}
