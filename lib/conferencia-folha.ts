export type ResultadoConferenciaFolha = "APROVADA" | "REJEITADA";

export function normalizarConferenciaFolha(entrada: {
  resultado: string;
  conferente: string;
  confirmouCadastros: boolean;
  confirmouValores: boolean;
  confirmouRubricas: boolean;
  observacao: string;
}) {
  const resultado = entrada.resultado.trim().toUpperCase();
  if (resultado !== "APROVADA" && resultado !== "REJEITADA") {
    throw new Error("Selecione se a conferência foi aprovada ou rejeitada.");
  }

  const conferente = entrada.conferente.trim().replace(/\s+/g, " ");
  if (conferente.length < 3 || conferente.length > 160) {
    throw new Error("Informe o nome do responsável pela conferência.");
  }

  const observacao = entrada.observacao.trim();
  if (observacao.length > 2_000) {
    throw new Error("A observação deve ter no máximo 2.000 caracteres.");
  }
  if (resultado === "REJEITADA" && observacao.length < 10) {
    throw new Error("Explique a rejeição em pelo menos 10 caracteres.");
  }
  if (
    resultado === "APROVADA" &&
    (!entrada.confirmouCadastros ||
      !entrada.confirmouValores ||
      !entrada.confirmouRubricas)
  ) {
    throw new Error(
      "A aprovação exige confirmar cadastros, valores e rubricas.",
    );
  }

  return {
    resultado: resultado as ResultadoConferenciaFolha,
    conferente,
    confirmouCadastros: entrada.confirmouCadastros,
    confirmouValores: entrada.confirmouValores,
    confirmouRubricas: entrada.confirmouRubricas,
    observacao,
  };
}
