import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { caminhoAplicacao } from "@/lib/base-path";

export default function NotFound() {
  return (
    <main className="system-state-page">
      <section className="system-state-card">
        <Image
          src={caminhoAplicacao("/veredas/veredas-lockup-navy.svg")}
          alt="Veredas"
          width={164}
          height={64}
          priority
          unoptimized
        />
        <span className="section-kicker">Página não encontrada</span>
        <h1>Este caminho não está disponível.</h1>
        <p>Retorne à visão geral para seguir com a operação.</p>
        <Link className="button primary" href="/">
          <ArrowLeft size={16} /> Voltar à visão geral
        </Link>
      </section>
    </main>
  );
}
