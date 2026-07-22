import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { competencias, moeda } from "@/lib/dados-demo";

export default function FolhasPage() {
  return (
    <AppShell
      title="Folhas"
      eyebrow="Processamento mensal"
      actions={<Link href="/folhas/nova" className="button primary"><Plus size={16} /> Nova folha</Link>}
    >
      <section className="panel">
        <div className="panel-header">
          <div><span className="section-kicker">Histórico</span><h2>Competências processadas</h2><p>Folhas demonstrativas importadas da análise do legado.</p></div>
          <div className="inline-filters"><button className="filter active">Todas</button><button className="filter">Fechadas</button><button className="filter">Em conferência</button></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Competência</th><th>Lote</th><th>Status</th><th>Prestadores</th><th>Proventos</th><th>INSS</th><th>IRRF</th><th>Líquido</th><th></th></tr></thead>
            <tbody>{competencias.map((item) => (
              <tr key={item.slug}>
                <td><strong>{item.competencia}</strong><small>Folha normal</small></td>
                <td>#{item.numero}</td>
                <td><StatusBadge>{item.status}</StatusBadge></td>
                <td>{item.prestadores}</td>
                <td>{moeda(item.proventos)}</td>
                <td>{moeda(item.inss)}</td>
                <td>{moeda(item.irrf)}</td>
                <td><strong>{moeda(item.liquido)}</strong></td>
                <td><Link className="row-action" href={`/folhas/${item.slug}`} aria-label={`Abrir ${item.competencia}`}><ArrowRight size={17} /></Link></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
