export const TIPOS_CHECKLIST_COMPETENCIA = [
  "MEDICOES",
  "CONSOLIDACAO",
  "FOLHAS",
  "CONFERENCIA_RH",
  "PARALELO_GIW",
  "PAGAMENTOS",
  "OBRIGACAO",
  "DOCUMENTOS_DCTFWEB",
] as const;

export type TipoChecklistCompetencia =
  (typeof TIPOS_CHECKLIST_COMPETENCIA)[number];
export type StatusChecklistCompetencia =
  | "OK"
  | "PENDENTE"
  | "BLOQUEIO"
  | "NAO_APLICAVEL";

export type ItemChecklistCompetencia = {
  tipo: TipoChecklistCompetencia;
  status: StatusChecklistCompetencia;
  obrigatorio: boolean;
  total: number;
  conformes: number;
  pendentes: number;
  hashEvidencia: string;
  detalhes: Record<string, unknown>;
};

export function competenciasCampanha(
  competenciaFinal: string,
  quantidade = 3,
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competenciaFinal)) {
    throw new Error("Competência deve usar o formato AAAA-MM.");
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 12) {
    throw new Error("A campanha deve possuir entre 1 e 12 competências.");
  }
  const [ano, mes] = competenciaFinal.split("-").map(Number);
  return Array.from({ length: quantidade }, (_, indice) => {
    const data = new Date(Date.UTC(ano, mes - 1 - indice, 1));
    return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}`;
  }).reverse();
}

export function statusPorContagem(input: {
  total: number;
  pendentes: number;
  vazio: "BLOQUEIO" | "NAO_APLICAVEL";
  bloqueio?: boolean;
}): StatusChecklistCompetencia {
  if (input.total === 0) return input.vazio;
  if (input.pendentes === 0) return "OK";
  return input.bloqueio ? "BLOQUEIO" : "PENDENTE";
}

export function avaliarProntidaoCompetencia(
  itens: ItemChecklistCompetencia[],
) {
  const bloqueios = itens.filter(
    (item) =>
      item.obrigatorio &&
      item.status !== "OK" &&
      item.status !== "NAO_APLICAVEL",
  );
  return {
    pronta: bloqueios.length === 0,
    bloqueios: bloqueios.map((item) => item.tipo),
    conformes: itens.filter(
      (item) => item.status === "OK" || item.status === "NAO_APLICAVEL",
    ).length,
    total: itens.length,
  };
}

export function conteudoHomologacaoCompetencia(input: {
  competencia: string;
  itens: ItemChecklistCompetencia[];
}) {
  return {
    competencia: input.competencia,
    itens: [...input.itens]
      .sort((a, b) => a.tipo.localeCompare(b.tipo))
      .map((item) => ({
        tipo: item.tipo,
        status: item.status,
        obrigatorio: item.obrigatorio,
        total: item.total,
        conformes: item.conformes,
        pendentes: item.pendentes,
        hashEvidencia: item.hashEvidencia,
      })),
  };
}

export function normalizarDecisaoCompetencia(input: {
  status: string;
  justificativa: string;
  responsavel: string;
  pronta: boolean;
}) {
  const status = input.status.trim().toUpperCase();
  if (!["EM_ANALISE", "APROVADA", "REJEITADA"].includes(status)) {
    throw new Error("Status da homologação mensal inválido.");
  }
  const justificativa = input.justificativa.trim();
  if (justificativa.length < 10 || justificativa.length > 3000) {
    throw new Error("A justificativa deve ter entre 10 e 3.000 caracteres.");
  }
  const responsavel = input.responsavel.trim();
  if (responsavel.length < 3 || responsavel.length > 160) {
    throw new Error("O responsável deve ter entre 3 e 160 caracteres.");
  }
  if (status === "APROVADA" && !input.pronta) {
    throw new Error(
      "A competência possui bloqueios obrigatórios e não pode ser aprovada.",
    );
  }
  return {
    status: status as "EM_ANALISE" | "APROVADA" | "REJEITADA",
    justificativa,
    responsavel,
    decididoEm: status === "EM_ANALISE" ? null : new Date(),
  };
}

export function rotuloItemCompetencia(tipo: TipoChecklistCompetencia) {
  const rotulos: Record<TipoChecklistCompetencia, string> = {
    MEDICOES: "Medições mensais",
    CONSOLIDACAO: "Consolidação por pessoa",
    FOLHAS: "Folhas fechadas",
    CONFERENCIA_RH: "Conferências do RH",
    PARALELO_GIW: "Comparação com o GIW",
    PAGAMENTOS: "Relação de pagamentos",
    OBRIGACAO: "Obrigação previdenciária",
    DOCUMENTOS_DCTFWEB: "Documentos DCTFWeb/DARF",
  };
  return rotulos[tipo];
}

export function destinoItemCompetencia(
  tipo: TipoChecklistCompetencia,
  competencia: string,
) {
  const mes = encodeURIComponent(competencia);
  const destinos: Record<TipoChecklistCompetencia, string> = {
    MEDICOES: `/medicoes?competencia=${mes}`,
    CONSOLIDACAO: `/consolidacoes?competencia=${mes}`,
    FOLHAS: "/folhas",
    CONFERENCIA_RH: "/folhas",
    PARALELO_GIW: "/folhas",
    PAGAMENTOS: "/folhas",
    OBRIGACAO: "/obrigacoes",
    DOCUMENTOS_DCTFWEB: "/obrigacoes",
  };
  return destinos[tipo];
}
