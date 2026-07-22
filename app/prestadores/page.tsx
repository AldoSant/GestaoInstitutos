import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { moeda, prestadoresDemo } from "@/lib/dados-demo";

export default function PrestadoresPage() {
  return (
    <AppShell
      title="Prestadores"
      eyebrow="Pessoas e vínculos"
      actions={<button className="button primary" type="button"><Plus size={16} /> Novo prestador</button>}
    >
      <section className="panel">
        <div className="panel-header">
          <div><span className="section-kicker">Cadastro unificado</span><h2>Prestadores ativos</h2><p>Amostra sintética baseada nos padrões encontrados, sem dados pessoais reais.</p></div>
          <label className="search-field"><Search size={17} /><span className="sr-only">Buscar</span><input type="search" placeholder="Buscar por nome ou matrícula" /></label>
        </div>
        <div className="summary-strip"><span><strong>37</strong> ativos na competência</span><span><strong>26</strong> pessoas físicas com retenção</span><span><strong>11</strong> sem incidência no recorte</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Matrícula</th><th>Prestador</th><th>Natureza</th><th>Atividade atual</th><th>Retribuição</th><th>INSS</th><th>IRRF</th><th>Situação</th></tr></thead>
            <tbody>{prestadoresDemo.map((p) => (
              <tr key={p.matricula}>
                <td>{p.matricula}</td><td><strong>{p.nome}</strong><small>Identificação mascarada</small></td>
                <td><StatusBadge tone={p.tipo === "PF" ? "info" : "neutral"}>{p.tipo}</StatusBadge></td>
                <td>{p.atividade}</td><td>{moeda(p.base)}</td><td>{p.inss ? "Incide" : "Não incide"}</td><td>{p.tipo === "PF" ? "Conforme faixa" : "Não incide"}</td><td><StatusBadge>Ativo</StatusBadge></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
