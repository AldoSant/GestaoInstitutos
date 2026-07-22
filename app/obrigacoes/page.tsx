import { AlertTriangle, CheckCircle2, FileWarning, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { analisarConciliacaoPrevidenciaria } from "@/lib/calculos";
import { competencias, moeda } from "@/lib/dados-demo";

export default function ObrigacoesPage() {
  const atual = competencias[0];
  const analise = analisarConciliacaoPrevidenciaria(atual.inss, atual.obrigacao);
  return (
    <AppShell title="Obrigações" eyebrow="Apuração previdenciária">
      <section className="alert-box danger">
        <ShieldAlert size={25} />
        <div><strong>Emissão bloqueada por divergência</strong><p>O protótipo impede a emissão enquanto as parcelas não tiverem tipo e origem comprovados.</p></div>
        <StatusBadge tone="danger">Diferença {moeda(analise.diferenca)}</StatusBadge>
      </section>
      <section className="obligation-grid">
        <article className="panel">
          <div className="panel-header"><div><span className="section-kicker">Conciliação</span><h2>Junho de 2026</h2></div><StatusBadge tone="warning"><AlertTriangle size={14} /> Requer validação</StatusBadge></div>
          <dl className="large-reconciliation">
            <div><dt>INSS dos segurados na folha</dt><dd>{moeda(atual.inss)}</dd><small>26 registros tributados</small></div>
            <div><dt>Total recuperado do legado</dt><dd>{moeda(atual.obrigacao)}</dd><small>52 linhas sem tipo explícito</small></div>
            <div className="danger"><dt>Diferença não explicada</dt><dd>{moeda(analise.diferenca)}</dd><small>Razão encontrada: {analise.razao}×</small></div>
          </dl>
        </article>
        <article className="panel evidence-card">
          <span className="section-kicker">Evidências pendentes</span><h3>O que destrava a apuração</h3>
          <ul className="check-list">
            <li><FileWarning /><span><strong>DARF/GPS efetivamente emitida</strong><small>Documento e código de receita</small></span></li>
            <li><FileWarning /><span><strong>Totalizador da DCTFWeb</strong><small>Débitos por origem e recibo</small></span></li>
            <li><FileWarning /><span><strong>Lançamento contábil</strong><small>Retenção e parcela patronal</small></span></li>
            <li className="done"><CheckCircle2 /><span><strong>Folha e memória individual</strong><small>Já coletadas e reconciliadas</small></span></li>
          </ul>
        </article>
      </section>
      <section className="panel">
        <div className="panel-header"><div><span className="section-kicker">Modelo aprimorado</span><h2>Parcelas exigidas</h2><p>Cada débito deverá ter natureza, base, alíquota e fonte.</p></div></div>
        <div className="type-grid"><div><strong>Segurado</strong><span>Retenção de 11% do contribuinte individual</span></div><div><strong>Patronal</strong><span>Parcela da contratante, quando aplicável</span></div><div><strong>RAT e terceiros</strong><span>Separados por código e enquadramento</span></div><div><strong>Acréscimos e compensações</strong><span>Juros, multa, créditos e ajustes</span></div></div>
      </section>
    </AppShell>
  );
}
