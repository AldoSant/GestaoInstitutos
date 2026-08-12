type ErroComCodigo = {
  code?: unknown;
};

function codigoTecnico(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as ErroComCodigo).code ?? "")
    : "";
}

/**
 * Mensagens do domínio são seguras para a interface. Erros de infraestrutura
 * (PostgreSQL, rede e driver) devem ser registrados no servidor, mas não
 * expostos pela URL de retorno de uma Server Action.
 */
export function mensagemOperacional(error: unknown, fallback: string) {
  if (codigoTecnico(error)) return fallback;
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}
