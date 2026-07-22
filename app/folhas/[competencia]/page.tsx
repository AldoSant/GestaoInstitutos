import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { competencias, moeda, prestadoresDemo } from "@/lib/dados-demo";

export default async function FolhaDetalhePage({ params }: { params: Promise<{ competencia: string }> }) {
  const { competencia } = await params;
  const folha = competencias.find((item) => item.slug === competencia);
  if (!folha) notFound();

  return (
    <AppShell
      title={folha.competencia}
      eyebrow={`Folha normal · lote nº ${folha.numero}`}
      actions={<button className="button secondary" type="button"><Download size={16} /> Exportar memória</button>}
    >
      <Link href="/folhas" className="back-link"><ArrowLeft size={16} /> Voltar para folhas</Link>
      <section className="detail-summary">
        <div><span>Status</span><StatusBadge>{folha.status}</StatusBadge></div>
        <div><span>Prestadores</span><strong>{folha.prestadores}</strong></div>
        <div><span>Proventos</span><strong>{moeda(folha.proventos)}</strong></div>
        <div><span>Descontos</span><strong>{moeda(folha.descontos)}</strong></div>
        <div><span>Líquido</span><strong>{moeda(folha.liquido)}</strong></div>
        <div className="locked"><LockKeyhole size={17} /><span>Regra congelada</span><strong>v2026.01</strong></div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div><span className="section-kicker">Memória individual</span><h2>Prestadores calculados</h2><p>Amostra anonimizada. A versão integrada exibirá todos os 37 registros.</p></div>
          <label className="search-field"><span className="sr-only">Buscar prestador</span><input type="search" placeholder="Buscar matrícula ou prestador" /></label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Prestador</th><th>Atividade</th><th>Natureza</th><th>Proventos</th><th>INSS</th><th>IRRF</th><th>Líquido</th><th>Memória</th></tr></thead>
            <tbody>{prestadoresDemo.map((p) => (
              <tr key={p.matricula}>
                <td><strong>{p.nome}</strong><small>Matrícula {p.matricula}</small></td>
                <td>{p.atividade}</td>
                <td><StatusBadge tone={p.tipo === "PF" ? "info" : "neutral"}>{p.tipo}</StatusBadge></td>
                <td>{moeda(p.base)}</td>
                <td>{moeda(p.inss)}</td>
                <td>{moeda(p.irrf)}</td>
                <td><strong>{moeda(p.liquido)}</strong></td>
                <td><button className="icon-button" type="button" aria-label={`Abrir memória de ${p.nome}`}><FileText size={17} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
