export function normalizarConferenciaDemonstrativo(entrada: {
  resultado: unknown;
  conferente: unknown;
  confirmouPagamentos: unknown;
  confirmouRetencoes: unknown;
  confirmouGuias: unknown;
  observacao: unknown;
}) {
  const resultado = String(entrada.resultado ?? "").trim().toUpperCase();
  const conferente = String(entrada.conferente ?? "").trim();
  const observacao = String(entrada.observacao ?? "").trim();
  const confirmouPagamentos = Boolean(entrada.confirmouPagamentos);
  const confirmouRetencoes = Boolean(entrada.confirmouRetencoes);
  const confirmouGuias = Boolean(entrada.confirmouGuias);

  if (resultado !== "APROVADA" && resultado !== "REJEITADA") {
    throw new Error("Selecione aprovação ou rejeição.");
  }
  if (conferente.length < 3 || conferente.length > 160) {
    throw new Error("Informe o responsável pela conferência.");
  }
  if (
    resultado === "APROVADA" &&
    (!confirmouPagamentos || !confirmouRetencoes || !confirmouGuias)
  ) {
    throw new Error(
      "A aprovação exige confirmar pagamentos, retenções e guias.",
    );
  }
  if (resultado === "REJEITADA" && observacao.length < 10) {
    throw new Error("A rejeição exige uma justificativa com ao menos 10 caracteres.");
  }
  if (observacao.length > 2_000) {
    throw new Error("A observação deve ter no máximo 2.000 caracteres.");
  }
  return {
    resultado: resultado as "APROVADA" | "REJEITADA",
    conferente,
    confirmouPagamentos,
    confirmouRetencoes,
    confirmouGuias,
    observacao,
  };
}
