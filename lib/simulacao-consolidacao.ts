import type { EntradaVinculoFolha } from "./processamento-folha";

export const STATUS_SIMULACAO_FISCAL = [
  "SIMULADA",
  "EM_HOMOLOGACAO",
  "HOMOLOGADA",
  "REJEITADA",
  "INVALIDADA",
] as const;

export type StatusSimulacaoFiscal =
  (typeof STATUS_SIMULACAO_FISCAL)[number];

const TRANSICOES: Record<StatusSimulacaoFiscal, StatusSimulacaoFiscal[]> = {
  SIMULADA: ["EM_HOMOLOGACAO", "INVALIDADA"],
  EM_HOMOLOGACAO: ["HOMOLOGADA", "REJEITADA", "INVALIDADA"],
  HOMOLOGADA: [],
  REJEITADA: [],
  INVALIDADA: [],
};

export function conteudoFontesSimulacao({
  competencia,
  pessoaId,
  fontes,
}: {
  competencia: string;
  pessoaId: string;
  fontes: EntradaVinculoFolha[];
}) {
  return {
    competencia,
    pessoaId,
    fontes: [...fontes]
      .sort((a, b) => a.vinculoId.localeCompare(b.vinculoId))
      .map((fonte) => ({
        ...fonte,
        eventos: [...fonte.eventos].sort(
          (a, b) =>
            a.codigo.localeCompare(b.codigo, "pt-BR") ||
            a.id.localeCompare(b.id),
        ),
        outrasFontes: [...fonte.outrasFontes].sort(
          (a, b) =>
            a.documentoFonte.localeCompare(b.documentoFonte) ||
            a.documentoReferencia.localeCompare(b.documentoReferencia) ||
            a.fontePagadora.localeCompare(b.fontePagadora),
        ),
      })),
  };
}

export function normalizarTransicaoSimulacao({
  statusAtual,
  statusDestino,
  responsavel,
  justificativa,
}: {
  statusAtual: StatusSimulacaoFiscal;
  statusDestino: string;
  responsavel: string;
  justificativa: string;
}) {
  if (
    !STATUS_SIMULACAO_FISCAL.includes(
      statusDestino as StatusSimulacaoFiscal,
    )
  ) {
    throw new Error("Estado de simulação fiscal inválido.");
  }
  const destino = statusDestino as StatusSimulacaoFiscal;
  if (!TRANSICOES[statusAtual].includes(destino)) {
    throw new Error(
      `A simulação não pode avançar de ${statusAtual} para ${destino}.`,
    );
  }
  const ator = responsavel.trim();
  if (ator.length < 3 || ator.length > 160) {
    throw new Error("O responsável deve ter entre 3 e 160 caracteres.");
  }
  const motivo = justificativa.trim();
  if (
    ["HOMOLOGADA", "REJEITADA", "INVALIDADA"].includes(destino) &&
    (motivo.length < 10 || motivo.length > 3_000)
  ) {
    throw new Error(
      "A decisão terminal exige justificativa entre 10 e 3.000 caracteres.",
    );
  }
  return {
    status: destino,
    responsavel: ator,
    justificativa: motivo,
    decididoEm: ["HOMOLOGADA", "REJEITADA", "INVALIDADA"].includes(destino)
      ? new Date()
      : null,
  };
}

export function rotuloStatusSimulacao(status: StatusSimulacaoFiscal) {
  return {
    SIMULADA: "Simulada",
    EM_HOMOLOGACAO: "Em homologação",
    HOMOLOGADA: "Homologada",
    REJEITADA: "Rejeitada",
    INVALIDADA: "Invalidada",
  }[status];
}
