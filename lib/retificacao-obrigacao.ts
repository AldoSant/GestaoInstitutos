import { hashJson } from "./json-canonico";

export const STATUS_RETIFICACAO_OBRIGACAO = [
  "SOLICITADA",
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
] as const;

export type StatusRetificacaoObrigacao =
  (typeof STATUS_RETIFICACAO_OBRIGACAO)[number];

export function normalizarSolicitacaoRetificacao(input: {
  motivo: string;
  responsavel: string;
}) {
  const motivo = input.motivo.trim();
  const responsavel = input.responsavel.trim();
  if (motivo.length < 20 || motivo.length > 3_000) {
    throw new Error(
      "O motivo da retificação deve ter entre 20 e 3.000 caracteres.",
    );
  }
  if (responsavel.length < 3 || responsavel.length > 160) {
    throw new Error("O responsável deve ter entre 3 e 160 caracteres.");
  }
  return { motivo, responsavel };
}

export function hashSnapshotRetificacao(snapshot: Record<string, unknown>) {
  return hashJson(snapshot);
}

export function retificacaoAtiva(status: string) {
  return status === "SOLICITADA" || status === "EM_ANDAMENTO";
}
