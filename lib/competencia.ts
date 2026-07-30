export const COOKIE_COMPETENCIA = "instituto_competencia";

const PADRAO_COMPETENCIA = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function primeiraCompetencia(
  valor: string | string[] | undefined,
): string | undefined {
  const primeira = Array.isArray(valor) ? valor[0] : valor;
  return primeira && PADRAO_COMPETENCIA.test(primeira) ? primeira : undefined;
}

export function competenciaCalendario(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

export function rotuloCompetencia(valor: string) {
  const competencia = primeiraCompetencia(valor);
  if (!competencia) return valor;
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

