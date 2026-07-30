import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function AjudaPage() {
  return (
    <AppShell title="Ajuda" eyebrow="Guia rápido">
      <section className="panel prose-panel">
        <h2>Como executar o fechamento mensal</h2>
        <ol>
          <li>
            Confira pessoas, prestadores e vínculos em{" "}
            <Link className="text-link" href="/cadastros">
              Pessoas e vínculos
            </Link>
            .
          </li>
          <li>
            Registre medições e lançamentos que alteram os valores do mês.
          </li>
          <li>
            Acesse{" "}
            <Link className="text-link" href="/folhas">
              Folha mensal
            </Link>{" "}
            e crie ou abra a competência.
          </li>
          <li>
            Revise as pendências, confira pessoas, rubricas, descontos e valor
            líquido.
          </li>
          <li>Registre a conferência do RH e feche a folha.</li>
          <li>
            Finalize a apuração em{" "}
            <Link className="text-link" href="/obrigacoes">
              Obrigações e guias
            </Link>
            .
          </li>
        </ol>

        <h3>Quando o sistema bloquear uma etapa</h3>
        <p>
          Leia a pendência apresentada e abra o cadastro indicado. Depois da
          correção, volte à competência e processe novamente. Uma folha fechada
          só pode ser reaberta com justificativa.
        </p>

        <h3>Documentos oficiais</h3>
        <p>
          Relatórios internos servem para conferência. DARF, documentos da
          DCTFWeb e GFD são identificados separadamente e precisam corresponder
          aos valores da competência antes do registro do pagamento.
        </p>
      </section>
    </AppShell>
  );
}
