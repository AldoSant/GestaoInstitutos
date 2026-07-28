export function validarEstadoFolhasParaApuracao(estado: {
  fechadas: number;
  pendentes: number;
  itens: number;
  semEnquadramento: number;
}) {
  if (estado.fechadas === 0 || estado.itens === 0) {
    throw new Error(
      "A apuração exige ao menos uma Folha fechada com itens na competência.",
    );
  }
  if (estado.semEnquadramento > 0) {
    throw new Error(
      `${estado.semEnquadramento} item(ns) de Folha não possuem enquadramento previdenciário congelado. Reabra e reprocesse essas Folhas antes da apuração.`,
    );
  }
  if (estado.pendentes > 0) {
    throw new Error(
      `${estado.pendentes} Folha(s) da competência ainda não estão fechadas. A apuração parcial foi bloqueada.`,
    );
  }
}

export function validarIntegridadeFontesObrigacao(fontes: {
  vinculadas: number;
  pendentes: number;
  fechadasNovas: number;
  alteradas: number;
}) {
  if (fontes.vinculadas === 0) {
    throw new Error("A obrigação não possui Folhas de origem congeladas.");
  }
  const problemas: string[] = [];
  if (fontes.pendentes > 0) {
    problemas.push(`${fontes.pendentes} Folha(s) ainda não fechada(s)`);
  }
  if (fontes.fechadasNovas > 0) {
    problemas.push(
      `${fontes.fechadasNovas} Folha(s) fechada(s) após a última apuração`,
    );
  }
  if (fontes.alteradas > 0) {
    problemas.push(
      `${fontes.alteradas} Folha(s) de origem reaberta(s) ou alterada(s)`,
    );
  }
  if (problemas.length > 0) {
    throw new Error(
      `Reapure a obrigação antes de conferir documentos: ${problemas.join("; ")}.`,
    );
  }
}
