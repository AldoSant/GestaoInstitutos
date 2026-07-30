import { cookies } from "next/headers";
import {
  competenciaCalendario,
  COOKIE_COMPETENCIA,
  primeiraCompetencia,
} from "@/lib/competencia";

export async function lerCompetenciaContexto(
  valor?: string | string[],
): Promise<string> {
  const informada = primeiraCompetencia(valor);
  if (informada) return informada;

  const jar = await cookies();
  return (
    primeiraCompetencia(jar.get(COOKIE_COMPETENCIA)?.value) ??
    competenciaCalendario()
  );
}

