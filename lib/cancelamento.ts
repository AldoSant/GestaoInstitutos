export function normalizarMotivoCancelamento(
  valor: string,
  entidade: "Folha" | "Obrigação",
) {
  const motivo = valor.trim();
  if (motivo.length < 10 || motivo.length > 2_000) {
    throw new Error(
      `Informe um motivo de cancelamento da ${entidade} com 10 a 2.000 caracteres.`,
    );
  }
  return motivo;
}

export function validarStatusCancelamentoFolha(status: string) {
  if (!["RASCUNHO", "ABERTA"].includes(status)) {
    throw new Error(
      "Somente uma Folha na fila ou aberta pode ser cancelada. Folha fechada deve ser reaberta primeiro.",
    );
  }
}

export function validarStatusCancelamentoObrigacao(status: string) {
  if (!["RASCUNHO", "BLOQUEADA", "APURADA"].includes(status)) {
    throw new Error(
      "Somente uma obrigação ainda não emitida pode ser cancelada.",
    );
  }
}
