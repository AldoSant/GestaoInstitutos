"use client";

import Image from "next/image";
import { RefreshCw } from "lucide-react";
import { caminhoAplicacao } from "@/lib/base-path";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="system-state-page">
      <section className="system-state-card" role="alert">
        <Image
          src={caminhoAplicacao("/veredas/veredas-lockup-navy.svg")}
          alt="Veredas"
          width={164}
          height={64}
          priority
          unoptimized
        />
        <span className="section-kicker">Operação preservada</span>
        <h1>Não foi possível abrir esta área.</h1>
        <p>
          Nenhuma informação foi alterada. Atualize a área para tentar novamente.
        </p>
        <button className="button primary" type="button" onClick={reset}>
          <RefreshCw size={16} /> Tentar novamente
        </button>
      </section>
    </main>
  );
}
