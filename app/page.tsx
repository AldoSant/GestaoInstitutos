import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  LockKeyhole,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MetricCard, StatusBadge } from "@/components/ui";
import { competencias, moeda } from "@/lib/dados-demo";

export default function Home() {
  const atual = competencias[0];
  return (
    <AppShell
      title="Visão geral"
      eyebrow="Folha de prestadores"
      actions={<Link href="/folhas/nova" className="button primary">Nova folha</Link>}
    >
      <section className="hero-row">
        <div>
          <p className="section-kicker">Competência atual</p>
          <h2>Junho está fechada, mas exige conciliação previdenciária.</h2>
          <p>Os cálculos foram consolidados por pessoa. A obrigação permanece bloqueada até que a duplicidade encontrada no legado seja explicada.</p>
        </div>
        <div className="hero-status">
          <StatusBadge><CheckCircle2 size={14} /> Folha fechada</StatusBadge>
          <span>Última conferência: hoje, 17:42</span>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Resumo da competência">
        <MetricCard label="Prestadores" value="37" detail="26 PF com retenção · 11 sem incidência" icon={UsersRound} tone="blue" />
        <MetricCard label="Proventos" value={moeda(atual.proventos)} detail="+2,7% em relação a maio" icon={BadgeDollarSign} />
        <MetricCard label="Descontos" value={moeda(atual.descontos)} detail={`INSS ${moeda(atual.inss)} · IRRF ${moeda(atual.irrf)}`} icon={CircleDollarSign} tone="amber" />
        <MetricCard label="Líquido" value={moeda(atual.liquido)} detail="95,3% dos proventos" icon={Banknote} tone="slate" />
      </section>

      <section className="dashboard-grid">
        <article className="panel span-2">
          <div className="panel-header">
            <div><span className="section-kicker">Evolução</span><h3>Últimas competências</h3></div>
            <Link href="/folhas" className="text-link">Ver todas <ArrowRight size={15} /></Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Competência</th><th>Situação</th><th>Prestadores</th><th>Proventos</th><th>Descontos</th><th>Líquido</th><th></th></tr></thead>
              <tbody>
                {competencias.map((item) => (
                  <tr key={item.slug}>
                    <td><strong>{item.competencia}</strong><small>Lote nº {item.numero}</small></td>
                    <td><StatusBadge>{item.status}</StatusBadge></td>
                    <td>{item.prestadores}</td>
                    <td>{moeda(item.proventos)}</td>
                    <td>{moeda(item.descontos)}</td>
                    <td><strong>{moeda(item.liquido)}</strong></td>
                    <td><Link className="row-action" href={`/folhas/${item.slug}`} aria-label={`Abrir ${item.competencia}`}><ArrowRight size={17} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="panel critical-panel">
          <div className="critical-icon"><AlertTriangle size={22} /></div>
          <span className="section-kicker">Bloqueio crítico</span>
          <h3>Obrigação com valor duplicado</h3>
          <p>A apuração herdada apresenta 52 linhas para 26 prestadores e total de {moeda(atual.obrigacao)} — exatamente 2× o INSS da folha.</p>
          <dl className="reconciliation">
            <div><dt>Retido na folha</dt><dd>{moeda(atual.inss)}</dd></div>
            <div><dt>Obrigação herdada</dt><dd>{moeda(atual.obrigacao)}</dd></div>
            <div className="difference"><dt>Diferença</dt><dd>{moeda(atual.inss)}</dd></div>
          </dl>
          <Link href="/obrigacoes" className="button warning">Abrir conciliação</Link>
        </aside>
      </section>

      <section className="workflow-panel">
        <div className="panel-header">
          <div><span className="section-kicker">Cadeia auditável</span><h3>Da entrada à obrigação</h3></div>
          <StatusBadge tone="info"><LockKeyhole size={14} /> Regra v2026.01</StatusBadge>
        </div>
        <ol className="workflow">
          <li className="done"><span>1</span><div><strong>Cadastros e vínculos</strong><small>37 aptos para a competência</small></div></li>
          <li className="done"><span>2</span><div><strong>Consolidação por CPF</strong><small>Múltiplos contratos conciliados</small></div></li>
          <li className="done"><span>3</span><div><strong>Cálculo e memória</strong><small>Resultados congelados e assinados</small></div></li>
          <li className="attention"><span>4</span><div><strong>Obrigação previdenciária</strong><small>Aguardando explicação da diferença</small></div></li>
          <li><span>5</span><div><strong>Transmissão e pagamento</strong><small>Fora do protótipo atual</small></div></li>
        </ol>
      </section>

      <section className="quick-grid">
        <Link href="/prestadores" className="quick-card"><UsersRound /><span><strong>Conferir prestadores</strong><small>Cadastros e incidências</small></span><ArrowRight /></Link>
        <Link href="/folhas/2026-06" className="quick-card"><BadgeDollarSign /><span><strong>Auditar memória</strong><small>Bases, eventos e tributos</small></span><ArrowRight /></Link>
        <Link href="/obrigacoes" className="quick-card"><FileCheck2 /><span><strong>Conciliar obrigação</strong><small>Itens e origens do débito</small></span><ArrowRight /></Link>
      </section>
    </AppShell>
  );
}
