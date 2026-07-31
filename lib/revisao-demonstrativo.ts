export function normalizarAberturaRevisaoDemonstrativo(input: {
  motivo: unknown;
  responsavel: unknown;
}) {
  const motivo = String(input.motivo ?? "").trim();
  const responsavel = String(input.responsavel ?? "").trim();
  if (motivo.length < 20 || motivo.length > 3_000) {
    throw new Error(
      "O motivo da nova revisão deve ter entre 20 e 3.000 caracteres.",
    );
  }
  if (responsavel.length < 3 || responsavel.length > 160) {
    throw new Error("O responsável deve ter entre 3 e 160 caracteres.");
  }
  return { motivo, responsavel };
}
