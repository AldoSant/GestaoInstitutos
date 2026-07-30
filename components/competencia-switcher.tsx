"use client";

import { CalendarDays } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  COOKIE_COMPETENCIA,
  primeiraCompetencia,
  rotuloCompetencia,
} from "@/lib/competencia";

export function CompetenciaSwitcher({
  competencias,
  selecionada,
}: {
  competencias: string[];
  selecionada: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const competenciaNaUrl = primeiraCompetencia(
    searchParams.get("competencia") ?? undefined,
  );
  const atual = competenciaNaUrl ?? selecionada;

  useEffect(() => {
    if (!competenciaNaUrl) return;
    document.cookie = `${COOKIE_COMPETENCIA}=${competenciaNaUrl}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [competenciaNaUrl]);

  return (
    <label className="competencia-switcher">
      <CalendarDays size={17} aria-hidden="true" />
      <span className="sr-only">Competência em foco</span>
      <select
        aria-label="Competência em foco"
        value={atual}
        onChange={(event) => {
          const competencia = event.target.value;
          document.cookie = `${COOKIE_COMPETENCIA}=${competencia}; Path=/; Max-Age=31536000; SameSite=Lax`;
          router.push(`/?competencia=${competencia}`);
        }}
      >
        {competencias.map((competencia) => (
          <option key={competencia} value={competencia}>
            {rotuloCompetencia(competencia)}
          </option>
        ))}
      </select>
    </label>
  );
}
