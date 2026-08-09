import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { caminhoAplicacao } from "@/lib/base-path";
import type { BloqueioOrientado as DadosBloqueioOrientado } from "@/lib/bloqueios-orientados";

export function BloqueioOrientado({ bloqueio }: { bloqueio: DadosBloqueioOrientado }) {
  return (
    <section className="alert-box danger bloqueio-orientado" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <div>
        <strong>{bloqueio.titulo}</strong>
        <p><b>O que falta:</b> {bloqueio.causa}</p>
        <p><b>Impacto:</b> {bloqueio.impacto}</p>
        <Link className="button secondary" href={caminhoAplicacao(bloqueio.acao.href)}>
          {bloqueio.acao.rotulo}
        </Link>
      </div>
    </section>
  );
}
