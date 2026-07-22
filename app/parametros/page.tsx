import { BookOpenCheck, CalendarClock, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";

const faixas = [
  ["Até R$ 2.428,80", "0%", "R$ 0,00"],
  ["R$ 2.428,81 a R$ 2.826,65", "7,5%", "R$ 182,16"],
  ["R$ 2.826,66 a R$ 3.751,05", "15%", "R$ 394,16"],
  ["R$ 3.751,06 a R$ 4.664,68", "22,5%", "R$ 675,49"],
  ["Acima de R$ 4.664,68", "27,5%", "R$ 908,73"],
];

export default function ParametrosPage() {
  return (
    <AppShell title="Parâmetros" eyebrow="Regras e vigências">
      <section className="rule-summary">
        <article><ShieldCheck /><span><small>Versão ativa</small><strong>2026.01</strong></span><StatusBadge>Publicada</StatusBadge></article>
        <article><CalendarClock /><span><small>Vigência</small><strong>01/01/2026</strong></span></article>
        <article><BookOpenCheck /><span><small>Memória</small><strong>Hash e fonte normativa</strong></span></article>
      </section>
      <section className="settings-grid">
        <article className="panel">
          <div className="panel-header"><div><span className="section-kicker">Previdência</span><h2>Contribuinte individual</h2></div><StatusBadge tone="info">2026</StatusBadge></div>
          <dl className="parameter-list"><div><dt>Alíquota de retenção</dt><dd>11%</dd></div><div><dt>Teto da base</dt><dd>R$ 8.475,55</dd></div><div><dt>Limite da contribuição</dt><dd>R$ 932,31</dd></div><div><dt>Conciliação por pessoa</dt><dd>Ativa</dd></div></dl>
        </article>
        <article className="panel">
          <div className="panel-header"><div><span className="section-kicker">IRRF</span><h2>Deduções mensais</h2></div><StatusBadge tone="info">2026</StatusBadge></div>
          <dl className="parameter-list"><div><dt>Desconto simplificado</dt><dd>R$ 607,20</dd></div><div><dt>Dedução por dependente</dt><dd>R$ 189,59</dd></div><div><dt>Redução integral</dt><dd>Até R$ 5.000</dd></div><div><dt>Redução decrescente</dt><dd>Até R$ 7.350</dd></div></dl>
        </article>
      </section>
      <section className="panel">
        <div className="panel-header"><div><span className="section-kicker">Tabela progressiva</span><h2>Faixas mensais de IRRF</h2></div></div>
        <div className="table-wrap"><table><thead><tr><th>Base de cálculo</th><th>Alíquota</th><th>Parcela a deduzir</th></tr></thead><tbody>{faixas.map((f) => <tr key={f[0]}><td><strong>{f[0]}</strong></td><td>{f[1]}</td><td>{f[2]}</td></tr>)}</tbody></table></div>
      </section>
    </AppShell>
  );
}
