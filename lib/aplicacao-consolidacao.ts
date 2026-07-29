import type { LinhaMemoriaFolha, processarVinculoFolha } from "./processamento-folha";

export type ResultadoVinculoFolha = ReturnType<typeof processarVinculoFolha>;
export type ResultadoVinculoFolhaAplicado = Omit<ResultadoVinculoFolha, "memoria"> & {
  memoria: ResultadoVinculoFolha["memoria"] & {
    consolidacaoFiscal: {
      modo: "RATEIO_HOMOLOGADO";
      simulacaoId: string;
      hashResultado: string;
      vinculoId: string;
    };
  };
};

export type RateioConsolidadoFonte = {
  simulacaoId: string;
  hashResultado: string;
  vinculoId: string;
  totalProventosCentavos: number;
  descontosEventosCentavos: number;
  totalDescontosCentavos: number;
  totalLiquidoCentavos: number;
  baseInssBrutaCentavos: number;
  baseInssCentavos: number;
  valorInssCentavos: number;
  baseIrrfBrutaCentavos: number;
  baseIrrfCentavos: number;
  irrfBrutoCentavos: number;
  irrfReducaoCentavos: number;
  valorIrrfCentavos: number;
};

type AmbienteConsolidacao = {
  FOLHA_CONSOLIDADA_PRODUTIVA?: string;
  FOLHA_CONSOLIDADA_EMPRESA_ID?: string;
  FOLHA_CONSOLIDADA_INICIO?: string;
};

function competenciaValida(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const mes = Number(value.slice(5));
  return mes >= 1 && mes <= 12;
}

function uuidValido(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function avaliarAtivacaoConsolidacaoProdutiva({
  empresaId,
  competencia,
  ambiente = process.env as AmbienteConsolidacao,
}: {
  empresaId: string;
  competencia: string;
  ambiente?: AmbienteConsolidacao;
}) {
  if (ambiente.FOLHA_CONSOLIDADA_PRODUTIVA !== "true") {
    return { ativa: false as const, motivo: "recurso desativado" };
  }
  const empresaConfigurada = ambiente.FOLHA_CONSOLIDADA_EMPRESA_ID?.trim() ?? "";
  const inicio = ambiente.FOLHA_CONSOLIDADA_INICIO?.trim() ?? "";
  if (!uuidValido(empresaConfigurada)) {
    throw new Error(
      "FOLHA_CONSOLIDADA_EMPRESA_ID deve identificar explicitamente a empresa habilitada.",
    );
  }
  if (!competenciaValida(inicio)) {
    throw new Error(
      "FOLHA_CONSOLIDADA_INICIO deve usar o formato AAAA-MM quando a consolidação produtiva estiver ativa.",
    );
  }
  const competenciaMensal = competencia.slice(0, 7);
  if (!competenciaValida(competenciaMensal)) {
    throw new Error("Competência inválida para a consolidação produtiva.");
  }
  if (empresaId !== empresaConfigurada) {
    return { ativa: false as const, motivo: "empresa não habilitada" };
  }
  if (competenciaMensal < inicio) {
    return { ativa: false as const, motivo: "competência anterior à ativação" };
  }
  return {
    ativa: true as const,
    empresaId: empresaConfigurada,
    inicio,
  };
}

function validarInteiros(rateio: RateioConsolidadoFonte) {
  for (const [campo, value] of Object.entries(rateio)) {
    if (campo.endsWith("Centavos") && (!Number.isSafeInteger(value) || Number(value) < 0)) {
      throw new Error(`Rateio consolidado inválido em ${campo}.`);
    }
  }
}

function substituirLinhaFiscal(
  linhas: LinhaMemoriaFolha[],
  codigo: "INSS" | "IRRF",
  baseCalculoCentavos: number,
  valorCentavos: number,
) {
  const encontradas = linhas.filter(
    (linha) => linha.origem === "SISTEMA" && linha.codigo === codigo,
  );
  if (encontradas.length !== 1) {
    throw new Error(`A memória individual deve possuir exatamente uma linha ${codigo}.`);
  }
  return linhas.map((linha) =>
    linha === encontradas[0]
      ? { ...linha, baseCalculoCentavos, valorCentavos }
      : linha,
  );
}

export function aplicarRateioConsolidadoNaFolha(
  individual: ResultadoVinculoFolha,
  rateio: RateioConsolidadoFonte,
): ResultadoVinculoFolhaAplicado {
  validarInteiros(rateio);
  if (individual.vinculoId !== rateio.vinculoId) {
    throw new Error("O rateio consolidado pertence a outro Vínculo.");
  }
  const descontosEventosIndividuais =
    individual.totalDescontosCentavos -
    individual.valorInssCentavos -
    individual.valorIrrfCentavos;
  if (
    individual.totalProventosCentavos !== rateio.totalProventosCentavos ||
    descontosEventosIndividuais !== rateio.descontosEventosCentavos
  ) {
    throw new Error(
      "Proventos ou descontos contratuais mudaram após a simulação consolidada.",
    );
  }
  if (
    rateio.totalDescontosCentavos !==
      rateio.descontosEventosCentavos +
        rateio.valorInssCentavos +
        rateio.valorIrrfCentavos ||
    rateio.totalLiquidoCentavos !==
      rateio.totalProventosCentavos - rateio.totalDescontosCentavos
  ) {
    throw new Error("O fechamento monetário da fonte consolidada é inválido.");
  }
  let linhas = substituirLinhaFiscal(
    individual.linhas,
    "INSS",
    rateio.baseInssCentavos,
    rateio.valorInssCentavos,
  );
  linhas = substituirLinhaFiscal(
    linhas,
    "IRRF",
    rateio.baseIrrfCentavos,
    rateio.valorIrrfCentavos,
  );
  return {
    ...individual,
    totalProventosCentavos: rateio.totalProventosCentavos,
    totalDescontosCentavos: rateio.totalDescontosCentavos,
    totalLiquidoCentavos: rateio.totalLiquidoCentavos,
    baseInssCentavos: rateio.baseInssCentavos,
    valorInssCentavos: rateio.valorInssCentavos,
    baseIrrfCentavos: rateio.baseIrrfCentavos,
    irrfBrutoCentavos: rateio.irrfBrutoCentavos,
    irrfReducaoCentavos: rateio.irrfReducaoCentavos,
    valorIrrfCentavos: rateio.valorIrrfCentavos,
    linhas,
    memoria: {
      ...individual.memoria,
      baseInssBrutaCentavos: rateio.baseInssBrutaCentavos,
      baseInssLimitadaCentavos: rateio.baseInssCentavos,
      inss: {
        ...individual.memoria.inss,
        valorCentavos: rateio.valorInssCentavos,
      },
      irrf: {
        ...individual.memoria.irrf,
        baseBrutaCentavos: rateio.baseIrrfBrutaCentavos,
        baseCentavos: rateio.baseIrrfCentavos,
        impostoBrutoCentavos: rateio.irrfBrutoCentavos,
        reducaoCentavos: rateio.irrfReducaoCentavos,
        valorCentavos: rateio.valorIrrfCentavos,
      },
      consolidacaoFiscal: {
        modo: "RATEIO_HOMOLOGADO",
        simulacaoId: rateio.simulacaoId,
        hashResultado: rateio.hashResultado,
        vinculoId: rateio.vinculoId,
      },
    },
  };
}
