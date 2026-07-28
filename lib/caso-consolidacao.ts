export const STATUS_CASO_EDITAVEIS = ["EM_ANALISE", "RESOLVIDO"] as const;
export const DECISOES_CONSOLIDACAO = [
  "UNIFICAR_VINCULOS",
  "RATEIO_NECESSARIO",
  "NAO_APLICAVEL",
] as const;

export type StatusCasoEditavel = (typeof STATUS_CASO_EDITAVEIS)[number];
export type DecisaoConsolidacao = (typeof DECISOES_CONSOLIDACAO)[number];

export type FonteConsolidacao = {
  vinculoId: string;
  termoId: string;
  termoNumero: string;
  metaId: string;
  metaCodigo: string;
  atividade: string;
  valorContratual: string;
  valorPrevisto: string;
  exigeMedicao: boolean;
  medicaoId: string | null;
  medicaoTipo: string | null;
  folhaId: string | null;
  folhaNumero: number | null;
  folhaStatus: string | null;
};

export function conteudoFontesConsolidacao(input: {
  competencia: string;
  pessoaId: string;
  baseOutrasFontes: string;
  fontes: FonteConsolidacao[];
}) {
  return {
    competencia: input.competencia,
    pessoaId: input.pessoaId,
    baseOutrasFontes: input.baseOutrasFontes,
    fontes: [...input.fontes]
      .sort((a, b) => a.vinculoId.localeCompare(b.vinculoId))
      .map((fonte) => ({
        vinculoId: fonte.vinculoId,
        termoId: fonte.termoId,
        termoNumero: fonte.termoNumero,
        metaId: fonte.metaId,
        metaCodigo: fonte.metaCodigo,
        atividade: fonte.atividade,
        valorContratual: fonte.valorContratual,
        valorPrevisto: fonte.valorPrevisto,
        exigeMedicao: fonte.exigeMedicao,
        medicaoId: fonte.medicaoId,
        medicaoTipo: fonte.medicaoTipo,
        folhaId: fonte.folhaId,
        folhaNumero: fonte.folhaNumero,
        folhaStatus: fonte.folhaStatus,
      })),
  };
}

export function normalizarAtualizacaoCaso(input: {
  status: string;
  decisao?: string | null;
  justificativa: string;
  responsavel: string;
}) {
  const status = input.status.trim().toUpperCase();
  if (!STATUS_CASO_EDITAVEIS.includes(status as StatusCasoEditavel)) {
    throw new Error("Status do caso inválido.");
  }

  const justificativa = input.justificativa.trim();
  if (justificativa.length < 10 || justificativa.length > 2000) {
    throw new Error("A justificativa deve ter entre 10 e 2.000 caracteres.");
  }

  const responsavel = input.responsavel.trim();
  if (responsavel.length < 3 || responsavel.length > 160) {
    throw new Error("O responsável deve ter entre 3 e 160 caracteres.");
  }

  const decisaoInformada = input.decisao?.trim().toUpperCase() || null;
  if (status === "EM_ANALISE") {
    if (decisaoInformada) {
      throw new Error("Caso em análise ainda não pode registrar decisão final.");
    }
    return {
      status: "EM_ANALISE" as const,
      decisao: null,
      justificativa,
      responsavel,
      resolvidoEm: null,
    };
  }

  if (
    !decisaoInformada ||
    !DECISOES_CONSOLIDACAO.includes(
      decisaoInformada as DecisaoConsolidacao,
    )
  ) {
    throw new Error("Selecione uma decisão válida para resolver o caso.");
  }

  return {
    status: "RESOLVIDO" as const,
    decisao: decisaoInformada as DecisaoConsolidacao,
    justificativa,
    responsavel,
    resolvidoEm: new Date(),
  };
}

export function rotuloDecisao(decisao: string | null) {
  if (decisao === "UNIFICAR_VINCULOS") return "Unificar vínculos";
  if (decisao === "RATEIO_NECESSARIO") return "Rateio necessário";
  if (decisao === "NAO_APLICAVEL") return "Não aplicável";
  return "Sem decisão";
}
